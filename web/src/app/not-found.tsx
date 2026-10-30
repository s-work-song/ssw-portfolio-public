/**
 * 없는 주소로 들어온 방문자에게 보여 주는 안내 페이지다.
 * 정적 export에서는 404.html로 나가며, GitHub Pages가 이 파일을 그대로 쓴다.
 * 소개 페이지가 다른 페이지로 가는 입구를 모두 노출하므로 그곳으로 안내한다.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SSW 소개페이지",
};

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <div style={{ maxWidth: "480px", textAlign: "center" }}>
        <p style={{ margin: "0 0 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", letterSpacing: ".18em", color: "var(--accent, #6366f1)" }}>
          404 NOT FOUND
        </p>
        <h1 style={{ margin: "0 0 12px", fontSize: "clamp(1.5rem, 5vw, 2rem)", fontWeight: 800 }}>
          페이지를 찾을 수 없습니다
        </h1>
        <p style={{ margin: "0 0 24px", lineHeight: 1.7, color: "var(--text-dim)", wordBreak: "keep-all" }}>
          주소가 바뀌었거나 없는 페이지입니다. 소개 페이지에서 이력서·자기소개서·연구·기록으로 이동할 수 있어요.
        </p>
        <Link
          href="/about-me/"
          className="hover-btn-primary hover-btn-inverse"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            background: "var(--text)",
            color: "var(--bg)",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          소개 페이지로 가기
        </Link>
      </div>
    </main>
  );
}
