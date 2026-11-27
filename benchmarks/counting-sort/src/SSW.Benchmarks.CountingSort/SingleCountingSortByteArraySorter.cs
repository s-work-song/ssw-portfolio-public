using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace SSW.Benchmarks.CountingSort;

/// <summary>
/// 256개 빈도 버퍼 하나를 사용하는 기본 계수 정렬입니다.
/// </summary>
/// <remarks>
/// byte는 가능한 값이 256개로 고정되어 있어 count와 출력의 합이 <c>O(n + k)</c>가 됩니다.
/// 값 범위 <c>k</c>가 입력 길이에 비해 충분히 작을 때 비교 정렬과 다른 비용 구조를
/// 관찰하기 좋습니다. 반대로 값 범위가 커지면 count 저장 공간과 초기화 비용이 커져
/// 이 전제가 약해집니다. 버퍼가 하나뿐이라 같은 칸을 연달아 갱신하면 앞선 증가를
/// 기다려야 하며, N-way 구현은 이 의존성을 버퍼 분할로 흩습니다.
/// </remarks>
public sealed class SingleCountingSortByteArraySorter : IByteArraySorter, IByteHistogram
{
    /// <summary>단일 빈도 버퍼 변형을 식별하는 이름입니다.</summary>
    public string Name => "Counting (single buffer)";

    /// <summary>단일 빈도 배열을 채운 뒤 정렬된 출력으로 다시 기록합니다.</summary>
    public void Sort(byte[] values) => ByteHistogram.Sort(this, values);

    /// <inheritdoc />
    public void Count(ReadOnlySpan<byte> values, Span<int> counts)
    {
        ByteHistogram.EnsureSlotCount(counts);
        counts.Clear();

        // N-way 구현과 같은 방식으로 읽어, 버퍼 분할 외의 차이가 측정에 섞이지 않게 합니다.
        ref int lane0 = ref MemoryMarshal.GetReference(counts);
        ref byte first = ref MemoryMarshal.GetReference(values);
        var length = (nuint)values.Length;
        for (nuint index = 0; index < length; index++)
        {
            Unsafe.Add(ref lane0, Unsafe.Add(ref first, index))++;
        }
    }
}
