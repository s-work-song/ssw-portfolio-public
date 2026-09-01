# Counting Sort 비교 실험

바이트 값 범위(0~255)에 한정된 계수 정렬(Counting Sort)을, 표준 라이브러리 기준선과 단일·2/4/8-way·병렬 구현으로 비교하기 위한 독립 실험입니다. 모든 구현은 같은 정렬 계약을 따르며 안전하게 비교할 수 있는 코드만 포함합니다.

## 구성

```text
counting-sort/
├─ src/SSW.Benchmarks.CountingSort/             # 정렬 계약과 구현
├─ tests/SSW.Benchmarks.CountingSort.Tests/     # Array.Sort 동등성 테스트
├─ bench/SSW.Benchmarks.CountingSort.Benchmarks/# BenchmarkDotNet 러너
└─ SSW.Benchmarks.CountingSort.sln
```

core의 모든 구현은 `IByteArraySorter` 계약으로 바이트 배열을 제자리 오름차순 정렬합니다.

- `ArraySortByteArraySorter`: 비교 기준선입니다.
- `SingleCountingSortByteArraySorter`: 하나의 256칸 빈도 버퍼를 사용합니다.
- `TwoWay`·`FourWay`·`EightWay`: 독립 빈도 버퍼를 합산해 write-after-write 의존성을 줄입니다.
- `ParallelCountingSortByteArraySorter`: 각 구간의 로컬 버퍼를 병합합니다. unsafe 코드나 공유 버퍼의 비동기 쓰기는 사용하지 않습니다.

2/4/8-way 구현은 각각의 lane을 모두 합산하고, 블록 크기로 나누어떨어지지 않는 tail을 첫 버퍼에 반영합니다. 따라서 빈 배열, 한 원소, 홀수 길이와 2/4/8의 배수가 아닌 길이도 동일한 계약으로 처리합니다.

## 구현 범위와 검증 원칙

공개 구현은 표준 라이브러리 기준선과 단일·2/4/8-way·병렬 계수 정렬에 집중합니다. 각 구현은 값 증가와 버퍼 합산, 입력 길이가 처리 블록의 배수가 아닐 때 남는 tail, 제자리 정렬 입력 재사용 문제를 계약·테스트·벤치 구조에서 검증합니다.

## 검증과 측정 상태

테스트는 모든 구현을 `Array.Sort` 결과와 비교합니다. 빈 배열, 한 원소, 반복 값, 0/255 경계 값, 3·5·9 길이, 길이 257의 결정론적 난수 입력을 포함합니다.

벤치마크는 각 측정 호출에서 동일 원본을 작업 배열로 복사한 뒤 정렬하므로 앞선 제자리 정렬 결과를 다음 호출이 재사용하지 않습니다. 복사 비용은 모든 구현이 동일하게 부담하며, BenchmarkDotNet이 통계적으로 필요한 호출 수를 자동 산정합니다. 환경별 성능은 직접 실행해 확인할 수 있도록 고정 수치를 제공하지 않습니다.

SDK 빌드와 BenchmarkDotNet 산출물은 `benchmarks/artifacts/` 아래에 모입니다.

## 실행

이 디렉터리에서 실행합니다.

```powershell
.\run-tests.ps1
.\run-benchmark.ps1 -List
.\run-benchmark.ps1
```
