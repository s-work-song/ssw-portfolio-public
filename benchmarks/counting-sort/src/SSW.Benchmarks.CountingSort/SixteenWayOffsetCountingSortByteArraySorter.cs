using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;

namespace SSW.Benchmarks.CountingSort;

/// <summary>
/// 열여섯 빈도 버퍼를 시작 주소 하나와 상수 오프셋으로 다루는 계수 정렬입니다.
/// </summary>
/// <remarks>
/// <see cref="SixteenWayCountingSortByteArraySorter"/>와 버퍼 배치·명령 수는 같지만,
/// 버퍼마다 주소를 따로 들지 않고 <c>[시작 주소 + 값 × 4 + 1024 × k]</c> 주소 계산에 오프셋을 넣습니다.
/// 그래서 버퍼 수와 관계없이 시작 주소 하나와 입력 위치만 레지스터에 있으면 되고, 레지스터 스필이 생기지 않습니다.
/// 오프셋을 <see cref="nint"/>로 더해야 JIT가 int 덧셈과 부호 확장 없이 주소 계산 하나로 합칩니다.
/// </remarks>
public sealed class SixteenWayOffsetCountingSortByteArraySorter : IByteArraySorter, IByteHistogram
{
    /// <summary>시작 주소 하나로 열여섯 버퍼를 쓰는 변형을 식별하는 이름입니다.</summary>
    public string Name => "Counting (16-way, one base)";

    /// <summary>입력을 열여섯 갈래로 세고 병합해 제자리 오름차순 정렬합니다.</summary>
    public void Sort(byte[] values) => ByteHistogram.Sort(this, values);

    /// <inheritdoc />
    public void Count(ReadOnlySpan<byte> values, Span<int> counts)
    {
        ByteHistogram.EnsureSlotCount(counts);
        Span<int> buffer = stackalloc int[256 * 16];
        buffer.Clear();

        // 시작 주소는 하나만 둡니다. k번째 버퍼는 오프셋 256 × k로 찾아갑니다.
        ref int lanes = ref MemoryMarshal.GetReference(buffer);
        ref byte first = ref MemoryMarshal.GetReference(values);
        var length = (nuint)values.Length;
        var blockLength = length - (length % 16);
        nuint index = 0;

        for (; index < blockLength; index += 16)
        {
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index))++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 1) + 256)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 2) + 512)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 3) + 768)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 4) + 1024)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 5) + 1280)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 6) + 1536)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 7) + 1792)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 8) + 2048)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 9) + 2304)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 10) + 2560)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 11) + 2816)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 12) + 3072)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 13) + 3328)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 14) + 3584)++;
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index + 15) + 3840)++;
        }

        for (; index < length; index++)
        {
            Unsafe.Add(ref lanes, (nint)Unsafe.Add(ref first, index))++;
        }

        ByteHistogram.Merge(buffer, 16, counts);
    }
}
