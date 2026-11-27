export type GraphPost = {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
};

export type LogGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: "reference" | "related";
  commonTags: string[];
  reason: string;
  score: number;
};

// 공개 원문에 있는 네 링크의 실험용 메타데이터 스냅샷이다.
// 본문을 복제하거나 실시간으로 참조 관계를 추출하는 기능은 아니다.
const REFERENCE_PAIRS = [
  ["consider-human-hallucination-before-ai-hallucination", "do-not-call-restful-and-rpc-the-same"],
  ["good-tools-do-not-automatically-improve-collaboration", "rules-need-both-compliance-and-enforceable-structure"],
  ["why-object-oriented-design-and-patterns-should-be-understood-together", "why-i-started-software-development"],
  ["why-object-oriented-design-matters-more-in-the-ai-era", "why-i-started-software-development"],
] as const;

const STOP_WORDS = new Set([
  "그리고", "하지만", "때문에", "대한", "통해", "위해", "어떤", "있다", "있는", "없다", "않는",
  "것이다", "것을", "하는", "한다", "하기", "생각", "기록", "기록합니다", "이야기", "이유", "경험",
  "정리합니다", "the", "and", "for", "with",
]);
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const round = (value: number) => Math.round(value * 1000) / 1000;
const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase();

function canonicalPosts(posts: GraphPost[]): GraphPost[] {
  const sorted = [...posts].filter((post) => post.slug.trim()).sort((a, b) =>
    compareText(a.slug, b.slug) || compareText(JSON.stringify(a), JSON.stringify(b)));
  return sorted.filter((post, index) => index === 0 || sorted[index - 1].slug !== post.slug);
}

export type LogTagGroup = { id: string; tag: string | null; posts: GraphPost[] };

/** 태그 소속만 묶는다. 여러 태그를 가진 글은 각 묶음에 한 번씩 포함된다. */
export function buildLogTagGroups(posts: GraphPost[]): LogTagGroup[] {
  const groups = new Map<string, LogTagGroup>();
  for (const post of canonicalPosts(posts)) {
    const labels = [...post.tags].map((tag) => tag.trim()).filter(Boolean).sort(compareText);
    const seen = new Set<string>();
    for (const tag of labels.length ? labels : [null]) {
      const id = tag === null ? "untagged" : `tag:${normalize(tag)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const group = groups.get(id) ?? { id, tag, posts: [] };
      group.posts.push(post);
      groups.set(id, group);
    }
  }
  return [...groups.values()].sort((a, b) => Number(a.tag === null) - Number(b.tag === null)
    || b.posts.length - a.posts.length || compareText(a.id, b.id));
}

/** 중앙 허브 양옆에 196×104 카드를 겹침 없이 배치한다. */
export function layoutTagBranches(count: number) {
  const rows = Math.ceil(count / 2);
  return {
    center: { x: 330, y: Math.max(0, rows - 1) * 66 },
    branches: Array.from({ length: count }, (_, index) => ({
      position: { x: index % 2 === 0 ? 0 : 660, y: Math.floor(index / 2) * 132 },
      side: index % 2 === 0 ? "left" as const : "right" as const,
    })),
  };
}

function keywords(post: GraphPost): Set<string> {
  return new Set((`${post.title} ${post.summary}`.normalize("NFKC").toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) ?? [])
    .map((word) => word.replace(/(?:에서|으로|에게|처럼|보다|까지|부터|은|는|이|가|을|를|의|과|와)$/, ""))
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word)));
}

function pairId(source: string, target: string): string {
  return JSON.stringify([source, target].sort(compareText));
}

/** 태그 희소성과 제목/요약의 공통 단어만 사용하는 탐색용 휴리스틱. 의미 검색이 아니다. */
export function buildLogGraph(posts: GraphPost[]): { edges: LogGraphEdge[] } {
  const ordered = canonicalPosts(posts);
  const tags = ordered.map((post) => new Set(post.tags.map(normalize).filter(Boolean)));
  const words = ordered.map(keywords);
  const tagFrequency = new Map<string, number>();
  const wordFrequency = new Map<string, number>();
  const tagLabels = new Map<string, string>();
  ordered.forEach((post, index) => {
    for (const tag of [...post.tags].sort(compareText)) {
      if (normalize(tag) && !tagLabels.has(normalize(tag))) tagLabels.set(normalize(tag), tag.trim());
    }
    for (const tag of tags[index]) tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
    for (const word of words[index]) wordFrequency.set(word, (wordFrequency.get(word) ?? 0) + 1);
  });
  const candidates: LogGraphEdge[] = [];
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const sharedTags = [...tags[i]].filter((tag) => tags[j].has(tag)).sort(compareText);
      const sharedWords = [...words[i]].filter((word) => words[j].has(word)).sort(compareText);
      // 단어 하나 우연히 겹친 글을 자동으로 엮지 않는다.
      if (!sharedTags.length && sharedWords.length < 2) continue;
      const tagScore = sharedTags.reduce((sum, tag) => sum + Math.log(1 + ordered.length / tagFrequency.get(tag)!), 0);
      const wordScore = sharedWords.reduce((sum, word) => sum + Math.log(1 + ordered.length / wordFrequency.get(word)!), 0);
      const commonTags = sharedTags.map((tag) => tagLabels.get(tag)!);
      const source = ordered[i].slug;
      const target = ordered[j].slug;
      candidates.push({
        id: pairId(source, target), source, target, kind: "related", commonTags,
        reason: commonTags.length ? `공통 태그: ${commonTags.join(" · ")}` : `제목·요약 공통 단어: ${sharedWords.slice(0, 3).join(" · ")}`,
        score: round(tagScore * 3 + Math.min(wordScore, 3) * 0.35),
      });
    }
  }
  const selected = new Map<string, LogGraphEdge>();
  for (const post of ordered) {
    candidates.filter((edge) => edge.source === post.slug || edge.target === post.slug)
      .sort((a, b) => b.score - a.score || compareText(a.id, b.id))
      .slice(0, 2).forEach((edge) => selected.set(edge.id, edge));
  }
  const slugs = new Set(ordered.map((post) => post.slug));
  for (const [source, target] of REFERENCE_PAIRS) {
    if (!slugs.has(source) || !slugs.has(target)) continue;
    const id = pairId(source, target);
    const related = candidates.find((edge) => edge.id === id);
    selected.set(id, {
      id, source, target, kind: "reference", commonTags: related?.commonTags ?? [],
      reason: "공개 본문에서 직접 참조한 기록", score: related?.score ?? 0,
    });
  }
  return { edges: [...selected.values()].sort((a, b) => compareText(a.id, b.id)) };
}

/** 선택한 기록을 기준으로 직접 참조의 방향을 설명한다. */
export function describeLogConnection(edge: LogGraphEdge, selectedSlug: string | null): string {
  if (edge.kind !== "reference") return edge.reason;
  if (edge.source === selectedSlug) return "이 글에서 참조한 기록";
  if (edge.target === selectedSlug) return "이 글을 참조하는 기록";
  return edge.reason;
}

type Point = { x: number; y: number };
const NODE_WIDTH = 196;
const NODE_HEIGHT = 104;
const GAP = 24;

/** 196×104 카드의 좌상단 좌표. 난수·DOM·물리 엔진 없이 작은 전체 목록을 동기 배치한다. */
export function layoutLogGraph(posts: GraphPost[], edges: LogGraphEdge[]): Record<string, Point> {
  const ordered = canonicalPosts(posts);
  if (!ordered.length) return {};
  const indices = new Map(ordered.map((post, index) => [post.slug, index]));
  const uniqueLinks = new Map<string, [number, number]>();
  for (const edge of [...edges].sort((a, b) => compareText(a.id, b.id))) {
    const source = indices.get(edge.source);
    const target = indices.get(edge.target);
    if (source !== undefined && target !== undefined && source !== target) {
      uniqueLinks.set(pairId(edge.source, edge.target), [source, target]);
    }
  }
  const links = [...uniqueLinks.entries()].sort(([a], [b]) => compareText(a, b)).map(([, link]) => link);
  const points = ordered.map((_, index) => {
    const angle = index * 2.399963229728653;
    const radius = Math.sqrt(index + 0.5) * 135;
    return { x: Math.cos(angle) * radius * 1.35, y: Math.sin(angle) * radius * 0.8 };
  });
  for (let step = 0; step < 240; step++) {
    const forces = points.map((point) => ({ x: -point.x * 0.005, y: -point.y * 0.005 }));
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const strength = Math.min(16, 34000 / (distance * distance));
        forces[i].x -= dx / distance * strength;
        forces[i].y -= dy / distance * strength;
        forces[j].x += dx / distance * strength;
        forces[j].y += dy / distance * strength;
      }
    }
    for (const [source, target] of links) {
      const dx = points[target].x - points[source].x;
      const dy = points[target].y - points[source].y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const strength = (distance - 270) * 0.035;
      forces[source].x += dx / distance * strength;
      forces[source].y += dy / distance * strength;
      forces[target].x -= dx / distance * strength;
      forces[target].y -= dy / distance * strength;
    }
    const cooling = 1 - step / 300;
    points.forEach((point, index) => {
      point.x += Math.max(-18, Math.min(18, forces[index].x)) * cooling;
      point.y += Math.max(-18, Math.min(18, forces[index].y)) * cooling;
    });
    // 사각형 충돌을 더 짧은 축으로 해소해 관계가 가까운 느슨한 군집을 유지한다.
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        const overlapX = NODE_WIDTH + GAP - Math.abs(dx);
        const overlapY = NODE_HEIGHT + GAP - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        if (overlapX < overlapY) {
          const push = (overlapX / 2 + 0.01) * (dx < 0 ? -1 : 1);
          points[i].x -= push; points[j].x += push;
        } else {
          const push = (overlapY / 2 + 0.01) * (dy < 0 ? -1 : 1);
          points[i].y -= push; points[j].y += push;
        }
      }
    }
  }
  // force 결과를 가까운 엇갈린 격자에 투영한다. 전부 fitView했을 때
  // 작은 28개 카드가 끝없이 퍼지지 않으며 사각형 충돌도 확실히 제거된다.
  const columns = Math.ceil(Math.sqrt(ordered.length * 0.8));
  const rows = Math.ceil(ordered.length / columns);
  const slots = Array.from({ length: columns * rows }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return { x: column * 234 + (row % 2) * 18, y: row * 145 + (column % 2) * 7 };
  });
  const minForceX = Math.min(...points.map((point) => point.x));
  const minForceY = Math.min(...points.map((point) => point.y));
  const forceWidth = Math.max(1, Math.max(...points.map((point) => point.x)) - minForceX);
  const forceHeight = Math.max(1, Math.max(...points.map((point) => point.y)) - minForceY);
  const degrees = ordered.map(() => 0);
  links.forEach(([source, target]) => { degrees[source]++; degrees[target]++; });
  const assignmentOrder = ordered.map((_, index) => index)
    .sort((a, b) => degrees[b] - degrees[a] || a - b);
  for (const index of assignmentOrder) {
    const desired = {
      x: (points[index].x - minForceX) / forceWidth * (columns - 1) * 234,
      y: (points[index].y - minForceY) / forceHeight * (rows - 1) * 145,
    };
    const distance = (point: Point) => (point.x - desired.x) ** 2 + (point.y - desired.y) ** 2;
    slots.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x);
    points[index] = slots.shift()!;
  }
  const minimumX = Math.min(...points.map((point) => point.x));
  const minimumY = Math.min(...points.map((point) => point.y));
  return Object.fromEntries(ordered.map((post, index) => [post.slug, {
    x: round(points[index].x - minimumX + 32), y: round(points[index].y - minimumY + 32),
  }]));
}
