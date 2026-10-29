using BenchmarkDotNet.Attributes;
using SSW.Benchmarks.Shared.Benchmarking;
using SSW.Benchmarks.CountingSort;

namespace SSW.Benchmarks.CountingSort.Benchmarks;

/// <summary>
/// 정렬 전체 대신 값별 빈도를 세는 단계만 측정합니다.
/// </summary>
/// <remarks>
/// 버퍼 분할 수와 레지스터 스필의 영향은 세는 루프에서만 생기므로, 입력 복사와 출력 기록을
/// 빼고 이 단계만 비교합니다. 입력을 바꾸지 않으므로 호출마다 복사할 필요도 없습니다.
/// 실행 간 흔들림을 평균에 넣기 위해 프로세스를 세 번 띄웁니다.
/// </remarks>
[Config(typeof(SharedBenchmarkConfig))]
[SimpleJob(launchCount: 3)]
public class CountingPhaseBenchmarks
{
    private readonly IByteHistogram _single = new SingleCountingSortByteArraySorter();
    private readonly IByteHistogram _twoWay = new TwoWayCountingSortByteArraySorter();
    private readonly IByteHistogram _fourWay = new FourWayCountingSortByteArraySorter();
    private readonly IByteHistogram _eightWay = new EightWayCountingSortByteArraySorter();
    private readonly IByteHistogram _sixteenWay = new SixteenWayCountingSortByteArraySorter();
    private readonly IByteHistogram _sixteenWayOffset = new SixteenWayOffsetCountingSortByteArraySorter();
    private readonly int[] _counts = new int[256];

    private byte[] _source = [];

    [GlobalSetup]
    public void CreateSource()
    {
        _source = new byte[1024 * 1024];
        new Random(20260727).NextBytes(_source);
    }

    [Benchmark]
    public void Single() => _single.Count(_source, _counts);

    [Benchmark]
    public void TwoWay() => _twoWay.Count(_source, _counts);

    [Benchmark(Baseline = true)]
    public void FourWay() => _fourWay.Count(_source, _counts);

    [Benchmark]
    public void EightWay() => _eightWay.Count(_source, _counts);

    [Benchmark]
    public void SixteenWay() => _sixteenWay.Count(_source, _counts);

    [Benchmark]
    public void SixteenWayOffset() => _sixteenWayOffset.Count(_source, _counts);
}
