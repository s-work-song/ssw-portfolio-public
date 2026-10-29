'use client';

import * as Tabs from '@radix-ui/react-tabs';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { architectureTabFromHash, architectureTabHash, type ArchitectureTab } from '../navigation/architectureTabNavigation';
import styles from './ArchitectureTabs.module.css';

function subscribeToLocation(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

function currentHash() { return window.location.hash; }
function serverHash() { return ''; }

/** 본문은 서버 렌더링 슬롯으로 받고, 탭 선택만 클라이언트에서 처리한다. */
export default function ArchitectureTabs({ development, deployment, migration }: { development: ReactNode; deployment: ReactNode; migration: ReactNode }) {
  const activeHash = useSyncExternalStore(subscribeToLocation, currentHash, serverHash);
  const activeTab: ArchitectureTab = architectureTabFromHash(activeHash);

  useEffect(() => {
    // 상세 링크는 탭 본문이 열린 뒤 복원한다. 기본 탭 주소는 아래로 이동시키지 않는다.
    if (!activeHash || activeHash === architectureTabHash(activeTab)) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const target = document.getElementById(activeHash.slice(1));
        target?.scrollIntoView({ block: 'start' });
      });
    });
    return () => { window.cancelAnimationFrame(firstFrame); window.cancelAnimationFrame(secondFrame); };
  }, [activeHash, activeTab]);

  function selectTab(value: string) {
    if (value !== 'development' && value !== 'deployment' && value !== 'migration') return;
    if (value === activeTab) return;
    window.history.pushState(null, '', architectureTabHash(value));
    window.dispatchEvent(new Event('hashchange'));
  }

  return (
    <Tabs.Root value={activeTab} onValueChange={selectTab} className={styles.tabs} activationMode="automatic">
      <Tabs.List className={styles.tabList} aria-label="개발·배포 환경 보기">
        <Tabs.Trigger value="development" className={styles.tab}>개발 환경</Tabs.Trigger>
        <Tabs.Trigger value="deployment" className={styles.tab}>배포 구성</Tabs.Trigger>
        <Tabs.Trigger value="migration" className={styles.tab}>인프라 최적화</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="development" className={styles.panel}>{development}</Tabs.Content>
      <Tabs.Content value="deployment" className={styles.panel}>{deployment}</Tabs.Content>
      <Tabs.Content value="migration" className={styles.panel}>{migration}</Tabs.Content>
    </Tabs.Root>
  );
}
