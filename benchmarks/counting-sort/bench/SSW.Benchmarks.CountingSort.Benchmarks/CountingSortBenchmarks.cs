using BenchmarkDotNet.Attributes;
using SSW.Benchmarks.Shared.Benchmarking;
using SSW.Benchmarks.CountingSort;

namespace SSW.Benchmarks.CountingSort.Benchmarks;

[MemoryDiagnoser]
[Config(typeof(SharedBenchmarkConfig))]
// 실행 간 흔들림을 평균에 넣기 위해 프로세스를 세 번 띄웁니다.
[SimpleJob(launchCount: 3)]
public class CountingSortBenchmarks
{
    private readonly IByteArraySorter _arraySort = new ArraySortByteArraySorter();
    private readonly IByteArraySorter _singleCounting = new SingleCountingSortByteArraySorter();
    private readonly IByteArraySorter _twoWayCounting = new TwoWayCountingSortByteArraySorter();
    private readonly IByteArraySorter _fourWayCounting = new FourWayCountingSortByteArraySorter();
    private readonly IByteArraySorter _eightWayCounting = new EightWayCountingSortByteArraySorter();
    private readonly IByteArraySorter _sixteenWayCounting = new SixteenWayCountingSortByteArraySorter();
    private readonly IByteArraySorter _sixteenWayOffsetCounting = new SixteenWayOffsetCountingSortByteArraySorter();
    private readonly IByteArraySorter _parallelCounting = new ParallelCountingSortByteArraySorter();

    private byte[] _source = [];
    private byte[] _input = [];

    [GlobalSetup]
    public void CreateSource()
    {
        // 연구 페이지와 같은 1 MiB 무작위 바이트입니다.
        _source = new byte[1024 * 1024];
        new Random(20260727).NextBytes(_source);
        _input = new byte[_source.Length];
    }

    [Benchmark(Baseline = true)]
    public void ArraySort() => RestoreAndSort(_arraySort);

    [Benchmark]
    public void SingleCounting() => RestoreAndSort(_singleCounting);

    [Benchmark]
    public void TwoWayCounting() => RestoreAndSort(_twoWayCounting);

    [Benchmark]
    public void FourWayCounting() => RestoreAndSort(_fourWayCounting);

    [Benchmark]
    public void EightWayCounting() => RestoreAndSort(_eightWayCounting);

    [Benchmark]
    public void SixteenWayCounting() => RestoreAndSort(_sixteenWayCounting);

    [Benchmark]
    public void SixteenWayOffsetCounting() => RestoreAndSort(_sixteenWayOffsetCounting);

    [Benchmark]
    public void ParallelCounting() => RestoreAndSort(_parallelCounting);

    private void RestoreAndSort(IByteArraySorter sorter)
    {
        _source.AsSpan().CopyTo(_input);
        sorter.Sort(_input);
    }
}
