using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Runtime.Intrinsics;
using System.Runtime.Intrinsics.X86;
using SSW.Benchmarks.SimdAvx2.Abstractions;
using SSW.Benchmarks.SimdAvx2.Implementations.Scalar;
using SSW.Benchmarks.SimdAvx2.Implementations.Simd.Stage2SingleAgent;

namespace SSW.Benchmarks.SimdAvx2.Implementations.Simd.Stage3Collaboration;

/// <summary>
/// <see cref="MultiplyAddAvx2RangeSumCalculator"/>와 계산은 같고, 앞쪽 캐시 줄을 미리 읽어 두는 구현입니다.
/// <c>unsafe</c> 키워드와 포인터 없이 <c>ref</c>만 씁니다. 프리페치 명령(<c>Sse.Prefetch0</c>)은 포인터만 받으므로,
/// 대신 앞쪽 바이트 하나를 실제로 읽어(<c>Volatile.Read</c>) 그 캐시 줄을 요청합니다.
/// 실제 읽기라서 배열 밖을 읽지 않도록 끝의 열여섯 블록은 미리 읽기 없이 처리합니다.
/// 미리 읽는 방식은 <see cref="PairedPrefetchMultiplyAddAvx2RangeSumCalculator"/>와 같습니다. 캐시 줄을 128바이트 짝으로 보고,
/// 짝의 앞 줄은 멀리(<see cref="FarDistance"/>)에서 읽어 L2 인접 줄 프리페처가 뒷줄까지 가져오게 하고,
/// 뒷줄은 이미 L2에 와 있을 가까운 거리(<see cref="NearDistance"/>)에서 읽어 L1으로 올립니다.
/// 배열은 고정(pin)하지 않으므로 GC가 옮기면 짝 경계가 어긋날 수 있습니다. 결과는 같고 속도만 잠깐 달라집니다.
/// </summary>
public sealed class PairedLookaheadMultiplyAddAvx2RangeSumCalculator : IRangeSumCalculator
{
    /// <summary>짝의 앞 줄을 미리 읽는 거리입니다. 4 KB 페이지 하나입니다.</summary>
    internal const int FarDistance = 4096;

    /// <summary>짝의 뒷줄을 L1으로 올리는 거리입니다.</summary>
    internal const int NearDistance = 1024;

    private const int PairSize = 128;
    private const int LineSize = 64;
    private const int BlockSize = MultiplyAddAvx2RangeSumCalculator.BlockSize;
    private const int FlushInterval = MultiplyAddAvx2RangeSumCalculator.FlushInterval;

    /// <summary>가장 먼 읽기(앞 줄 거리 + 짝 하나)가 배열 안에 머물도록 미리 읽기를 빼는 끝쪽 블록 수입니다.</summary>
    private const int TailBlocks = FarDistance / BlockSize;

    private readonly IRangeSumCalculator _fallback;

    /// <summary>기본 fallback은 조건 분기 scalar 구현입니다.</summary>
    public PairedLookaheadMultiplyAddAvx2RangeSumCalculator(IRangeSumCalculator? fallback = null)
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
            rest = Avx2.Add(rest, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index), bias, limit));
        }

        Vector256<long> negative = MultiplyAddAvx2RangeSumCalculator.Widen(Avx2.MultiplyAddAdjacent(rest, Vector256<short>.One));
        nuint blocks = (end - index) / BlockSize;
        nuint blockEnd = index + (blocks * BlockSize);
        nuint aheadEnd = blocks > TailBlocks ? blockEnd - (TailBlocks * BlockSize) : index;

        while (index < aheadEnd)
        {
            nuint chunkEnd = Math.Min(aheadEnd, index + (FlushInterval * BlockSize));
            Vector256<short> sum0 = Vector256<short>.Zero, sum1 = Vector256<short>.Zero;
            Vector256<short> sum2 = Vector256<short>.Zero, sum3 = Vector256<short>.Zero;
            Vector256<short> sum4 = Vector256<short>.Zero, sum5 = Vector256<short>.Zero;
            Vector256<short> sum6 = Vector256<short>.Zero, sum7 = Vector256<short>.Zero;
            for (; index < chunkEnd; index += BlockSize)
            {
                _ = Volatile.Read(ref Unsafe.Add(ref first, index + FarDistance));
                _ = Volatile.Read(ref Unsafe.Add(ref first, index + (FarDistance + PairSize)));
                _ = Volatile.Read(ref Unsafe.Add(ref first, index + (NearDistance + LineSize)));
                _ = Volatile.Read(ref Unsafe.Add(ref first, index + (NearDistance + LineSize + PairSize)));
                sum0 = Avx2.Add(sum0, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index), bias, limit));
                sum1 = Avx2.Add(sum1, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 32), bias, limit));
                sum2 = Avx2.Add(sum2, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 64), bias, limit));
                sum3 = Avx2.Add(sum3, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 96), bias, limit));
                sum4 = Avx2.Add(sum4, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 128), bias, limit));
                sum5 = Avx2.Add(sum5, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 160), bias, limit));
                sum6 = Avx2.Add(sum6, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 192), bias, limit));
                sum7 = Avx2.Add(sum7, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 224), bias, limit));
            }

            negative = Avx2.Add(negative, MultiplyAddAvx2RangeSumCalculator.Widen(sum0, sum1, sum2, sum3, sum4, sum5, sum6, sum7));
        }

        // 끝쪽 블록은 미리 읽기 없이 처리합니다. 열여섯 개 이하라 16비트 칸이 넘치지 않습니다.
        Vector256<short> tail0 = Vector256<short>.Zero, tail1 = Vector256<short>.Zero;
        Vector256<short> tail2 = Vector256<short>.Zero, tail3 = Vector256<short>.Zero;
        Vector256<short> tail4 = Vector256<short>.Zero, tail5 = Vector256<short>.Zero;
        Vector256<short> tail6 = Vector256<short>.Zero, tail7 = Vector256<short>.Zero;
        for (; index < blockEnd; index += BlockSize)
        {
            tail0 = Avx2.Add(tail0, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index), bias, limit));
            tail1 = Avx2.Add(tail1, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 32), bias, limit));
            tail2 = Avx2.Add(tail2, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 64), bias, limit));
            tail3 = Avx2.Add(tail3, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 96), bias, limit));
            tail4 = Avx2.Add(tail4, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 128), bias, limit));
            tail5 = Avx2.Add(tail5, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 160), bias, limit));
            tail6 = Avx2.Add(tail6, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 192), bias, limit));
            tail7 = Avx2.Add(tail7, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index + 224), bias, limit));
        }

        negative = Avx2.Add(negative, MultiplyAddAvx2RangeSumCalculator.Widen(tail0, tail1, tail2, tail3, tail4, tail5, tail6, tail7));

        // 블록에 못 미치는 벡터는 일곱 개 이하라 16비트 칸 하나로 모아도 넘치지 않습니다.
        rest = Vector256<short>.Zero;
        for (; index < end; index += 32)
        {
            rest = Avx2.Add(rest, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Vector256.LoadUnsafe(ref first, index), bias, limit));
        }

        negative = Avx2.Add(negative, MultiplyAddAvx2RangeSumCalculator.Widen(Avx2.MultiplyAddAdjacent(rest, Vector256<short>.One)));
        return total - Vector256.Sum(negative);
    }
}
