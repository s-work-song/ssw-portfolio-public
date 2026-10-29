using System.Runtime.Intrinsics;
using System.Runtime.Intrinsics.X86;
using SSW.Benchmarks.SimdAvx2.Abstractions;
using SSW.Benchmarks.SimdAvx2.Implementations.Scalar;

namespace SSW.Benchmarks.SimdAvx2.Implementations.Simd;

/// <summary>
/// <see cref="MultiplyAddAvx2RangeSumCalculator"/>에 소프트웨어 프리페치(PREFETCHT0)를 더한 구현입니다.
/// 하드웨어 프리페처는 4KB 페이지 경계를 넘어 미리 읽지 않으므로, 입력이 L2 캐시보다 크면 페이지마다 읽기 대기가 생깁니다.
/// 반복마다 <see cref="PrefetchDistance"/>바이트 앞의 캐시 줄 네 개를 미리 요청해 그 대기를 줄입니다.
/// .NET 8의 <c>Sse.Prefetch0</c>는 포인터만 받으므로, 이 저장소의 구현 중 이 구현만 <c>unsafe</c> 코드를 씁니다.
/// 프리페치 거리는 i5-9600K(L2 256 KB)에서 1 MiB 입력으로 잰 결과로 고른 값이라 다른 CPU에서는 최적이 아닐 수 있습니다.
/// 프리페치는 힌트라서 배열 끝을 넘는 주소를 요청해도 예외가 나지 않습니다.
/// 예전에 손으로 짠 다른 구현과 달리, 이 구현은 에이전트와 함께 한계까지 다듬은 버전입니다.
/// </summary>
public sealed unsafe class PrefetchMultiplyAddAvx2RangeSumCalculator : IRangeSumCalculator
{
    /// <summary>미리 읽을 거리입니다. 반복 여덟 번 분량입니다.</summary>
    internal const int PrefetchDistance = 2048;

    private const int BlockSize = MultiplyAddAvx2RangeSumCalculator.BlockSize;
    private const int FlushInterval = MultiplyAddAvx2RangeSumCalculator.FlushInterval;
    private readonly IRangeSumCalculator _fallback;

    /// <summary>기본 fallback은 조건 분기 scalar 구현입니다.</summary>
    public PrefetchMultiplyAddAvx2RangeSumCalculator(IRangeSumCalculator? fallback = null)
    {
        _fallback = fallback ?? new BranchedRangeSumCalculator();
    }

    /// <inheritdoc />
    public long Sum(ReadOnlyMemory<byte> source, ByteRange range)
    {
        range.EnsureValid();
        if (!Avx2.IsSupported || MultiplyAddAvx2RangeSumCalculator.IsFullRange(range))
        {
            // 전체 범위는 프리페치로 얻을 것이 없는 드문 경우라 프리페치 없는 구현에 맡깁니다.
            return new MultiplyAddAvx2RangeSumCalculator(_fallback).Sum(source, range);
        }

        ReadOnlySpan<byte> values = source.Span;
        fixed (byte* start = values)
        {
            int head = MultiplyAddAvx2RangeSumCalculator.AlignedStart((nint)start, values.Length);
            int vectorEnd = head + ((values.Length - head) / Vector256<byte>.Count * Vector256<byte>.Count);
            long total = _fallback.Sum(source[..head], range) + _fallback.Sum(source[vectorEnd..], range);

            Vector256<byte> bias = MultiplyAddAvx2RangeSumCalculator.RangeBias(range);
            Vector256<sbyte> limit = MultiplyAddAvx2RangeSumCalculator.RangeLimit(range);
            byte* current = start + head;
            byte* blockEnd = current + ((vectorEnd - head) / BlockSize * BlockSize);
            byte* end = start + vectorEnd;
            Vector256<long> negative = Vector256<long>.Zero;

            while (current < blockEnd)
            {
                byte* chunkEnd = blockEnd - current > FlushInterval * BlockSize ? current + (FlushInterval * BlockSize) : blockEnd;
                Vector256<short> sum0 = Vector256<short>.Zero, sum1 = Vector256<short>.Zero;
                Vector256<short> sum2 = Vector256<short>.Zero, sum3 = Vector256<short>.Zero;
                Vector256<short> sum4 = Vector256<short>.Zero, sum5 = Vector256<short>.Zero;
                Vector256<short> sum6 = Vector256<short>.Zero, sum7 = Vector256<short>.Zero;
                for (; current < chunkEnd; current += BlockSize)
                {
                    byte* ahead = current + PrefetchDistance;
                    Sse.Prefetch0(ahead);
                    Sse.Prefetch0(ahead + 64);
                    Sse.Prefetch0(ahead + 128);
                    Sse.Prefetch0(ahead + 192);
                    sum0 = Avx2.Add(sum0, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(current), bias, limit));
                    sum1 = Avx2.Add(sum1, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(current + 32), bias, limit));
                    sum2 = Avx2.Add(sum2, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(current + 64), bias, limit));
                    sum3 = Avx2.Add(sum3, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(current + 96), bias, limit));
                    sum4 = Avx2.Add(sum4, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(current + 128), bias, limit));
                    sum5 = Avx2.Add(sum5, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(current + 160), bias, limit));
                    sum6 = Avx2.Add(sum6, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(current + 192), bias, limit));
                    sum7 = Avx2.Add(sum7, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(current + 224), bias, limit));
                }

                negative = Avx2.Add(negative, MultiplyAddAvx2RangeSumCalculator.Widen(sum0, sum1, sum2, sum3, sum4, sum5, sum6, sum7));
            }

            Vector256<short> rest = Vector256<short>.Zero;
            for (; current < end; current += 32)
            {
                rest = Avx2.Add(rest, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(current), bias, limit));
            }

            negative = Avx2.Add(negative, MultiplyAddAvx2RangeSumCalculator.Widen(Avx2.MultiplyAddAdjacent(rest, Vector256<short>.One)));
            return total - Vector256.Sum(negative);
        }
    }
}
