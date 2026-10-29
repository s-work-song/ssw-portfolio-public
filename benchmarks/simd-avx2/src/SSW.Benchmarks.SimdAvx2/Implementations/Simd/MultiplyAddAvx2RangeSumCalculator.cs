using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.Intrinsics;
using System.Runtime.Intrinsics.X86;
using SSW.Benchmarks.SimdAvx2.Abstractions;
using SSW.Benchmarks.SimdAvx2.Implementations.Scalar;

namespace SSW.Benchmarks.SimdAvx2.Implementations.Simd;

/// <summary>
/// 범위 검사와 합산을 벡터당 AVX2 명령 네 개로 줄인 구현입니다.
/// <c>unsafe</c> 키워드와 포인터 없이 <c>ref</c>와 <c>Vector256.LoadUnsafe</c>만 씁니다.
/// 언롤링 구현은 벡터마다 Max·Min·CompareEqual 두 쌍과 AND 두 번, SAD, 덧셈으로 명령 여덟 개를 씁니다. 이 구현은 다음 방법으로 그 수를 줄입니다.
/// <list type="number">
/// <item>값에 <c>0x80 - 최솟값</c>을 더하면 범위가 부호 있는 바이트의 맨 아래 구간으로 옮겨져, 부호 있는 비교 한 번으로 범위 안인지 알 수 있습니다.</item>
/// <item>범위 마스크(-1 또는 0)를 <c>vpmaddubsw</c>로 값과 곱하면 이웃한 두 바이트의 합이 음수로 16비트 칸에 모입니다. AND와 SAD 두 명령이 하나로 줄어듭니다.</item>
/// <item>16비트 칸은 <see cref="FlushInterval"/>번 반복마다 64비트 누적값으로 넓혀 넘치지 않게 합니다.</item>
/// <item>배열 앞부분을 scalar로 처리해 벡터 읽기를 32바이트 경계에 맞추고, 누적 벡터 여덟 개로 덧셈끼리 기다리지 않게 합니다.</item>
/// </list>
/// 예전에 손으로 짠 다른 구현과 달리, 이 구현은 에이전트와 함께 한계까지 다듬은 버전입니다.
/// AVX2가 없는 환경에서는 기준 scalar 구현으로 의미를 보존합니다.
/// </summary>
public sealed class MultiplyAddAvx2RangeSumCalculator : IRangeSumCalculator
{
    /// <summary>16비트 칸에는 반복마다 최대 510(255 + 255)이 쌓이므로 64번(32,640)까지는 넘치지 않습니다.</summary>
    internal const int FlushInterval = 64;

    /// <summary>한 반복에서 처리하는 바이트 수입니다. 벡터 여덟 개입니다.</summary>
    internal const int BlockSize = 256;

    private readonly IRangeSumCalculator _fallback;

    /// <summary>기본 fallback은 조건 분기 scalar 구현입니다.</summary>
    public MultiplyAddAvx2RangeSumCalculator(IRangeSumCalculator? fallback = null)
    {
        _fallback = fallback ?? new BranchedRangeSumCalculator();
    }

    /// <inheritdoc />
    public long Sum(ReadOnlyMemory<byte> source, ByteRange range)
    {
        range.EnsureValid();
        if (!Avx2.IsSupported)
        {
            return _fallback.Sum(source, range);
        }

        ReadOnlySpan<byte> values = source.Span;
        ref byte first = ref MemoryMarshal.GetReference(values);
        // 배열은 고정(pin)하지 않으므로 GC가 옮기면 정렬이 어긋날 수 있습니다. 결과는 같고 속도만 잠깐 달라집니다.
        int head = AlignedStart(Unsafe.ByteOffset(ref Unsafe.NullRef<byte>(), ref first), values.Length);
        int vectorEnd = head + ((values.Length - head) / Vector256<byte>.Count * Vector256<byte>.Count);
        long total = _fallback.Sum(source[..head], range) + _fallback.Sum(source[vectorEnd..], range);

        if (IsFullRange(range))
        {
            return total + SumAllVectors(ref first, (nuint)head, (nuint)vectorEnd);
        }

        Vector256<byte> bias = RangeBias(range);
        Vector256<sbyte> limit = RangeLimit(range);
        nuint index = (nuint)head;
        nuint blockEnd = index + (((nuint)vectorEnd - index) / BlockSize * BlockSize);
        Vector256<long> negative = Vector256<long>.Zero;

        while (index < blockEnd)
        {
            nuint chunkEnd = Math.Min(blockEnd, index + (FlushInterval * BlockSize));
            Vector256<short> sum0 = Vector256<short>.Zero, sum1 = Vector256<short>.Zero;
            Vector256<short> sum2 = Vector256<short>.Zero, sum3 = Vector256<short>.Zero;
            Vector256<short> sum4 = Vector256<short>.Zero, sum5 = Vector256<short>.Zero;
            Vector256<short> sum6 = Vector256<short>.Zero, sum7 = Vector256<short>.Zero;
            for (; index < chunkEnd; index += BlockSize)
            {
                sum0 = Avx2.Add(sum0, NegativePairSums(Vector256.LoadUnsafe(ref first, index), bias, limit));
                sum1 = Avx2.Add(sum1, NegativePairSums(Vector256.LoadUnsafe(ref first, index + 32), bias, limit));
                sum2 = Avx2.Add(sum2, NegativePairSums(Vector256.LoadUnsafe(ref first, index + 64), bias, limit));
                sum3 = Avx2.Add(sum3, NegativePairSums(Vector256.LoadUnsafe(ref first, index + 96), bias, limit));
                sum4 = Avx2.Add(sum4, NegativePairSums(Vector256.LoadUnsafe(ref first, index + 128), bias, limit));
                sum5 = Avx2.Add(sum5, NegativePairSums(Vector256.LoadUnsafe(ref first, index + 160), bias, limit));
                sum6 = Avx2.Add(sum6, NegativePairSums(Vector256.LoadUnsafe(ref first, index + 192), bias, limit));
                sum7 = Avx2.Add(sum7, NegativePairSums(Vector256.LoadUnsafe(ref first, index + 224), bias, limit));
            }

            negative = Avx2.Add(negative, Widen(sum0, sum1, sum2, sum3, sum4, sum5, sum6, sum7));
        }

        // 블록에 못 미치는 벡터는 일곱 개 이하라 16비트 칸 하나로 모아도 넘치지 않습니다.
        Vector256<short> rest = Vector256<short>.Zero;
        for (; index < (nuint)vectorEnd; index += 32)
        {
            rest = Avx2.Add(rest, NegativePairSums(Vector256.LoadUnsafe(ref first, index), bias, limit));
        }

        negative = Avx2.Add(negative, Widen(Avx2.MultiplyAddAdjacent(rest, Vector256<short>.One)));
        return total - Vector256.Sum(negative);
    }

    /// <summary>벡터 읽기가 32바이트 경계에서 시작하도록 scalar로 먼저 처리할 바이트 수를 구합니다.</summary>
    internal static int AlignedStart(nint address, int length)
    {
        int peel = (int)((Vector256<byte>.Count - (address & (Vector256<byte>.Count - 1))) & (Vector256<byte>.Count - 1));
        return Math.Min(peel, length);
    }

    /// <summary>0~255 전체 범위는 비교 한계값이 부호 있는 바이트를 넘으므로 마스크 없이 따로 더합니다.</summary>
    internal static bool IsFullRange(ByteRange range) => range.Minimum == byte.MinValue && range.Maximum == byte.MaxValue;

    /// <summary>값에 더하면 범위의 최솟값이 부호 있는 바이트의 최솟값(-128)으로 옮겨지는 수입니다.</summary>
    internal static Vector256<byte> RangeBias(ByteRange range) => Vector256.Create((byte)(0x80 - range.Minimum));

    /// <summary>옮긴 값이 이 수보다 작으면 범위 안입니다. 전체 범위가 아니면 -127~127 안에 있습니다.</summary>
    internal static Vector256<sbyte> RangeLimit(ByteRange range) => Vector256.Create((sbyte)(range.Maximum - range.Minimum - 127));

    /// <summary>범위 안 바이트만 남겨 이웃한 두 바이트의 합을 음수로 16비트 칸에 담습니다.</summary>
    internal static Vector256<short> NegativePairSums(Vector256<byte> value, Vector256<byte> bias, Vector256<sbyte> limit)
    {
        Vector256<sbyte> inRange = Avx2.CompareGreaterThan(limit, Avx2.Add(value, bias).AsSByte());
        return Avx2.MultiplyAddAdjacent(value, inRange);
    }

    /// <summary>16비트 누적 벡터 여덟 개를 64비트 레인으로 넓혀 더합니다. 32비트 단계의 합은 522,240을 넘지 않습니다.</summary>
    internal static Vector256<long> Widen(
        Vector256<short> sum0, Vector256<short> sum1, Vector256<short> sum2, Vector256<short> sum3,
        Vector256<short> sum4, Vector256<short> sum5, Vector256<short> sum6, Vector256<short> sum7)
    {
        Vector256<short> one = Vector256<short>.One;
        Vector256<int> low = Avx2.Add(
            Avx2.Add(Avx2.MultiplyAddAdjacent(sum0, one), Avx2.MultiplyAddAdjacent(sum1, one)),
            Avx2.Add(Avx2.MultiplyAddAdjacent(sum2, one), Avx2.MultiplyAddAdjacent(sum3, one)));
        Vector256<int> high = Avx2.Add(
            Avx2.Add(Avx2.MultiplyAddAdjacent(sum4, one), Avx2.MultiplyAddAdjacent(sum5, one)),
            Avx2.Add(Avx2.MultiplyAddAdjacent(sum6, one), Avx2.MultiplyAddAdjacent(sum7, one)));
        return Widen(Avx2.Add(low, high));
    }

    internal static Vector256<long> Widen(Vector256<int> value) =>
        Avx2.Add(Avx2.ConvertToVector256Int64(value.GetLower()), Avx2.ConvertToVector256Int64(value.GetUpper()));

    private static long SumAllVectors(ref byte first, nuint index, nuint vectorEnd)
    {
        Vector256<ulong> total = Vector256<ulong>.Zero;
        for (; index < vectorEnd; index += 32)
        {
            total = Avx2.Add(total, Avx2.SumAbsoluteDifferences(Vector256.LoadUnsafe(ref first, index), Vector256<byte>.Zero).AsUInt64());
        }

        return (long)Vector256.Sum(total);
    }
}
