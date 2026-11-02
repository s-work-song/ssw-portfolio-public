import type { ReactNode } from "react";

/** 설정 화면이 클라이언트 컴포넌트라 제목과 설명은 레이아웃에서 내보낸다. */
export const metadata = {
  title: "설정",
  description: "테마와 포인트 컬러, 챗봇 표시 방식을 바꾸는 화면",
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
