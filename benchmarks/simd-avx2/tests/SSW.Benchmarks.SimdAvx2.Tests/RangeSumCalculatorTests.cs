using SSW.Benchmarks.SimdAvx2.Abstractions;
using SSW.Benchmarks.SimdAvx2.Decorators;
using SSW.Benchmarks.SimdAvx2.Implementations.Scalar;
using SSW.Benchmarks.SimdAvx2.Implementations.Simd;
using SSW.Benchmarks.SimdAvx2.TestData;

namespace SSW.Benchmarks.SimdAvx2.Tests;

/// <summary>
/// 성능 비교 전에 모든 변형이 기준 구현과 같은 결과를 내는지 검증합니다.
/// AVX2가 없는 환경에서는 해당 구현의 scalar fallback도 같은 계약으로 검증됩니다.
/// </summary>
public sealed class RangeSumCalculatorTests
{
    public static IEnumerable<object[]> Calculators()
    {
        yield return ["branched", new BranchedRangeSumCalculator()];
        yield return ["branchless", new BranchlessRangeSumCalculator()];
        yield return ["avx2", new Avx2RangeSumCalculator()];
        yield return ["avx2-unrolled", new UnrolledAvx2RangeSumCalculator()];
        yield return ["avx2-multiply-add", new MultiplyAddAvx2RangeSumCalculator()];
        yield return ["avx2-multiply-add-prefetch", new PrefetchMultiplyAddAvx2RangeSumCalculator()];
        yield return ["parallel", new ParallelRangeSumCalculator()];
    }

    [Theory]
    [MemberData(nameof(Calculators))]
    public void Sum_matches_branched_baseline_for_deterministic_data(string _, IRangeSumCalculator calculator)
    {
        byte[] data = DeterministicByteData.Create(1_000_003);
        var range = new ByteRange(40, 210);
        long expected = new BranchedRangeSumCalculator().Sum(data, range);

        Assert.Equal(expected, calculator.Sum(data, range));
    }

    [Theory]
    [MemberData(nameof(Calculators))]
    public void Sum_handles_empty_and_tail_lengths(string _, IRangeSumCalculator calculator)
    {
        var range = new ByteRange(10, 200);
        Assert.Equal(0, calculator.Sum(Array.Empty<byte>(), range));

        byte[] tailData = [0, 10, 11, 199, 200, 201, 255];
        Assert.Equal(420, calculator.Sum(tailData, range));
    }

    [Theory]
    [MemberData(nameof(Calculators))]
    public void Sum_matches_branched_baseline_for_unaligned_slices(string _, IRangeSumCalculator calculator)
    {
        // 정렬 구현은 시작 주소에 따라 scalar로 처리하는 앞부분 길이가 달라지므로 시작 위치와 길이를 바꿔 본다.
        byte[] data = DeterministicByteData.Create(100_000);
        var range = new ByteRange(100, 200);
        var baseline = new BranchedRangeSumCalculator();
        foreach (int offset in new[] { 0, 1, 7, 8, 24, 31, 33 })
        {
            foreach (int length in new[] { 0, 1, 31, 32, 33, 255, 256, 257, 4_099, 70_001 })
            {
                ReadOnlyMemory<byte> slice = data.AsMemory(offset, length);
                Assert.Equal(baseline.Sum(slice, range), calculator.Sum(slice, range));
            }
        }
    }

    [Theory]
    [MemberData(nameof(Calculators))]
    public void Sum_handles_full_and_single_value_ranges(string _, IRangeSumCalculator calculator)
    {
        // 0~255 전체 범위와 값 하나짜리 범위는 비교 한계값의 양 끝이다.
        byte[] data = DeterministicByteData.Create(100_003);
        var baseline = new BranchedRangeSumCalculator();
        foreach (var range in new[] { new ByteRange(0, 255), new ByteRange(0, 0), new ByteRange(255, 255), new ByteRange(0, 254), new ByteRange(1, 255) })
        {
            Assert.Equal(baseline.Sum(data, range), calculator.Sum(data, range));
        }
    }

    [Theory]
    [MemberData(nameof(Calculators))]
    public void Sum_does_not_overflow_on_long_runs_of_maximum_values(string _, IRangeSumCalculator calculator)
    {
        // 16비트 칸에 모으는 구현이 64번 반복을 여러 번 넘겨도 넘치지 않는지 본다.
        byte[] data = new byte[(64 * 256 * 5) + 1_000];
        Array.Fill(data, (byte)255);
        Assert.Equal(255L * data.Length, calculator.Sum(data, new ByteRange(200, 255)));
    }

    [Theory]
    [MemberData(nameof(Calculators))]
    public void Sum_rejects_reversed_range(string _, IRangeSumCalculator calculator)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => calculator.Sum(new byte[] { 1, 2, 3 }, new ByteRange(200, 10)));
    }
}
