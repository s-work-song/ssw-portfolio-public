'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { agentExperiments } from '@/data/agentExperiments';
import ProjectMediaCarousel from './ProjectMediaCarousel';
import styles from './AgentExperimentGallery.module.css';

const categories = [
  'SVG 제작',
  '2D 게임 제작',
  '3D 게임 제작',
  'Blender 3D 에셋 제작',
] as const;

function CapturePlaceholder({ label }: { label: string }) {
  return (
    <div className={styles.capture} aria-label={`${label} 캡처 준비 중`}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8" cy="9" r="1.5" />
        <path d="m3 17 5-5 4 4 4-6 5 7" />
      </svg>
      <span>결과 캡처 준비 중</span>
      <small>{label}</small>
    </div>
  );
}

/** 자동 재생 없이 실험을 탐색하고, 모델 비교는 같은 화면에서 확인하는 갤러리다. */
export default function AgentExperimentGallery() {
  const [category, setCategory] = useState<(typeof categories)[number]>('SVG 제작');
  const [selectedId, setSelectedId] = useState(agentExperiments[0].id);
  const [selectedModel, setSelectedModel] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const experiments = agentExperiments.filter((item) => item.category === category);
  const index = Math.max(0, experiments.findIndex((item) => item.id === selectedId));
  const active = experiments[index];

  useEffect(() => {
    const selectHashExperiment = () => {
      let hash = '';
      try {
        hash = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      const target = agentExperiments.find((item) => item.id === hash);
      if (!target) return;
      setCategory(target.category);
      setSelectedId(target.id);
      setSelectedModel(0);
    };
    selectHashExperiment();
    window.addEventListener('hashchange', selectHashExperiment);
    return () => window.removeEventListener('hashchange', selectHashExperiment);
  }, []);

  function select(nextIndex: number, focus = false) {
    const next = (nextIndex + experiments.length) % experiments.length;
    setSelectedId(experiments[next].id);
    setSelectedModel(0);
    // 목록만 가로로 이동시킨다. 페이지나 채팅 패널의 스크롤은 건드리지 않는다.
    const button = itemRefs.current[next];
    if (button) {
      const list = button.parentElement;
      if (list) list.scrollLeft = button.offsetLeft - list.offsetLeft;
      if (focus) button.focus({ preventScroll: true });
    }
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, itemIndex: number) {
    const next = event.key === 'ArrowRight' ? itemIndex + 1
      : event.key === 'ArrowLeft' ? itemIndex - 1
        : event.key === 'Home' ? 0
          : event.key === 'End' ? experiments.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    select(next, true);
  }

  return (
    <section id="agent-experiments" className={styles.section} aria-labelledby="agent-experiments-heading">
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>AI EXPERIMENTS</p>
          <h3 id="agent-experiments-heading">AI 에이전트 성능·활용 실험</h3>
          <p className={styles.intro}>2D·3D 게임 구현부터 Blender 에셋과 SVG 일러스트 제작, 같은 과제의 모델별 결과 비교까지.</p>
        </div>
        <span className={styles.draft}>레이아웃 미리보기</span>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="실험 분류">
          {categories.map((value) => (
            <button key={value} type="button" aria-pressed={category === value} onClick={() => {
              setCategory(value);
              setSelectedId(agentExperiments.find((item) => item.category === value)!.id);
              setSelectedModel(0);
            }}>{value}</button>
          ))}
        </div>
        <div className={styles.controls}>
          <span aria-live="polite" aria-atomic="true">{String(index + 1).padStart(2, '0')} / {String(experiments.length).padStart(2, '0')}<span className={styles.srOnly}> · {active.title}</span></span>
          <button type="button" aria-label="이전 실험" disabled={experiments.length < 2} onClick={() => select(index - 1)}>←</button>
          <button type="button" aria-label="다음 실험" disabled={experiments.length < 2} onClick={() => select(index + 1)}>→</button>
        </div>
      </div>

      <div className={styles.filmstrip} role="group" aria-label="실험 바로 선택">
        {experiments.map((item, itemIndex) => (
          <button key={item.id} id={item.id} ref={(element) => { itemRefs.current[itemIndex] = element; }} type="button"
            aria-pressed={active.id === item.id} aria-controls="agent-experiment-stage"
            onClick={() => select(itemIndex)} onKeyDown={(event) => handleKey(event, itemIndex)}>
            <span className={styles.itemNumber}>{String(itemIndex + 1).padStart(2, '0')}</span>
            <span><small>{item.category}{item.models ? ' · 예정' : ''}</small><strong>{item.title}</strong></span>
            <span className={styles.itemArrow} aria-hidden="true">↗</span>
          </button>
        ))}
      </div>

      <div id="agent-experiment-stage" className={styles.stage}>
        <article key={active.id} className={styles.slide} aria-label={active.title}>
          {active.models ? (
            <div className={styles.comparison}>
              <div className={styles.comparisonHeading}>
                <span>같은 과제, 서로 다른 결과</span>
                <span className={styles.muted}>비교 실험 예정</span>
              </div>
              <div className={styles.modelSwitcher} role="group" aria-label="비교할 모델">
                {active.models.map((model, modelIndex) => (
                  <button key={model} type="button" aria-pressed={selectedModel === modelIndex} onClick={() => setSelectedModel(modelIndex)}>{model}</button>
                ))}
              </div>
              <div className={styles.modelGrid}>
                {active.models.map((model, modelIndex) => (
                  <div key={model} className={`${styles.modelColumn} ${selectedModel === modelIndex ? styles.selectedModel : ''}`}>
                    <h4><span className={styles.modelNumber}>0{modelIndex + 1}</span>{model}</h4>
                    <CapturePlaceholder label={model} />
                    <p>구현 내용과 관찰 결과를 정리할 자리입니다.</p>
                  </div>
                ))}
              </div>
              <p className={styles.conditions}>비교 조건 · 공통 요구사항, 작업 시간·예산, 수정 지시와 리소스 사용 범위는 실험 후 정리할 예정입니다.</p>
            </div>
          ) : (
            <div className={styles.singlePreview}>
              <div className={styles.previewLabel}><span>{active.category}</span><span>SCREEN / VIDEO</span></div>
              {active.images?.length ? (
                <ProjectMediaCarousel
                  className={styles.experimentCarousel}
                  gallery={{
                    images: active.images,
                    placeholder: `${active.title} 화면을 추가할 자리입니다.`,
                  }}
                  projectTitle={active.title}
                  imageSizes="(max-width: 900px) calc(100vw - 72px), 900px"
                />
              ) : (
                <CapturePlaceholder label={active.title} />
              )}
            </div>
          )}
          <div className={styles.caption}>
            <div className={styles.description}>
              <p className={styles.eyebrow}>{active.category}</p>
              <h4>{active.title}</h4>
              <p>{active.description}</p>
              <ul className={styles.tags}>{active.focus.map((focus) => <li key={focus}>{focus}</li>)}</ul>
            </div>
            <div className={styles.details}>
              <dl>
                <div><dt>모델·도구</dt><dd>{active.models ? '모델별 제작 기록 정리 예정' : '제작 기록 확인 후 추가'}</dd></div>
                <div><dt>실험 기록</dt><dd>요구사항·개입 과정·결과 정리 예정</dd></div>
              </dl>
              {active.demoUrl && <a href={active.demoUrl} target="_blank" rel="noopener noreferrer" aria-label={`${active.title} ${active.demoLabel ?? '직접 실행'}, 새 탭`}>{active.demoLabel ?? '직접 실행'} <span aria-hidden="true">↗</span></a>}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
