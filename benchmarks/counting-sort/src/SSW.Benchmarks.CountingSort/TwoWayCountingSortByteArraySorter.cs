using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace SSW.Benchmarks.CountingSort;

/// <summary>
/// 두 독립 빈도 버퍼를 병합하고 남은 입력도 반영하는 계수 정렬입니다.
/// </summary>
/// <remarks>
/// 인접한 두 입력이 같은 count 칸을 연달아 갱신하면 앞선 증가가 끝나야 다음 증가를 할 수 있습니다.
/// 버퍼를 둘로 나누면 그런 write-after-write 의존 사슬이 짧아져 단일 버퍼보다 빨라집니다.
/// 대신 버퍼 초기화와 마지막 병합(256칸 × 버퍼 수)이 추가됩니다.
/// 입력과 버퍼는 <see cref="Unsafe.Add{T}(ref T, nuint)"/>로 읽어 원소마다 붙는 범위 검사를 없앴습니다.
/// 버퍼 수만 다르고 읽는 방식은 모든 N-way 구현이 같으므로, 측정 차이는 버퍼 분할과 레지스터 사용량에서 나옵니다.
/// </remarks>
public sealed class TwoWayCountingSortByteArraySorter : IByteArraySorter, IByteHistogram
{
    /// <summary>두 개의 빈도 버퍼를 쓰는 변형을 식별하는 이름입니다.</summary>
    public string Name => "Counting (2-way)";

    /// <summary>입력을 두 갈래로 세고 병합해 제자리 오름차순 정렬합니다.</summary>
    public void Sort(byte[] values) => ByteHistogram.Sort(this, values);

    /// <inheritdoc />
    public void Count(ReadOnlySpan<byte> values, Span<int> counts)
    {
        ByteHistogram.EnsureSlotCount(counts);
        Span<int> buffer = stackalloc int[256 * 2];
        buffer.Clear();

        // 버퍼마다 시작 주소를 따로 둡니다. 루프 내내 이 주소들이 레지스터에 살아 있어야 합니다.
        ref int lane0 = ref MemoryMarshal.GetReference(buffer);
        ref int lane1 = ref Unsafe.Add(ref lane0, 256);

        ref byte first = ref MemoryMarshal.GetReference(values);
        var length = (nuint)values.Length;
        var blockLength = length - (length % 2);
        nuint index = 0;

        // 서로 다른 버퍼에 기록해 같은 칸으로의 연속 쓰기를 분산합니다.
        for (; index < blockLength; index += 2)
        {
            Unsafe.Add(ref lane0, Unsafe.Add(ref first, index))++;
            Unsafe.Add(ref lane1, Unsafe.Add(ref first, index + 1))++;
        }

        for (; index < length; index++)
        {
            Unsafe.Add(ref lane0, Unsafe.Add(ref first, index))++;
        }

        ByteHistogram.Merge(buffer, 2, counts);
    }
}
