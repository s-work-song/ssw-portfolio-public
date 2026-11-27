namespace SSW.Benchmarks.CountingSort;

/// <summary>
/// 계수 정렬에서 값별 빈도를 세는 단계만 분리한 계약입니다.
/// </summary>
/// <remarks>
/// 정렬 전체 시간에는 출력 기록처럼 모든 계수 정렬이 같게 부담하는 비용이 섞입니다.
/// 버퍼 분할 수와 레지스터 사용량의 차이는 세는 루프에서만 생기므로, 그 차이를
/// 따로 관찰할 수 있도록 빈도 계산을 공개합니다.
/// </remarks>
public interface IByteHistogram
{
    /// <summary>벤치마크와 결과 표에서 구현을 식별하는 표시 이름입니다.</summary>
    string Name { get; }

    /// <summary>입력 바이트의 값별 빈도를 <paramref name="counts"/>에 기록합니다.</summary>
    /// <param name="values">빈도를 셀 입력입니다.</param>
    /// <param name="counts">길이 256의 출력 빈도 배열입니다. 기존 값은 덮어씁니다.</param>
    void Count(ReadOnlySpan<byte> values, Span<int> counts);
}
