# Strongly Typed Values: 값 객체 표현 비교

## 배경

이 실험은 같은 주문 금액 계산을 원시 정수, `readonly record struct` 값 객체, class wrapper로 표현합니다. 비교의 핵심은 도메인 의미를 타입으로 드러낼 때의 호출 경계와 객체 표현 차이이며, 어느 표현이 항상 더 빠르거나 더 낫다고 전제하지 않습니다.

`ProductId`, `UnitPrice`, `Quantity`는 서로 다른 타입이므로 강타입 주문 생성자에 잘못된 의미의 값을 넘기는 코드는 컴파일되지 않습니다. 값 객체는 생성 시 유효 범위를 검사하고, 원시값으로 돌아가는 경계는 `ToPrimitive()`로 명시합니다.

## 전제 상황과 샘플 데이터

상품 식별자, 단가, 수량처럼 의미는 완전히 다르지만 저장 형식은 모두 `int`인 주문 데이터를 가정합니다. 원시 정수만 사용하면 세 값의 위치를 바꾸어도 타입이 같기 때문에 컴파일러가 의미상의 실수를 구분하지 못합니다. 반대로 각각을 이름이 다른 값 객체로 감싸면 메서드와 생성자 서명만 읽어도 어떤 값이 필요한지 드러나고, 잘못된 타입을 전달하는 코드를 컴파일 단계에서 막을 수 있습니다.

벤치마크는 아래 한 건의 주문을 세 가지 표현으로 미리 생성합니다.

| 항목 | 값 | 의미 |
| --- | ---: | --- |
| `ProductId` | `7` | 상품을 구분하는 식별자입니다. |
| `UnitPrice` | `120` | 상품 한 개의 단가입니다. |
| `Quantity` | `3` | 주문 수량입니다. |
| 계산 결과 | `360` | `UnitPrice × Quantity`의 결과입니다. |

| 비교 방식 | 표현 | 확인하려는 차이 |
| --- | --- | --- |
| primitive 기준선 | `PrimitiveOrder(int, int, int)` | 가장 단순하지만 같은 정수끼리 의미가 섞일 수 있는 표현입니다. |
| `readonly record struct` 값 객체 | `ProductId`, `UnitPrice`, `Quantity`를 각각 값 형식으로 정의합니다. | 도메인 의미·유효성 검사·값 동등성을 유지하면서 참조형 wrapper 없이 표현합니다. |
| class wrapper | 같은 세 의미를 각각 `sealed class`로 정의합니다. | 강타입 가독성은 유지하되 참조 형식과 객체 간접 참조를 사용하는 비교군입니다. |

## 가독성과 DOD 관점에서 보는 값 형식

C#의 `struct`와 `record struct`는 데이터를 직접 담는 사용자 정의 값 형식입니다. 작은 도메인 값인 `ProductId`, `UnitPrice`, `Quantity`를 `readonly record struct`로 표현하면 이름이 타입에 남아 코드 가독성과 컴파일 시점 안전성을 확보하면서, class wrapper에 필요한 개별 객체 참조와 힙 할당을 줄일 여지도 함께 가질 수 있습니다. C# 값 형식의 직접 저장과 복사 의미는 [Microsoft의 C# struct 설명](https://learn.microsoft.com/dotnet/csharp/fundamentals/types/structs)에서도 확인할 수 있습니다.

이 특성은 데이터 지향 설계(Data-Oriented Design, DOD)와도 연결됩니다. 많은 주문을 배열처럼 연속된 구조로 보관하고 같은 계산을 반복한다면 값 형식은 참조를 따라 여러 객체를 방문하는 구조보다 데이터를 조밀하게 배치하고 간접 참조를 줄이기 쉬우며, 캐시 지역성을 고려한 일괄 처리 구조를 설계하는 데 유리할 수 있습니다. 즉 도메인 타입의 이름을 포기하지 않으면서도 데이터 배치와 처리 비용을 함께 고려할 수 있다는 점이 C# 값 형식의 장점입니다.

Java SE 26의 정식 타입 체계는 기본형(primitive type)과 참조형(reference type)으로 나뉘며, class와 record는 참조형입니다. 따라서 현재 정식 Java 언어에는 C#의 사용자 정의 `struct`와 직접 대응하는 일반 구조체 타입이 없습니다. 이는 [Java Language Specification의 타입 분류](https://docs.oracle.com/en/java/javase/26/docs/specs/jls/jls-4.html)에서 확인할 수 있습니다. 다만 Java에도 값 객체를 도입하려는 [Project Valhalla](https://openjdk.org/projects/valhalla/)가 진행 중이므로, 이 차이를 Java의 영구적인 한계로 단정하지는 않습니다.

현재 벤치마크는 주문 객체를 `GlobalSetup`에서 한 번 생성한 뒤 `CalculateTotal()` 호출만 측정합니다. 따라서 값 객체 생성 시의 할당량, 대량 배열의 실제 메모리 배치, 캐시 적중률까지 검증한 실험은 아닙니다. DOD 이점을 수치로 확인하려면 다수 주문의 생성·저장·순회까지 포함한 별도 벤치마크가 필요합니다. 또한 struct가 커지면 복사 비용이 늘고 인터페이스로 변환할 때 boxing이 생길 수 있으므로, 값 형식이 언제나 class보다 빠르다고 결론 내리지 않습니다.

## 실험 범위

이 공개 실험은 ASP.NET Core TempData 직렬화 예외가 아니라, 강타입 값 객체의 타입 안전성과 표현 비용 비교에 집중합니다. 강타입이 타입 혼용을 줄이는 API 경계와 값 형식·참조 형식의 비용을 같은 입력과 런타임에서 검증할 수 있도록 구성했습니다.

## 구조

```text
strongly-typed-values/
├─ src/SSW.Benchmarks.StronglyTypedValues/              # primitive·struct·class 도메인 모델
├─ tests/SSW.Benchmarks.StronglyTypedValues.Tests/      # 동등성·유효성·생성자 타입 경계 검증
└─ bench/SSW.Benchmarks.StronglyTypedValues.Benchmarks/ # 동일 주문의 금액 계산 BenchmarkDotNet 러너
```

## 실행

이 디렉터리에서 실행합니다.

```powershell
.\run-tests.ps1
.\run-benchmark.ps1 -List
.\run-benchmark.ps1
```

SDK 빌드와 BenchmarkDotNet 산출물은 `benchmarks/artifacts/` 아래에 모입니다.

성능은 실행 환경에 따라 달라지므로 이 문서에는 고정 수치를 제공하지 않습니다.
