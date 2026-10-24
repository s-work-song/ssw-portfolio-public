import type { AgentExperimentAudioPreview } from '../../data/agentExperiments.ts';

const albumOrder = ['Opus 5.5', 'Lyria 3.5', 'Lyria 3.5 보컬', 'Lyria 3.0 보컬 메들리 · 밈 가사', 'GPT Dots 리메이크'];

/** 사이트 내부의 루트 경로에만 basePath를 붙이고 외부 음원 URL은 보존한다. */
export function audioPreviewSource(src: string, basePath: string): string {
  return src.startsWith('/') && !src.startsWith('//') ? `${basePath.replace(/\/$/u, '')}${src}` : src;
}

/** 곡 순서는 원본 그대로, 앨범은 소개에 사용하는 순서로 묶는다. */
export function groupAudioPreviews(previews: readonly AgentExperimentAudioPreview[]) {
  const groups = new Map<string, AgentExperimentAudioPreview[]>();
  for (const preview of previews) {
    const tracks = groups.get(preview.album) ?? [];
    tracks.push(preview);
    groups.set(preview.album, tracks);
  }
  const rank = (album: string) => albumOrder.includes(album) ? albumOrder.indexOf(album) : albumOrder.length;
  return [...groups].sort(([left], [right]) => rank(left) - rank(right))
    .map(([album, tracks]) => ({ album, tracks }));
}

/** 프리뷰의 표시 길이이며 전체 곡 길이를 뜻하지 않는다. */
export function formatAudioPreviewDuration(seconds: number): string {
  const totalSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/** 곡 선택은 재생 명령이 아니다. 같은 곡을 다시 선택해도 처음부터 준비한다. */
export function pauseAndResetAudioPreview(player: Pick<HTMLAudioElement, 'pause' | 'currentTime'> | null): void {
  if (!player) return;
  player.pause();
  player.currentTime = 0;
}
