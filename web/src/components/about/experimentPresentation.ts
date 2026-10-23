import type { AgentExperimentImage, AgentExperimentModelCredit } from '../../data/agentExperiments.ts';

export type DisplayModelCredit = { purpose?: string; models: string[]; via?: string };

/** 같은 모델의 역할을 합쳐 표시하되 원본 제작 정보와 경유 도구는 보존한다. */
export function mergeModelCredits(credits: AgentExperimentModelCredit[] = []): DisplayModelCredit[] {
  const entries = new Map<string, { model: string; purposes: Set<string>; via?: string }>();
  for (const credit of credits) {
    for (const model of credit.models) {
      const key = JSON.stringify([model, credit.via]);
      const entry = entries.get(key) ?? { model, purposes: new Set<string>(), via: credit.via };
      if (credit.purpose) entry.purposes.add(credit.purpose);
      entries.set(key, entry);
    }
  }
  return [...entries.values()].map(({ model, purposes, via }) => ({
    purpose: purposes.size ? [...purposes].join(' · ') : undefined,
    models: [model],
    via,
  }));
}

/** 사진별 헤더와 완전히 같은 작품명·모델 캡션만 생략한다. */
export function imageWithoutRepeatedCaption(image: AgentExperimentImage, credits: AgentExperimentModelCredit[] = []) {
  const credit = credits.find((entry) => entry.purpose === image.modelCreditPurpose);
  const repeatsHeader = image.title && credit
    && image.caption === `${image.title} · ${credit.models.join(' · ')}`;
  return repeatsHeader ? { ...image, caption: undefined } : image;
}

/** 선택 버튼의 제목에 이미 표기된 단일 제작 모델은 다시 표시하지 않는다. */
export function creditsWithoutTitleRepeat(title: string, credits: AgentExperimentModelCredit[] = []) {
  return credits.filter((credit) => credit.purpose || credit.via
    || !title.endsWith(` · ${credit.models.join(' · ')}`));
}
