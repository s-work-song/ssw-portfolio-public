import {
  SIMD_RECORD_BASELINE_ROOT_URL,
  SIMD_RECORD_BASELINE_SOURCE_URL,
} from '@/features/research/data/benchmarks';
import ResearchLink from '@/features/research/ui/ResearchLink';

/**
 * 숨겨 둔 기록 깨기(SIMD 범위 합산) 접기 상자다.
 *
 * 연구 페이지 SIMD 카드 아래와 구직용 자기소개서 마무리 두 곳에서 같은 본문을 쓴다.
 * 챗봇 지식·최적화 개요에는 넣지 않는다. `context`에 따라 "위 비교"처럼 앞 내용을
 * 가리키는 말과 접기 제목의 크기만 바꾼다.
 */
export default function SimdRecordChallenge({ context }: Readonly<{ context: 'research' | 'cover-letter' }>) {
  const inResearch = context === 'research';
  return (
    <details style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
      <summary style={{ width: 'fit-content', marginLeft: 'auto', cursor: 'pointer', fontSize: inResearch ? '0.75rem' : '0.875rem', color: inResearch ? 'var(--text-mute)' : 'var(--text-dim)' }}>
        🥚 이 기록, 깰 수 있을까요?
      </summary>
      <div style={{ marginTop: '12px', padding: '16px 18px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px dashed var(--border-strong)', lineHeight: 1.7, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
        <p style={{ margin: 0 }}>
          이 실험의 차별점은 메모리 관리 언어인 C#의 안정성을 지키면서 비관리 언어인 C++ 수준의 성능을 내는 것입니다.{' '}
          {inResearch ? '위 비교' : '연구 페이지의 비교'}에서도 C++ 구현(34.5 μs)과 C# SIMD 구현(37 μs)의 처리 시간은 비슷했습니다.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          이 차별점을 유지하면서, 그때 직접 타이핑해 짠 C# 코드(37 μs)를 먼저 에이전트 하나와 함께 다듬었고, 이어서 서로 다른 하네스의 두 에이전트가 협업해 한 번 더 최적화했습니다. 그 결과를 기록으로 걸어 두었습니다(아래 기준 측정 결과).
          같은 문제를 이 기록보다 빠르게 푸는 코드를 만들면 기록을 깬 것입니다. 각자의 PC에서 재 보고 결과를 보내 주시면 누구나 참가할 수 있습니다.
        </p>
        <p style={{ margin: '10px 0 0' }}>
          기준 코드도 에이전트와 함께 다듬은 것이니, 참가하실 때도 에이전트를 써도 좋습니다. 더 좋은 방식으로 기록을 넘으면 인정합니다.
        </p>

        <div style={{ marginTop: '14px', fontWeight: 700, color: 'var(--text)' }}>두 가지 트랙</div>
        <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
          <li>
            <strong style={{ color: 'var(--text)' }}>트랙 1 · <code>unsafe</code> 없는 C#</strong>: 기준 코드는{' '}
            <a href={`${SIMD_RECORD_BASELINE_SOURCE_URL}/Stage3Collaboration/UnrolledPairedLookaheadMultiplyAddAvx2RangeSumCalculator.cs`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}><code>UnrolledPairedLookaheadMultiplyAddAvx2RangeSumCalculator</code></a>입니다.
            <code>unsafe</code> 키워드와 포인터 없이 C#만으로 넘어야 합니다.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>트랙 2 · 제한 없음</strong>: 기준 코드는{' '}
            <a href={`${SIMD_RECORD_BASELINE_SOURCE_URL}/Stage3Collaboration/PairedPrefetchMultiplyAddAvx2RangeSumCalculator.cs`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}><code>PairedPrefetchMultiplyAddAvx2RangeSumCalculator</code></a>입니다.
            언어와 <code>unsafe</code> 모두 자유입니다.
          </li>
        </ul>

        <div style={{ marginTop: '14px', fontWeight: 700, color: 'var(--text)' }}>기준 측정 결과</div>
        <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontVariantNumeric: 'tabular-nums' }}>
          <li>트랙 1 기준(<code>Avx2UnrolledPairedLookahead</code>): <strong style={{ color: 'var(--text)' }}>14.56 μs</strong> (표준편차 0.42)</li>
          <li>트랙 2 기준(<code>Avx2PairedPrefetch</code>): <strong style={{ color: 'var(--text)' }}>12.72 μs</strong> (표준편차 0.21)</li>
          <li>참고 · {inResearch ? '위' : '연구 페이지'} C# SIMD의 공개 재구성(<code>Avx2Unrolled</code>): <strong style={{ color: 'var(--text)' }}>36.06 μs</strong> (표준편차 0.73)</li>
        </ul>
        <p style={{ margin: '8px 0 0', fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--text-mute)' }}>
          측정 환경: Intel Core i5-9600K(Coffee Lake, 3.7 GHz, 코어당 L2 256 KB), Windows 11, .NET 8.0.23(x64 RyuJIT, x86-64-v3),
          BenchmarkDotNet 0.15.8 기본 설정입니다. 입력은 아래 규칙과 같은 1 MiB 데이터에서 100 이상 200 이하 범위입니다.
          같은 PC에서도 실행마다 몇 %씩 흔들리므로, 비교는 기준 코드와 같은 실행 안에서 합니다.
        </p>

        <div style={{ marginTop: '14px', fontWeight: 700, color: 'var(--text)' }}>규칙</div>
        <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
          <li>
            <strong style={{ color: 'var(--text)' }}>같은 문제</strong>: <code>DeterministicByteData.Create(1_048_576)</code> 입력에서 100 이상 200 이하인 바이트의 합입니다.
            결과가 같아야 하고, 측정 밖에서 미리 계산해 둘 수 없습니다. 입력 길이가 벡터 폭의 배수가 아니거나 시작 주소가 정렬되지 않아도 같은 결과를 내야 합니다.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>같은 조건</strong>: AVX2까지(AVX-512 제외), 단일 스레드입니다.
            명령어는 x86-64-v3 수준(AVX2·FMA·BMI1·BMI2 등)까지만 쓰고, AVX-VNNI·AVX-IFMA·AVX10처럼 그 뒤에 나온 확장은 쓰지 않습니다.
            각자의 PC에서{' '}
            <a href={SIMD_RECORD_BASELINE_ROOT_URL} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>기준 코드의 벤치마크</a>와 같은 BenchmarkDotNet 실행으로 함께 잽니다.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>통과 기준</strong>: 기준 코드보다 10% 이상 빠르면 됩니다.
            이 문턱은 절대적인 기준이 아닙니다. 입력이 L2 캐시에 들어가는 경우와 들어가지 않는 경우를 직접 재 보고, 최신 CPU의 캐시 구성을 참고해 정한 값입니다.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>환경 맞춤 튜닝</strong>: 기준 코드의 미리 읽기 거리(4,096바이트·1,024바이트)와 누적 벡터 개수(8개)는 i5-9600K에 맞춘 값입니다.
            이런 상수는 각자의 환경에 맞게 조정해도 되지만, 개선 폭은 절대 시간이 아니라 같은 환경에서 잰 기준 코드 대비 비율로 봅니다.
            다만 상수 조정만으로 얻은 향상은 이 기록 깨기가 찾는 개선이 아닙니다. 명령 선택, 데이터 접근 방식, 알고리즘처럼 방법 자체를 바꾼 개선을 찾습니다.
            그래서 제출 코드는 제 PC(i5-9600K)에서도 다시 재서 기준 코드와 비교해 봅니다. 같은 실행에서 5% 이내면 같은 속도로 봅니다.
          </li>
        </ul>

        <div style={{ marginTop: '14px', fontWeight: 700, color: 'var(--text)' }}>왜 AVX-512는 빼나요?</div>
        <p style={{ margin: '6px 0 0' }}>
          참가자 CPU마다 AVX-512 지원 범위가 달라 같은 조건으로 비교하기 어렵기 때문입니다.
          리누스 토발즈(Linus Torvalds)도 2020년에 AVX-512가 전력을 많이 먹고 시장 파편화를 키웠다고 비판하며
          {' '}&ldquo;I hope AVX512 dies a painful death&rdquo;라고까지 말했습니다(
          <a href="https://www.phoronix.com/news/Linus-Torvalds-On-AVX-512" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>Phoronix 기사</a>).
          에이전트로 최적화할 때 주의할 점은{' '}
          <ResearchLink href="/about-me/research#research-optimization-caution" arrow={false} style={{ color: 'var(--accent-text)' }}>성능 최적화 개요</ResearchLink>에 정리했습니다.
        </p>

        <p style={{ margin: '14px 0 0' }}>
          코드와 두 측정 결과(CPU 모델과 측정 방법 포함)를{' '}
          <a href="mailto:sworksong@gmail.com" style={{ color: 'var(--accent-text)' }}>sworksong@gmail.com</a>으로 보내 주세요.
          문턱에 못 미치더라도 새로운 관점이 담긴 시도라면 보내 주세요. 이 기록 깨기는 더 빠른 코드만큼이나, 이런 문제를 재미있어하는 분을 만나고 싶어서 열어 둔 것입니다.
        </p>
        <p style={{ margin: '10px 0 0', color: 'var(--text)', fontWeight: 600 }}>
          이 기록을 깨는 분이 계신 팀이라면 제가 배울 사람이 있는 곳입니다. {inResearch ? '만약 제가 구직 중이라면 ' : ''}처우보다 배움을 우선해 합류를 진지하게 검토하겠습니다.
        </p>
      </div>
    </details>
  );
}
