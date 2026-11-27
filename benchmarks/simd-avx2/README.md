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
  Implementations/Simd/
    Stage1Handwritten    # 1단계: 챗봇을 참고해 직접 짠 AVX2, AVX2 언롤링
    Stage2SingleAgent    # 2단계: 에이전트 하나와 다듬은 곱셈-덧셈, 곱셈-덧셈 + 프리페치
    Stage3Collaboration  # 3단계: 서로 다른 하네스의 두 에이전트가 협업한 짝 프리페치, 짝 선행 읽기
  Decorators/            # 병렬 구간 분할
tests/                   # 모든 변형의 결과 동등성
bench/                   # 실제 구현을 호출하는 BenchmarkDotNet runner
```

## 단계별 구현

같은 문제를 SI 활용 방식이 바뀔 때마다 다시 풀었고, 단계마다 폴더를 나눠 모두 남겨 두었습니다. 클래스 이름은 단계와 상관없이 기법을 나타냅니다.

### 1단계: 챗봇을 참고해 직접 짠 구현 (`Stage1Handwritten`)

`Avx2RangeSumCalculator`와 `UnrolledAvx2RangeSumCalculator`는 챗봇에게 인트린직과 예제 코드를 물어 가며 직접 타이핑해 짠 구현을 공개용으로 재구성한 것입니다. 범위 검사를 `max`·`min`과 같음 비교 두 번으로 하고, 마스크를 AND로 씌운 뒤 SAD로 부분합을 모읍니다. 언롤링 구현은 누적 벡터를 네 개로 나눠 의존 사슬을 줄입니다.

### 2단계: 에이전트 하나와 다듬은 구현 (`Stage2SingleAgent`)

`MultiplyAddAvx2RangeSumCalculator`와 `PrefetchMultiplyAddAvx2RangeSumCalculator`는 1단계 코드를 에이전트 하나와 함께 한계까지 다듬은 버전입니다.

- 값에 `0x80 - 최솟값`을 더해 범위 검사를 부호 있는 비교 한 번으로 줄이고, AND와 SAD를 `vpmaddubsw` 하나로 합쳐 벡터당 명령을 여덟 개에서 네 개로 줄였습니다. `vpmaddubsw`가 이웃한 두 바이트의 합을 16비트 칸에 모으므로, 64번 반복마다 64비트 누적값으로 넓혀 넘치지 않게 합니다.
- 벡터 읽기를 32바이트 경계에 맞추고 누적 벡터를 여덟 개로 늘렸습니다.
- 프리페치 구현은 `Sse.Prefetch0`로 2,048바이트 앞을 미리 읽습니다. 이 API가 포인터만 받기 때문에 라이브러리 프로젝트에 `AllowUnsafeBlocks`를 켰습니다. 프리페치 없는 곱셈-덧셈 구현은 `ref`와 `Vector256.LoadUnsafe`만 씁니다.

### 3단계: 서로 다른 하네스의 두 에이전트가 협업한 구현 (`Stage3Collaboration`)

Claude Code의 Fable 5.2와 Codex의 GPT 6.2 Astra가 공통 메일 규약과 공유 게시판으로 아이디어를 주고받으며 2단계 코드를 다시 다듬었습니다. 계산(범위 검사, `vpmaddubsw`, 누적 벡터 여덟 개)은 2단계와 같고, 메모리에서 데이터를 가져오는 방식을 바꿨습니다.

- `PairedPrefetchMultiplyAddAvx2RangeSumCalculator`(`unsafe` 사용): 캐시 줄을 128바이트 짝으로 보고, 짝의 앞 줄은 4,096바이트 앞에서, 뒷줄은 1,024바이트 앞에서 프리페치합니다. 앞 줄 요청이 L2의 인접 줄 프리페처를 깨워 뒷줄까지 L2로 가져오게 하는 것이 핵심입니다. 같은 두 거리를 쓰되 짝 구조를 뺀 대조군은 2단계보다 약 8% 빨라지는 데 그쳐, 짝 구조를 넣은 쪽(약 14%)보다 이득이 작았습니다.
- `PairedLookaheadMultiplyAddAvx2RangeSumCalculator`(`unsafe` 없음): 프리페치 명령 대신 앞쪽 바이트 하나를 `Volatile.Read`로 실제로 읽어 캐시 줄을 요청합니다. 이 선행 읽기는 Astra가, 짝 구조는 Fable이 찾았고 둘을 합친 구현입니다.
- `UnrolledPairedLookaheadMultiplyAddAvx2RangeSumCalculator`(`unsafe` 없음): 위 구현을 한 반복에 블록 두 개(512바이트)씩 처리하도록 풀었습니다. 선행 읽기는 블록마다 그 블록 몫을 따로 냅니다. 빨라지는 이유는 확인하지 못했고, 셋 이상으로 풀면 이득이 없었습니다.

동작 원리 설명은 측정 결과에 맞춘 추론이며 하드웨어 카운터로 확인하지 않았습니다. 프리페치·선행 읽기 거리와 누적 벡터 수는 i5-9600K(L2 256 KB)에서 1 MiB 입력으로 고른 값이라 다른 CPU에서는 최적이 아닐 수 있습니다.

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
