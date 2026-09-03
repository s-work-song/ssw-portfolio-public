/**
 * 포트폴리오의 최상위 조합 루트(Composition Root)다.
 * 전역 메타데이터와 스타일을 선언하고, next-themes를 감싼 ThemeProvider와
 * 전역 포트폴리오 채팅을 모든 라우트에 한 번만 연결한다(Provider 패턴).
 */
import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../context/ThemeContext";
import { THEME_BOOT_SCRIPT } from "../context/settingsDataset";
import { ChatProvider } from "../features/chat";
import { ChatApiPreconnect } from "./ChatApiPreconnect";
import { PortfolioLogViewBridge } from "../features/webmcp/PortfolioLogViewBridge";
import { PortfolioWebMcp } from "../features/webmcp/PortfolioWebMcp";

const notoSansKr = Noto_Sans_KR({
  weight: "variable",
  display: "swap",
  variable: "--font-noto-sans-kr",
  preload: false,
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "SSW 소개페이지",
    template: "SSW 소개페이지",
  },
  description:
    "컴퓨팅 스택의 원리를 탐구하고 측정 가능한 개선을 제품으로 연결하는 소프트웨어 엔지니어 송상운의 포트폴리오입니다.",
};

/**
 * 모든 라우트를 감싸는 최상위 레이아웃이다.
 *
 * 테마 Provider와 챗봇 Provider를 한 번만 연결해, 어느 페이지에서 들어와도
 * 설정과 대화가 이어지게 한다. `suppressHydrationWarning`은 next-themes가
 * 하이드레이션 전에 html 속성을 손대기 때문에 필요하다.
 *
 * <head>의 부트 스크립트는 저장된 설정을 하이드레이션 전에 문서 루트의
 * CSS 변수와 data 속성으로 바른다. 이게 없으면 정적 HTML이 기본값으로 그려진
 * 뒤 마운트 후 effect가 저장값으로 바꿔, 새로고침마다 한 번 깜빡인다.
 * 계약은 `context/settingsDataset`가 쥔다.
 *
 * WebMCP 관련 컴포넌트는 두 갈래로 나눠 붙인다. 기록 검색 결과를 화면에
 * 반영하는 다리는 항상 켜 두고, 도구 등록은 브라우저가 WebMCP를 지원할 때만
 * 지연 로딩한다.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={notoSansKr.variable}
      suppressHydrationWarning
    >
      <head>
        {/* 첫 페인트 전에 저장된 설정을 적용한다. 상세는 context/settingsDataset. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <ChatApiPreconnect />
        <ThemeProvider>
          <ChatProvider>
            {/* 챗봇 기록 검색 결과 반영은 WebMCP 지원과 무관하게 항상 켠다. */}
            <PortfolioLogViewBridge />
            {/* 도구 등록은 브라우저가 WebMCP를 지원할 때만 지연 로딩한다. */}
            <PortfolioWebMcp />
            {children}
          </ChatProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
