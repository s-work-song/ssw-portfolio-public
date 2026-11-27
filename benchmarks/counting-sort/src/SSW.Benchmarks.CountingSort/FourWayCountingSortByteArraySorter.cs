using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace SSW.Benchmarks.CountingSort;

/// <summary>
/// 네 독립 빈도 버퍼를 병합하고 남은 입력도 반영하는 계수 정렬입니다.
/// </summary>
/// <remarks>
/// 버퍼를 넷으로 나누면 같은 칸을 연달아 갱신하는 의존성이 더 흩어집니다.
/// 이 지점부터는 증가 연산의 저장(store)이 병목이라, 버퍼를 더 나눠도 세는 시간은 거의 줄지 않습니다.
/// 입력과 버퍼는 <see cref="Unsafe.Add{T}(ref T, nuint)"/>로 읽어 원소마다 붙는 범위 검사를 없앴습니다.
/// 버퍼 수만 다르고 읽는 방식은 모든 N-way 구현이 같으므로, 측정 차이는 버퍼 분할과 레지스터 사용량에서 나옵니다.
/// </remarks>
public sealed class FourWayCountingSortByteArraySorter : IByteArraySorter, IByteHistogram
{
    /// <summary>네 개의 빈도 버퍼를 쓰는 변형을 식별하는 이름입니다.</summary>
    public string Name => "Counting (4-way)";

    /// <summary>입력을 네 갈래로 세고 병합해 제자리 오름차순 정렬합니다.</summary>
    public void Sort(byte[] values) => ByteHistogram.Sort(this, values);

    /// <inheritdoc />
    public void Count(ReadOnlySpan<byte> values, Span<int> counts)
    {
        ByteHistogram.EnsureSlotCount(counts);
        Span<int> buffer = stackalloc int[256 * 4];
        buffer.Clear();

        // 버퍼마다 시작 주소를 따로 둡니다. 루프 내내 이 주소들이 레지스터에 살아 있어야 합니다.
        ref int lane0 = ref MemoryMarshal.GetReference(buffer);
        ref int lane1 = ref Unsafe.Add(ref lane0, 256);
        ref int lane2 = ref Unsafe.Add(ref lane0, 512);
        ref int lane3 = ref Unsafe.Add(ref lane0, 768);

        ref byte first = ref MemoryMarshal.GetReference(values);
        var length = (nuint)values.Length;
        var blockLength = length - (length % 4);
        nuint index = 0;

        // 서로 다른 버퍼에 기록해 같은 칸으로의 연속 쓰기를 분산합니다.
        for (; index < blockLength; index += 4)
        {
            Unsafe.Add(ref lane0, Unsafe.Add(ref first, index))++;
            Unsafe.Add(ref lane1, Unsafe.Add(ref first, index + 1))++;
            Unsafe.Add(ref lane2, Unsafe.Add(ref first, index + 2))++;
            Unsafe.Add(ref lane3, Unsafe.Add(ref first, index + 3))++;
        }

        for (; index < length; index++)
        {
            Unsafe.Add(ref lane0, Unsafe.Add(ref first, index))++;
        }

        ByteHistogram.Merge(buffer, 4, counts);
    }
}
