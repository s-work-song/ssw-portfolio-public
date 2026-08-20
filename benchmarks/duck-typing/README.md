# Duck Typing: 패턴 기반 열거 비교

## 배경

C#의 foreach는 `IEnumerable<T>` 구현만이 아니라 `GetEnumerator`·`MoveNext`·`Current` 모양을 가진 타입도 사용할 수 있습니다. 이것은 구조적 패턴을 컴파일 시점에 찾는 기능이며, 성능 우위는 입력·런타임·호출 형태에 따라 달라집니다. 이 저장소는 결과 수치를 주장하지 않고 같은 결과와 할당량을 검증할 수 있는 구조만 제공합니다.

이 실험은 같은 `_` 구분 토큰 배열을 네 가지 열거 경로로 끝까지 소비합니다. 인터페이스 기반 열거, 값 형식 열거자가 인터페이스로 반환되어 boxing되는 경로, `GetEnumerator` 패턴을 이용한 struct 열거, `ReadOnlySpan<string>`을 보관하는 ref struct 열거를 분리했습니다.

## 전제 상황과 샘플 데이터

구분자로 이어진 식별자나 경로 조각을 한 번 분해한 뒤, 모든 토큰을 순서대로 처리하는 상황을 가정합니다. 파일·리소스 키, 명령 문자열, 직렬화 전처리처럼 이미 나누어진 문자열 배열을 반복해서 소비해야 할 때 적용할 수 있는 형태입니다. 이 실험은 문자열 분할 알고리즘이 아니라, 분할이 끝난 같은 배열을 `foreach`로 열거할 때 구현 방식에 따라 호출 경로와 할당이 어떻게 달라질 수 있는지를 분리해 살펴봅니다.

벤치마크의 원본 문자열은 다음과 같습니다.

```text
alpha_bravo__charlie_delta_
```

`_`를 구분자로 사용하고 빈 항목을 보존하므로 준비 단계에서 아래 여섯 개의 토큰을 만듭니다.

```text
["alpha", "bravo", "", "charlie", "delta", ""]
```

연속 구분자 `__`와 마지막 구분자 `_`가 각각 빈 문자열을 하나씩 만듭니다. 네 구현은 이 배열을 처음부터 끝까지 순회하며 각 토큰의 길이를 더하고, 모두 같은 결과인 `22`를 반환해야 합니다. 문자열 분할 비용이 측정에 섞이지 않도록 토큰 배열은 BenchmarkDotNet의 `GlobalSetup`에서 한 번만 생성합니다.

| 비교 방식 | 열거 경로 | 확인하려는 차이 |
| --- | --- | --- |
| 인터페이스 열거 | 배열을 `IEnumerable<string>` 계약으로 소비합니다. | 가장 익숙한 추상화 경계의 호출 비용을 기준선으로 둡니다. |
| boxing 열거 | 값 형식 열거자를 `IEnumerator<string>` 인터페이스로 반환합니다. | 값 형식이 인터페이스로 변환될 때 발생할 수 있는 boxing과 할당을 관찰합니다. |
| pattern struct 열거 | `GetEnumerator`·`MoveNext`·`Current` 모양을 가진 구체 struct를 직접 사용합니다. | 인터페이스 없이 컴파일러가 찾는 `foreach` 패턴의 호출 경로를 확인합니다. |
| ref struct 패턴 열거 | `ReadOnlySpan<string>`을 보관하는 `ref struct` 열거자를 사용합니다. | 힙으로 이스케이프하거나 boxing할 수 없는 제약 아래에서 span 기반 열거를 비교합니다. |

여기서 Duck Typing은 런타임 동적 타입을 의미하지 않습니다. 필요한 멤버의 모양이 맞으면 C# 컴파일러가 `foreach` 패턴으로 인정하는 컴파일 시점의 구조적 사용 방식을 가리킵니다.

## 원본과 재구성의 범위

원본 `SSW.Example.DuckTyping`에는 pattern enumerator, ArrayPool 버퍼의 using 강제 Roslyn analyzer, 간단한 source generator가 함께 있었습니다. 이번 재구성은 주제를 좁혀 **열거 방식의 비교**만 core에 넣었고, analyzer/generator는 반입하지 않았습니다. 원본 BenchmarkDotNet 러너는 실제 변형 대신 문자열을 출력하는 활성 항목이 있어 사용하지 않았습니다.

## 구조

```text
duck-typing/
├─ src/SSW.Benchmarks.DuckTyping/              # 토큰화 계약과 네 열거 구현
├─ tests/SSW.Benchmarks.DuckTyping.Tests/      # 빈 입력·경계 구분자·동등 결과 검증
└─ bench/SSW.Benchmarks.DuckTyping.Benchmarks/ # 실제 구현을 소비하는 BenchmarkDotNet 러너
```

토큰화 계약은 빈 입력을 빈 토큰 시퀀스로 처리하고, 그 외 입력의 연속·시작·끝 구분자에서 생기는 빈 토큰은 보존합니다. 따라서 구현 간 비교에서 의미가 달라지지 않습니다.

## 실행

이 디렉터리에서 실행합니다.

```powershell
.\run-tests.ps1
.\run-benchmark.ps1 -List
.\run-benchmark.ps1
```

SDK 빌드와 BenchmarkDotNet 산출물은 `benchmarks/artifacts/` 아래에 모입니다.

측정 결과는 검증 실행 후 기록합니다. 이 문서에는 수치를 미리 적지 않습니다.
