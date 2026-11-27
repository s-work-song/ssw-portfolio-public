'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Card } from '@/components/surface/Surface';
import { rootMotionAllowed, subscribeSeasonMotion } from '@/features/seasonal/seasonMotion';
import { ParticleCanvases } from '@/features/seasonal/particles/ParticleCanvases';
import { PARTICLE_PREVIEWS, type ParticlePreviewId } from '@/features/seasonal/seasonParticleProfiles';
import { runSeasonParticles } from '@/features/seasonal/particles/runSeasonParticles';
import styles from './StyleGuide.module.css';

const serverMotion = () => false;

export default function SeasonParticlePreview() {
  const [effect, setEffect] = useState<ParticlePreviewId>('snow');
  const [playing, setPlaying] = useState(true);
  const [behind, setBehind] = useState(false);
  const [inView, setInView] = useState(false);
  const motionAllowed = useSyncExternalStore(subscribeSeasonMotion, rootMotionAllowed, serverMotion);
  const selected = PARTICLE_PREVIEWS.find((preview) => preview.id === effect) ?? PARTICLE_PREVIEWS[0];
  const stageRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof runSeasonParticles>>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.08 });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || !motionAllowed || !stageRef.current) return;
    const preview = runSeasonParticles(stageRef.current, frontRef.current, backRef.current, effect);
    renderer.current = preview;
    return () => {
      preview?.destroy();
      renderer.current = null;
    };
  }, [effect, inView, motionAllowed]);

  useEffect(() => {
    renderer.current?.update(playing, behind);
  }, [behind, effect, inView, motionAllowed, playing]);

  return (
    <div className={styles.particlePreview}>
      <div role="group" aria-label="계절 효과 선택" className={styles.particleOptions}>
        {PARTICLE_PREVIEWS.map((preview) => (
          <button key={preview.id} type="button" className={styles.particleChoice}
            aria-pressed={effect === preview.id} onClick={() => setEffect(preview.id)}>
            {preview.label}
          </button>
        ))}
      </div>
      <div className={styles.particleToolbar}>
        <p>{selected.description}</p>
        <div className={styles.particleActions}>
          <button type="button" className={styles.particleControl} disabled={!motionAllowed}
            onClick={() => setPlaying((previous) => !previous)}>
            미리보기 {playing && motionAllowed ? '정지' : '재생'}
          </button>
          <button type="button" role="switch" aria-checked={behind} className={styles.particleControl}
            onClick={() => setBehind((previous) => !previous)}>
            카드 뒤에 숨기기
          </button>
        </div>
      </div>
      {!motionAllowed && <p className={styles.particleMotionNote}>모션을 끈 상태에서는 애니메이션을 재생하지 않습니다.</p>}
      <div ref={stageRef} data-season={selected.season} data-preview-effect={effect} className={styles.particleStage}>
        <ParticleCanvases effect={effect} scope="container" frontRef={frontRef} backRef={backRef} />
        <div className={styles.particleScene}>
          <Card tone="elev" raised className={styles.particleSceneCard}>
            <span>{selected.label} · 실제 효과와 같은 모양</span>
            <strong>계절이 지나가는 화면</strong>
            <p>카드 위와 뒤를 바꿔 보세요.</p>
          </Card>
          <Card tone="elev" className={`${styles.particleSceneCard} ${styles.particleSceneSmall}`}>
            <span>표면 견본</span>
            <strong>카드 사이 여백</strong>
          </Card>
        </div>
      </div>
    </div>
  );
}
