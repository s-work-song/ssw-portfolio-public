import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PARTICLE_PREVIEWS,
  particlePreviewCount,
  particlePreviewRadius,
  particlePreviewTiming,
  seasonParticleCount,
  seasonParticleTiming,
  spawnPreviewParticle,
} from '../../../src/features/seasonal/seasonParticleProfiles.ts';
import { isSeasonWeatherEnabled, SEASON_WEATHER_EFFECTS, SEASON_WEATHER_IDS } from '../../../src/features/seasonal/seasonWeatherPolicy.ts';

test('스타일 가이드의 선택은 실제 시즌과 같은 눈·낙엽·벚꽃·비 순이다', () => {
  assert.deepEqual(PARTICLE_PREVIEWS.map(({ id, season }) => [id, season]), [
    ['snow', 'winter'], ['leaves', 'autumn'], ['petals', 'spring'], ['rain', 'summer'],
  ]);
});

test('낙엽·벚꽃·비는 자기 시즌에서만 기본으로 내리고 각각 끌 수 있다', () => {
  for (const id of SEASON_WEATHER_IDS) {
    const { season, dataset } = SEASON_WEATHER_EFFECTS[id];
    assert.equal(isSeasonWeatherEnabled(id, { season }), true);
    assert.equal(isSeasonWeatherEnabled(id, { season, [dataset]: 'false' }), false);
    for (const other of ['none', 'winter', 'christmas', ...SEASON_WEATHER_IDS.map((otherId) => SEASON_WEATHER_EFFECTS[otherId].season)]) {
      if (other !== season) assert.equal(isSeasonWeatherEnabled(id, { season: other, [dataset]: 'true' }), false);
    }
  }
});

test('공통 양과 카드 뒤 설정은 실제 입자에 적용되고 전체 화면은 넓게 퍼져 시작한다', () => {
  for (const id of ['snow', ...SEASON_WEATHER_IDS]) {
    const regular = seasonParticleCount(id, 1600, 900, 'normal', false);
    assert.ok(seasonParticleCount(id, 1600, 900, 'light', false) < regular);
    assert.ok(seasonParticleCount(id, 1600, 900, 'heavy', false) > regular);
    assert.equal(seasonParticleCount(id, 1600, 900, 'normal', true), 2 * regular);
    assert.ok(seasonParticleTiming(id).startupRampSeconds(900) >= particlePreviewTiming(id).startupRampSeconds(360));
  }
});

test('눈·낙엽·벚꽃·비 모두 화면 위에서 시작하고 지정한 카드 앞뒤 층을 따른다', () => {
  for (const { id } of PARTICLE_PREVIEWS) {
    const particle = spawnPreviewParticle(id, 400, 'back');
    assert.ok(particle.x >= 0 && particle.x < 400);
    assert.ok(particle.y < -particlePreviewRadius(id, particle.size));
    assert.equal(particle.plane, 'back');
    assert.equal(particle.visibility, 1);
    assert.equal(particle.frontShare, 0);
  }
});

test('비는 잎사귀보다 빠르고 촘촘하며, 뒤에 숨긴 견본은 입자 상한을 지킨다', () => {
  const rain = spawnPreviewParticle('rain', 400, 'front');
  const leaf = spawnPreviewParticle('leaves', 400, 'front');
  assert.ok(rain.speed > leaf.speed * 3);
  assert.ok(rain.angle < 0);
  assert.equal(rain.spin, 0);
  assert.ok(particlePreviewCount('rain', 620, 320, false) > particlePreviewCount('leaves', 620, 320, false));
  assert.equal(particlePreviewCount('rain', 620, 320, true), 2 * particlePreviewCount('rain', 620, 320, false));
  assert.equal(particlePreviewCount('rain', 3840, 2160, true), 115);
  assert.ok(particlePreviewTiming('rain').fadeOutSeconds < particlePreviewTiming('snow').fadeOutSeconds);
});
