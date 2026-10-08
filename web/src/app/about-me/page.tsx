/**
 * About 진입 화면의 소개 패널·목적지 카드·다음 행동을 조합한다.
 * 표면 UI는 공용 About 컴포넌트에, 카드 콘텐츠는 data/about에 의존해
 * 이 파일은 페이지 수준 프레젠테이션과 순서만 책임진다.
 */
import React from 'react';
import Link from 'next/link';
import AboutDecorativeGrid from '@/components/about/AboutDecorativeGrid';
import AboutPanel from '@/components/about/AboutPanel';
import ArchiveProjectShowcase from '@/components/about/ArchiveProjectShowcase';
import ProjectMediaCarousel from '@/components/about/ProjectMediaCarousel';
import AgentExperimentGallery from '@/components/about/AgentExperimentGallery';
import { aboutArchiveProjects, aboutDestinations, aboutProjects } from '@/data/about';

export const metadata = {
  title: '소개 | Overview',
  description: '송상운 개인 포트폴리오 소개 및 각 섹션 안내',
};

export default function OverviewPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
      
      {/* Intro Hero Section */}
      <AboutPanel id="portfolio-overview" tabIndex={-1} style={{
        padding: 'clamp(20px, 5vw, 40px)',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden',
        scrollMarginTop: '96px'
      }}>
        {/* Subtle grid background watermark */}
        <AboutDecorativeGrid />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 2.25rem)', fontWeight: 800, margin: 0, color: 'var(--text)', lineHeight: 1.2 }}>
            안녕하세요, 송상운입니다.
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            fontSize: 'clamp(0.95rem, 2vw, 1.125rem)',
            lineHeight: 1.7,
            color: 'var(--text-dim)',
            maxWidth: '850px',
            wordBreak: 'keep-all'
          }}>
            <p style={{ margin: 0 }}>
              하드웨어의 성능과 한계를 직접 측정하는 취미에서 출발해, CPU·주기억장치·보조기억장치에서 데이터가 처리되고 저장되는 방식을 살펴왔습니다. 구성 요소 간 데이터 전송과 외부 유무선 통신에서 대역폭이 성능에 미치는 영향까지 함께 고려하며, 컴퓨팅 시스템 전반의 동작 원리를 탐구해 왔습니다.
            </p>
            <p style={{ margin: 0 }}>
              소프트웨어 개발에서는 객체지향과 설계 원칙, 디자인 패턴을 단순히 암기하는 데 그치지 않고, 실제 문제 해결에 효과적으로 적용하는 방법을 고민해 왔습니다. 이를 바탕으로 AI 에이전트와 협업하며 개발 과정의 생산성을 높이는 에이전트 네이티브 소프트웨어 엔지니어를 지향하고 있습니다.
            </p>
          </div>
        </div>
      </AboutPanel>
 
      {/* Grid of Sections */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
        gap: '24px'
      }}>
        {aboutDestinations.map((section) => (
          <Link href={section.href} key={section.href} style={{ textDecoration: 'none', display: 'flex' }}>
            <div 
              className="hover-timeline-card" 
              style={{
                background: 'var(--bg-elev)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: 'clamp(20px, 4vw, 28px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                flex: 1,
                boxShadow: 'var(--shadow)',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span aria-hidden="true" style={{ fontSize: '2rem' }}>{section.emoji}</span>
                <h4 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  {section.title}
                </h4>
              </div>
              <p style={{ 
                margin: 0, 
                fontSize: '0.975rem', 
                lineHeight: 1.6, 
                color: 'var(--text-dim)',
                flex: 1,
                wordBreak: 'keep-all'
              }}>
                {section.desc}
              </p>
              <div style={{ 
                fontSize: '0.9375rem', 
                fontWeight: 600, 
                color: 'var(--accent, #6366f1)',
                display: 'inline-flex',
                alignItems: 'center'
              }}>
                {section.linkText}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <AboutPanel style={{
        padding: 'clamp(20px, 5vw, 36px)',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        <div
          id="past-work-archive"
          tabIndex={-1}
          style={{
            borderRadius: '14px',
            padding: '10px',
            scrollMarginTop: '108px',
          }}
        >
          <p style={{ margin: '0 0 8px', color: 'var(--accent, #6366f1)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Archive
          </p>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 'clamp(1.35rem, 3vw, 1.75rem)' }}>
            과거 작업 아카이브
          </h3>
          <p style={{ margin: '10px 0 0', color: 'var(--text-dim)', lineHeight: 1.7, wordBreak: 'keep-all' }}>
            AI 에이전트를 본격적으로 활용하기 전에 직접 구현하고 사용했던 작업과 실험을 실행 화면과 함께 정리했습니다.
          </p>
        </div>
        <ArchiveProjectShowcase projects={aboutArchiveProjects} />
      </AboutPanel>

      <AboutPanel style={{
        padding: 'clamp(20px, 5vw, 36px)',
        borderRadius: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        <div
          id="featured-projects"
          tabIndex={-1}
          style={{
            borderRadius: '14px',
            padding: '10px',
            scrollMarginTop: '108px',
          }}
        >
          <p style={{ margin: '0 0 8px', color: 'var(--accent, #6366f1)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Projects
          </p>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 'clamp(1.35rem, 3vw, 1.75rem)' }}>
            AI 협업 프로젝트
          </h3>
          <p style={{ margin: '10px 0 0', color: 'var(--text-dim)', lineHeight: 1.7, wordBreak: 'keep-all' }}>
            요구사항과 운영 환경에 맞춰 구조와 기술을 선택하고, AI 에이전트의 구현 결과를 검토·테스트하며 진행한 프로젝트입니다.
          </p>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: '16px',
        }}>
          {aboutProjects.map((project) => (
            <article
              key={project.id}
              id={project.id}
              tabIndex={-1}
              style={{
                padding: '22px',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                background: 'var(--bg-elev-2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                scrollMarginTop: '96px',
              }}
            >
              <span style={{ color: 'var(--accent, #6366f1)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {project.category}
              </span>
              <h4 style={{ margin: 0, color: 'var(--text)', fontSize: '1.12rem' }}>
                {project.title}
              </h4>
              {project.gallery && (
                <ProjectMediaCarousel
                  gallery={project.gallery}
                  projectTitle={project.title}
                />
              )}
              <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.65, wordBreak: 'keep-all', whiteSpace: 'pre-line', flex: 1 }}>
                {project.desc}
              </p>
              <span style={{
                alignSelf: 'flex-start',
                padding: project.statusTone === 'warning' ? '5px 9px' : 0,
                border: project.statusTone === 'warning'
                  ? '1px solid color-mix(in srgb, #f97316 42%, transparent)'
                  : 'none',
                borderRadius: project.statusTone === 'warning' ? '999px' : 0,
                background: project.statusTone === 'warning'
                  ? 'color-mix(in srgb, #f97316 13%, transparent)'
                  : 'transparent',
                color: project.statusTone === 'warning' ? '#f97316' : 'var(--text-mute)',
                fontSize: '0.82rem',
                fontWeight: project.statusTone === 'warning' ? 700 : 400,
              }}>
                {project.status}
              </span>
              {project.links && project.links.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
                  {project.links.map((link) => {
                    const isDemo = link.kind === 'demo';
                    return (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${project.title} ${link.label} 새 탭에서 열기`}
                        className={isDemo ? 'hover-btn-primary' : 'hover-btn-secondary'}
                        style={{
                          minHeight: '36px',
                          padding: '7px 11px',
                          border: isDemo
                            ? '1px solid var(--accent, #6366f1)'
                            : '1px solid var(--border-strong)',
                          borderRadius: '9px',
                          background: isDemo
                            ? 'var(--accent, #6366f1)'
                            : 'var(--bg-elev)',
                          color: isDemo ? '#fff' : 'var(--text-dim)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        {link.label}
                        <span aria-hidden="true">↗</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      </AboutPanel>

      <AgentExperimentGallery />

      {/* Bottom CTA to start with Resume */}
      <section style={{ 
        padding: '36px', 
        background: 'var(--surface-fill, linear-gradient(135deg, var(--bg-elev-2), var(--bg)))',
        borderRadius: '24px', 
        textAlign: 'center',
        border: '1px solid var(--border)',
        marginTop: '20px',
        boxShadow: 'var(--shadow)'
      }}>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>
          상세 이력서를 확인해 보세요
        </h3>
        <Link href="/about-me/resume" className="hover-btn-primary hover-btn-inverse" style={{
          display: 'inline-block',
          padding: '12px 28px',
          background: 'var(--text)',
          color: 'var(--bg)',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 600,
          boxShadow: 'var(--shadow)',
          transition: 'all 0.15s ease'
        }}>
          이력서(Resume) 보러 가기
        </Link>
      </section>

    </div>
  );
}
