/**
 * 연구 탭 정의와 타임라인 콘텐츠를 보관하는 데이터 모듈이다.
 * 공유 CareerItem 타입에만 의존하고 React·탭 상태·표현 계층을 알지 않는다.
 * 소비 계층은 이 불변 계약에 의존해 새 연대기 항목 추가에 열려 있다(OCP·DIP).
 */
import type { CareerItem } from '@/types/career';

export type ResearchTabId =
  | 'overview'
  | 'optimization'
  | 'cpu'
  | 'memory'
  | 'serialization'
  | 'meta';

export type ResearchPrimaryTabId = 'overview' | 'optimization' | 'meta';

export interface ResearchTab {
  id: ResearchTabId;
  label: string;
  emoji: string;
}

export const researchPrimaryTabs: readonly ResearchTab[] = [
  { id: 'overview', label: '연구·실험 이력 (Timeline)', emoji: '⏱️' },
  { id: 'optimization', label: '성능 최적화', emoji: '⚡' },
  { id: 'meta', label: '개발 도구 및 AI 활용', emoji: '🛠️' },
];

export const researchOptimizationTabs: readonly ResearchTab[] = [
  { id: 'optimization', label: '최적화 개요', emoji: '📊' },
  { id: 'cpu', label: 'CPU & SIMD', emoji: '🔬' },
  { id: 'memory', label: '메모리 & 파일 I/O', emoji: '💾' },
  { id: 'serialization', label: '직렬화 & 전송', emoji: '📡' },
];

export const researchTabs: readonly ResearchTab[] = [
  researchPrimaryTabs[0],
  ...researchOptimizationTabs,
  researchPrimaryTabs[2],
];

export function researchPrimaryTabFromTab(
  tabId: ResearchTabId,
): ResearchPrimaryTabId {
  if (tabId === 'overview' || tabId === 'meta') return tabId;
  return 'optimization';
}

export const researchTimelineItems: CareerItem[] = [
  {
    period: '학창 시절',
    color: '#3b82f6',
    role: '하드웨어 성능 측정 및 최적화',
    org: '',
    desc: 'CPU 오버클럭 환경 구성과 안정화 작업을 수행하고, 하드웨어 벤치마크를 통해 성능과 안정성을 측정했습니다.',
    tags: ['Hardware', 'Overclocking']
  },
  {
    period: '학창 시절',
    color: '#3b82f6',
    role: 'SSD RAID 0 및 2-Way SLI 구성',
    org: '',
    desc: '복수 SSD의 RAID 0 구성과 2-Way SLI 그래픽 카드 병렬 처리 환경을 구축하고, 디스크 I/O와 그래픽 처리 구조를 학습했습니다.',
    tags: ['RAID 0', '2-Way SLI', 'Benchmarking']
  },
  {
    period: '2022년',
    color: '#f97316',
    role: 'VR/AR 콘텐츠 개발 과정 수료',
    org: '',
    desc: '유니티 엔진을 활용한 VR/AR 콘텐츠 개발의 기초 이론과 실습 과정을 이수했습니다.',
    tags: ['Unity', 'Game Dev', 'VR / AR']
  },
  {
    period: '2022년',
    color: '#f97316',
    role: 'C# 저수준 문법 및 비동기 처리 분석',
    org: '',
    desc: 'Java와의 구조체 메모리 동작 차이(in/out/ref 키워드, 방어적 복사)를 분석하고, async/await 비동기 처리 및 취소 토큰 관리 방법을 학습했습니다.',
    tags: ['C#', 'Async / Await']
  },
  {
    period: '2022년',
    color: '#f97316',
    role: '객체 지향 설계 및 구조 실험',
    org: '',
    desc: 'DDD(도메인 주도 설계)와 Feature-First 패키지 구조를 프로젝트에 적용하고, 책임 분리와 유지보수 관점에서 구조를 검토했습니다.',
    tags: ['OOP', 'DDD', 'Clean Architecture']
  },
  {
    period: '2023년',
    color: '#ef4444',
    role: '단위 테스트 환경 및 프로파일링 연구',
    org: '',
    desc: 'Visual Studio 테스트 탐색기와 연동하는 XUnit, MSTest 단위 테스트 설계법을 연구하고, 유니티 프로파일러를 활용한 어셈블리 성능 프로파일링을 설계했습니다.',
    tags: ['XUnit', 'MSTest', 'Profiling']
  },
  {
    period: '2023년',
    color: '#ef4444',
    role: '데이터 지향 설계(DoD) 및 Unity ECS 적용',
    org: '',
    desc: '기존 OOP 설계의 성능 한계를 확인하고 개선하기 위해 SoA(Struct of Arrays) 메모리 레이아웃을 도입하고, Unity ECS/DOTS를 적용하여 캐시 지역성 및 성능 효율을 실험했습니다.',
    tags: ['Unity ECS', 'Structure of Arrays', 'DoD']
  },
  {
    period: '2023년',
    color: '#ef4444',
    role: 'C++ 및 언리얼 엔진 기초 학습',
    org: '',
    desc: '유니티 요금제 개편을 계기로 다른 개발 환경을 검토하며 C++ STL, 저수준 메모리 관리 및 언리얼 엔진 구조를 학습했습니다.',
    tags: ['C++', 'Unreal Engine']
  },
  {
    period: '2023년',
    color: '#ef4444',
    role: '윈도우 API 활용 및 키보드 후킹',
    org: '',
    desc: 'User32.dll을 이용한 시스템 전역 저수준 키보드 훅(user-mode)을 구현하고, SendInput API를 연동한 자동 매크로 프로그램을 작성했습니다.',
    tags: ['Win32 API', 'Low-level Keyboard Hook']
  },
  {
    period: '2024년',
    color: '#a855f7',
    role: '업무 보조용 WPF MVVM 데스크톱 앱 구축',
    org: '',
    desc: 'WinForms 기반 엑셀 행 데이터 자동 매핑기 프로토타입을 제작한 뒤, WPF MVVM 패턴으로 마이그레이션(CommunityToolkit.Mvvm)하고 NPOI, HtmlAgilityPack, MimeKit 등의 라이브러리를 적용했습니다.',
    tags: ['WPF', 'MVVM', 'XAML', 'NPOI']
  },
  {
    period: '2024년',
    color: '#a855f7',
    role: '.NET BCL 및 메모리 할당 최적화',
    org: '',
    desc: '.NET 8 환경에서 Newtonsoft.Json 기반 코드를 System.Text.Json으로 마이그레이션하고, Span<T>와 ref struct를 활용한 힙 할당 감소 및 스택 메모리 사용 방법을 학습했습니다.',
    tags: ['Span<T>', 'System.Text.Json', 'Pipelines']
  },
  {
    period: '2024년',
    color: '#a855f7',
    role: '바이너리 직렬화 (Protobuf) 및 압축 최적화',
    org: '',
    desc: 'Protocol Buffers의 Varint 가변 길이 인코딩 및 지그재그 인코딩 방식을 학습하고, ZSTD/GZIP 압축을 연계해 전송 데이터 크기를 줄이는 소켓 통신 구현을 검증했습니다.',
    tags: ['Protobuf', 'ZSTD', 'Socket']
  },
  {
    period: '2025년',
    color: '#10b981',
    role: 'SIMD (AVX2/ARM NEON) 및 CUDA 가속',
    org: '',
    desc: 'C# AVX2 Intrinsics 명령어 및 BMI2 비트 조작(PEXT/PDEP)을 사용한 Nibble 단위 비트 패킹을 연구하고, ARM NEON 벡터 연산 및 CUDA GPU 가속 기초를 학습했습니다.',
    tags: ['AVX2 SIMD', 'BMI2', 'ARM NEON', 'CUDA']
  },
  {
    period: '2025년',
    color: '#10b981',
    role: '정량적 성능 프로파일링 (BenchmarkDotNet)',
    org: '',
    desc: 'BenchmarkDotNet으로 추상화 구조별 연산 속도와 GC 할당량을 측정하고 비교하는 검증 절차를 구성했습니다.',
    tags: ['BenchmarkDotNet', 'Microbenchmarks']
  },
  {
    period: '2025년',
    color: '#10b981',
    role: 'PDF 파싱 및 이미지 자동 매칭 앱 제작',
    org: '',
    desc: 'PDF 파일에서 이미지 데이터를 파싱·추출하고 디렉토리 내 에셋과 대조하여, 일치하는 파일명을 일괄 변경하는 업무 보조용 유틸리티를 제작해 사용했습니다.',
    tags: ['WPF', 'PDF Parsing']
  },
  {
    period: '2026–현재',
    color: '#6366f1',
    role: '오픈 웨이트 AI 모델 실행 환경 구성',
    org: '',
    desc: 'Semantic Kernel을 활용해 오픈 웨이트 모델을 로컬 GPU에서 직접 구동하는 환경과 Google Colab GPU에서 추론 서버로 제공하는 환경을 각각 구성하고 테스트했습니다.',
    tags: ['Open Weight', 'Semantic Kernel']
  },
  {
    period: '2026–현재',
    color: '#6366f1',
    role: 'AI 에이전트 오케스트레이션',
    org: '',
    desc: '복수의 AI 개발 에이전트에 구현·검증·문서화 역할을 분담하고, 저수준 성능 최적화 실험 결과를 검증해 포트폴리오 문서로 정리했습니다.',
    tags: ['AI Agent', 'Orchestration']
  }
];
