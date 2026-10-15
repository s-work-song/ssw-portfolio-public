import {
  deploymentMemoryComparison,
  deploymentMemoryServices,
  deploymentMemoryTotals,
} from '@/data/deployment';
import styles from './DeploymentMemoryHistory.module.css';

const twoDecimals = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('en-US');

/** 앱 12개의 기존 관찰 기록을 이전 구현과 Rust 전환 후 두 열로 비교한다. */
export default function DeploymentMemoryHistory() {
  const comparison = deploymentMemoryComparison;
  const chartRows = [{ id: 'before', ...comparison.before }, { id: 'after', ...comparison.after }];
  const maximumMiB = Math.max(...chartRows.map(row => row.memoryMiB));
  const tickStepMiB = 1000;
  const axisMaximumMiB = Math.ceil(maximumMiB / tickStepMiB) * tickStepMiB;
  const chartTicks = Array.from({ length: axisMaximumMiB / tickStepMiB + 1 }, (_, index) => index * tickStepMiB);
  return (
    <section id="migration-memory-history" className={styles.history} aria-labelledby="migration-memory-title">
      <div className={styles.summary}>
        <h5 id="migration-memory-title">{comparison.scope}</h5>
        <p id="migration-memory-scope" className={styles.scope}>{comparison.scopeNote}</p>
        <div className={styles.metrics}>
          <dl><dt>{comparison.before.label}</dt><dd>{comparison.before.value}</dd></dl>
          <span className={styles.flowArrow} aria-hidden="true">
            <svg viewBox="0 0 32 32" focusable="false"><path d="M5 16H27M18 7L27 16L18 25" /></svg>
          </span>
          <dl><dt>{comparison.after.label}</dt><dd>{comparison.after.value}</dd></dl>
        </div>
        <figure className={styles.chart} aria-labelledby="memory-chart-title" aria-describedby="migration-memory-scope">
          <figcaption id="memory-chart-title">앱 12개 메모리 비교</figcaption>
          <p className={styles.chartUnit}>프로세스 메모리 (MiB)</p>
          <div className={styles.chartPlot} data-memory-chart="columns" data-memory-axis-max={axisMaximumMiB}>
            <div className={styles.chartGrid} aria-hidden="true">
              {chartTicks.map(tick => (
                <div key={tick} className={styles.gridLine} data-memory-tick={tick}
                  style={{ bottom: `${(tick / axisMaximumMiB) * 100}%` }}>
                  <span>{integer.format(tick)}</span>
                </div>
              ))}
            </div>
            <div className={styles.chartRows}>
              {chartRows.map(row => (
                <div key={row.id} className={styles.chartRow} data-memory-bar={row.id} data-memory-mib={row.memoryMiB}
                  role="group" aria-label={`${row.label}: ${row.value}`}>
                  <div className={[styles.barFill, row.id === 'after' ? styles.afterBar : styles.beforeBar].join(' ')}
                    style={{ height: `${(row.memoryMiB / axisMaximumMiB) * 100}%` }} aria-hidden="true">
                    <strong className={styles.chartValue}>{row.value}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.chartLabels} aria-hidden="true">
            {chartRows.map(row => {
              const [phase, ...details] = row.label.split(' · ');
              return (
                <div key={row.id}>
                  <strong>{phase}</strong>
                  <span>{details.join(' · ')}</span>
                </div>
              );
            })}
          </div>
          <p className={styles.chartAxisLabel} aria-hidden="true">실행 환경</p>
        </figure>
        <div className={styles.change}>
          <span>약 {comparison.ratio}배</span><span>기록값 {comparison.reductionPercent}% 감소</span>
        </div>
      </div>

      <div className={styles.tableSection}>
        <h5 id="service-memory-title">서버·서비스별 메모리 기록</h5>
        <table className={styles.serviceTable} aria-labelledby="service-memory-title">
          <caption>단위: MiB · 서비스별 cgroup memory.current</caption>
          <thead><tr><th scope="col">서버·서비스</th><th scope="col">이전 Java · C#</th><th scope="col">이후 Rust</th></tr></thead>
          <tbody>
            {deploymentMemoryServices.map(service => (
              <tr key={service.id} data-memory-service={service.id}>
                <th scope="row"><strong>{service.label}</strong><span>{service.language} → Rust</span></th>
                <td data-label="이전 Java · C#">{twoDecimals.format(service.before)}</td>
                <td data-label="이후 Rust" className={styles.afterCell}>{twoDecimals.format(service.after)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {deploymentMemoryTotals.map(total => (
              <tr key={total.id} data-memory-total={total.id}>
                <th scope="row">{total.label}</th>
                <td data-label="이전 Java · C#">{twoDecimals.format(total.before)}</td>
                <td data-label="이후 Rust" className={styles.afterCell}>{twoDecimals.format(total.after)}</td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>

    </section>
  );
}
