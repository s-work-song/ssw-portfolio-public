using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace SSW.Benchmarks.CountingSort;

/// <summary>
/// 열여섯 독립 빈도 버퍼를 병합하고 남은 입력도 반영하는 계수 정렬입니다.
/// </summary>
/// <remarks>
/// 버퍼 시작 주소 열여섯 개를 루프 내내 들고 있어야 해서 x64 범용 레지스터(rsp 등을 빼면 약 14개)를 넘깁니다.
/// JIT는 일부 주소를 스택에 내려 두고 반복마다 다시 읽으므로(레지스터 스필), 8-way보다 느려집니다.
/// 같은 16-way라도 <see cref="SixteenWayOffsetCountingSortByteArraySorter"/>처럼 시작 주소 하나와 상수 오프셋으로 접근하면 스필이 사라집니다.
/// 입력과 버퍼는 <see cref="Unsafe.Add{T}(ref T, nuint)"/>로 읽어 원소마다 붙는 범위 검사를 없앴습니다.
/// 버퍼 수만 다르고 읽는 방식은 모든 N-way 구현이 같으므로, 측정 차이는 버퍼 분할과 레지스터 사용량에서 나옵니다.
/// </remarks>
public sealed class SixteenWayCountingSortByteArraySorter : IByteArraySorter, IByteHistogram
{
    /// <summary>열여섯 개의 빈도 버퍼를 쓰는 변형을 식별하는 이름입니다.</summary>
    public string Name => "Counting (16-way)";

    /// <summary>입력을 열여섯 갈래로 세고 병합해 제자리 오름차순 정렬합니다.</summary>
    public void Sort(byte[] values) => ByteHistogram.Sort(this, values);

    /// <inheritdoc />
    public void Count(ReadOnlySpan<byte> values, Span<int> counts)
    {
        ByteHistogram.EnsureSlotCount(counts);
        Span<int> buffer = stackalloc int[256 * 16];
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
        ref int lane8 = ref Unsafe.Add(ref lane0, 2048);
        ref int lane9 = ref Unsafe.Add(ref lane0, 2304);
        ref int lane10 = ref Unsafe.Add(ref lane0, 2560);
        ref int lane11 = ref Unsafe.Add(ref lane0, 2816);
        ref int lane12 = ref Unsafe.Add(ref lane0, 3072);
        ref int lane13 = ref Unsafe.Add(ref lane0, 3328);
        ref int lane14 = ref Unsafe.Add(ref lane0, 3584);
        ref int lane15 = ref Unsafe.Add(ref lane0, 3840);

        ref byte first = ref MemoryMarshal.GetReference(values);
        var length = (nuint)values.Length;
        var blockLength = length - (length % 16);
        nuint index = 0;

        // 서로 다른 버퍼에 기록해 같은 칸으로의 연속 쓰기를 분산합니다.
        for (; index < blockLength; index += 16)
        {
            Unsafe.Add(ref lane0, Unsafe.Add(ref first, index))++;
            Unsafe.Add(ref lane1, Unsafe.Add(ref first, index + 1))++;
            Unsafe.Add(ref lane2, Unsafe.Add(ref first, index + 2))++;
            Unsafe.Add(ref lane3, Unsafe.Add(ref first, index + 3))++;
            Unsafe.Add(ref lane4, Unsafe.Add(ref first, index + 4))++;
            Unsafe.Add(ref lane5, Unsafe.Add(ref first, index + 5))++;
            Unsafe.Add(ref lane6, Unsafe.Add(ref first, index + 6))++;
            Unsafe.Add(ref lane7, Unsafe.Add(ref first, index + 7))++;
            Unsafe.Add(ref lane8, Unsafe.Add(ref first, index + 8))++;
            Unsafe.Add(ref lane9, Unsafe.Add(ref first, index + 9))++;
            Unsafe.Add(ref lane10, Unsafe.Add(ref first, index + 10))++;
            Unsafe.Add(ref lane11, Unsafe.Add(ref first, index + 11))++;
            Unsafe.Add(ref lane12, Unsafe.Add(ref first, index + 12))++;
            Unsafe.Add(ref lane13, Unsafe.Add(ref first, index + 13))++;
            Unsafe.Add(ref lane14, Unsafe.Add(ref first, index + 14))++;
            Unsafe.Add(ref lane15, Unsafe.Add(ref first, index + 15))++;
        }

        for (; index < length; index++)
        {
            Unsafe.Add(ref lane0, Unsafe.Add(ref first, index))++;
        }

        ByteHistogram.Merge(buffer, 16, counts);
    }
}
