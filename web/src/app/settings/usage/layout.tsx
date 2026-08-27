import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "챗봇 운영 통계 | SSW 소개페이지",
  robots: {
    index: false,
    follow: false,
  },
};

export default function UsageLayout({ children }: { children: ReactNode }) {
  return children;
}
