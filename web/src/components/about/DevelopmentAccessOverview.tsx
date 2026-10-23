import { developmentAccessDescription, developmentAccessRoutes, developmentAccessTargets, groupDevelopmentAccessChannels, groupDevelopmentAccessRoutes } from '@/data/developmentAccess';
import { developmentMachines } from '@/data/developmentTopology';
import styles from './DevelopmentAccessOverview.module.css';

function AccessRoutes({ routes }: { routes: typeof developmentAccessRoutes }) {
  return (
    <div className={styles.groups}>
      {groupDevelopmentAccessRoutes(routes).map(group => {
        const channels = groupDevelopmentAccessChannels(group.routes);
        return (
          <div key={group.id} className={[styles.accessGroup, channels.length > 1 ? styles.multi : ''].join(' ')}
            data-access-group={group.id} data-access-route-count={group.routes.length}>
            <div className={styles.clients}>
              <span className={styles.label}>접속하는 기기</span>
              <ul>{group.clients.map(id => <li key={id} data-access-client={id}>{developmentMachines[id].label}</li>)}</ul>
              {group.routes.length > 1 && <p className={styles.groupNote}>모든 기기가 각 접속 수단을 이용합니다.</p>}
            </div>
            <div className={styles.channels}>
              {channels.map(channel => (
                <div key={channel.id} className={styles.pathway} data-access-channel={channel.label} data-access-channel-targets={channel.routes.length}>
                  <div className={styles.channel}>
                    <span className={styles.inputLine} aria-hidden="true" />
                    <span className={styles.gateway}>{channel.label}</span>
                    {channel.note && <span className={styles.channelNote}>{channel.note}</span>}
                  </div>
                  <div className={[styles.targets, channel.routes.length > 1 ? styles.branch : ''].join(' ')}>
                    {channel.routes.map(route => (
                      <div key={route.id} className={styles.route} data-access-route={route.id} data-access-history={route.historical ? 'historical' : 'current'}>
                        <span className={styles.routeLine} aria-hidden="true" />
                        <div className={styles.target} data-access-target={route.target}>
                          <span className={styles.label}>접속 대상</span>
                          <strong>{developmentAccessTargets[route.target]}</strong>
                          {route.targetRole && <span className={styles.label}>{route.targetRole}</span>}
                          <p>{route.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 접속 기기와 접속 수단을 공유하되 스마트폰 원격 경로와 과거 환경은 분리한다. */
export default function DevelopmentAccessOverview() {
  return (
    <figure className={styles.figure} aria-labelledby="development-access-title" aria-describedby="development-access-description">
      <figcaption id="development-access-title">개발 도구 접속 경로</figcaption>
      <p className={styles.lead}>접속 기기 → 접속 수단 → 대상 순서입니다. 같은 접속 수단은 한 번만 표시하고, 그 뒤에서 대상 환경으로 갈라집니다.</p>
      <AccessRoutes routes={developmentAccessRoutes.filter(route => !route.historical)} />
      <section className={styles.history} aria-labelledby="development-access-history-title">
        <h4 id="development-access-history-title">이전 개발 환경 · 현재 미사용</h4>
        <AccessRoutes routes={developmentAccessRoutes.filter(route => route.historical)} />
      </section>
      <p id="development-access-description" className={styles.description}>{developmentAccessDescription}</p>
    </figure>
  );
}
