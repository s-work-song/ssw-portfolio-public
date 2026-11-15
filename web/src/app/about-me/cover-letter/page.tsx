/**
 * 자기소개서의 서사와 핵심 가치 섹션을 순서대로 표현하는 정적 서버 컴포넌트다.
 * 현재 콘텐츠가 고정된 단일 문서이므로 데이터 계층을 억지로 추가하지 않고,
 * 페이지 내부의 문서 구조와 가독성에만 책임을 둔다.
 */
import React from 'react';
import Link from 'next/link';
import { AskAiButton } from '@/features/chat';
import CareerTurningPointPreview from '@/features/profile/ui/CareerTurningPointPreview';
import LogReadingLink from '@/features/logs/navigation/LogReadingLink';

/** 강점과 약점: 본인이 확인한 강점(지식 문서 profile.md 핵심 강점과 같은 내용). */
const STRENGTHS = [
  {
    title: '역할을 나눈 검증 흐름 설계',
    body: '여러 SI 세션이 작업·관리·검증 역할을 나눠 맡도록 작업 체계와 검증 흐름을 설계합니다.',
  },
  {
    title: '측정으로 찾는 병목',
    body: 'CPU·메모리·I/O를 직접 측정해 성능 병목을 찾고, 측정 가능한 근거로 해결책을 검증합니다.',
  },
  {
    title: '빗나간 결과를 다음 가설로',
    body: '예상과 다른 실험 결과를 실패로 끝내지 않고, 다음 가설로 바꿔 다시 검증합니다.',
  },
  {
    title: '전체 연결 구조를 보는 시야',
    body: '웹·앱·서버·인프라를 함께 다뤄 와서, 기능 하나보다 전체가 어떻게 이어지는지를 먼저 봅니다.',
  },
];

/** 본인이 밝힌 약점과 보완 방식(지식 문서 profile.md 약점과 보완 방식과 같은 내용). */
const WEAKNESSES = [
  {
    title: '즉석 구두 설명',
    weakness: '정리된 글과 문서로는 잘 설명하지만, 회의에서 즉석으로 구두 설명을 풀어내는 것은 상대적으로 약한 편입니다.',
    remedy: '중요한 논의는 자료를 먼저 정리해 공유하고, 구두로 논의한 뒤에는 결정 사항을 문서로 남깁니다.',
  },
  {
    title: '몰입이 끊길 때',
    weakness: '깊이 몰입한 상태가 예고 없이 끊기면 스트레스를 크게 받는 편입니다. 작업 전환 자체는 받아들이지만, 몰입이 반복해서 끊기면 결과 품질이 떨어진다고 봅니다.',
    remedy: '급하지 않은 요청은 정리해서 받고, 급한 사안은 구두로 알려 주시면 우선순위를 바로 조정합니다.',
  },
  {
    title: '마감과 품질',
    weakness: '품질을 먼저 챙기고 싶은 성향이 있습니다.',
    remedy: '현실에서는 마감을 먼저 지키는 것을 기본값으로 삼고 있고, 이 방식으로 문제가 된 적은 없습니다.',
  },
  {
    title: '코드 스타일에 대한 고집',
    weakness: '예전에는 코드 스타일을 사용 언어와 기술적 문맥을 고려한 정석으로 바로잡으려는 고집이 있었습니다.',
    remedy: '지금은 팀이 합의한 스타일을 우선 기준으로 정하고 그대로 따르며, 정석적인 방식은 제안만 합니다.',
  },
];

/** 함께 일할 때 중요하게 보는 것(지식 문서 employment-preferences.md 중요하게 보는 조건과 같은 순서). required는 필수 조건. */
const PRIORITIES = [
  {
    title: '합법성과 윤리',
    required: true,
    body: '사용자 피해, 불법·비윤리적 행위, 개인정보·보안 문제, 데이터 훼손이나 복구하기 어려운 장애 가능성은 일정이나 속도를 이유로 타협하지 않습니다. 법적 위험이 불분명하면 확인 없이 진행하지 않습니다.',
    log: { lead: '이 기준을 더 분명히 갖게 된 계기', slug: 'scale-and-appearance-do-not-guarantee-business-integrity', title: '규모와 외형이 사업의 건전성을 보장하지는 않습니다' },
  },
  {
    title: 'SI 에이전트를 실제 업무에 쓸 수 있는 환경',
    required: true,
    body: 'SI 에이전트 사용을 형식적으로 허용하는 데 그치지 않고, 실제 업무에 바로 활용할 수 있는 환경이어야 합니다. SI 에이전트를 쓸 수 없는 폐쇄망 같은 환경에서는 지금의 작업 방식을 이어 가기 어렵습니다.',
  },
  {
    title: '최고의 복지는 동료',
    body: '좋은 동료와 함께 일하는 것이 어떤 제도보다 큰 복지라고 생각합니다. 아는 것을 먼저 나눠 공통의 맥락을 만들고, 서로 다른 경험과 관점으로 각자의 빈틈을 채우며 함께 성장하는 관계를 원합니다.',
    log: { lead: '이 생각을 자세히 쓴 글', slug: 'mutual-respect-creates-a-virtuous-cycle-of-knowledge', title: '상호 존중이 만드는 지식의 선순환' },
  },
  {
    title: '근무지까지의 거리',
    body: '회사 사무실이든 파견지든 프로젝트 현장이든, 매일 오가는 거리는 오래 꾸준히 일할 수 있는지에 직접 영향을 줍니다. 파견 근무 자체는 가능하지만, 근무지가 가능한 한 편도 1시간 안쪽인지를 중요하게 봅니다.',
  },
  {
    title: '깊이 몰입할 수 있는 시간',
    body: '잦은 방해 없이 깊게 몰입할 수 있는 시간이 결과 품질로 이어진다고 봅니다.',
  },
];

/** 취미와 관심사(지식 문서 personality-and-priorities.md 취미와 관심사와 같은 내용). */
const HOBBIES = [
  {
    title: 'SI 에이전트 실험',
    body: '떠오른 생각을 SI 에이전트와 함께 바로 만들어 보고 결과를 확인하는 일이 지금 가장 많은 시간을 쓰는 취미입니다.',
  },
  {
    title: '하드웨어·홈서버·자동화',
    body: '하드웨어 구성과 벤치마킹, 홈서버와 자동화, 새로 나온 SI 도구 써 보기가 서로 이어진 컴퓨터 취미입니다.',
  },
  {
    title: '운동',
    body: '일주일에 서너 번 가벼운 스트레칭과 웨이트 트레이닝을 합니다.',
  },
  {
    title: '게임',
    body: '요즘 직접 플레이하는 시간은 많지 않지만, 게임 영상을 보며 장르와 구성 요소를 살펴봅니다.',
  },
];
/** 핵심 가치(지식 문서 profile.md 핵심 가치와 같은 내용). */
const CORE_VALUES = [
  {
    title: '본질 추구',
    body: '표면적인 문제보다 그 이면에 있는 진짜 원인을 찾아 해결합니다.',
    question: '가치관 중 「본질 추구」가 실제 문제 해결 과정에서 드러난 사례를 알려 주세요.',
  },
  {
    title: '빠른 실행',
    body: '완벽함보다는 완성에 초점을 맞추며, 빠르게 검증하고 개선해 나갑니다.',
    question: '가치관 중 「빠른 실행」을 POC와 검증 과정에서 어떻게 적용하는지 알려 주세요.',
  },
  {
    title: '투명한 소통',
    body: '솔직하게 공유하고 협력할 때 최고의 결과물이 나온다고 믿습니다.',
    question: '가치관 중 「투명한 소통」을 협업에서 어떻게 실천하는지 알려 주세요.',
  },
];

/** 성격(지식 문서 profile.md 자기소개서 성격 항목과 같은 내용). */
const TRAITS = [
  {
    label: '탐구',
    title: '오래 파고들고 직접 확인하는 편',
    body: '생각과 상상이 많은 편이라, 관심 있는 문제는 여러 관점에서 오래 파고들고 직접 시험해 원인을 확인합니다. 확실한 내용은 근거를 들어 말하고, 확신이 없으면 모른다고 밝힙니다.',
  },
  {
    label: '기술자',
    title: '사업가보다는 기술자에 가까운 성향',
    body: '투자를 받으려면 어느 정도의 과장이 필요하다는 것은 알지만, 기술적으로 아직 어려운 것을 이미 가능한 것처럼 말하는 일은 잘 맞지 않습니다. 대신 내부에서 실험하고 실측하며 기술을 개선하고, 실제로 어디까지 가능한지 근거를 정리하는 일은 즐겁게 합니다.',
  },
];

/** 앞으로 탐구하고 싶은 분야. */
const NEXT_INTERESTS = ['XR', '게임 제작', '임베디드', '실제 제품 만들기'];

const cardStyle: React.CSSProperties = {
  padding: '22px 24px',
  background: 'var(--bg)',
  borderRadius: '16px',
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};
const cardTitleStyle: React.CSSProperties = { fontSize: '1.0625rem', fontWeight: 700, margin: 0, color: 'var(--text)', lineHeight: 1.35, wordBreak: 'keep-all' };
const cardTextStyle: React.CSSProperties = { margin: 0, color: 'var(--text-dim)', lineHeight: 1.65, fontSize: '0.9375rem', wordBreak: 'keep-all' };
const subheadStyle: React.CSSProperties = { fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text)' };
const tagStyle: React.CSSProperties = {
  display: 'inline-block',
  minWidth: '2.6em',
  marginRight: '8px',
  padding: '1px 8px',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 700,
  textAlign: 'center',
  verticalAlign: '1px',
};

/** 자기소개서 본문 패널(옅은 점 격자 배경). 성격·강점과 약점·취미 섹션이 함께 쓴다. */
function CoverPanel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} tabIndex={-1} style={{
      padding: 'clamp(26px, 5vw, 40px) clamp(18px, 4vw, 32px)',
      background: 'var(--bg-elev)',
      borderRadius: '24px',
      border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)',
      position: 'relative',
      overflow: 'hidden',
      scrollMarginTop: '96px'
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        opacity: 'var(--surface-pattern-opacity, 0.3)',
        pointerEvents: 'none'
      }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {children}
      </div>
    </section>
  );
}

const sectionTitleStyle: React.CSSProperties = { fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text)', lineHeight: 1.2 };
const leadStyle: React.CSSProperties = { margin: 0, fontSize: '1.03125rem', color: 'var(--text-dim)', lineHeight: 1.7, wordBreak: 'keep-all' };
const cardGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '16px' };

export const metadata = {
  title: '자기소개서 | Cover Letter',
  description: '가치관과 걸어온 길',
};

export default function CoverLetterPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>
      
      {/* Hero Section */}
      <section id="cover-letter-overview" tabIndex={-1} style={{
        padding: 'clamp(22px, 5vw, 36px)',
        background: 'var(--bg-elev)',
        borderRadius: '24px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden',
        scrollMarginTop: '96px'
      }}>
        {/* Subtle grid background watermark */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          opacity: 'var(--surface-pattern-opacity, 0.3)',
          pointerEvents: 'none'
        }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 5.5vw, 2.25rem)', fontWeight: 800, margin: 0, color: 'var(--text)', lineHeight: 1.2 }}>
            &quot;단순히 돌아가는 코드가 아닌,<br />그 이면의 원리를 탐구합니다.&quot;
          </h2>
          <p style={{ fontSize: 'clamp(1rem, 2.6vw, 1.125rem)', color: 'var(--text-dim)', maxWidth: '850px', lineHeight: 1.6, margin: 0, wordBreak: 'keep-all' }}>
            단순히 결과물만 내는 것이 아니라, 프로덕트가 만들어지는 이면에 담긴 고민과 과정을 중요하게 생각합니다. 언제나 본질을 꿰뚫고 새로운 기준을 제시하기 위해 노력하는 메이커입니다.
          </p>
          <AskAiButton
            align="end"
            guidedTourTarget="cover-letter-overview-ask-ai"
            question="자기소개서에 담긴 개발 철학과 경험의 흐름을 주요 사례 중심으로 설명해 주세요."
          />
        </div>
      </section>

      {/* Narrative Section (based on the markdown) */}
      <section id="cover-letter-story" tabIndex={-1} style={{
        padding: 'clamp(26px, 5vw, 40px) clamp(18px, 4vw, 32px)',
        background: 'var(--bg-elev)',
        borderRadius: '24px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
        position: 'relative',
        overflow: 'hidden',
        scrollMarginTop: '96px'
      }}>
        {/* Subtle grid background watermark */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          opacity: 'var(--surface-pattern-opacity, 0.3)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '40px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(40px, auto) 1fr', gap: '24px', alignItems: 'start' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-text)', opacity: 0.8, lineHeight: 1 }}>01</div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--text)', lineHeight: 1.2 }}>학창 시절부터 이어진 탐구심</h3>
              <p style={{ margin: 0, fontSize: '1.03125rem', color: 'var(--text-dim)', lineHeight: 1.7, wordBreak: 'keep-all' }}>
                고등학생 때부터 컴퓨터 하드웨어에 대한 깊은 관심이 있었습니다. 단순히 이론적인 것에 그치지 않고, 직접 CPU 오버클럭을 하거나 RAID 환경을 구성하며 성능 개선을 두 눈으로 확인하고 검증하는 과정 자체에 큰 흥미를 느꼈습니다. 이러한 하드웨어에 대한 본질적인 탐구심은 이후 소프트웨어 엔지니어로 성장하는 데 강력한 밑거름이 되었습니다.
              </p>
              <div style={{ marginTop: '14px' }}>
                <AskAiButton
                  align="end"
                  question="자기소개서의 「학창 시절부터 이어진 탐구심」이 현재 개발 방식에 어떻게 이어졌는지 사례와 함께 설명해 주세요."
                />
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border)', opacity: 0.7 }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(40px, auto) 1fr', gap: '24px', alignItems: 'start' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-text)', opacity: 0.8, lineHeight: 1 }}>02</div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--text)', lineHeight: 1.2 }}>로우레벨에서 하이레벨까지</h3>
              <p style={{ margin: 0, fontSize: '1.03125rem', color: 'var(--text-dim)', lineHeight: 1.7, wordBreak: 'keep-all' }}>
                Java로 프로그래밍에 입문하며 객체지향과 고수준 추상화의 기초를 다졌고, 이후 C#과 Unity를 통해 게임 개발을 시작하면서 프레임워크를 수동적으로 가져다 쓰는 것을 넘어 동작 원리와 저수준 구현까지 파고들었습니다. WinForms에서 WPF로 마이그레이션하며 MVVM 패턴을 체득했고, 더 나아가 CPU의 비순차 실행이나 분기 예측, SIMD(AVX2) 등 하드웨어의 물리적 특성을 고려한 소프트웨어 성능 최적화 실험에 몰두해 왔고, CUDA로 GPU 가속의 기초도 익혔습니다.
              </p>
              <div style={{ marginTop: '14px' }}>
                <AskAiButton align="end" question="자기소개서의 「로우레벨에서 하이레벨까지」 경험을 기술 선택과 성능 최적화 사례 중심으로 자세히 설명해 주세요." />
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border)', opacity: 0.7 }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(40px, auto) 1fr', gap: '24px', alignItems: 'start' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-text)', opacity: 0.8, lineHeight: 1 }}>03</div>
            <div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 12px', color: 'var(--text)', lineHeight: 1.2 }}>스스로 문제를 정의하는 메이커</h3>
              <p style={{ margin: 0, fontSize: '1.03125rem', color: 'var(--text-dim)', lineHeight: 1.7, wordBreak: 'keep-all' }}>
                단순히 구현하는 것을 넘어, 데이터의 직렬화 포맷을 비교 분석하고 자체적인 코드 제너레이터(Scaffold)를 구축하는 등, 생산성과 성능이라는 두 마리 토끼를 잡기 위해 끊임없이 고민하고 있습니다. 저는 주어지는 문제를 수동적으로 푸는 사람이 아니라, 스스로 문제를 정의하고 본질부터 파고듭니다.
              </p>
              <div style={{ marginTop: '14px' }}>
                <AskAiButton align="end" question="「스스로 문제를 정의하는 메이커」라는 표현을 실제 프로젝트와 실험 사례를 들어 설명해 주세요." />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Personality */}
      <CoverPanel id="cover-letter-core-values">
        <h3 style={sectionTitleStyle}>핵심 가치</h3>
        <div style={{ ...cardGridStyle, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
          {CORE_VALUES.map((item) => (
            <div key={item.title} style={{ ...cardStyle, position: 'relative', overflow: 'hidden', padding: '26px 24px 20px', gap: '12px' }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '4px', background: 'linear-gradient(90deg, var(--accent-text), transparent)', opacity: 0.8 }} />
              <h5 style={{ ...cardTitleStyle, fontSize: '1.25rem', fontWeight: 800 }}>{item.title}</h5>
              <p style={cardTextStyle}>{item.body}</p>
              <div style={{ marginTop: 'auto' }}>
                <AskAiButton align="end" question={item.question} />
              </div>
            </div>
          ))}
        </div>
      </CoverPanel>

      <CoverPanel id="cover-letter-personality">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={sectionTitleStyle}>성격</h3>
          <p style={leadStyle}>
            궁금한 게 생기면 직접 해 보고, 확인한 그대로 이야기하는 편입니다.
          </p>
        </div>
        <div style={cardGridStyle}>
          {TRAITS.map((item) => (
            <div key={item.label} style={{ ...cardStyle, position: 'relative', overflow: 'hidden', paddingLeft: '28px' }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--accent-text)', opacity: 0.75 }} />
              <span style={{ ...tagStyle, alignSelf: 'flex-start', marginRight: 0, background: 'var(--accent-soft)', color: 'var(--accent-text)', border: '1px solid var(--border)' }}>{item.label}</span>
              <h5 style={cardTitleStyle}>{item.title}</h5>
              <p style={cardTextStyle}>{item.body}</p>
            </div>
          ))}
        </div>
        <AskAiButton align="end" question="자기소개서의 「성격」에 적힌 성향이 실제 작업과 협업에서 어떻게 드러나는지 사례와 함께 설명해 주세요." />
      </CoverPanel>

      {/* Strengths and weaknesses */}
      <CoverPanel id="cover-letter-strengths">
        <h3 style={sectionTitleStyle}>강점과 약점</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={subheadStyle}>강점</h4>
          <div style={cardGridStyle}>
            {STRENGTHS.map((item) => (
              <div key={item.title} style={cardStyle}>
                <h5 style={cardTitleStyle}>{item.title}</h5>
                <p style={cardTextStyle}>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={subheadStyle}>약점과 보완</h4>
          <div style={cardGridStyle}>
            {WEAKNESSES.map((item) => (
              <div key={item.title} style={cardStyle}>
                <h5 style={cardTitleStyle}>{item.title}</h5>
                <p style={cardTextStyle}>
                  <span style={{ ...tagStyle, background: 'var(--bg-elev-2)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>약점</span>
                  {item.weakness}
                </p>
                <p style={cardTextStyle}>
                  <span style={{ ...tagStyle, background: 'var(--accent-soft)', color: 'var(--accent-text)', border: '1px solid var(--border)' }}>보완</span>
                  {item.remedy}
                </p>
              </div>
            ))}
          </div>
        </div>
        <AskAiButton align="end" question="자기소개서의 「강점과 약점」에 적힌 강점과 약점, 약점을 보완하는 방식을 실제 사례와 함께 설명해 주세요." />
      </CoverPanel>

      {/* Work priorities and conditions */}
      <CoverPanel id="cover-letter-values">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={sectionTitleStyle}>함께 일할 때 중요하게 보는 것</h3>
          <p style={leadStyle}>
            기본 생활과 연구 활동을 안정적으로 이어 갈 수 있는 수준이라면, 보상 차이보다 관심 있는 역할과 업무 환경에 더 무게를 둡니다. 중요하게 보는 순서는 다음과 같습니다.
          </p>
        </div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {PRIORITIES.map((item, index) => (
            <li key={item.title} style={{ ...cardStyle, flexDirection: 'row', alignItems: 'flex-start', gap: '16px' }}>
              <span aria-hidden="true" style={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-text)', opacity: 0.85, lineHeight: 1.35, minWidth: '1.6em' }}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                <h5 style={cardTitleStyle}>
                  {item.title}
                  {item.required ? (
                    <span style={{ ...tagStyle, marginRight: 0, marginLeft: '8px', background: 'var(--accent-soft)', color: 'var(--accent-text)', border: '1px solid var(--border)' }}>필수</span>
                  ) : null}
                </h5>
                <p style={cardTextStyle}>{item.body}</p>
                {item.log ? (
                  <p style={{ ...cardTextStyle, fontSize: '0.875rem' }}>
                    {item.log.lead}:{' '}
                    <LogReadingLink slug={item.log.slug} style={{ color: 'var(--accent-text)', fontWeight: 600 }}>
                      「{item.log.title}」
                    </LogReadingLink>
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <AskAiButton align="end" question="자기소개서의 「함께 일할 때 중요하게 보는 것」에서 합법성과 윤리를 가장 먼저 보는 이유와 나머지 기준을 설명해 주세요." />
      </CoverPanel>

      {/* Hobbies */}
      <CoverPanel id="cover-letter-hobbies">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={sectionTitleStyle}>취미와 관심사</h3>
          <p style={leadStyle}>
            관심의 중심은 코딩 자체보다 컴퓨터와 계산 자원을 어떻게 구성하고 활용해 원하는 결과를 만드느냐에 있습니다. 그래서 컴퓨터를 다루는 취미가 곧 일상이기도 합니다.
          </p>
        </div>
        <div style={cardGridStyle}>
          {HOBBIES.map((item) => (
            <div key={item.title} style={cardStyle}>
              <h5 style={cardTitleStyle}>{item.title}</h5>
              <p style={cardTextStyle}>{item.body}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          <span style={{ ...cardTextStyle, fontWeight: 600, color: 'var(--text)', marginRight: '4px' }}>앞으로 탐구하고 싶은 분야</span>
          {NEXT_INTERESTS.map((name) => (
            <span key={name} style={{ padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dim)', fontSize: '0.875rem', fontWeight: 600 }}>{name}</span>
          ))}
        </div>
        <AskAiButton align="end" question="자기소개서의 「취미와 관심사」가 개발 방식이나 지금의 작업과 어떻게 이어지는지 설명해 주세요." />
      </CoverPanel>

      <CareerTurningPointPreview />


      <section style={{ 
        padding: '40px', 
        background: 'var(--surface-fill, linear-gradient(135deg, var(--bg-elev-2), var(--bg)))',
        borderRadius: '24px', 
        textAlign: 'center',
        border: '1px solid var(--border)',
        marginTop: '20px'
      }}>
        <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text)' }}>연구 기간의 최적화 실험이 궁금하신가요?</h3>
        <p style={{ color: 'var(--text-dim)', marginBottom: '24px' }}>
          CPU 명령 수준 최적화부터 SI 에이전트 코딩 연구에 이르기까지, 다양한 실험과 도전 결과를 정리해 두었습니다.
        </p>
        <Link href="/about-me/research" className="hover-btn-primary hover-btn-inverse" style={{
          display: 'inline-block',
          padding: '12px 24px',
          background: 'var(--text)',
          color: 'var(--bg)',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 600,
        }}>
          연구 경험(Research) 보러 가기
        </Link>
      </section>

    </div>
  );
}
