/**
 * 사이트 루트로 들어온 방문자를 소개 Overview로 보낸다.
 * 소개 페이지가 이력서·자기소개서·연구·기록으로 가는 입구를 모두 노출하므로,
 * 특정 문서로 바로 보내는 것보다 방문자가 길을 잃지 않는다.
 *
 * 정적 export에는 서버가 없어 next.config의 redirects()나 redirect()를 쓸 수 없다.
 * meta refresh로 즉시 이동하며, 전환 안내 화면은 렌더링하지 않는다.
 */
import type { Metadata } from "next";

// 배포 시 basePath가 붙으므로 이동 주소에도 같은 접두사를 붙여야 한다.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const target = `${basePath}/about-me/`;

export const metadata: Metadata = {
  title: "SSW 소개페이지",
};

export default function RootRedirect() {
  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${target}`} />
      <style>{"html { visibility: hidden; }"}</style>
    </>
  );
}
