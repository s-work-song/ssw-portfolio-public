export type ArchitectureTab = 'development' | 'deployment' | 'migration';

/** 기존 상세 링크도 해당 탭을 열 수 있도록 유지한다. */
export function architectureTabFromHash(hash: string): ArchitectureTab {
  if (/^#(?:infrastructure-migration(?:-|$)|migration-memory(?:-|$)|memory-chart-title$|service-memory-title$)/u.test(hash)) return 'migration';
  return /^#deployment(?:-|$)/u.test(hash)
    ? 'deployment'
    : 'development';
}

export function architectureTabHash(tab: ArchitectureTab) {
  const hashes = { development: '#development-environment', deployment: '#deployment-overview', migration: '#infrastructure-migration' } as const;
  return hashes[tab];
}
