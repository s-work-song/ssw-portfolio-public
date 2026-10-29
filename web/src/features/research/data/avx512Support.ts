/**
 * 최적화 개요의 AVX-512 파편화 표에 쓰는 제품군별 지원 하위 집합이다.
 * Wikipedia AVX-512 문서의 "CPUs with AVX-512" 목록(2026-10 확인)과 제품 발표 기사를 기준으로 했고,
 * InstLatX64의 2019년 벤 다이어그램에서 착안해 이후 제품과 AMD를 더했다.
 * 모든 제품에서 항상 함께 지원되는 하위 집합은 한 열로 묶는다.
 */

export interface Avx512SubsetGroup {
  id: string;
  label: string;
  /** 열 제목이 줄임말일 때 묶인 하위 집합을 모두 적는다. */
  members: readonly string[];
}

export interface Avx512Product {
  name: string;
  detail: string;
  /** 지원하는 열의 id. 비어 있으면 note로 사정을 적는다. */
  supported: readonly string[];
  note?: string;
}

export const avx512SubsetGroups: readonly Avx512SubsetGroup[] = [
  { id: 'f-cd', label: 'F·CD', members: ['F', 'CD'] },
  { id: 'er-pf', label: 'ER·PF', members: ['ER', 'PF'] },
  { id: 'phi-dl', label: '4FMAPS·4VNNIW', members: ['4FMAPS', '4VNNIW'] },
  { id: 'vl-dq-bw', label: 'VL·DQ·BW', members: ['VL', 'DQ', 'BW'] },
  { id: 'ifma-vbmi', label: 'IFMA·VBMI', members: ['IFMA', 'VBMI'] },
  { id: 'vnni', label: 'VNNI', members: ['VNNI'] },
  { id: 'bf16', label: 'BF16', members: ['BF16'] },
  { id: 'vpopcntdq', label: 'VPOPCNTDQ', members: ['VPOPCNTDQ'] },
  { id: 'vbmi2', label: 'VBMI2 외 4종', members: ['VBMI2', 'BITALG', 'GFNI', 'VAES', 'VPCLMULQDQ'] },
  { id: 'vp2intersect', label: 'VP2INTERSECT', members: ['VP2INTERSECT'] },
  { id: 'fp16', label: 'FP16', members: ['FP16'] },
];

const ICE_LAKE = ['f-cd', 'vl-dq-bw', 'ifma-vbmi', 'vnni', 'vpopcntdq', 'vbmi2'] as const;

export const avx512Products: readonly Avx512Product[] = [
  { name: 'Knights Landing', detail: 'Xeon Phi · 2016', supported: ['f-cd', 'er-pf'] },
  { name: 'Knights Mill', detail: 'Xeon Phi · 2017', supported: ['f-cd', 'er-pf', 'phi-dl', 'vpopcntdq'] },
  { name: 'Skylake-SP·X', detail: 'Xeon·HEDT · 2017', supported: ['f-cd', 'vl-dq-bw'] },
  { name: 'Cannon Lake', detail: '모바일 · 2018', supported: ['f-cd', 'vl-dq-bw', 'ifma-vbmi'] },
  { name: 'Cascade Lake', detail: 'Xeon · 2019', supported: ['f-cd', 'vl-dq-bw', 'vnni'] },
  { name: 'Cooper Lake', detail: 'Xeon · 2020', supported: ['f-cd', 'vl-dq-bw', 'vnni', 'bf16'] },
  { name: 'Ice Lake·Rocket Lake', detail: '10·11세대, Xeon · 2019~2021', supported: ICE_LAKE },
  { name: 'Tiger Lake', detail: '11세대 모바일 · 2020', supported: [...ICE_LAKE, 'vp2intersect'] },
  {
    name: '12세대 ~ Core Ultra',
    detail: '소비자용 · 2021~',
    supported: [],
    note: '공식 미지원. 12세대 성능 코어에는 회로가 있었지만 효율 코어와 명령어를 맞추려고 막았습니다.',
  },
  { name: 'Sapphire Rapids 이후', detail: '성능 코어 Xeon · 2023~', supported: [...ICE_LAKE, 'bf16', 'fp16'] },
  {
    name: 'Sierra Forest',
    detail: '효율 코어 Xeon 6 · 2024',
    supported: [],
    note: '미지원. 같은 Xeon 6라도 성능 코어 제품(Granite Rapids)은 지원합니다.',
  },
  { name: 'AMD Zen 4', detail: '2022', supported: [...ICE_LAKE, 'bf16'] },
  { name: 'AMD Zen 5', detail: '2024', supported: [...ICE_LAKE, 'bf16', 'vp2intersect'] },
];
