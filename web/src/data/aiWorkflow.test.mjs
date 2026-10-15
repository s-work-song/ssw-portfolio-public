import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import { aiWorkflowExamples, aiWorkflowStories, aiWorkflowStages, aiWorkflowTools, aiWorkflowCliTools, aiWorkflowToolGroups } from './aiWorkflow.ts';
import { aboutTabPathFromPath } from '../features/chat/navigation.ts';
import { workflowStageFromHash, workflowStageIndexFromHash, workflowStageIndexForKey } from '../app/about-me/ai-workflow/workflowStageNavigation.ts';
import { scrollToWorkflowStageNav } from '../app/about-me/ai-workflow/workflowStageScroll.ts';

test('SI 활용 다섯 단계는 고유 앵커와 역할 설명을 갖는다', () => {
  assert.deepEqual(aiWorkflowStages.map(({ id }) => id), ['chat', 'read-only', 'implementation', 'tools', 'orchestration']);
  assert.deepEqual(aiWorkflowStages.map(({ number }) => number), ['01', '02', '03', '04', '05']);
  for (const stage of aiWorkflowStages) {
    for (const key of ['shortTitle', 'navDescription', 'title', 'description', 'aiRole', 'humanRole', 'change', 'captureNote']) {
      assert.ok(typeof stage[key] === 'string' && stage[key].trim(), `${stage.id}.${key}`);
    }
  }
});

test('실제 사례는 01~04 단계에 연결하고 사용 환경만 남기며 모델 정보는 공개하지 않는다', () => {
  assert.deepEqual(Object.keys(aiWorkflowExamples), ['chat', 'read-only', 'implementation', 'tools']);
  assert.equal(aiWorkflowExamples.chat.environment.tool, 'ChatGPT 채팅');
  assert.equal(aiWorkflowExamples['read-only'].environment.tool, 'Antigravity IDE');
  assert.equal(aiWorkflowExamples.implementation.environment.tool, 'Codex 데스크톱 앱');
  assert.equal(aiWorkflowExamples.tools.environment.tool, '에이전트 + FFmpeg CLI');
  assert.ok(aiWorkflowStages.every(({ captureNote }) => captureNote === '사람과 SI의 작업 흐름 도식'));
  for (const example of Object.values(aiWorkflowExamples)) {
    assert.deepEqual(Object.keys(example.environment).sort(), ['project', 'tool']);
    assert.equal(example.checkpoints.length, 3);
    assert.ok(example.summary && example.privacyNote);
    assert.doesNotMatch(JSON.stringify(example), /[A-Z]:[\\/]|https?:\/\/|_si-adoption-levels-imgs/u);
    assert.doesNotMatch(JSON.stringify(example), /Gemini|GPT-\d|Extra High|사용 모델/u);
  }
  for (const id of ['chat', 'read-only', 'implementation']) assert.ok(aiWorkflowExamples[id].request);
});

test('구현 사례는 구현·리뷰 요청·코드 차이·화면 주석·배치 반영 순서이며 검증 상태를 과장하지 않는다', () => {
  assert.equal(aiWorkflowExamples.chat.captures.length, 1);
  assert.equal(aiWorkflowExamples['read-only'].captures.length, 1);
  const captures = aiWorkflowExamples.implementation.captures;
  assert.deepEqual(captures.map(({ src }) => src.split('/').at(-1)), [
    '01-implementation-request.webp', '02-code-review-request.webp', '03-code-review-result.webp',
    '04-screen-annotation.webp', '05-layout-result.webp',
  ]);
  assert.match(captures[4].detail, /전체 검증 완료를 뜻하지는 않습니다/);
  assert.match(captures[0].detail, /로컬 데모.*서버 인증과 데이터베이스/);
  assert.match(aiWorkflowExamples.chat.captures[0].detail, /복사·붙여넣기와 실행은 사람이 직접/);
  assert.match(aiWorkflowExamples['read-only'].captures[0].detail, /변경 파일 수는 0/);
});

test('요청 조건과 사람이 확인할 항목을 구체적인 예제에 연결한다', () => {
  const chat = aiWorkflowExamples.chat;
  assert.match(chat.request, /C#.*Normalize.*소수점 둘째 자리/);
  assert.match(chat.captures[0].detail, /반올림한 벡터의 길이는 정확히 1이 아닐 수/);
  const scan = aiWorkflowExamples['read-only'];
  assert.match(scan.checkpoints.join(' '), /js\/storage\.js.*세션 조회·저장·로그아웃/);
  const implementation = aiWorkflowExamples.implementation;
  assert.match(implementation.captures[1].detail, /if.*switch/);
  assert.match(implementation.captures[2].detail, /ArrowLeft·ArrowRight·Home·End/);
  assert.match(implementation.captures[3].detail, /버튼을 정렬 드롭다운 옆에 배치/);
});

test('공개 캡처 7장은 검토된 테두리 정리·가림 처리 사본만 사용한다', async () => {
  // 검토된 사본의 해시를 고정해 원본이나 미가림 이미지로 바뀌는 회귀를 감지한다.
  const approvedHashes = [
    '7bb38b777f45a25e2a6ebafd57e9e550f55e25facc9ed5689d7565959473ec39',
    '55487bec4801774be9217f182feb58b29ca4675bd5eb70c2bfd500fda5e55b95',
    '61b33b27f4fd23285b6a0ddd01554b0c555d7613c60034eaa2060c41defd5aea',
    '9bca6353d5b5d129822af54a7747d88cd7b15bd88b633a4fefa14ef5855653fc',
    '8b56ec13823402ea8822fce4c08014bca9adcea4ee48c888b7488b55371947b2',
    '56ccce70b44282333270f5dbd234691375787abb2d980988dec290ecfab3cc5e',
    '6632cc4f003ae2626631abdd6c9f71e657b6320f9111117e50c0bebf6dced5ff',
  ];
  const captures = ['chat', 'read-only', 'implementation'].flatMap((id) => aiWorkflowExamples[id].captures);
  assert.equal(captures.length, approvedHashes.length);
  for (const [index, capture] of captures.entries()) {
    assert.match(capture.src, /^\/images\/si-adoption\/[a-z/-]+[0-9a-z-]+\.webp$/);
    assert.ok(capture.alt && capture.caption && capture.title && capture.detail);
    const bytes = await readFile(new URL(`../../public${capture.src}`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), approvedHashes[index], capture.src);
  }
});

test('04 단계의 FFmpeg 사례는 도구 소개 뒤에 놓고 원본 요청을 꾸며내지 않으며 실제 영상으로 연결한다', async () => {
  const example = aiWorkflowExamples.tools;
  assert.match(example.title, /FFmpeg.*컨택트 시트/);
  assert.match(example.summary, /에이전트가 FFmpeg로 편집.*컨택트 시트\(Contact Sheet\)/s);
  const visibleText = [example.title, example.summary, ...example.checkpoints, example.privacyNote,
    ...example.captures.flatMap(({ title, detail, alt, caption }) => [title, detail, alt, caption])].join(' ');
  assert.doesNotMatch(visibleText, /그리드|콜라주/);
  assert.equal(example.request, undefined, '실제 프롬프트가 제공되지 않은 사례에는 요청 문구를 만들지 않는다');
  assert.equal(example.frameAspectRatio, '834 / 1221');
  assert.equal(example.portrait, true);
  assert.match(example.checkpoints.join(' '), /최종 영상에서도 확인/);
  assert.equal(example.captures[0].src, '/images/archive/android-ar-campfire/03-final-background.webp');
  assert.deepEqual(example.captures.map(({ title }) => title.slice(0, 2)), ['01', '02', '03']);
  assert.match(example.captures[1].detail, /24개.*6열·4행/);
  assert.match(example.captures[2].detail, /3개씩/);
  assert.equal(example.relatedLink.href, '/about-me/#archive-android-ar-campfire');
  const about = await readFile(new URL('./about.ts', import.meta.url), 'utf8');
  assert.ok(about.includes("id: 'archive-android-ar-campfire'"));
  assert.ok(about.includes(example.captures[0].src), '첫 사진은 소개 페이지의 동일한 최적화 이미지를 재사용한다');
  const content = await readFile(new URL('../app/about-me/ai-workflow/WorkflowStageContent.tsx', import.meta.url), 'utf8');
  assert.ok(content.indexOf('<WorkflowTools />') < content.indexOf('<WorkflowExample'));
  const component = await readFile(new URL('../app/about-me/ai-workflow/WorkflowExample.tsx', import.meta.url), 'utf8');
  assert.match(component, /example\.request &&/);
  assert.match(component, /frameAspectRatio=\{example\.frameAspectRatio\}/);
  assert.match(component, /href=\{example\.relatedLink\.href\}/);
});

test('FFmpeg 사례는 동적인 게임·앱 화면 검토로의 활용을 별도 카드로 설명한다', async () => {
  const note = aiWorkflowExamples.tools.applicationNote;
  assert.ok(note?.title && note.description);
  for (const text of ['게임 제작', '애니메이션·카메라 이동·이펙트', '앱의 화면 전환', '컨택트 시트']) assert.ok(note.description.includes(text), text);
  assert.doesNotMatch(note.description, /다만 프레임 사이|실제 실행 화면이나 영상 재생/);
  for (const id of ['chat', 'read-only', 'implementation']) assert.equal(aiWorkflowExamples[id].applicationNote, undefined);
  const component = await readFile(new URL('../app/about-me/ai-workflow/WorkflowExample.tsx', import.meta.url), 'utf8');
  assert.match(component, /example\.applicationNote &&/);
  assert.match(component, /<aside className=\{styles\.applicationNote\} aria-labelledby=/);
  assert.match(component, /<h5 id=\{`example-\$\{stageId\}-applications-title`\}>/);
  assert.ok(component.indexOf('</ol>') < component.indexOf('className={styles.applicationNote}'));
  assert.ok(component.indexOf('className={styles.applicationNote}') < component.indexOf('<WorkflowCaptureGallery'));
  const css = await readFile(new URL('../app/about-me/ai-workflow/AiWorkflow.module.css', import.meta.url), 'utf8');
  assert.match(css, /^\.applicationNote \{[^}]*background: var\(--bg-elev\)/m);
});

test('FFmpeg 사례 세 장은 소개 사진·컨택트 시트·검토 순서의 해상도·용량 제한 WebP이며 메타데이터를 제외한다', async () => {
  const expected = [
    { width: 432, height: 960, maxBytes: 130000, hash: '7690010f000db45c8da696d8a626a20412388848769f085d482a5aef6fd9a557' },
    { width: 834, height: 1221, maxBytes: 340000, hash: 'c5379dfb119a230b98090abb6364ed2500451ed18184a9bd5a6dd5c8f9a951b6' },
    { width: 424, height: 503, maxBytes: 60000, hash: '849b57a5e161c17fe695c50dba6f35d70635aad7f3ea29b82121adc9dfb8a8bf' },
  ];
  assert.equal(aiWorkflowExamples.tools.captures.length, expected.length);
  for (const [index, capture] of aiWorkflowExamples.tools.captures.entries()) {
    const approved = expected[index];
    assert.match(capture.src, /^\/images\/(?:si-adoption\/tools|archive\/android-ar-campfire)\/[a-z0-9-]+\.webp$/);
    assert.ok(capture.title && capture.detail && capture.alt && capture.caption);
    const bytes = await readFile(new URL(`../../public${capture.src}`, import.meta.url));
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, approved.width);
    assert.equal(metadata.height, approved.height);
    assert.ok(bytes.length < approved.maxBytes, capture.src);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), approved.hash);
    for (const key of ['exif', 'xmp', 'iptc']) assert.equal(metadata[key], undefined);
  }
});

test('02·03 단계에서 모델명이 표시된 다섯 캡처의 해당 영역은 불투명 단색으로 가려져 있다', async () => {
  const regions = [
    ['read-only/01-codebase-scan.webp', 1588, 1280, 196, 42, 38],
    ['implementation/01-implementation-request.webp', 1885, 1452, 215, 40, 43],
    ['implementation/02-code-review-request.webp', 2605, 1452, 220, 40, 43],
    ['implementation/04-screen-annotation.webp', 2605, 1452, 220, 40, 43],
    ['implementation/05-layout-result.webp', 2605, 1452, 220, 40, 43],
  ];
  for (const [file, left, top, width, height, color] of regions) {
    const bytes = await readFile(new URL(`../../public/images/si-adoption/${file}`, import.meta.url));
    const pixels = await sharp(bytes).extract({ left, top, width, height }).removeAlpha().raw().toBuffer();
    assert.ok(pixels.every((value) => value === color), file);
  }
});

test('05 단계는 본문·이미지·후속 설명을 스크롤 순서로 배치하고 사진 슬라이더를 쓰지 않는다', async () => {
  assert.deepEqual(Object.keys(aiWorkflowStories), ['orchestration']);
  const story = aiWorkflowStories.orchestration;
  assert.deepEqual(story.sections.map(({ id }) => id), ['sessions', 'pre-notice', 'coordination']);
  assert.ok(story.sections[0].paragraphs.length && story.sections[0].capture);
  assert.ok(story.sections[1].paragraphs.length && story.sections[1].capture);
  assert.ok(story.sections[2].paragraphs.length && !story.sections[2].capture);
  assert.match(story.summary, /Claude 데스크톱 앱의 내장 세션 간 메시지 전송/);
  assert.match(story.environment.tool, /내장 세션 간 메시지 전송/);
  assert.doesNotMatch(story.summary + story.environment.tool, /문서 기반 인수인계|보고와 문서/);
  for (const text of ['사전 통보', '예상 중단 시간', '영향을 받는 기능', '당시 업로드 작업']) assert.ok(story.sections[1].paragraphs.join(' ').includes(text), text);
  assert.doesNotMatch(JSON.stringify(story), /[A-Z]:[\\/]|https?:\/\/|_si-adoption-levels-imgs|Fable|사용 모델|\.md\b|\.sh\b|@[a-z0-9.-]+\.[a-z]+/u);
  const content = await readFile(new URL('../app/about-me/ai-workflow/WorkflowStageContent.tsx', import.meta.url), 'utf8');
  assert.match(content, /aiWorkflowStories\[stage\.id\]/);
  assert.match(content, /story && <WorkflowStory/);
  const component = await readFile(new URL('../app/about-me/ai-workflow/WorkflowStory.tsx', import.meta.url), 'utf8');
  assert.match(component, /story\.sections\.map/);
  assert.ok(component.indexOf('section.paragraphs.map') < component.indexOf('<WorkflowInlineCapture'));
  const image = await readFile(new URL('../app/about-me/ai-workflow/WorkflowInlineCapture.tsx', import.meta.url), 'utf8');
  for (const source of [component, image]) assert.doesNotMatch(source, /Swiper|ProjectMediaCarousel["']|WorkflowCaptureGallery|aria-roledescription="carousel"|새 탭/);
  assert.match(image, /<Image[^]*?width=\{capture\.width\} height=\{capture\.height\}/);
  assert.match(image, /<ZoomableImage/);
  assert.match(image, /<MediaDialog/);
  assert.match(image, /returnFocus=\{\(\) => triggerRef\.current\}/);
  assert.match(image, /mediaDialogOutsideCloseAllowed/);
});

test('05 사례는 대표 세션 간 협업과 서브에이전트의 구현·검증·문서화 분담을 구분한다', () => {
  const story = aiWorkflowStories.orchestration;
  assert.match(story.summary, /공용 인프라와 이커머스 데모의 대표 세션/);
  const section = story.sections.find(({ id }) => id === 'sessions');
  assert.match(section.title, /대표 세션이 작업을 조율하고 관리/);
  assert.match(section.paragraphs[0], /각 프로젝트의 작업을 조율하고 관리하는 대표 세션/);
  assert.match(section.paragraphs[0], /내장 메시지 기능으로 관련 대표 세션에/);
  assert.match(section.paragraphs[1], /각 대표 세션은 서브에이전트를 통해 구현·검증·문서화 등의 작업/);
  assert.match(section.paragraphs[1], /작업을 나눠 맡기고 진행 상황과 결과를 확인/);
});

test('05 사전 통보 캡처는 세션 메시지와 수신 측 판단을 보존하고 권한 식별자·경로만 불투명하게 가린다', async () => {
  const capture = aiWorkflowStories.orchestration.sections[1].capture;
  assert.equal(capture.src, '/images/si-adoption/orchestration/02-session-pre-notice.webp');
  const bytes = await readFile(new URL(`../../public${capture.src}`, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '8b51c1719e0d27b83e183c342e53cd7000542ef615bcd6e992f9a7813982451a');
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, capture.width);
  assert.equal(metadata.height, capture.height);
  assert.equal(metadata.width, 1237);
  assert.equal(metadata.height, 315);
  assert.ok(bytes.length < 20000);
  for (const key of ['exif', 'xmp', 'iptc']) assert.equal(metadata[key], undefined);
  for (const [left, top, width, height] of [[759, 75, 101, 25], [530, 98, 198, 26]]) {
    const pixels = await sharp(bytes).extract({ left, top, width, height }).removeAlpha().raw().toBuffer();
    assert.ok(pixels.every((value) => value === 36), `${left},${top}`);
  }
});

test('05 공개 캡처는 원본 해상도의 검토된 불투명 가림 사본이며 메타데이터를 제외한다', async () => {
  const capture = aiWorkflowStories.orchestration.sections[0].capture;
  assert.equal(capture.src, '/images/si-adoption/orchestration/01-session-handoff.webp');
  const bytes = await readFile(new URL(`../../public${capture.src}`, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'b6f2fb5de673cdac0daa268c297de31a67d395ef9ec41d59dfe687ce0b75a895');
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, capture.width);
  assert.equal(metadata.height, capture.height);
  assert.equal(metadata.width, 2812);
  assert.equal(metadata.height, 1490);
  assert.ok(bytes.length < 70000);
  for (const key of ['exif', 'xmp', 'iptc']) assert.equal(metadata[key], undefined);
  const regions = [
    [1, 258, 473, 323, 17], [1, 659, 473, 830, 17],
    [720, 30, 965, 150, 32], [725, 437, 465, 31, 36],
    [855, 551, 159, 31, 36], [1099, 551, 214, 31, 36], [1328, 551, 168, 31, 36],
    [725, 643, 812, 32, 36], [762, 841, 895, 31, 36], [762, 869, 179, 31, 36],
    [850, 895, 235, 31, 36], [720, 1026, 965, 47, 36],
    [1744, 143, 316, 102, 32], [1760, 497, 288, 38, 32], [1740, 599, 320, 101, 32],
    [2191, 1060, 507, 150, 32], [2195, 1418, 560, 71, 32], [1460, 1440, 221, 49, 32],
  ];
  for (const [left, top, width, height, color] of regions) {
    const pixels = await sharp(bytes).extract({ left, top, width, height }).removeAlpha().raw().toBuffer();
    assert.ok(pixels.every((value) => value === color), `${left},${top}`);
  }
});

test('04 단계는 MCP·CLI 두 그룹의 로컬 아이콘 목록을 캡처와 별개로 유지한다', async () => {
  assert.deepEqual(aiWorkflowTools.map(({ name }) => name), ['GitHub', 'Notion', 'Jira', 'OpenPencil', 'Colab', 'Unity', 'Blender']);
  assert.equal(new Set(aiWorkflowTools.map(({ id }) => id)).size, 7);
  assert.deepEqual(aiWorkflowCliTools.map(({ name }) => name), ['Git', 'FFmpeg', 'Google Cloud CLI', 'ADB', 'Podman']);
  assert.deepEqual(aiWorkflowCliTools.map(({ id }) => id), ['git', 'ffmpeg', 'gcloud', 'adb', 'podman']);
  assert.deepEqual(aiWorkflowToolGroups.map(({ id, tools }) => [id, tools.length]), [['mcp', 7], ['cli', 5]]);
  for (const tool of [...aiWorkflowTools, ...aiWorkflowCliTools]) {
    assert.ok(tool.detail);
    assert.deepEqual(Object.keys(tool).sort(), ['detail', 'icon', 'id', 'name']);
    assert.match(tool.icon, /^\/icons\/workflow-tools\/[a-z-]+\.(?:svg|webp)$/);
    if (tool.id === 'podman') {
      assert.equal(tool.icon, '/icons/workflow-tools/podman-symbol.webp');
      const bytes = await readFile(new URL(`../../public${tool.icon}`, import.meta.url));
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, 266);
      assert.equal(metadata.height, 253);
      assert.ok(bytes.length < 6000);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), '595b8942d07e50e0816a7f260b355611e82fc0df3d87d4649a7c1984db762f87');
      continue;
    }
    assert.match(tool.icon, /\.svg$/);
    const svg = await readFile(new URL(`../../public${tool.icon}`, import.meta.url), 'utf8');
    assert.match(svg, /<svg\b[^>]*viewBox=/);
    assert.doesNotMatch(svg, /<script|<foreignObject|<image\b/);
    assert.doesNotMatch(svg, /(?:href|src)="(?!#)/);
  }
  const content = await readFile(new URL('../app/about-me/ai-workflow/WorkflowStageContent.tsx', import.meta.url), 'utf8');
  assert.match(content, /stage\.id === 'tools' && <WorkflowTools \/>/);
  const component = await readFile(new URL('../app/about-me/ai-workflow/WorkflowTools.tsx', import.meta.url), 'utf8');
  assert.match(component, /aiWorkflowToolGroups\.map/);
  assert.match(component, /group\.tools\.map/);
  assert.match(component, /data-group=\{group\.id\}/);
  assert.doesNotMatch(component, /tool\.command|toolCommand|<code\b/);
  assert.match(component, /\$\{basePath\}\$\{tool\.icon\}/);
  assert.match(component, /alt=""/);
  assert.match(component, /현재 연결 상태나 모든 작업 권한을 뜻하지 않습니다/);
  assert.doesNotMatch(component, /<button\b|<a\b|WorkflowCaptureGallery/);
  const notice = await readFile(new URL('../../public/icons/workflow-tools/NOTICE.txt', import.meta.url), 'utf8');
  assert.match(notice, /Simple Icons/);
  assert.match(notice, /GitHub: https:\/\/github\.com\/logos/);
  assert.match(notice, /Git logo by Jason Long, CC BY 3\.0/);
  assert.match(notice, /Android robot.*adb CLI/s);
  assert.match(notice, /work created and shared by Google.*Creative Commons 3\.0 Attribution License/);
  assert.match(notice, /Podman: https:\/\/podman\.io/);
  assert.match(notice, /Podman color symbol: unmodified WebP used by the official Podman website navbar/);
  assert.match(notice, /913ceb777a00360fbbe0f697bc36f54781ca3b1b\/static\/logos\/optimized\/podman-3-logo-266w-253h\.webp/);
  const podmanLicense = await readFile(new URL('../../public/icons/workflow-tools/LICENSE-podman.txt', import.meta.url), 'utf8');
  assert.match(podmanLicense, /Apache License.*Version 2\.0/s);
  assert.match(notice, /MIT License.*OpenPencil contributors/s);
});

test('CLI 카드는 MCP와 같은 크기·내용 형식을 쓰고 오른쪽 생략 표시는 동작 없는 안내로 둔다', async () => {
  const component = await readFile(new URL('../app/about-me/ai-workflow/WorkflowTools.tsx', import.meta.url), 'utf8');
  assert.match(component, /group\.id === 'cli' &&/);
  assert.match(component, /<li className=\{styles\.toolMore\} style=/);
  assert.match(component, /'--tool-more-span': Math\.max\(1, 7 - group\.tools\.length\)/);
  assert.match(component, /role="img" aria-label="이 밖에도 다양한 CLI 도구가 있습니다">⋯/);
  const css = await readFile(new URL('../app/about-me/ai-workflow/AiWorkflow.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.toolGrid \{[^}]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.toolMore \{[^}]*place-items: center[^}]*grid-column: span var\(--tool-more-span, 1\)/);
  assert.match(css, /@media \(max-width: 1000px\) \{[^]*?\.toolMore \{ grid-column: auto; \}/);
  assert.match(css, /@media \(max-width: 640px\) \{[^]*?\.toolMore \{ grid-column: auto; \}/);
  assert.doesNotMatch(css, /toolCommand|\.toolGrid\[data-group='cli'\]/);
});

test('04 단계는 아이콘이 일부 예시임을 설명하고 MCP 외 CLI 활용과 권한·검증 범위를 함께 다룬다', async () => {
  const tools = aiWorkflowStages.find(({ id }) => id === 'tools');
  assert.match(tools.shortTitle, /MCP·CLI/);
  assert.match(tools.navDescription, /MCP·CLI/);
  assert.match(tools.description, /MCP.*플러그인.*CLI.*명령줄 인터페이스/);
  assert.match(tools.flowSteps.map(({ detail }) => detail).join(' '), /CLI/);
  const component = await readFile(new URL('../app/about-me/ai-workflow/WorkflowTools.tsx', import.meta.url), 'utf8');
  for (const text of ['MCP·CLI로 활용하는 도구의 예시', '수많은 도구 중 일부', '이 목록에 한정되지 않습니다', 'MCP나 플러그인이 없어도', '환경과 권한', 'CLI를 통해', 'FFmpeg', 'gcloud', '어떻게 검증', '같은 도구도 MCP·플러그인·CLI']) {
    assert.ok(component.includes(text), text);
  }
});

test('단계 탭은 기존 직접 링크·챗봇 헤더·사례 앵커를 올바른 패널로 연결한다', () => {
  aiWorkflowStages.forEach((stage, index) => {
    for (const hash of [`#workflow-${stage.id}`, `#workflow-header-${stage.id}`, `#example-${stage.id}`]) {
      assert.equal(workflowStageFromHash(hash), stage.id);
      assert.equal(workflowStageIndexFromHash(hash), index);
    }
  });
  assert.equal(workflowStageFromHash('#workflow-tools-gallery-title'), 'tools');
  for (const hash of ['', '#ai-workflow-intro', '#workflow-tools-extra', '#workflow-header-unknown', '#%']) {
    assert.equal(workflowStageFromHash(hash), 'chat');
  }
  assert.equal(workflowStageIndexForKey('ArrowRight', 4), 0);
  assert.equal(workflowStageIndexForKey('ArrowLeft', 0), 4);
  assert.equal(workflowStageIndexForKey('Home', 3), 0);
  assert.equal(workflowStageIndexForKey('End', 1), 4);
  for (const key of ['Tab', 'Enter', ' ', 'ArrowDown']) assert.equal(workflowStageIndexForKey(key, 1), null);
});

test('상하단 단계 선택은 기존 카드형 버튼을 공유하고 본문은 퇴장·입장 슬라이드와 독립 갤러리를 유지한다', async () => {
  const page = await readFile(new URL('../app/about-me/ai-workflow/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /<WorkflowStageTabs panels=\{aiWorkflowStages\.map/);
  assert.doesNotMatch(page, /<WorkflowStageNav/);
  const tabs = await readFile(new URL('../app/about-me/ai-workflow/WorkflowStageTabs.tsx', import.meta.url), 'utf8');
  assert.equal((tabs.match(/<WorkflowStageNav\b/g) ?? []).length, 2);
  for (const pattern of [/autoHeight speed=\{speed\}/, /useMediaSwiperSpeed\(\)/, /allowTouchMove=\{false\}/, /simulateTouch=\{false\}/, /inert=\{index !== activeIndex\}/, /<SwiperSlide/, /\{panels\[index\]\}/, /new ResizeObserver/, /swiper\.updateAutoHeight\(\)/, /addEventListener\('popstate'/, /addEventListener\('hashchange'/, /window\.history\.pushState\(window\.history\.state/]) {
    assert.match(tabs, pattern);
  }
  assert.doesNotMatch(tabs, /index === activeIndex &&|activeIndex === index &&/);
  const nav = await readFile(new URL('../app/about-me/ai-workflow/WorkflowStageNav.tsx', import.meta.url), 'utf8');
  for (const text of ['role="tablist"', 'role="tab"', 'aria-controls=', 'aria-selected={current}', 'tabIndex={current ? 0 : -1}', 'workflowStageIndexForKey', 'styles.jumpNumber', 'styles.jumpDescription', '현재 단계']) assert.ok(nav.includes(text), text);
  assert.doesNotMatch(nav, /scrollToStage|scrollIntoView/);
});

test('하단 선택은 고유 탭 ID와 공통 선택 상태를 쓰고 상단 도착 후에만 초점·단계를 바꾼다', async () => {
  const tabs = await readFile(new URL('../app/about-me/ai-workflow/WorkflowStageTabs.tsx', import.meta.url), 'utf8');
  assert.match(tabs, /<WorkflowStageNav currentStageId=\{activeId\} onSelect=\{selectStage\}/);
  assert.match(tabs, /<WorkflowStageNav currentStageId=\{activeId\} onSelect=\{selectStageFromBottom\} position="bottom"/);
  assert.ok(tabs.indexOf('position="bottom"') > tabs.indexOf('</Swiper>'));
  const handler = tabs.match(/function selectStageFromBottom\(id: AiWorkflowStageId\) \{([^]*?)\n  \}/)?.[1];
  assert.ok(handler);
  assert.match(handler, /scrollToWorkflowStageNav\(target, speed > 0, \(\) => \{/);
  assert.match(handler, /getElementById\(`workflow-tab-\$\{id\}`\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.ok(handler.indexOf('scrollToWorkflowStageNav') < handler.indexOf('selectStage(id)'));
  assert.ok(handler.indexOf('.focus') < handler.indexOf('selectStage(id)'));
  assert.doesNotMatch(handler, /scrollIntoView|behavior: 'instant'/);
  assert.match(tabs, /useEffect\(\(\) => \(\) => \{ cancelNavScrollRef\.current\?\.\(\); \}, \[hash, speed\]\)/);
  const nav = await readFile(new URL('../app/about-me/ai-workflow/WorkflowStageNav.tsx', import.meta.url), 'utf8');
  assert.match(nav, /position === 'top' \? 'workflow-tab' : 'workflow-bottom-tab'/);
  assert.match(nav, /id=\{`\$\{tabIdPrefix\}-\$\{stage\.id\}`\}/);
  assert.match(nav, /getElementById\(`\$\{tabIdPrefix\}-\$\{stage\.id\}`\)/);
  assert.match(nav, /본문 아래 SI 활용 단계 선택/);
  assert.ok(nav.indexOf('.focus') < nav.indexOf('onSelect(stage.id)'));
});

function workflowScrollFixture({ scrollY = 8000, navTop = 1108 } = {}) {
  const frames = new Map();
  const commands = [];
  let nextFrame = 0;
  const view = Object.assign(new EventTarget(), {
    scrollY, scrollX: 0, innerHeight: 900,
    performance: { now: () => 0 },
    getComputedStyle: (target) => target === document.documentElement ? { scrollPaddingTop: '84px' } : { scrollMarginTop: '24px' },
    scrollTo: (options) => { commands.push(options); if (options.behavior === 'instant') view.scrollY = options.top; },
    requestAnimationFrame: (callback) => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  const document = { defaultView: view, documentElement: { scrollHeight: 12000 }, scrollingElement: { scrollHeight: 12000 } };
  const target = { ownerDocument: document, getBoundingClientRect: () => ({ top: navTop - view.scrollY }) };
  const tick = (timestamp) => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(timestamp); };
  return { view, target, commands, frames, tick };
}

test('브라우저가 기본 스크롤을 즉시 실행해도 모션 켬은 첫 프레임에 상단으로 점프하지 않는다', () => {
  const fixture = workflowScrollFixture();
  fixture.view.scrollTo = (options) => { fixture.commands.push(options); fixture.view.scrollY = options.top; };
  let arrivals = 0;
  scrollToWorkflowStageNav(fixture.target, true, () => { arrivals++; });
  assert.equal(fixture.view.scrollY, 8000);
  fixture.tick(0);
  assert.equal(fixture.view.scrollY, 8000);
  fixture.tick(160);
  assert.ok(fixture.view.scrollY < 8000 && fixture.view.scrollY > 1000);
  assert.equal(arrivals, 0);
});

test('하단 선택은 부드러운 스크롤 도중 본문을 유지하고 헤더 여백을 반영한 상단 도착 뒤 전환한다', () => {
  const fixture = workflowScrollFixture();
  let arrivals = 0;
  scrollToWorkflowStageNav(fixture.target, true, () => { arrivals++; });
  assert.deepEqual(fixture.commands, []);
  fixture.tick(0);
  fixture.tick(200);
  assert.ok(fixture.view.scrollY < 8000 && fixture.view.scrollY > 1000);
  assert.equal(arrivals, 0);
  fixture.tick(500);
  assert.equal(arrivals, 0);
  fixture.tick(900);
  assert.equal(fixture.view.scrollY, 1000);
  assert.ok(fixture.commands.every(({ behavior }) => behavior === 'instant'));
  assert.equal(arrivals, 1);
  assert.equal(fixture.frames.size, 0);
  const commandCount = fixture.commands.length;
  fixture.view.dispatchEvent(new Event('wheel'));
  assert.equal(fixture.commands.length, commandCount);
});

test('모션 끄기 또는 이미 상단에 있는 경우에는 불필요하게 기다리지 않고 바로 전환한다', () => {
  for (const [fixture, animated] of [[workflowScrollFixture(), false], [workflowScrollFixture({ scrollY: 1000 }), true]]) {
    let arrivals = 0;
    scrollToWorkflowStageNav(fixture.target, animated, () => { arrivals++; });
    assert.deepEqual(fixture.commands, [{ top: 1000, behavior: 'instant' }]);
    assert.equal(arrivals, 1);
    assert.equal(fixture.frames.size, 0);
  }
});

test('휠·터치·다른 클릭으로 스크롤을 중단하면 나중에 초점이나 단계를 강제로 바꾸지 않는다', () => {
  for (const type of ['wheel', 'touchstart', 'pointerdown']) {
    const fixture = workflowScrollFixture();
    let arrivals = 0;
    scrollToWorkflowStageNav(fixture.target, true, () => { arrivals++; });
    fixture.tick(0);
    fixture.tick(200);
    const interruptedTop = fixture.view.scrollY;
    const commandCount = fixture.commands.length;
    fixture.view.dispatchEvent(new Event(type));
    fixture.tick(900);
    assert.equal(fixture.commands.length, commandCount);
    assert.equal(fixture.view.scrollY, interruptedTop);
    assert.equal(arrivals, 0, type);
    assert.equal(fixture.frames.size, 0, type);
  }
});

test('반복 선택·화면 이탈 취소는 이전 전환 콜백을 폐기하고 최신 요청만 완료한다', () => {
  const fixture = workflowScrollFixture();
  let previousArrivals = 0;
  let latestArrivals = 0;
  const cancel = scrollToWorkflowStageNav(fixture.target, true, () => { previousArrivals++; });
  cancel();
  cancel();
  assert.equal(fixture.commands.length, 0);
  scrollToWorkflowStageNav(fixture.target, true, () => { latestArrivals++; });
  fixture.tick(0);
  fixture.tick(900);
  assert.equal(previousArrivals, 0);
  assert.equal(latestArrivals, 1);
  assert.equal(fixture.frames.size, 0);
});

test('문서 스크롤이 잠겨 상단에 도착하지 못하면 본문만 전환하지 않는다', () => {
  const fixture = workflowScrollFixture();
  fixture.view.scrollTo = (options) => fixture.commands.push(options);
  let arrivals = 0;
  scrollToWorkflowStageNav(fixture.target, true, () => { arrivals++; });
  fixture.tick(0);
  fixture.tick(900);
  assert.equal(arrivals, 0);
  assert.equal(fixture.frames.size, 0);
});

test('스크롤 키는 이동을 취소하지만 탭 자체가 처리한 Home·End 키는 새 요청을 취소하지 않는다', () => {
  for (const prevented of [false, true]) {
    const fixture = workflowScrollFixture();
    let arrivals = 0;
    scrollToWorkflowStageNav(fixture.target, true, () => { arrivals++; });
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'key', { value: 'Home' });
    if (prevented) event.preventDefault();
    fixture.view.dispatchEvent(event);
    fixture.tick(0);
    fixture.tick(900);
    assert.equal(arrivals, prevented ? 1 : 0);
  }
});

test('사례 갤러리는 기존 확대·슬라이드를 재사용하고 모든 단계의 이미지 새 탭 링크를 제거한다', async () => {
  const page = await readFile(new URL('../app/about-me/ai-workflow/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /<WorkflowStageContent/);
  const content = await readFile(new URL('../app/about-me/ai-workflow/WorkflowStageContent.tsx', import.meta.url), 'utf8');
  assert.match(content, /aiWorkflowExamples\[stage\.id\]/);
  assert.match(content, /<WorkflowExample/);
  const example = await readFile(new URL('../app/about-me/ai-workflow/WorkflowExample.tsx', import.meta.url), 'utf8');
  assert.match(example, /사용 환경.*environment\.tool/s);
  assert.doesNotMatch(example, /사용 모델|environment\.model|제품과 모델/);
  assert.match(example, /각 단계에서 반드시 사용해야 하는 도구를 뜻하지는 않습니다/);
  const gallery = await readFile(new URL('../app/about-me/ai-workflow/WorkflowCaptureGallery.tsx', import.meta.url), 'utf8');
  assert.match(gallery, /onActiveIndexChange=\{setActiveIndex\}/);
  assert.match(gallery, /captures\[activeIndex\]/);
  assert.doesNotMatch(gallery, /<a\b|target="_blank"|새 탭에서 크게 보기|basePath/);
  assert.match(gallery, /이미지를 누르면 전체 보기로 열립니다/);
  assert.match(gallery, /aria-live="polite"/);
  assert.match(gallery, /frameAspectRatio=\{frameAspectRatio \?\? \(portrait \? '834 \/ 1706' : undefined\)\}/);
  assert.doesNotMatch(gallery, /expandedImageSize/);
  const shared = await readFile(new URL('../components/about/ProjectMediaCarousel.tsx', import.meta.url), 'utf8');
  assert.equal((shared.match(/style=\{frameAspectRatio \? \{ aspectRatio: frameAspectRatio \} : undefined\}/g) ?? []).length, 1);
  assert.match(shared, /<ZoomableImage key=\{image\.src\}/);
  assert.doesNotMatch(shared, /expandedImageSize|lightboxPortraitFrame/);
  const css = await readFile(new URL('../app/about-me/ai-workflow/AiWorkflow.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.captureGallery \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.captureGallery > \* \{ min-width: 0; \}/);
});

test('새 탭 경로를 정확히 구분하고 기존 탭은 유지한다', () => {
  assert.equal(aboutTabPathFromPath('/about-me/ai-workflow/'), '/about-me/ai-workflow');
  assert.equal(aboutTabPathFromPath('/about-me/ai-workflow-extra'), null);
  assert.equal(aboutTabPathFromPath('/about-me/architecture/'), '/about-me/architecture');
  assert.equal(aboutTabPathFromPath('/about-me/architecture-extra'), null);
  assert.equal(aboutTabPathFromPath('/about-me/log/view'), '/about-me/log');
  assert.equal(aboutTabPathFromPath('/about-me'), '/about-me');
});

test('마무리 카드는 상황에 맞는 활용 방식의 선택을 안내하며 중립 표면으로 구분한다', async () => {
  const page = await readFile(new URL('../app/about-me/ai-workflow/page.tsx', import.meta.url), 'utf8');
  const closing = page.match(/<aside className=\{styles\.closing\}[^]*?<\/aside>/)?.[0];
  assert.ok(closing);
  for (const text of ['aria-labelledby="workflow-try-title"', 'CHOOSE WHAT FITS', '정답은 하나가 아닙니다', '더 높은 단계나 더 많은 도구가 항상 더 좋은 결과를 뜻하지는 않습니다', '작업의 성격과 복잡도', '팀의 환경', '검토에 드는 노력', '상황에 맞는 활용 방식을 고르는 것이 중요합니다']) assert.ok(closing.includes(text), text);
  assert.doesNotMatch(closing, /WHERE ARE YOU NOW|NEXT EXPERIMENT|다음 실험은 작은 작업 하나부터|어느 단계|현재 주로 활용하는 단계|다음 단계로 나아가려면/);
  assert.match(page, /여러분 또는 여러분의 팀·조직은 지금 어느 단계로 일하고 있나요/);
  const css = await readFile(new URL('../app/about-me/ai-workflow/AiWorkflow.module.css', import.meta.url), 'utf8');
  const style = css.match(/^\.closing \{[^}]*\}/m)?.[0];
  assert.ok(style);
  assert.match(style, /border-inline-start: 3px solid var\(--accent\)/);
  assert.match(style, /background: var\(--bg-elev\)/);
  assert.doesNotMatch(style, /--bg-elev-2|--accent-soft|linear-gradient/);
});

test('소개 요약은 프로젝트 다음·활용 실험 앞에 놓고 상세 탭에 연결한다', async () => {
  const page = await readFile(new URL('../app/about-me/page.tsx', import.meta.url), 'utf8');
  const positions = ['id="featured-projects"', '<AiWorkflowPreview />', '<AgentExperimentGallery />'].map((text) => page.indexOf(text));
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
  const preview = await readFile(new URL('../components/about/AiWorkflowPreview.tsx', import.meta.url), 'utf8');
  assert.ok(preview.includes('/about-me/ai-workflow/#workflow-${stage.id}'));
  const layout = await readFile(new URL('../app/about-me/layout.tsx', import.meta.url), 'utf8');
  assert.ok(layout.includes('href: "/about-me/ai-workflow"'));
});

test('SI 안내는 백악관 지침·개인적 동의·사용 경험·개인적 전망 순서이며 모델 분류 목록은 두지 않는다', async () => {
  const notice = await readFile(new URL('../components/about/SiTerminologyNotice.tsx', import.meta.url), 'utf8');
  for (const text of ['SI 표기 안내', 'SI(Super Intelligence, 초지능)', '참고해', '용어를 사용합니다']) {
    assert.ok(notice.includes(text), text);
  }
  const references = ['백악관의 지침', '개인적으로도 이 방향에 동의하며', '페이블 5의 사용 경험'].map((text) => notice.indexOf(text));
  assert.ok(references.every((position, index) => position >= 0 && (!index || position > references[index - 1])));
  assert.ok(!notice.includes('기존 AI 기술과 도구를 가리킵니다'));
  assert.ok(notice.includes('<time dateTime="2026-07-01">2026년 7월 1일</time> 서비스가 재개된'));
  assert.ok(notice.includes('에서 다양한 주제에 대한 답변 수준을 보며 이미 인류의 평균은 넘어서는 범용 지능 능력을 갖췄다고 해도 되지 않을까 하는 생각이 들었습니다.</p>'));
  assert.ok(notice.includes('<p>이러한 답변이 단순히 다음 토큰을 예측한 결과에 불과하더라도 그 <strong>내용의 가치는 실재한다고 생각</strong>합니다. 수년 이내에는 출력 토큰에 담긴 내용이 진정한 의미의 초지능 수준의 가치를 보여줄 수 있지 않을까 기대합니다. 이 사이트의 <strong>SI 표기</strong>에는 제가 바라보는 <strong>기술의 발전 방향과 개인적인 기대</strong>를 미리 반영한 표현의 의미도 있습니다.</p>'));
  assert.doesNotMatch(notice, /표기 배경 · 준비 중|styles\.pending/u);
  assert.doesNotMatch(notice, /AI와 SI를 구분|AI·SI 구분/u);
  assert.doesNotMatch(notice, /페이블 시리즈|Opus|Astra|GPT-|2026년 기준|<ul\b/u);
  assert.ok(!/\bhref=/.test(notice), '준비 중인 배경 로그에는 링크를 만들지 않는다');
  const page = await readFile(new URL('../app/about-me/page.tsx', import.meta.url), 'utf8');
  assert.ok(page.indexOf('<SiTerminologyNotice />') >= 0);
  assert.ok(page.indexOf('<SiTerminologyNotice />') < page.indexOf('id="featured-projects"'));
  for (const file of ['../components/about/AiWorkflowPreview.tsx', '../app/about-me/ai-workflow/page.tsx']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.ok(source.includes('SI 활용 단계'));
  }
  const layout = await readFile(new URL('../app/about-me/layout.tsx', import.meta.url), 'utf8');
  assert.ok(layout.includes('shortLabel: "SI 활용 단계"'));
});
