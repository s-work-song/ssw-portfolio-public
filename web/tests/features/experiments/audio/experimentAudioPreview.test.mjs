import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { agentExperiments } from '../../../../src/features/experiments/data/agentExperiments.ts';
import { audioPreviewSource, formatAudioPreviewDuration, groupAudioPreviews, pauseAndResetAudioPreview } from '../../../../src/features/experiments/audio/experimentAudioPreview.ts';

test('프리뷰는 Opus·Lyria·GPT 앨범 순서로 묶고 앨범 내 곡 순서와 원본을 보존한다', () => {
  const track = (album, title) => ({ album, title, src: `/audio/${title}.mp3`, durationSeconds: 20 });
  const input = [track('GPT Dots 리메이크', 'Iron'), track('Opus 5.5', 'Neon'), track('Lyria 3.5', 'Midnight'),
    track('Opus 5.5', 'Pixel'), track('GPT Dots 리메이크', 'Gravity')];
  const original = structuredClone(input);
  const grouped = groupAudioPreviews(input);
  assert.deepEqual(grouped.map(({ album }) => album), ['Opus 5.5', 'Lyria 3.5', 'GPT Dots 리메이크']);
  assert.deepEqual(grouped.map(({ tracks }) => tracks.map(({ title }) => title)), [['Neon', 'Pixel'], ['Midnight'], ['Iron', 'Gravity']]);
  assert.deepEqual(input, original);
  assert.deepEqual(groupAudioPreviews([]), []);
});

test('실제 OSCILLO 프리뷰도 묶음에서 곡을 빠뜨리지 않고 앨범 안 순서와 원본을 보존한다', () => {
  const previews = agentExperiments.find(({ id }) => id === 'oscillo-rhythm-game').audioPreviews;
  const original = structuredClone(previews);
  const grouped = groupAudioPreviews(previews);
  const bySource = (left, right) => left.src.localeCompare(right.src);
  assert.deepEqual(grouped.flatMap(({ tracks }) => tracks).toSorted(bySource), previews.toSorted(bySource));
  for (const { album, tracks } of grouped) {
    assert.deepEqual(tracks, original.filter((track) => track.album === album));
  }
  assert.deepEqual(previews, original);
});

test('음원 경로는 로컬에만 basePath를 붙이고 외부 HTTPS URL은 경로·쿼리·해시까지 보존한다', () => {
  const local = '/media/agent-experiments/example.mp3';
  assert.equal(audioPreviewSource(local, ''), local);
  assert.equal(audioPreviewSource(local, '/ssw-portfolio-public'), `/ssw-portfolio-public${local}`);
  assert.equal(audioPreviewSource(local, '/ssw-portfolio-public/'), `/ssw-portfolio-public${local}`);
  assert.equal(audioPreviewSource(local, '/'), local);
  const remote = 'https://pf-samples.sworksong.workers.dev/rhythm-game-oscillo/previews/low-b-gravity.b25c0c7934ec.mp3?version=2#preview';
  for (const prefix of ['', '/ssw-portfolio-public', '/ssw-portfolio-public/']) {
    assert.equal(audioPreviewSource(remote, prefix), remote);
  }
  assert.equal(audioPreviewSource('//example.com/preview.mp3', '/portfolio'), '//example.com/preview.mp3');
});

test('프리뷰 길이는 분:초로 표시하고 비정상 길이도 안전하게 처리한다', () => {
  for (const [seconds, expected] of [[0, '0:00'], [19.98, '0:19'], [25, '0:25'], [65, '1:05'],
    [-2, '0:00'], [Number.NaN, '0:00'], [Infinity, '0:00']]) {
    assert.equal(formatAudioPreviewDuration(seconds), expected);
  }
});

test('곡 선택은 이전 재생을 먼저 멈추고 0초로 되돌리며 재생을 시작하지 않는다', () => {
  const calls = [];
  const player = { pause() { calls.push('pause'); }, play() { assert.fail('곡 선택 시 자동 재생 금지'); },
    set currentTime(value) { calls.push(['currentTime', value]); } };
  pauseAndResetAudioPreview(player);
  assert.deepEqual(calls, ['pause', ['currentTime', 0]]);
  assert.doesNotThrow(() => pauseAndResetAudioPreview(null));
});

test('프리뷰 UI는 단일 수동 플레이어·MP3·basePath·실험 이동 정리를 유지한다', async () => {
  const source = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  const preview = source.slice(source.indexOf('function ExperimentAudioPreviews('), source.indexOf('function ExperimentImageBlock('));
  assert.equal((preview.match(/<audio\b/gu) ?? []).length, 1);
  assert.match(preview, /<audio key=\{selected\.src\}[^>]+controls preload="none"/u);
  assert.match(preview, /<source src=\{audioPreviewSource\(selected\.src, basePath\)\} type="audio\/mpeg"/u);
  assert.doesNotMatch(preview, /autoPlay|\.play\(|download=/u);
  assert.match(preview, /return \(\) => \{ player\?\.pause\(\); \};/u);
  assert.match(preview, /aria-pressed=\{selected\.src === track\.src\}/u);
  assert.match(preview, /pauseAndResetAudioPreview\(playerRef\.current\);\s*setSelectedSrc\(track\.src\)/u);
  assert.match(source, /<article key=\{active\.id\}/u);
  assert.match(source, /active\.audioPreviews\?\.length \? <ExperimentAudioPreviews/u);
  assert.match(source, /active\.audio && <ExperimentAudio/u);
});

test('많은 곡의 앨범은 넓은 칸으로 표시한다', async () => {
  const source = await readFile(new URL('../../../../src/features/experiments/ui/AgentExperimentGallery.tsx', import.meta.url), 'utf8');
  assert.match(source, /<fieldset key=\{album\} className=\{tracks\.length > 3 \? `\$\{styles\.audioAlbum\} \$\{styles\.audioAlbumWide\}` : styles\.audioAlbum\}/u);
});
