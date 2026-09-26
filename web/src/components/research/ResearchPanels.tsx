/**
 * 선택된 ResearchTabId에 해당하는 연구 본문 패널만 렌더링한다.
 * 탭 상태와 콘텐츠 인덱스는 상위 조정자·data/research에 위임하고, 이 파일은
 * 프레젠테이션 전략에 집중한다. 각 탭 분기는 동일 ID 계약으로 교체되는
 * 상태 기반 Strategy 패턴이며 새 탭은 ID·탭 데이터·패널을 함께 확장한다.
 */
import Image from 'next/image';
import CareerTimeline from '@/components/CareerTimeline';
import {
  BenchmarkCatalog,
  BenchmarkEvidence,
} from '@/components/research/BenchmarkEvidence';
import { researchTimelineItems, type ResearchTabId } from '@/data/research';
import { AskAiButton } from '@/features/chat';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function ResearchPanels({ activeTab }: { activeTab: ResearchTabId }) {
  return (
    <div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            <section id="research-timeline-overview" tabIndex={-1} style={{
              padding: '28px',
              background: 'var(--bg-elev)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              scrollMarginTop: '96px',
            }}>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text)' }}>
                연구·실험 개요 및 목적
              </h3>
              <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
                하드웨어와 소프트웨어의 계층별 성능 특성을 측정하고 병목 요인을 분석하는 것을 목적으로 수행한 개인 학습 및 실험 기록입니다.
                웹 SI 실무 이후 CPU 파이프라인(분기 예측), SIMD 명령어(AVX2), 메모리·파일 입출력(Memory Mapped File),
                비트 수준 직렬화와 무선 전송 대역폭을 대상으로 구현 방식과 측정 결과를 비교했습니다.
              </p>
              <div style={{ marginTop: '16px' }}>
                <AskAiButton align="end" question="포트폴리오의 연구·실험 목적과 주제별 연관성을 설명해 주세요." />
              </div>
            </section>

            <section
              id="research-timeline"
              tabIndex={-1}
              style={{ width: '100%', scrollMarginTop: '96px' }}
            >
              <CareerTimeline items={researchTimelineItems} />
            </section>
          </div>
        )}

        {/* TAB 2: OPTIMIZATION OVERVIEW */}
        {activeTab === 'optimization' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <section
              id="research-optimization-overview"
              tabIndex={-1}
              style={{
                padding: '28px',
                background: 'var(--bg-elev)',
                borderRadius: '20px',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow)',
                scrollMarginTop: '96px',
              }}
            >
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text)' }}>
                성능 최적화 연구 개요
              </h3>
              <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
                CPU 파이프라인과 SIMD 벡터화, 메모리 배치와 파일 입출력, 직렬화와 전송 크기까지
                실행 계층별 병목을 분리해 측정하고 개선한 기록입니다. 공개 가능한 실험은 독립 실행 가능한
                코드와 테스트, 벤치마크 러너로 재구성해 아래에 연결했습니다.
              </p>
              <div style={{ marginTop: '16px' }}>
                <AskAiButton
                  align="end"
                  guidedTourTarget="research-optimization-ask-ai"
                  question="성능 최적화 연구를 CPU, 메모리·파일 I/O, 직렬화·전송 관점으로 나누어 설명해 주세요."
                />
              </div>
            </section>

            <BenchmarkCatalog />
          </div>
        )}

        {/* TAB 3: CPU & SIMD - CPU 아키텍처 및 SIMD 벡터 병렬 최적화 연구 분과 */}
        {activeTab === 'cpu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* 실험 1: 분기 예측(Branch Prediction) 및 SIMD 최적화 사례 연구 */}
            <div id="research-cpu-simd" tabIndex={-1} style={{
              padding: '28px',
              background: 'var(--bg-elev)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                    조건 분기와 SIMD 벡터화 성능 비교
                  </h3>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent, #6366f1)', border: '1px solid var(--border)', borderRadius: '99px', padding: '3px 10px', background: 'var(--bg-elev-2)' }}>
                    CPU Architecture
                  </span>
                </div>
                <p style={{ marginTop: '10px', fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
                  바이트 배열에서 범위 조건을 충족하는 값을 필터링하여 합산하는 동작을 표준 조건 분기, 부호 비트 트릭을 이용한 브랜치리스(Branchless),
                  그리고 256비트 AVX2 SIMD 벡터 연산으로 각각 구현하여 처리 시간을 비교했습니다.
                </p>
                <AskAiButton align="end" question="「조건 분기와 SIMD 벡터화 성능 비교」 실험의 가설, 구현 방식과 측정 결과를 설명해 주세요." />
                <BenchmarkEvidence projectId="simd-avx2" />
              </div>

              {/* Code comparison container */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
                marginTop: '8px'
              }}>
                <div style={{ padding: '16px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>Case 1: 표준 조건 분기</div>
                  <pre style={{ margin: 0, fontSize: '0.8rem' }}>
                    {`long sum = 0;
foreach (byte v in src) {
  if (v >= bounds.min && v <= bounds.max) {
    sum += v;
  }
}
return sum;`}
                  </pre>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: 'auto' }}>
                    데이터가 무작위로 분포된 조건에서 분기 예측 실패(Branch Misprediction)에 따른 처리 시간 증가를 확인했습니다.
                  </div>
                </div>

                <div style={{ padding: '16px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>Case 2: 브랜치리스 (비트 트릭)</div>
                  <pre style={{ margin: 0, fontSize: '0.8rem' }}>
                    {`long sum = 0;
foreach (byte v in src) {
  int gteMin = v - bounds.min >> 31 ^ 1;
  int lteMax = bounds.max - v >> 31 ^ 1;
  sum += v * (gteMin & lteMax);
}
return sum;`}
                  </pre>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: 'auto' }}>
                    비트 이동 및 XOR 연산으로 조건부 분기(if)를 제거한 구현입니다. 해당 측정에서 정렬 여부에 따른 처리 시간 차이가 작았습니다.
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>Case 3: AVX2 SIMD (C# Managed Style)</div>
                <pre style={{ margin: 0, fontSize: '0.8rem' }}>
                  {`var vSpan = MemoryMarshal.Cast<byte, Vector256<byte>>(src);
Vector256<long> accumulator = Vector256<long>.Zero;

foreach (var v in vSpan) {
  Vector256<byte> mask = Vector256.GreaterThanOrEqual(v, min) & Vector256.LessThanOrEqual(v, max);
  accumulator += Avx2.SumAbsoluteDifferences(v & mask, Vector256<byte>.Zero).AsInt64();
}
return Vector256.Sum(accumulator) + ScalarSum(src[남은_청크..]);`}
                </pre>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: 'auto' }}>
                  MemoryMarshal.Cast로 Span의 데이터를 복사 없이 Vector256로 재해석하고, JIT 컴파일을 통해 AVX2 명령어를 사용하는 벡터 연산을 수행합니다.
                </div>
              </div>

              {/* Benchmark Result Screenshot */}
              <div style={{
                background: 'var(--bg-elev-2)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-mute)', fontFamily: 'monospace' }}>
                  BenchmarkDotNet 실측 리포트 캡처
                </div>
                <div style={{ overflow: 'hidden', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <Image
                    src={`${basePath}/images/cpu-benchmark-report.png`}
                    alt="BenchmarkDotNet 실측 결과: 100만 바이트 배열에서 표준 분기 5,341.20 μs, AVX2 SIMD 병렬 처리 11.00 μs"
                    width={1350}
                    height={748}
                    sizes="(max-width: 768px) 100vw, 900px"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </div>
              </div>

              {/* CPU Processing Time Chart */}
              <div style={{ marginTop: '16px', background: 'var(--bg-elev-2)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                  다양한 조건에 따른 처리 시간 비교 (1M byte 배열)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-mute)', marginBottom: '24px', fontFamily: 'monospace' }}>
                  선형 스케일 (μs, 짧을수록 성능 우수, 전체 최대치 5,341 μs 대비 비율)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Group 1 */}
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ padding: '2px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '4px', fontSize: '0.725rem' }}>단일 스레드</span>
                      <span style={{ padding: '2px 8px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '4px', fontSize: '0.725rem' }}>무작위 데이터 (비정렬)</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'right' }}>Case 1: 표준 분기</div>
                        <div style={{ flex: 1, minWidth: '150px', height: '16px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '100%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                        </div>
                        <div style={{ width: '80px', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace', textAlign: 'right' }}>5,341 μs</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'right' }}>Case 2: 브랜치리스</div>
                        <div style={{ flex: 1, minWidth: '150px', height: '16px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '18.2%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                        </div>
                        <div style={{ width: '80px', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace', textAlign: 'right' }}>973 μs</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--accent, #6366f1)', fontWeight: 700, textAlign: 'right' }}>Case 3: AVX2 SIMD</div>
                        <div style={{ flex: 1, minWidth: '150px', height: '16px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '0.7%', height: '100%', background: 'var(--accent, #6366f1)', borderRadius: '4px', minWidth: '3px' }}></div>
                        </div>
                        <div style={{ width: '80px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent, #6366f1)', fontFamily: 'monospace', textAlign: 'right' }}>37 μs</div>
                      </div>
                    </div>
                  </div>

                  {/* Group 2 */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ padding: '2px 8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '4px', fontSize: '0.725rem' }}>단일 스레드</span>
                      <span style={{ padding: '2px 8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '4px', fontSize: '0.725rem' }}>정렬된 데이터</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'right' }}>Case 1: 표준 분기</div>
                        <div style={{ flex: 1, minWidth: '150px', height: '16px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '14.4%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                        </div>
                        <div style={{ width: '80px', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace', textAlign: 'right' }}>772 μs</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'right' }}>Case 2: 브랜치리스</div>
                        <div style={{ flex: 1, minWidth: '150px', height: '16px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '18.2%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                        </div>
                        <div style={{ width: '80px', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace', textAlign: 'right' }}>973 μs</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--accent, #6366f1)', fontWeight: 700, textAlign: 'right' }}>Case 3: AVX2 SIMD</div>
                        <div style={{ flex: 1, minWidth: '150px', height: '16px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '0.7%', height: '100%', background: 'var(--accent, #6366f1)', borderRadius: '4px', minWidth: '3px' }}></div>
                        </div>
                        <div style={{ width: '80px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent, #6366f1)', fontFamily: 'monospace', textAlign: 'right' }}>38 μs</div>
                      </div>
                    </div>
                  </div>

                  {/* Group 3 */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ padding: '2px 8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '4px', fontSize: '0.725rem' }}>병렬 처리</span>
                      <span style={{ padding: '2px 8px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '4px', fontSize: '0.725rem' }}>무작위 데이터 (비정렬)</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'right' }}>Case 1: 표준 분기</div>
                        <div style={{ flex: 1, minWidth: '150px', height: '16px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '15.7%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                        </div>
                        <div style={{ width: '80px', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace', textAlign: 'right' }}>837 μs</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'right' }}>Case 2: 브랜치리스</div>
                        <div style={{ flex: 1, minWidth: '150px', height: '16px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '3.6%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                        </div>
                        <div style={{ width: '80px', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace', textAlign: 'right' }}>194 μs</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--accent, #6366f1)', fontWeight: 700, textAlign: 'right' }}>Case 3: AVX2 SIMD</div>
                        <div style={{ flex: 1, minWidth: '150px', height: '16px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '0.2%', height: '100%', background: 'var(--accent, #6366f1)', borderRadius: '4px', minWidth: '3px' }}></div>
                        </div>
                        <div style={{ width: '80px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent, #6366f1)', fontFamily: 'monospace', textAlign: 'right' }}>11 μs</div>
                      </div>
                    </div>
                  </div>

                  {/* Group 4 */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ padding: '2px 8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '4px', fontSize: '0.725rem' }}>병렬 처리</span>
                      <span style={{ padding: '2px 8px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '4px', fontSize: '0.725rem' }}>정렬된 데이터</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'right' }}>Case 1: 표준 분기</div>
                        <div style={{ flex: 1, minWidth: '150px', height: '16px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '3.1%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                        </div>
                        <div style={{ width: '80px', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace', textAlign: 'right' }}>167 μs</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'right' }}>Case 2: 브랜치리스</div>
                        <div style={{ flex: 1, minWidth: '150px', height: '16px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '3.6%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                        </div>
                        <div style={{ width: '80px', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace', textAlign: 'right' }}>194 μs</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--accent, #6366f1)', fontWeight: 700, textAlign: 'right' }}>Case 3: AVX2 SIMD</div>
                        <div style={{ flex: 1, minWidth: '150px', height: '16px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '0.2%', height: '100%', background: 'var(--accent, #6366f1)', borderRadius: '4px', minWidth: '3px' }}></div>
                        </div>
                        <div style={{ width: '80px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent, #6366f1)', fontFamily: 'monospace', textAlign: 'right' }}>11 μs</div>
                      </div>
                    </div>
                  </div>

                </div>
                <div style={{ marginTop: '20px', textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent, #6366f1)', fontWeight: 700, wordBreak: 'keep-all' }}>
                    ← 전체 최적화 조합(SIMD + 병렬 처리 + 정렬 데이터) 기준 최대 약 485배 단축 (5,341 μs ➔ 11 μs)
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-mute)', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                    구현 방식만 바꾼 동일 조건 비교에서 SIMD 단독 효과는 단일 스레드·비정렬 약 143배(5,341 μs ➔ 37 μs), 병렬·정렬 약 15.2배(167 μs ➔ 11 μs)입니다.
                  </div>
                </div>
              </div>

              {/* Cross-platform comparisons */}
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' }}>
                  플랫폼·실행 환경별 성능 비교
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '16px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent, #6366f1)' }}>C++ Google Benchmark</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '6px 0', fontFamily: 'monospace' }}>34.5 μs</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-mute)', lineHeight: 1.4 }}>
                      해당 측정에서 C# 관리형 코드(37 μs)와 C++ 구현의 처리 시간이 유사한 수준임을 확인했습니다.
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent, #6366f1)' }}>Node.js / React Interop</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '6px 0', fontFamily: 'monospace' }}>33ms ➔ 1.96ms (~17x)</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-mute)', lineHeight: 1.4 }}>
                      C# 로직을 NativeAOT 컴파일하여 DLL 바이너리로 확보하고 Node.js(React 백엔드)에서 C-Interop 호출을 적용했습니다.
                    </div>
                  </div>
                  <div style={{ padding: '16px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent, #6366f1)' }}>Android Kotlin (모바일)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, margin: '6px 0', fontFamily: 'monospace' }}>5.3ms ➔ 1.43ms (~3.7x)</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-mute)', lineHeight: 1.4 }}>
                      갤럭시 S23 울트라(SM-S918N) 환경. 분기 미스로 인한 CPU 파이프라인 클리어링(낭비 연산)을 줄여 배터리 소모 및 발열을 제어하는 목적으로 검증했습니다.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 실험 2: 정렬 최적화 및 레지스터 효율성 연구 */}
            <div id="research-counting-sort" tabIndex={-1} style={{
              padding: '28px',
              background: 'var(--bg-elev)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  바이트 배열 정렬 및 레지스터 스필링 연구
                </h3>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent, #6366f1)', border: '1px solid var(--border)', borderRadius: '99px', padding: '3px 10px', background: 'var(--bg-elev-2)' }}>
                  Low-level Memory
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
                바이트 배열(0~255)의 제한된 값 범위를 활용해 O(N) 계수 정렬(Counting Sort)을 구현하고, 표준 `Array.Sort` O(N log N)과 비교했습니다. 포인터 연산(`unsafe`)과 루프 언롤링을 적용한 구현의 처리 시간도 측정했습니다.
              </p>
              <AskAiButton align="end" question="「바이트 배열 정렬 및 레지스터 스필링」 연구에서 선택한 최적화와 검증 결과를 설명해 주세요." />
              <BenchmarkEvidence projectId="counting-sort" />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'var(--bg-elev-2)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>4-Way 독립 버퍼 루프 언롤링 (WAW 의존성 해소)</div>
                  <pre style={{ margin: 0, fontSize: '0.8rem' }}>
                    {`int* buf = stackalloc int[256 * 4];
int* b0 = buf, b1 = buf + 256,
     b2 = buf + 512, b3 = buf + 768;

while (current < end) {
    b0[current[0]]++;
    b1[current[1]]++;
    b2[current[2]]++;
    b3[current[3]]++;
    current += 4;
}`}
                  </pre>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: 'auto' }}>
                    4개의 독립 카운트 버퍼를 스택 메모리에 확보(`stackalloc`)하고, 4바이트씩 병렬 카운팅하여 Write-After-Write(WAW) 데이터 의존성을 줄이고 명령어 수준 병렬성(ILP)을 활용합니다.
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ padding: '16px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px solid var(--border)', flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>레지스터 스필링(Register Spilling) 현상 분석</div>
                    <p style={{ margin: '8px 0 0', fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--text-dim)' }}>
                      언롤링 버퍼 단계를 4Way에서 8Way로 올렸을 때, x86 CPU의 범용 레지스터 개수 한계를 초과하여 일부 변수와 포인터가
                      L1 캐시나 메모리 스택으로 밀려나 성능이 하락했습니다.
                      실측 상 <strong>4-Way(461 μs)</strong>가 <strong>8-Way(587 μs)</strong>보다 약 27% 빨랐으며,
                      레지스터 사용량에 따른 언롤링 단계별 성능 차이를 확인했습니다.
                    </p>
                  </div>

                  <div style={{ padding: '16px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)' }}>정렬 성능 실측 수치 (1M byte 배열)</div>
                    <div style={{ marginTop: '8px', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'monospace' }}>
                      <div>• Array.Sort (표준 라이브러리): 11,963 μs</div>
                      <div>• O(N) 4-Way Counting Sort (단일): 461 μs (~26배 개선)</div>
                      <div>• ArrayPool + Interlocked 병렬 정렬: 130 μs (~92배 개선)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MEMORY & I/O - 메모리 레이아웃 구조체 설계 및 고속 파일 입출력 연구 분과 */}
        {activeTab === 'memory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* 실험 1: 데이터 지향 설계(DoD) - AoS vs SoA 캐시 라인 분석 */}
            <div id="research-memory-layout" tabIndex={-1} style={{
              padding: '28px',
              background: 'var(--bg-elev)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  AoS·SoA 메모리 배치와 캐시 활용 비교
                </h3>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent, #6366f1)', border: '1px solid var(--border)', borderRadius: '99px', padding: '3px 10px', background: 'var(--bg-elev-2)' }}>
                  DoD Layout
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
                Unity ECS/DOTS 환경 설계 및 C# 고성능 처리를 분석하며 AoS(Array of Structs, 구조체의 배열)와
                SoA(Struct of Arrays, 배열의 구조체) 레이아웃에 따른 하드웨어 L1/L2 캐시 라인(64바이트) 충전 효율을 비교 분석했습니다.
              </p>
              <AskAiButton align="end" question="「AoS·SoA 메모리 배치와 캐시 활용 비교」 실험을 객체지향 구조와 데이터 지향 설계의 차이 중심으로 설명해 주세요." />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '16px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>AoS (Array of Structs)</div>
                  <pre style={{ margin: 0, fontSize: '0.75rem' }}>
                    {`struct Entity {
    float x, y, z;
    float vx, vy, vz;
}
Entity[] entities = new Entity[N];`}
                  </pre>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: 'auto' }}>
                    한 필드(x)만 순회해도 인접 필드가 L1/L2 캐시라인에 함께 로드되는 구조입니다. 접근하지 않는 필드가 캐시 공간과 전송 대역폭을 함께 사용합니다.
                  </div>
                </div>

                <div style={{ padding: '16px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>SoA (Struct of Arrays)</div>
                  <pre style={{ margin: 0, fontSize: '0.75rem' }}>
                    {`float[] xs = new float[N];
float[] ys = new float[N];
float[] vxs = new float[N];`}
                  </pre>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: 'auto' }}>
                    x좌표 연산에 필요한 xs 배열의 값이 연속 배치되어 64바이트 캐시라인을 활용하기 쉬운 구조입니다. 데이터 지향 설계(DoD)와 SIMD 벡터화에 적용했습니다.
                  </div>
                </div>
              </div>
            </div>

            {/* Memory Mapped Files */}
            <div style={{
              padding: '28px',
              background: 'var(--bg-elev)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                    파일 비교 성능: 메모리 매핑(MMF)과 Stream
                  </h3>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent, #6366f1)', border: '1px solid var(--border)', borderRadius: '99px', padding: '3px 10px', background: 'var(--bg-elev-2)' }}>
                    File I/O
                  </span>
                </div>
                <p style={{ marginTop: '10px', fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
                  10MB 텍스트 파일의 일치 여부를 비교하는 조건에서, OS의 가상 메모리 관리 기법을 활용한 메모리 매핑 파일(Memory Mapped File)과 일반 스트림 청크 방식의 처리 시간을 측정했습니다.
                </p>
                <AskAiButton align="end" question="「메모리 매핑 파일과 Stream 비교」 실험의 조건, 결과와 적용 판단 기준을 설명해 주세요." />
              </div>

              {/* MMF Table */}
              <div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-strong)' }}>
                        <th style={{ padding: '8px' }}>비교 방식</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>경과 시간 (10회 평균)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>속도 배율</th>
                        <th style={{ padding: '8px' }}>주요 특징</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>SHA256 해시 비교</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>915 ms</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-mute)' }}>기준 (1.0x)</td>
                        <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>전체 해시를 계산하므로 중간 불일치 시 조기 종료 불가능</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>C# FileStream (1-byte 단위)</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>841 ms</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-mute)' }}>~1.1x</td>
                        <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>잦은 시스템 콜 발생으로 디스크 I/O 오버헤드 큼</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>C# Stream (Span Chunk 단위)</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>179 ms</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-mute)' }}>~5.1x</td>
                        <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>stackalloc 스택 버퍼를 빌려 힙 할당 없이 청크 비교</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>메모리 매핑(MMF) + Scalar</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>~130 ms</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-mute)' }}>~7.0x</td>
                        <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>OS 가상 메모리 주소 매핑, 유저-커널 버퍼 복사 차단</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(99, 102, 241, 0.06)' }}>
                        <td style={{ padding: '8px', fontWeight: 700, color: 'var(--accent, #6366f1)' }}>메모리 매핑(MMF) + AVX2 SIMD</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent, #6366f1)' }}>65 ms</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent, #6366f1)' }}>~14.0x</td>
                        <td style={{ padding: '8px', color: 'var(--accent, #6366f1)', fontSize: '0.8rem', fontWeight: 600 }}>메모리 맵 포인터에 직접 접근해 32바이트(256bit) 단위 비교</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Memory I/O Processing Time Chart */}
              <div style={{ marginTop: '16px', background: 'var(--bg-elev-2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                  10MB 파일 2개 대조 시간 비교 (10회 평균)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-mute)', marginBottom: '16px', fontFamily: 'monospace' }}>
                  경과 시간 (ms, 짧을수록 성능 우수)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '180px', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'right' }}>SHA256 해시 비교</div>
                    <div style={{ flex: 1, minWidth: '150px', height: '20px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>915 ms</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '180px', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'right' }}>C# FileStream (1-byte)</div>
                    <div style={{ flex: 1, minWidth: '150px', height: '20px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '92%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>841 ms</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '180px', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'right' }}>C# Stream (Span chunk)</div>
                    <div style={{ flex: 1, minWidth: '150px', height: '20px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '20%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>179 ms</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '180px', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'right' }}>메모리 매핑(MMF) + Scalar</div>
                    <div style={{ flex: 1, minWidth: '150px', height: '20px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '14%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>~130 ms</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '180px', fontSize: '0.85rem', color: 'var(--accent, #6366f1)', fontWeight: 700, textAlign: 'right' }}>메모리 매핑(MMF) + AVX2</div>
                    <div style={{ flex: 1, minWidth: '150px', height: '20px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '7%', height: '100%', background: 'var(--accent, #6366f1)', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent, #6366f1)', fontFamily: 'monospace' }}>65 ms</div>
                  </div>
                </div>
                <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--accent, #6366f1)', fontWeight: 700, textAlign: 'right' }}>
                  ← 약 14배 파일 대조 속도 향상
                </div>
              </div>

              {/* L3 Cache Bottleneck study */}
              <div style={{ background: 'var(--bg-elev-2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                  L3 캐시 대역폭 한계와 병렬 효율 연구 (i5-9600K 9MB L3 기준)
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
                  데이터 크기에 따른 병렬 처리 효과를 비교하기 위해 L3 캐시(9MB) 용량 전후로 연산 범위(8MB vs 16MB)를 나누어 벤치마크했습니다.
                  해당 측정에서 L3 캐시 용량 이내(8MB)에서는 병렬 처리 시간이 짧았으나, L3 캐시 용량을 초과한 16MB 데이터에서는 단일 스레드와 병렬 처리의 시간 차이가 관찰되지 않았습니다.
                  CPU 코어가 DRAM 버스 대역폭을 공유하는 조건에서 나타나는 <strong>메모리 대역폭 병목</strong>과 관련된 결과로 분석했습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SERIALIZATION - 프레임 기록 비트 직렬화 및 물리 계층 네트워크 전송 연구 분과 */}
        {activeTab === 'serialization' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* 실험 1: 프레임 직렬화 형식별 데이터 크기 비교 */}
            <div id="research-serialization-packing" tabIndex={-1} style={{
              padding: '28px',
              background: 'var(--bg-elev)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                    프레임 기록 직렬화 크기 최적화
                  </h3>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent, #6366f1)', border: '1px solid var(--border)', borderRadius: '99px', padding: '3px 10px', background: 'var(--bg-elev-2)' }}>
                    Serialization
                  </span>
                </div>
                <p style={{ marginTop: '10px', fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
                  게임 입력 프레임 기록(마우스 좌표 양자화, 버튼 비트, 스크롤 정규화) 데이터를 여러 포맷으로 직렬화·압축하고, 전송 데이터 크기의 차이를 비교했습니다.
                </p>
                <AskAiButton align="end" question="「프레임 기록 직렬화 크기 최적화」에서 비교한 포맷과 압축 결과를 설명해 주세요." />
                <BenchmarkEvidence projectId="serialization-protobuf" />
              </div>

              {/* Serialization Table */}
              <div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-strong)' }}>
                        <th style={{ padding: '8px' }}>직렬화 형식</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>데이터 크기 (bytes)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>기준 대비 크기</th>
                        <th style={{ padding: '8px' }}>특성</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>JSON (표준)</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>68,502</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-mute)' }}>기준 (1.0x)</td>
                        <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>필드명 중복과 텍스트 표현에 필요한 추가 데이터 포함</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>Raw Binary (이진)</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>10,240</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-mute)' }}>약 1/6.7로 축소</td>
                        <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>스키마 메타데이터가 제외된 원시 데이터 배열</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>JSON + ZSTD 압축</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>276</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-mute)' }}>약 1/248로 축소</td>
                        <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>텍스트 반복 패턴을 ZSTD 알고리즘으로 압축</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 600 }}>Protobuf 가변 정수 + ZSTD</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>158</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-mute)' }}>약 1/433으로 축소</td>
                        <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>Varint 인코딩 후 반복 패턴 압축</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(99, 102, 241, 0.06)' }}>
                        <td style={{ padding: '8px', fontWeight: 700, color: 'var(--accent, #6366f1)' }}>Protobuf + Nibble Pack + ZSTD</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent, #6366f1)' }}>74</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent, #6366f1)' }}>약 1/925로 축소</td>
                        <td style={{ padding: '8px', color: 'var(--accent, #6366f1)', fontSize: '0.8rem', fontWeight: 700 }}>4비트 이하 변수들을 비트 시프트 결합 후 ZSTD 압축</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Serialization Size Chart */}
              <div style={{ marginTop: '16px', background: 'var(--bg-elev-2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                  직렬화 포맷 및 압축 방식별 크기 대조
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-mute)', marginBottom: '16px', fontFamily: 'monospace' }}>
                  선형 스케일 (bytes, 짧을수록 데이터 크기가 작음)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '200px', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'right' }}>JSON (표준)</div>
                    <div style={{ flex: 1, minWidth: '150px', height: '20px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '100%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>68,502 B</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '200px', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'right' }}>Raw Binary (원시 이진)</div>
                    <div style={{ flex: 1, minWidth: '150px', height: '20px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '14.9%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>10,240 B</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '200px', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'right' }}>Protobuf 가변 정수 (Nibble)</div>
                    <div style={{ flex: 1, minWidth: '150px', height: '20px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '1.2%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>515 B</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '200px', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'right' }}>JSON + ZSTD 압축</div>
                    <div style={{ flex: 1, minWidth: '150px', height: '20px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '0.8%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>276 B</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '200px', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'right' }}>Protobuf + ZSTD</div>
                    <div style={{ flex: 1, minWidth: '150px', height: '20px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '0.5%', height: '100%', background: 'var(--text-mute)', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace' }}>158 B</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ width: '200px', fontSize: '0.85rem', color: 'var(--accent, #6366f1)', fontWeight: 700, textAlign: 'right' }}>Nibble Pack + ZSTD</div>
                    <div style={{ flex: 1, minWidth: '150px', height: '20px', background: 'var(--bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: '0.2%', height: '100%', background: 'var(--accent, #6366f1)', borderRadius: '4px' }}></div>
                    </div>
                    <div style={{ width: '80px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent, #6366f1)', fontFamily: 'monospace' }}>74 B</div>
                  </div>
                </div>
                <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--accent, #6366f1)', fontWeight: 700, textAlign: 'right' }}>
                  ← 기준 대비 데이터 크기를 약 1/925로 축소
                </div>
              </div>

              {/* Bit tricks code */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '16px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>Nibble Packing (4비트 변수 병합)</div>
                  <pre style={{ margin: 0, fontSize: '0.75rem' }}>
                    {`byte packed = (byte)((hi << 4) | (lo & 0x0F));

byte hi = (byte)(packed >> 4);
byte lo = (byte)(packed & 0x0F);`}
                  </pre>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: 'auto' }}>
                    0~15 범위의 값 2개를 비트 시프트 연산으로 1바이트에 패킹한 후, 마스크 필터 및 시프트를 적용해 개별 값으로 복원합니다.
                  </div>
                </div>

                <div style={{ padding: '16px', background: 'var(--bg-elev-2)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>BMI2 PEXT / PDEP (bool 필드 비트 압축)</div>
                  <pre style={{ margin: 0, fontSize: '0.75rem' }}>
                    {`ulong bits = Bmi2.X64.ParallelBitExtract(data, mask);

ulong restored = Bmi2.X64.ParallelBitDeposit(bits, mask);`}
                  </pre>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: 'auto' }}>
                    x86 비트 조작 명령어로 산재된 bool 데이터를 마스크 정렬로 압축 추출(`PEXT`)하고, 원래 구조체 메모리 레이아웃 위치에 복원(`PDEP`)합니다.
                  </div>
                </div>
              </div>
            </div>

            {/* Network bandwidth & Bluetooth SPP */}
            <div style={{
              padding: '28px',
              background: 'var(--bg-elev)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  컴퓨팅 물리 계층별 대역폭과 전송 최적화
                </h3>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent, #6366f1)', border: '1px solid var(--border)', borderRadius: '99px', padding: '3px 10px', background: 'var(--bg-elev-2)' }}>
                  Bandwidth Bottlenecks
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
                대역폭이 제한된 환경에서는 <strong>물리 계층 전송 속도</strong>가 전체 처리 시간의 주요 병목이 될 수 있습니다.
                아래 비교에 사용한 L1 캐시와 블루투스 전송은 나노초당 처리량에서 최대 약 1,800만 배의 차이가 있습니다. 이러한 조건에서는 CPU 압축 연산 비용과 전송량 감소에 따른 시간 절감 효과를 함께 비교할 필요가 있습니다.
              </p>
              <AskAiButton align="end" question="「컴퓨팅 물리 계층별 대역폭과 전송 최적화」 실험이 실제 통신 구현에 어떻게 반영됐는지 설명해 주세요." />

              {/* Bandwidth comparison */}
              <div style={{ overflowX: 'auto', marginTop: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-strong)' }}>
                      <th style={{ padding: '8px' }}>컴퓨팅 물리 계층</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>초당 처리량</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>나노초(ns)당 바이트(bytes)</th>
                      <th style={{ padding: '8px' }}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>L1 캐시 (CPU)</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>~3.7 TB/s</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--accent, #6366f1)', fontWeight: 600 }}>3,789 B/ns</td>
                      <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>CPU 클럭 레벨 직접 처리</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>DRAM 메인 메모리</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>~70 GB/s</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>70 B/ns</td>
                      <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>듀얼 채널 구성 기준</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>NVMe SSD</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>~3.5 GB/s</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>3 ~ 4 B/ns</td>
                      <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>PCIe 인터페이스 속도</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>1Gbps 유선 이더넷</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>~125 MB/s</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>0.125 B/ns</td>
                      <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>1바이트 전송에 8ns 소요</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px', fontWeight: 600 }}>블루투스 SPP (무선 직렬)</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>~200 KB/s</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>0.0002 B/ns</td>
                      <td style={{ padding: '8px', color: 'var(--text-mute)', fontSize: '0.8rem' }}>1바이트 전송에 약 5,000ns 소요</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bluetooth SPP Experiment */}
              <div style={{ background: 'var(--bg-elev-2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>
                  블루투스 파일 전송 및 GZip 압축 실험 (C# WPF 서버 ➔ Kotlin Android 클라이언트)
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
                  무선 직렬 전송 대역폭의 병목을 직접 측정하기 위해 PC와 안드로이드 스마트폰을 블루투스 SPP 소켓으로 연결하고 60MB 파일을 전송하는 앱을 제작했습니다.
                  <strong>비압축 원본 전송 시 대역폭 한계로 5분 이상</strong>이 소요되었으나, <strong>GZip 압축을 적용하자 전송 데이터 크기가 줄어 약 1분 이내로 완료</strong>되며 전송 시간을 5배 단축시켰습니다.
                  해당 전송 조건에서 CPU 압축 연산이 추가되더라도 전송 데이터 크기 감소로 전체 전송 시간이 줄어드는 것을 확인했습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: META PROGRAMMING - 컴파일러 인프라 활용 및 생성형 AI 가공 에이전트 실험 분과 */}
        {activeTab === 'meta' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* 실험 1: Roslyn 컴파일러 API 기반 코드 스캐폴딩 최적화 */}
            <div style={{
              padding: '28px',
              background: 'var(--bg-elev)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Roslyn 컴파일러 기반 메타 프로그래밍 및 코드 생성기 (Scaffold)
                </h3>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent, #6366f1)', border: '1px solid var(--border)', borderRadius: '99px', padding: '3px 10px', background: 'var(--bg-elev-2)' }}>
                  Metaprogramming
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
                최적화 로직과 반복적인 데이터 바인딩 코드를 작성할 때 발생하는 수작업 오류를 줄이기 위해 C# Roslyn 컴파일러 기반 소스 생성기(Source Generator)를 구현했습니다.
              </p>
              <AskAiButton align="end" question="「Roslyn 기반 메타 프로그래밍 및 코드 생성기」의 목적, 구현 범위와 효과를 설명해 주세요." />

              <ul style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-dim)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                <li><strong>리소스 매핑 자동화</strong>: 에셋이나 리소스 폴더의 구조적 변화를 분석하여 상응하는 Enum 클래스를 빌드 시점에 자동 생성합니다.</li>
                <li><strong>BMI2 최적화 마스크 생성</strong>: 특정 구조체들의 bool 멤버 선언부 및 필드 순서를 파싱하여, CPU BMI2 명령 연산(PEXT/PDEP)을 수행할 비트 마스크 상수를 컴파일 타임에 자동으로 추적 및 코드화합니다.</li>
                <li><strong>빌드 시점 검증</strong>: 메타 정보를 바탕으로 타입 검사를 빌드 과정에 적용해 캐스팅·범위 관련 오류를 사전에 확인하도록 구성했습니다.</li>
              </ul>
            </div>

            {/* AI agentic workflows */}
            <div id="research-tools-ai" tabIndex={-1} style={{
              padding: '28px',
              background: 'var(--bg-elev)',
              borderRadius: '20px',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  생성형 AI 기반 개발 및 검증 실험
                </h3>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent, #6366f1)', border: '1px solid var(--border)', borderRadius: '99px', padding: '3px 10px', background: 'var(--bg-elev-2)' }}>
                  AI Orchestration
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-dim)', wordBreak: 'keep-all' }}>
                로컬 경량 LLM(Gemma, Llama) 실행 환경과 클라우드 기반 모델 연동을 구성하고, 대형 언어 모델을 개발·검증 과정에 활용하는 방법을 실험했습니다.
              </p>
              <AskAiButton align="end" question="「생성형 AI 기반 개발 및 검증 실험」에서 AI에 맡긴 역할과 사람이 검증한 범위를 설명해 주세요." />

              <ul style={{ paddingLeft: '20px', margin: 0, color: 'var(--text-dim)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                <li><strong>단위 테스트 생성 및 검증</strong>: 저수준 최적화 및 BCL 함수의 경계 조건을 대상으로, 생성형 AI 프롬프트 체인을 활용해 단위 테스트(Unit Test)를 생성하고 검증하는 절차를 구성했습니다.</li>
                <li><strong>에이전트 역할 분담</strong>: Claude Code 등의 터미널 기반 AI 도구를 활용해 성능 병목 분석을 위한 가설 수립 ➔ 테스트 코드 생성 ➔ 벤치마크 측정 ➔ 결과에 따른 리팩터링을 반복하는 개발 절차를 운영했습니다.</li>
              </ul>
            </div>
          </div>
        )}

      </div>
  );
}
