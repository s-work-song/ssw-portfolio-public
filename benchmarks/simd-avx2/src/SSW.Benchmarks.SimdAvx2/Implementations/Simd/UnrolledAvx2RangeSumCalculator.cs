using System.Runtime.InteropServices;
using System.Runtime.Intrinsics;
using System.Runtime.Intrinsics.X86;
using SSW.Benchmarks.SimdAvx2.Abstractions;
using SSW.Benchmarks.SimdAvx2.Implementations.Scalar;

namespace SSW.Benchmarks.SimdAvx2.Implementations.Simd;

/// <summary>
/// 한 반복에서 AVX2 벡터 네 개를 처리하는 언롤링 구현입니다.
/// 독립 accumulator를 유지해 이전 벡터 덧셈 결과를 기다리는 의존 사슬을 줄이는 것이 목적이며,
/// 입력이 작거나 메모리 대역폭이 병목이면 이점이 없을 수 있습니다.
/// </summary>
public sealed class UnrolledAvx2RangeSumCalculator : IRangeSumCalculator
{
    private readonly IRangeSumCalculator _fallback;

    /// <summary>기본 fallback은 조건 분기 scalar 구현입니다.</summary>
    public UnrolledAvx2RangeSumCalculator(IRangeSumCalculator? fallback = null)
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
        int vectorSize = Vector256<byte>.Count;
        int blockSize = vectorSize * 4;
        int blockLength = values.Length - (values.Length % blockSize);
        Vector256<byte> minimum = Vector256.Create(range.Minimum);
        Vector256<byte> maximum = Vector256.Create(range.Maximum);
        Vector256<ulong> sum0 = Vector256<ulong>.Zero;
        Vector256<ulong> sum1 = Vector256<ulong>.Zero;
        Vector256<ulong> sum2 = Vector256<ulong>.Zero;
        Vector256<ulong> sum3 = Vector256<ulong>.Zero;
        ref byte first = ref MemoryMarshal.GetReference(values);

        for (int index = 0; index < blockLength; index += blockSize)
        {
            sum0 = Avx2.Add(sum0, Avx2RangeSumCalculator.SumFilteredVector(Vector256.LoadUnsafe(ref first, (nuint)index), minimum, maximum).AsUInt64());
            sum1 = Avx2.Add(sum1, Avx2RangeSumCalculator.SumFilteredVector(Vector256.LoadUnsafe(ref first, (nuint)(index + vectorSize)), minimum, maximum).AsUInt64());
            sum2 = Avx2.Add(sum2, Avx2RangeSumCalculator.SumFilteredVector(Vector256.LoadUnsafe(ref first, (nuint)(index + (vectorSize * 2))), minimum, maximum).AsUInt64());
            sum3 = Avx2.Add(sum3, Avx2RangeSumCalculator.SumFilteredVector(Vector256.LoadUnsafe(ref first, (nuint)(index + (vectorSize * 3))), minimum, maximum).AsUInt64());
        }

        long total = (long)Vector256.Sum(Avx2.Add(Avx2.Add(sum0, sum1), Avx2.Add(sum2, sum3)));
        return total + _fallback.Sum(source.Slice(blockLength), range);
    }
}
