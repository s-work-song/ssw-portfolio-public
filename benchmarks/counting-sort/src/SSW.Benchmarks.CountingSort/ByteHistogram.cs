namespace SSW.Benchmarks.CountingSort;

/// <summary>
/// 빈도 기반 정렬 구현이 공유하는 검증·병합·정렬 단계입니다.
/// </summary>
internal static class ByteHistogram
{
    /// <summary>바이트가 가질 수 있는 값의 개수이자 빈도 버퍼 하나의 칸 수입니다.</summary>
    public const int SlotCount = 256;

    /// <summary>출력 빈도 배열이 바이트 값 개수와 같은 길이인지 확인합니다.</summary>
    public static void EnsureSlotCount(Span<int> counts)
    {
        if (counts.Length != SlotCount)
        {
            throw new ArgumentException("빈도 배열은 바이트 값 개수와 같은 256칸이어야 합니다.", nameof(counts));
        }
    }

    /// <summary>
    /// 연속 배치한 <paramref name="laneCount"/>개 버퍼의 같은 값 칸을 더해 <paramref name="counts"/>에 씁니다.
    /// </summary>
    /// <remarks>병합 비용은 입력 길이와 무관하게 256칸 × 버퍼 수입니다.</remarks>
    public static void Merge(ReadOnlySpan<int> lanes, int laneCount, Span<int> counts)
    {
        for (var value = 0; value < SlotCount; value++)
        {
            var total = 0;
            for (var lane = 0; lane < laneCount; lane++)
            {
                total += lanes[(lane * SlotCount) + value];
            }

            counts[value] = total;
        }
    }

    /// <summary>빈도를 센 뒤 공통 출력 단계로 제자리 오름차순 정렬합니다.</summary>
    public static void Sort(IByteHistogram histogram, byte[] values)
    {
        ArgumentNullException.ThrowIfNull(values);
        if (values.Length < 2)
        {
            return;
        }

        Span<int> counts = stackalloc int[SlotCount];
        histogram.Count(values, counts);
        CountingSortWriter.WriteSorted(values, counts);
    }
}
