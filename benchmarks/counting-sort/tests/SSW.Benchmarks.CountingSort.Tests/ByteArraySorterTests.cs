using SSW.Benchmarks.CountingSort;

namespace SSW.Benchmarks.CountingSort.Tests;

public sealed class ByteArraySorterTests
{
    [Fact]
    public void EveryImplementationMatchesArraySortForBoundaryAndRandomInputs()
    {
        foreach (var testCase in CreateCases())
        {
            var expected = testCase.Input.ToArray();
            Array.Sort(expected);

            foreach (var sorter in CreateSorters())
            {
                var actual = testCase.Input.ToArray();

                sorter.Sort(actual);

                Assert.Equal(expected, actual);
            }
        }
    }

    [Fact]
    public void EveryHistogramMatchesNaiveCountsAndOverwritesTheOutput()
    {
        foreach (var testCase in CreateCases())
        {
            var expected = new int[256];
            foreach (var value in testCase.Input)
            {
                expected[value]++;
            }

            foreach (var histogram in CreateSorters().OfType<IByteHistogram>())
            {
                // 이전 호출의 값이 남아 있어도 결과가 덮어써지는지 함께 확인합니다.
                var actual = Enumerable.Repeat(-1, 256).ToArray();

                histogram.Count(testCase.Input, actual);

                Assert.Equal(expected, actual);
            }
        }
    }

    [Fact]
    public void HistogramRejectsCountsThatAreNotOneSlotPerByteValue()
    {
        foreach (var histogram in CreateSorters().OfType<IByteHistogram>())
        {
            Assert.Throws<ArgumentException>(() => histogram.Count([1, 2, 3], new int[255]));
        }
    }

    private static IEnumerable<(string Name, byte[] Input)> CreateCases()
    {
        yield return ("empty", []);
        yield return ("single", [42]);
        yield return ("repeated", [7, 7, 7, 7, 7, 7]);
        yield return ("byte-boundaries", [255, 0, 255, 0, 1, 254]);
        yield return ("length-three", [9, 3, 8]);
        yield return ("length-five", [5, 4, 3, 2, 1]);
        yield return ("length-nine", [9, 0, 8, 1, 7, 2, 6, 3, 5]);
        yield return ("deterministic-random-length-257", CreateDeterministicRandomBytes(257));
        // 16의 배수가 아닌 길이로 16-way 구현의 tail 처리까지 확인합니다.
        yield return ("deterministic-random-length-4099", CreateDeterministicRandomBytes(4099));
    }

    private static IEnumerable<IByteArraySorter> CreateSorters()
    {
        yield return new ArraySortByteArraySorter();
        yield return new SingleCountingSortByteArraySorter();
        yield return new TwoWayCountingSortByteArraySorter();
        yield return new FourWayCountingSortByteArraySorter();
        yield return new EightWayCountingSortByteArraySorter();
        yield return new SixteenWayCountingSortByteArraySorter();
        yield return new SixteenWayOffsetCountingSortByteArraySorter();
        yield return new ParallelCountingSortByteArraySorter();
    }

    private static byte[] CreateDeterministicRandomBytes(int length)
    {
        var random = new Random(20260727);
        var values = new byte[length];
        random.NextBytes(values);
        return values;
    }
}
