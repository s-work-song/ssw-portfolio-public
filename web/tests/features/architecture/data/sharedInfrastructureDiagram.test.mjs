import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sharedInfrastructureDeploymentSource, sharedInfrastructureServices } from '../../../../src/features/architecture/data/sharedInfrastructureDiagram.ts';

test('주요 공용 기능과 운영 기능은 이름과 역할이 있는 개별 서비스 카드로 나눈다', () => {
  assert.equal(new Set(sharedInfrastructureServices.map(service => service.id)).size, sharedInfrastructureServices.length);
  for (const service of sharedInfrastructureServices) {
    assert.ok(service.title && service.role);
    assert.ok(sharedInfrastructureDeploymentSource.includes(`${service.id}["${service.title}`));
  }
  assert.doesNotMatch(sharedInfrastructureDeploymentSource, /Services\[/u);
});

test('공용 인프라 도식에는 다른 프로젝트나 내부 주소를 싣지 않는다', () => {
  assert.doesNotMatch(sharedInfrastructureDeploymentSource, /CommerceAPI|Asset|https?:\/\/|localhost|\bport\b|[A-Z]:[\\/]/iu);
});

test('데스크톱 SVG와 모바일 카드 목록은 같은 서비스 정보를 사용하며 SVG가 모바일 글자를 작게 축소하지 않는다', async () => {
  const component = await readFile(new URL('../../../../src/features/architecture/diagrams/SharedInfrastructureDeploymentDiagram.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../../../src/features/architecture/diagrams/SharedInfrastructureDeploymentDiagram.module.css', import.meta.url), 'utf8');
  assert.equal(component.split('sharedInfrastructureServices.map').length - 1, 2);
  assert.match(component, /data-infra-service=\{service.id\}/u);
  assert.match(component, /role="img" aria-labelledby=\{captionId\} aria-describedby=\{descriptionId\}/u);
  assert.match(component, /onSettled\?\.\(\)/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.desktop \{ display: none/u);
  assert.match(css, /\.mobile \{ display: block/u);
  assert.doesNotMatch(component, /fetch\(|innerHTML|dangerouslySetInnerHTML/u);
});
