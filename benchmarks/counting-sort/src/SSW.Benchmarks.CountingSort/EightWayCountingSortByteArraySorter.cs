using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace SSW.Benchmarks.CountingSort;

/// <summary>
/// 여덟 독립 빈도 버퍼를 병합하고 남은 입력도 반영하는 계수 정렬입니다.
/// </summary>
/// <remarks>
/// 버퍼 시작 주소 여덟 개와 입력 위치를 합쳐도 x64 범용 레지스터 안에 들어가 스필 없이 실행됩니다.
/// 4-way에서 이미 저장(store)이 병목이므로 버퍼를 더 나눈 이득은 거의 없습니다.
/// 입력과 버퍼는 <see cref="Unsafe.Add{T}(ref T, nuint)"/>로 읽어 원소마다 붙는 범위 검사를 없앴습니다.
/// 버퍼 수만 다르고 읽는 방식은 모든 N-way 구현이 같으므로, 측정 차이는 버퍼 분할과 레지스터 사용량에서 나옵니다.
/// </remarks>
public sealed class EightWayCountingSortByteArraySorter : IByteArraySorter, IByteHistogram
{
    /// <summary>여덟 개의 빈도 버퍼를 쓰는 변형을 식별하는 이름입니다.</summary>
    public string Name => "Counting (8-way)";

    /// <summary>입력을 여덟 갈래로 세고 병합해 제자리 오름차순 정렬합니다.</summary>
    public void Sort(byte[] values) => ByteHistogram.Sort(this, values);

    /// <inheritdoc />
    public void Count(ReadOnlySpan<byte> values, Span<int> counts)
    {
        ByteHistogram.EnsureSlotCount(counts);
        Span<int> buffer = stackalloc int[256 * 8];
        buffer.Clear();

        // 버퍼마다 시작 주소를 따로 둡니다. 루프 내내 이 주소들이 레지스터에 살아 있어야 합니다.
        ref int lane0 = ref MemoryMarshal.GetReference(buffer);
        ref int lane1 = ref Unsafe.Add(ref lane0, 256);
        ref int lane2 = ref Unsafe.Add(ref lane0, 512);
        ref int lane3 = ref Unsafe.Add(ref lane0, 768);
        ref int lane4 = ref Unsafe.Add(ref lane0, 1024);
        ref int lane5 = ref Unsafe.Add(ref lane0, 1280);
        ref int lane6 = ref Unsafe.Add(ref lane0, 1536);
        ref int lane7 = ref Unsafe.Add(ref lane0, 1792);

        ref byte first = ref MemoryMarshal.GetReference(values);
        var length = (nuint)values.Length;
        var blockLength = length - (length % 8);
        nuint index = 0;

        // 서로 다른 버퍼에 기록해 같은 칸으로의 연속 쓰기를 분산합니다.
        for (; index < blockLength; index += 8)
        {
            Unsafe.Add(ref lane0, Unsafe.Add(ref first, index))++;
            Unsafe.Add(ref lane1, Unsafe.Add(ref first, index + 1))++;
            Unsafe.Add(ref lane2, Unsafe.Add(ref first, index + 2))++;
            Unsafe.Add(ref lane3, Unsafe.Add(ref first, index + 3))++;
            Unsafe.Add(ref lane4, Unsafe.Add(ref first, index + 4))++;
            Unsafe.Add(ref lane5, Unsafe.Add(ref first, index + 5))++;
            Unsafe.Add(ref lane6, Unsafe.Add(ref first, index + 6))++;
            Unsafe.Add(ref lane7, Unsafe.Add(ref first, index + 7))++;
        }

        for (; index < length; index++)
        {
            Unsafe.Add(ref lane0, Unsafe.Add(ref first, index))++;
        }

        ByteHistogram.Merge(buffer, 8, counts);
    }
}
