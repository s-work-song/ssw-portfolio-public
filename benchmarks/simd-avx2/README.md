# SIMD AVX2 범위 합산

## 배경과 이론

바이트 배열에서 특정 범위의 값만 골라 합산하는 작업은 작은 코드 차이로도 CPU의 실행 경로가 달라집니다. 이 실험은 조건 분기의 예측 실패, 브랜치리스 마스크 연산, AVX2의 256비트 벡터 레인, 루프 언롤링의 의존 사슬 감소, 병렬 작업 분할의 비용을 같은 결과 계약 아래에서 비교합니다.

AVX2 구현은 벡터마다 레인 전체를 더하는 수평 합산을 하지 않습니다. 수평 합산은 셔플과 덧셈 여러 번이 드는 비싼 연산이고, 그 결과를 scalar 변수 하나에 더하면 모든 반복이 그 변수를 기다리는 의존 사슬이 생깁니다. 그래서 필터한 바이트의 부분합은 64비트 레인 벡터에 계속 쌓아 두고, 수평 합산은 루프가 끝난 뒤 한 번만 합니다. 언롤링 구현은 이 accumulator를 네 개로 나눠 벡터 덧셈끼리도 서로 기다리지 않게 합니다.

> [!CAUTION]
> **AVX2 성능을 측정하려면 AVX2 명령어와 256비트 YMM 레지스터를 실제로 지원하는 CPU·운영체제·런타임이 반드시 필요합니다.** `Avx2.IsSupported == false`인 환경에서 나온 값은 AVX2 측정값이 아닙니다. 라이브러리 구현은 호환성을 위해 scalar 경로로 fallback할 수 있지만, 벤치마크 러너는 그런 결과가 AVX2 수치로 오인되지 않도록 실행을 중단합니다. BenchmarkDotNet의 환경 출력에 `HardwareIntrinsics=AVX2`와 `VectorSize=256`이 있는지도 확인해야 합니다. 단위 테스트가 통과했다는 사실만으로 AVX2 명령이 실행됐다고 판단하면 안 됩니다.

## 구조

```text
src/SSW.Benchmarks.SimdAvx2/
  Abstractions/          # ByteRange, IRangeSumCalculator
  Implementations/Scalar # 분기, 브랜치리스
  Implementations/Simd   # AVX2, AVX2 언롤링, 곱셈-덧셈, 곱셈-덧셈 + 프리페치
  Decorators/            # 병렬 구간 분할
tests/                   # 모든 변형의 결과 동등성
bench/                   # 실제 구현을 호출하는 BenchmarkDotNet runner
```

## 곱셈-덧셈 구현

`MultiplyAddAvx2RangeSumCalculator`와 `PrefetchMultiplyAddAvx2RangeSumCalculator`는 예전에 손으로 짠 다른 구현과 달리 에이전트와 함께 한계까지 다듬은 버전입니다.

- 값에 `0x80 - 최솟값`을 더해 범위 검사를 부호 있는 비교 한 번으로 줄이고, AND와 SAD를 `vpmaddubsw` 하나로 합쳐 벡터당 명령을 여덟 개에서 네 개로 줄였습니다. `vpmaddubsw`가 이웃한 두 바이트의 합을 16비트 칸에 모으므로, 64번 반복마다 64비트 누적값으로 넓혀 넘치지 않게 합니다.
- 벡터 읽기를 32바이트 경계에 맞추고 누적 벡터를 여덟 개로 늘렸습니다.
- 프리페치 구현은 `Sse.Prefetch0`로 2,048바이트 앞을 미리 읽습니다. 이 API가 포인터만 받기 때문에 라이브러리 프로젝트에 `AllowUnsafeBlocks`를 켰고, `unsafe` 코드는 이 구현 하나에만 있습니다. 프리페치 없는 곱셈-덧셈 구현은 `ref`와 `Vector256.LoadUnsafe`만 씁니다.
- 프리페치 거리와 누적 벡터 수는 i5-9600K(L2 256 KB)에 맞춘 값이라 다른 CPU에서는 최적이 아닐 수 있습니다.

## 측정 조건

벤치마크 입력은 연구 페이지의 원 실험과 같습니다. 고정 시드로 만든 1 MiB(1,048,576바이트) 무작위 바이트에서 100 이상 200 이하인 값을 합산합니다. 테스트는 벡터 폭의 배수가 아닌 1,000,003바이트를 써서 남은 꼬리 바이트 처리까지 확인합니다.

## 실행

이 디렉터리에서 실행합니다.

```powershell
.\run-tests.ps1
.\run-benchmark.ps1 -List
.\run-benchmark.ps1
```

마지막 명령은 사용자가 자신의 CPU와 전원 설정에서 측정할 때만 실행합니다.

SDK 빌드와 BenchmarkDotNet 산출물은 `benchmarks/artifacts/` 아래에 모입니다.

## 결과 정책

구현 변형의 정답성은 테스트로 확인합니다. 성능은 CPU, 운영체제, 런타임과 전원 설정에 따라 달라지므로 고정된 결과 수치를 제공하지 않으며 사용자가 자신의 환경에서 직접 실행해 확인합니다.
