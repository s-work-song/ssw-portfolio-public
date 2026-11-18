using System.Runtime.Intrinsics;
using System.Runtime.Intrinsics.X86;
using SSW.Benchmarks.SimdAvx2.Abstractions;
using SSW.Benchmarks.SimdAvx2.Implementations.Scalar;
using SSW.Benchmarks.SimdAvx2.Implementations.Simd.Stage2SingleAgent;

namespace SSW.Benchmarks.SimdAvx2.Implementations.Simd.Stage3Collaboration;

/// <summary>
/// <see cref="PrefetchMultiplyAddAvx2RangeSumCalculator"/>와 계산은 같고, 프리페치를 거는 방식만 바꾼 구현입니다.
/// 기준 구현은 블록의 캐시 줄 네 개 모두에 같은 거리로 PREFETCHT0를 겁니다. 프리페치도 L1 미스라서 줄마다 채움 버퍼(LFB)를
/// L3에서 줄이 올 때까지 하나씩 물고 있고, 이 버퍼 수가 한 번에 오가는 줄 수를 묶습니다.
/// 이 구현은 캐시 줄을 128바이트 짝으로 보고 두 줄을 다르게 다룹니다.
/// <list type="number">
/// <item>짝의 앞 줄은 멀리(<see cref="FarDistance"/>)에서 미리 요청합니다. L2의 인접 줄 프리페처가 짝을 이루는 뒷줄을 L2까지 함께 가져오는데, 이 요청은 채움 버퍼를 쓰지 않습니다.</item>
/// <item>짝의 뒷줄은 가까이(<see cref="NearDistance"/>)에서 요청합니다. 보통 이미 L2에 와 있어 채움 버퍼를 짧게만 쓰고 L1으로 올라옵니다. 인접 줄 프리페처가 놓친 줄은 여기서 L3 요청이 나갑니다.</item>
/// </list>
/// 같은 채움 버퍼로 더 많은 줄이 동시에 오가게 되어, 입력이 L2보다 클 때 읽기 대기가 줄어듭니다.
/// 두 거리는 i5-9600K(L2 256 KB)에서 1 MiB 입력으로 잰 결과로 고른 값이라 다른 CPU에서는 최적이 아닐 수 있습니다.
/// 인접 줄 프리페처가 꺼져 있거나 없는 CPU에서는 뒷줄 요청이 그대로 L3 요청이 되므로 결과는 같고 이득만 줄어듭니다.
/// 프리페치는 힌트라서 배열 끝을 넘는 주소를 요청해도 예외가 나지 않습니다.
/// </summary>
public sealed unsafe class PairedPrefetchMultiplyAddAvx2RangeSumCalculator : IRangeSumCalculator
{
    /// <summary>짝의 앞 줄을 미리 요청하는 거리입니다. 4 KB 페이지 하나입니다.</summary>
    internal const int FarDistance = 4096;

    /// <summary>짝의 뒷줄을 L1으로 올리는 거리입니다. 앞 줄 요청이 도착하고 난 뒤가 되도록 훨씬 가깝게 둡니다.</summary>
    internal const int NearDistance = 1024;

    /// <summary>인접 줄 프리페처가 한 묶음으로 보는 크기입니다. 캐시 줄 두 개입니다.</summary>
    private const int PairSize = 128;

    private const int LineSize = 64;
    private const int BlockSize = MultiplyAddAvx2RangeSumCalculator.BlockSize;
    private const int FlushInterval = MultiplyAddAvx2RangeSumCalculator.FlushInterval;
    private readonly IRangeSumCalculator _fallback;

    /// <summary>기본 fallback은 조건 분기 scalar 구현입니다.</summary>
    public PairedPrefetchMultiplyAddAvx2RangeSumCalculator(IRangeSumCalculator? fallback = null)
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
            byte* end = start + vectorEnd;

            // 블록이 캐시 줄 짝의 경계에서 시작하도록 벡터 세 개 이하를 먼저 처리합니다.
            Vector256<short> rest = Vector256<short>.Zero;
            for (; current < end && ((nuint)current & (PairSize - 1)) != 0; current += 32)
            {
                rest = Avx2.Add(rest, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(current), bias, limit));
            }

            Vector256<long> negative = MultiplyAddAvx2RangeSumCalculator.Widen(Avx2.MultiplyAddAdjacent(rest, Vector256<short>.One));

            // .NET 8 JIT는 prefetcht0에 주소 식을 접지 못하고 lea를 따로 냅니다. 그래서 요청할 주소 네 개를 루프 변수로 들고 다니고,
            // 지금 읽을 주소는 앞 줄 요청 주소에서 상수를 빼서 구합니다. 이러면 읽기 주소는 명령 안에 접힙니다.
            byte* far = current + FarDistance;
            byte* farEnd = far + ((end - current) / BlockSize * BlockSize);
            byte* farPair = far + PairSize;
            byte* near = current + NearDistance + LineSize;
            byte* nearPair = near + PairSize;

            while (far < farEnd)
            {
                byte* chunkEnd = farEnd - far > FlushInterval * BlockSize ? far + (FlushInterval * BlockSize) : farEnd;
                Vector256<short> sum0 = Vector256<short>.Zero, sum1 = Vector256<short>.Zero;
                Vector256<short> sum2 = Vector256<short>.Zero, sum3 = Vector256<short>.Zero;
                Vector256<short> sum4 = Vector256<short>.Zero, sum5 = Vector256<short>.Zero;
                Vector256<short> sum6 = Vector256<short>.Zero, sum7 = Vector256<short>.Zero;
                for (; far < chunkEnd; far += BlockSize, farPair += BlockSize, near += BlockSize, nearPair += BlockSize)
                {
                    Sse.Prefetch0(far);
                    Sse.Prefetch0(farPair);
                    Sse.Prefetch0(near);
                    Sse.Prefetch0(nearPair);
                    sum0 = Avx2.Add(sum0, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(far + (0 - FarDistance)), bias, limit));
                    sum1 = Avx2.Add(sum1, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(far + (32 - FarDistance)), bias, limit));
                    sum2 = Avx2.Add(sum2, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(far + (64 - FarDistance)), bias, limit));
                    sum3 = Avx2.Add(sum3, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(far + (96 - FarDistance)), bias, limit));
                    sum4 = Avx2.Add(sum4, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(far + (128 - FarDistance)), bias, limit));
                    sum5 = Avx2.Add(sum5, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(far + (160 - FarDistance)), bias, limit));
                    sum6 = Avx2.Add(sum6, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(far + (192 - FarDistance)), bias, limit));
                    sum7 = Avx2.Add(sum7, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(far + (224 - FarDistance)), bias, limit));
                }

                negative = Avx2.Add(negative, MultiplyAddAvx2RangeSumCalculator.Widen(sum0, sum1, sum2, sum3, sum4, sum5, sum6, sum7));
            }

            // 블록에 못 미치는 벡터는 일곱 개 이하라 16비트 칸 하나로 모아도 넘치지 않습니다.
            rest = Vector256<short>.Zero;
            for (current = far - FarDistance; current < end; current += 32)
            {
                rest = Avx2.Add(rest, MultiplyAddAvx2RangeSumCalculator.NegativePairSums(Avx.LoadAlignedVector256(current), bias, limit));
            }

            negative = Avx2.Add(negative, MultiplyAddAvx2RangeSumCalculator.Widen(Avx2.MultiplyAddAdjacent(rest, Vector256<short>.One)));
            return total - Vector256.Sum(negative);
        }
    }
}
