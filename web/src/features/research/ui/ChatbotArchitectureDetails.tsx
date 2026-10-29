'use client';

/**
 * 「오픈웨이트 모델 챗봇 구조 실험」 카드의 흐름도·단계별 설명 펼침 영역이다.
 * 처음 펼칠 때 내용을 마운트해 접힌 상태에서는 머메이드 스크립트를 불러오지 않고,
 * 한 번 펼친 내용은 접어도 유지해 다시 펼칠 때 흐름도를 새로 그리지 않는다.
 */
import { useId, useState } from 'react';
import MermaidDiagram from '@/components/diagrams/MermaidDiagram';
import {
  chatbotArchitectureDiagram,
  chatbotArchitectureFlowLegend,
  chatbotArchitectureStages,
} from '@/features/research/data/chatbotArchitecture';

export default function ChatbotArchitectureDetails() {
  const regionId = useId();
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  const toggle = () => {
    setMounted(true);
    setExpanded((value) => !value);
  };

  return (
    <>
      <div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={toggle}
          className="hover-btn-secondary"
          style={{
            minHeight: '36px',
            padding: '7px 11px',
            border: '1px solid var(--border-strong)',
            borderRadius: '9px',
            background: 'var(--bg-elev)',
            color: 'var(--text-dim)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {expanded ? '흐름도와 단계별 설명 접기' : '흐름도와 단계별 설명 보기'}
          <span aria-hidden="true">{expanded ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* hidden이 인라인 display에 덮이지 않도록 바깥 요소에는 display를 두지 않는다. */}
      <div id={regionId} role="region" aria-label="챗봇 구조 실험의 흐름도와 단계별 설명" hidden={!expanded}>
        {mounted && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            {/* 좁은 화면에서 글자가 줄지 않도록 흐름도는 별도 상자 없이 카드 폭을 그대로 쓴다. */}
            <MermaidDiagram
              diagram={chatbotArchitectureDiagram.source}
              compactDiagram={chatbotArchitectureDiagram.compactSource}
              title={chatbotArchitectureDiagram.title}
              description={chatbotArchitectureDiagram.description}
              waitingText="흐름도를 준비하고 있습니다."
              failedText="흐름도 대신 아래 설명을 확인해 주세요."
              straightenEdges
            />

            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
              {chatbotArchitectureFlowLegend}
            </p>

            <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {chatbotArchitectureStages.map((stage) => (
                <li key={stage.number} style={{
                  padding: 'clamp(14px, 3vw, 20px)',
                  background: 'var(--bg-elev-2)',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'keep-all' }}>
                    {stage.number}단계 · {stage.title}{stage.current ? ' (현재)' : ''}
                  </h4>
                  {/* 단계 상자의 안쪽 여백만큼 흐름도를 넓혀 휴대폰에서 글자가 덜 줄게 한다. */}
                  <div style={{ margin: '10px calc(-1 * clamp(14px, 3vw, 20px)) 0', minWidth: 0 }}>
                    <MermaidDiagram
                      diagram={stage.flow}
                      compactDiagram={stage.compactFlow}
                      title="상세 흐름도"
                      description={stage.flowDescription}
                      waitingText="흐름도를 준비하고 있습니다."
                      failedText="흐름도 대신 아래 설명을 확인해 주세요."
                      straightenEdges
                    />
                  </div>
                  <ul style={{ paddingLeft: '18px', margin: '10px 0 0', color: 'var(--text-dim)', lineHeight: 1.7, fontSize: '0.9rem', wordBreak: 'keep-all' }}>
                    {stage.details.map((detail) => <li key={detail}>{detail}</li>)}
                  </ul>
                  <p style={{
                    margin: '10px 0 0',
                    paddingLeft: '12px',
                    borderLeft: '3px solid var(--border-strong)',
                    fontSize: '0.9rem',
                    lineHeight: 1.7,
                    color: 'var(--text-dim)',
                    wordBreak: 'keep-all',
                  }}>
                    <strong style={{ color: 'var(--text)' }}>{stage.outcome.label}</strong>: {stage.outcome.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </>
  );
}
