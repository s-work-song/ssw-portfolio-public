using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.Intrinsics;
using System.Runtime.Intrinsics.X86;
using SSW.Benchmarks.SimdAvx2.Abstractions;
using SSW.Benchmarks.SimdAvx2.Implementations.Scalar;
using SSW.Benchmarks.SimdAvx2.Implementations.Simd.Stage2SingleAgent;

namespace SSW.Benchmarks.SimdAvx2.Implementations.Simd.Stage3Collaboration;

/// <summary>
/// <see cref="PairedLookaheadMultiplyAddAvx2RangeSumCalculator"/>와 미리 읽는 방식·거리·계산이 모두 같고,
/// 한 반복에서 블록 두 개(512 B)를 처리하도록 루프만 풀어 쓴 구현입니다. <c>unsafe</c> 키워드와 포인터는 없습니다.
/// 미리 읽기는 블록마다 그 블록 몫을 따로 냅니다. 반복 맨 앞에 몰아서 내면 오히려 느려집니다.
/// 실제 읽기는 값이 올 때까지 뒤 명령의 마무리를 막으므로, 한꺼번에 내면 그 대기 시간에 계산을 겹치지 못하기 때문입니다.
/// i5-9600K에서 1 MiB 입력으로 잰 결과 블록 하나짜리 루프보다 약 5% 빨랐습니다. 블록을 셋·넷·여덟으로 더 풀면 이득이 없었습니다.
/// 읽기 명령마다 주소 보폭이 512 B가 되어 L1의 보폭 프리페처가 다음 반복의 줄을 먼저 요청해 주는 것으로 짐작하지만 확인하지는 못했습니다.
/// </summary>
public sealed class UnrolledPairedLookaheadMultiplyAddAvx2RangeSumCalculator : IRangeSumCalculator
{
    /// <summary>짝의 앞 줄을 미리 읽는 거리입니다. 4 KB 페이지 하나입니다.</summary>
    internal const int FarDistance = PairedLookaheadMultiplyAddAvx2RangeSumCalculator.FarDistance;

    /// <summary>짝의 뒷줄을 L1으로 올리는 거리입니다.</summary>
    internal const int NearDistance = PairedLookaheadMultiplyAddAvx2RangeSumCalculator.NearDistance;

    private const int PairSize = 128;
    private const int LineSize = 64;
    private const int BlockSize = MultiplyAddAvx2RangeSumCalculator.BlockSize;

    /// <summary>한 반복에서 처리하는 바이트 수입니다. 블록 두 개입니다.</summary>
    private const int StepSize = 2 * BlockSize;

    /// <summary>누적 벡터마다 반복당 두 번 더하므로 넓히는 간격도 절반입니다.</summary>
    private const int StepsPerFlush = MultiplyAddAvx2RangeSumCalculator.FlushInterval / 2;

    private readonly IRangeSumCalculator _fallback;

    /// <summary>기본 fallback은 조건 분기 scalar 구현입니다.</summary>
    public UnrolledPairedLookaheadMultiplyAddAvx2RangeSumCalculator(IRangeSumCalculator? fallback = null)
    {
        _fallback = fallback ?? new BranchedRangeSumCalculator();
    }

    /// <inheritdoc />
    public long Sum(ReadOnlyMemory<byte> source, ByteRange range)
    {
        range.EnsureValid();
        if (!Avx2.IsSupported || MultiplyAddAvx2RangeSumCalculator.IsFullRange(range))
        {
            return new MultiplyAddAvx2RangeSumCalculator(_fallback).Sum(source, range);
        }

        ReadOnlySpan<byte> values = source.Span;
        ref byte first = ref MemoryMarshal.GetReference(values);
        nint address = Unsafe.ByteOffset(ref Unsafe.NullRef<byte>(), ref first);
        int head = MultiplyAddAvx2RangeSumCalculator.AlignedStart(address, values.Length);
        int vectorEnd = head + ((values.Length - head) / Vector256<byte>.Count * Vector256<byte>.Count);
        long total = _fallback.Sum(source[..head], range) + _fallback.Sum(source[vectorEnd..], range);

        Vector256<byte> bias = MultiplyAddAvx2RangeSumCalculator.RangeBias(range);
        Vector256<sbyte> limit = MultiplyAddAvx2RangeSumCalculator.RangeLimit(range);
        nuint index = (nuint)head;
        nuint end = (nuint)vectorEnd;

        // 블록이 캐시 줄 짝의 경계에서 시작하도록 벡터 세 개 이하를 먼저 처리합니다.
        Vector256<short> rest = Vector256<short>.Zero;
        for (; index < end && (((nuint)address + index) & (PairSize - 1)) != 0; index += 32)
        {
            rest = Avx2.Add(rest, Pairs(ref first, index, bias, limit));
        }

        Vector256<long> negative = MultiplyAddAvx2RangeSumCalculator.Widen(Avx2.MultiplyAddAdjacent(rest, Vector256<short>.One));

        // 실제 읽기라서 배열 밖을 읽으면 안 됩니다. 가장 먼 읽기는 index + FarDistance + StepSize - PairSize 이므로,
        // 그 읽기가 배열 안에 머무는 반복까지만 미리 읽기를 씁니다.
        nuint aheadEnd = end - index > FarDistance ? index + ((end - index - FarDistance) / StepSize * StepSize) : index;
        nuint blockEnd = index + ((end - index) / BlockSize * BlockSize);

        while (index < aheadEnd)
        {
            nuint chunkEnd = Math.Min(aheadEnd, index + (StepsPerFlush * StepSize));
            Vector256<short> sum0 = Vector256<short>.Zero, sum1 = Vector256<short>.Zero;
            Vector256<short> sum2 = Vector256<short>.Zero, sum3 = Vector256<short>.Zero;
            Vector256<short> sum4 = Vector256<short>.Zero, sum5 = Vector256<short>.Zero;
            Vector256<short> sum6 = Vector256<short>.Zero, sum7 = Vector256<short>.Zero;
            for (; index < chunkEnd; index += StepSize)
            {
                // 첫째 블록 몫: 짝 두 개의 앞 줄은 멀리, 뒷줄은 가까이.
                _ = Volatile.Read(ref Unsafe.Add(ref first, index + FarDistance));
                _ = Volatile.Read(ref Unsafe.Add(ref first, index + (FarDistance + PairSize)));
                _ = Volatile.Read(ref Unsafe.Add(ref first, index + (NearDistance + LineSize)));
                _ = Volatile.Read(ref Unsafe.Add(ref first, index + (NearDistance + LineSize + PairSize)));
                sum0 = Avx2.Add(sum0, Pairs(ref first, index, bias, limit));
                sum1 = Avx2.Add(sum1, Pairs(ref first, index + 32, bias, limit));
                sum2 = Avx2.Add(sum2, Pairs(ref first, index + 64, bias, limit));
                sum3 = Avx2.Add(sum3, Pairs(ref first, index + 96, bias, limit));
                sum4 = Avx2.Add(sum4, Pairs(ref first, index + 128, bias, limit));
                sum5 = Avx2.Add(sum5, Pairs(ref first, index + 160, bias, limit));
                sum6 = Avx2.Add(sum6, Pairs(ref first, index + 192, bias, limit));
                sum7 = Avx2.Add(sum7, Pairs(ref first, index + 224, bias, limit));

                // 둘째 블록 몫.
                _ = Volatile.Read(ref Unsafe.Add(ref first, index + (BlockSize + FarDistance)));
                _ = Volatile.Read(ref Unsafe.Add(ref first, index + (BlockSize + FarDistance + PairSize)));
                _ = Volatile.Read(ref Unsafe.Add(ref first, index + (BlockSize + NearDistance + LineSize)));
                _ = Volatile.Read(ref Unsafe.Add(ref first, index + (BlockSize + NearDistance + LineSize + PairSize)));
                sum0 = Avx2.Add(sum0, Pairs(ref first, index + (BlockSize + 0), bias, limit));
                sum1 = Avx2.Add(sum1, Pairs(ref first, index + (BlockSize + 32), bias, limit));
                sum2 = Avx2.Add(sum2, Pairs(ref first, index + (BlockSize + 64), bias, limit));
                sum3 = Avx2.Add(sum3, Pairs(ref first, index + (BlockSize + 96), bias, limit));
                sum4 = Avx2.Add(sum4, Pairs(ref first, index + (BlockSize + 128), bias, limit));
                sum5 = Avx2.Add(sum5, Pairs(ref first, index + (BlockSize + 160), bias, limit));
                sum6 = Avx2.Add(sum6, Pairs(ref first, index + (BlockSize + 192), bias, limit));
                sum7 = Avx2.Add(sum7, Pairs(ref first, index + (BlockSize + 224), bias, limit));
            }

            negative = Avx2.Add(negative, MultiplyAddAvx2RangeSumCalculator.Widen(sum0, sum1, sum2, sum3, sum4, sum5, sum6, sum7));
        }

        // 끝쪽 블록은 미리 읽기 없이 처리합니다. 열일곱 개 이하라 16비트 칸이 넘치지 않습니다.
        Vector256<short> tail0 = Vector256<short>.Zero, tail1 = Vector256<short>.Zero;
        Vector256<short> tail2 = Vector256<short>.Zero, tail3 = Vector256<short>.Zero;
        Vector256<short> tail4 = Vector256<short>.Zero, tail5 = Vector256<short>.Zero;
        Vector256<short> tail6 = Vector256<short>.Zero, tail7 = Vector256<short>.Zero;
        for (; index < blockEnd; index += BlockSize)
        {
            tail0 = Avx2.Add(tail0, Pairs(ref first, index, bias, limit));
            tail1 = Avx2.Add(tail1, Pairs(ref first, index + 32, bias, limit));
            tail2 = Avx2.Add(tail2, Pairs(ref first, index + 64, bias, limit));
            tail3 = Avx2.Add(tail3, Pairs(ref first, index + 96, bias, limit));
            tail4 = Avx2.Add(tail4, Pairs(ref first, index + 128, bias, limit));
            tail5 = Avx2.Add(tail5, Pairs(ref first, index + 160, bias, limit));
            tail6 = Avx2.Add(tail6, Pairs(ref first, index + 192, bias, limit));
            tail7 = Avx2.Add(tail7, Pairs(ref first, index + 224, bias, limit));
        }

        negative = Avx2.Add(negative, MultiplyAddAvx2RangeSumCalculator.Widen(tail0, tail1, tail2, tail3, tail4, tail5, tail6, tail7));

        // 블록에 못 미치는 벡터는 일곱 개 이하라 16비트 칸 하나로 모아도 넘치지 않습니다.
        rest = Vector256<short>.Zero;
        for (; index < end; index += 32)
        {
            rest = Avx2.Add(rest, Pairs(ref first, index, bias, limit));
        }

        negative = Avx2.Add(negative, MultiplyAddAvx2RangeSumCalculator.Widen(Avx2.MultiplyAddAdjacent(rest, Vector256<short>.One)));
        return total - Vector256.Sum(negative);
    }

    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    private static Vector256<short> Pairs(ref byte first, nuint index, Vector256<byte> bias, Vector256<sbyte> limit) =>
        MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index), bias, limit);
}
