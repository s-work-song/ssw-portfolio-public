import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { commerceConnectionPath, commerceDiagramGroups, commerceDiagramLinks, commerceDiagramNodes, commerceDiagramSize } from '../../../../src/features/architecture/data/commerceDiagram.ts';
import { deploymentDiagrams } from '../../../../src/features/architecture/data/deployment.ts';

const commerce = deploymentDiagrams.find(diagram => diagram.id === 'e-commerce');
const nodeById = new Map(commerceDiagramNodes.map(node => [node.id, node]));
const edgeKey = (from, to) => `${from}-${to}`;

test('수동 SVG는 기존 상세도의 모든 노드와 의미 연결을 유지한다', () => {
  const ids = [...commerce.source.matchAll(/^\s+(\w+)\[/gmu)].map(([, id]) => id);
  const edges = [...commerce.source.matchAll(/\b(\w+) -->[^\n]*?\b(\w+)\s*$/gmu)].map(([, from, to]) => edgeKey(from, to));
  assert.deepEqual(new Set(nodeById.keys()), new Set(ids));
  assert.deepEqual(new Set(commerceDiagramLinks.map(({ from, to }) => edgeKey(from, to))), new Set(edges));
  assert.equal(nodeById.size, commerceDiagramNodes.length);
  assert.equal(commerceDiagramLinks.length, edges.length);
});

test('업무와 공용 인프라는 같은 높이와 폭의 대칭 열이며 카드끼리 겹치지 않는다', () => {
  const [business, shared] = commerceDiagramGroups;
  for (const key of ['y', 'width', 'height']) assert.equal(business[key], shared[key]);
  assert.equal(business.x, commerceDiagramSize.width - shared.x - shared.width);
  for (const node of commerceDiagramNodes) {
    assert.ok(node.x >= 0 && node.y >= 0);
    assert.ok(node.x + node.width <= commerceDiagramSize.width);
    assert.ok(node.y + node.height <= commerceDiagramSize.height);
    for (const other of commerceDiagramNodes) {
      if (node.id === other.id) continue;
      assert.ok(node.x + node.width <= other.x || other.x + other.width <= node.x || node.y + node.height <= other.y || other.y + other.height <= node.y, `${node.id} / ${other.id}`);
    }
  }
  assert.equal(nodeById.get('CommerceTunnel').y, nodeById.get('InfraTunnel').y);
  assert.equal(nodeById.get('CommerceAPI').y, nodeById.get('InfraGateway').y);
});

test('모든 선은 해당 카드 경계에서 시작하고 끝나며 다른 카드 내부를 지나지 않는다', () => {
  const onBoundary = ([x, y], node) => (
    ((x === node.x || x === node.x + node.width) && y >= node.y && y <= node.y + node.height)
    || ((y === node.y || y === node.y + node.height) && x >= node.x && x <= node.x + node.width)
  );
  for (const link of commerceDiagramLinks) {
    assert.ok(onBoundary(link.route[0], nodeById.get(link.from)), link.from);
    assert.ok(onBoundary(link.route.at(-1), nodeById.get(link.to)), link.to);
    assert.doesNotThrow(() => commerceConnectionPath(link.route));
    for (let index = 1; index < link.route.length; index++) {
      const [x, y] = link.route[index];
      const [previousX, previousY] = link.route[index - 1];
      for (const node of commerceDiagramNodes) {
        const crosses = x === previousX
          ? x > node.x && x < node.x + node.width && Math.max(y, previousY) > node.y && Math.min(y, previousY) < node.y + node.height
          : y > node.y && y < node.y + node.height && Math.max(x, previousX) > node.x && Math.min(x, previousX) < node.x + node.width;
        assert.equal(crosses, false, `${link.from}-${link.to} crosses ${node.id}`);
      }
    }
  }
  assert.throws(() => commerceConnectionPath([[0, 0], [1, 1]]), /orthogonal/u);
});

test('JWT 발급과 공개키 제공은 인증 서버, JWT 검증과 업무 데이터는 커머스에 구분한다', () => {
  assert.match(nodeById.get('InfraAuth').lines.join(' '), /JWT 발급·갱신.*공개키 제공/u);
  assert.match(nodeById.get('CommerceAPI').lines.join(' '), /JWT 직접 검증/u);
  const authRequest = commerceDiagramLinks.find(link => link.from === 'CommerceAPI' && link.to === 'InfraTunnel');
  assert.ok(authRequest.label.lines.includes('JWKS 공개키 조회'));
  assert.equal(commerceDiagramLinks.some(link => link.from === 'Browser' && link.to === 'InfraAuth'), false);
  assert.equal(commerceDiagramLinks.some(link => link.from === 'CommerceDB' && link.to.startsWith('Infra')), false);
  assert.match(commerce.description, /인증 연동 시/u);
});

test('고객·관리자 Workers는 별도 추론 Tunnel 뒤의 Colab LLM에 연결한다', () => {
  assert.match(nodeById.get('InferenceTunnel').title, /추론 전용/u);
  assert.match(nodeById.get('LLM').title, /Google Colab.*GPU/u);
  const links = new Set(commerceDiagramLinks.map(link => edgeKey(link.from, link.to)));
  assert.ok(links.has('Workers-InferenceTunnel'));
  assert.ok(links.has('InferenceTunnel-LLM'));
  assert.equal(links.has('Workers-LLM'), false);
  assert.equal(links.has('CommerceTunnel-LLM'), false);
  assert.equal(links.has('InfraTunnel-LLM'), false);
});

test('모바일 간략도와 접근성·테마·렌더 완료 안내를 유지한다', async () => {
  const component = await readFile(new URL('../../../../src/features/architecture/diagrams/ECommerceDeploymentDiagram.tsx', import.meta.url), 'utf8');
  const carousel = await readFile(new URL('../../../../src/features/architecture/ui/DeploymentDiagramCarousel.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../../../src/features/architecture/diagrams/ECommerceDeploymentDiagram.module.css', import.meta.url), 'utf8');
  assert.match(component, /useSyncExternalStore\(subscribe, getCompact, getServerCompact\)/u);
  assert.match(component, /if \(compact\) return <MermaidDiagram/u);
  assert.match(component, /if \(!compact && !getCompact\(\)\) onSettled\?\.\(\)/u);
  assert.match(component, /role="img" aria-labelledby=\{captionId\} aria-describedby=\{descriptionId\}/u);
  assert.match(component, /data-diagram-status="ready"/u);
  assert.match(carousel, /diagram.id === 'e-commerce'[\s\S]*?<ECommerceDeploymentDiagram/u);
  assert.match(css, /var\(--text\)/u);
  assert.match(css, /var\(--accent\)/u);
  assert.doesNotMatch(component, /fetch\(|innerHTML|dangerouslySetInnerHTML|https?:\/\//u);
});
