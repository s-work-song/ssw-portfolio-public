import type { NextConfig } from "next";
import { existsSync, lstatSync } from "node:fs";
import { join } from "node:path";

/**
 * GitHub Pages 프로젝트 페이지는 사이트가 저장소 이름 하위 경로에 놓인다.
 * 배포 워크플로가 NEXT_PUBLIC_BASE_PATH=/ssw-portfolio-public 을 넣어주고,
 * 로컬 개발·빌드에서는 비어 있어 루트 기준으로 동작한다.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * 별도 로컬 검증 출력에만 지정한다. dev 내부 산출물은 격리하지만,
 * output:export build에서 Next는 이 경로를 최종 export 폴더로만 쓴다.
 * export의 내부 build 경로까지 격리한다고 가정하지 않는다.
 */
const customDistDir = process.env.SSW_NEXT_DIST_DIR;
if (customDistDir !== undefined) {
  // 산출물 전용 경로만 허용한다. 절대 경로·상위 이동·소스 폴더는 받지 않는다.
  if (customDistDir.length > 128 || !/^(?:\.diagnostics\/next-|\.next-)[A-Za-z0-9_-]+$/u.test(customDistDir)) {
    throw new Error("SSW_NEXT_DIST_DIR must be an output directory: .diagnostics/next-<name> or .next-<name>");
  }
  let outputPath = process.cwd();
  for (const segment of customDistDir.split("/")) {
    outputPath = join(outputPath, segment);
    if (existsSync(outputPath) && lstatSync(outputPath).isSymbolicLink()) {
      throw new Error("SSW_NEXT_DIST_DIR must not follow a symbolic link");
    }
  }
}

const nextConfig: NextConfig = {
  distDir: customDistDir ?? ".next",
  // 서버 런타임 없이 정적 파일로만 배포한다. 이 프로젝트는 전 라우트가
  // Static/SSG라 동적 기능을 포기하는 대가 없이 export가 가능하다.
  output: "export",
  basePath,
  // export에는 이미지 최적화 서버가 없으므로 next/image를 원본 그대로 내보낸다.
  images: { unoptimized: true },
  // 라우트를 디렉터리+index.html 로 내보내 정적 호스팅의 경로 해석과 맞춘다.
  trailingSlash: true,
  allowedDevOrigins: process.env.LOCAL_DEV_IP
    ? [process.env.LOCAL_DEV_IP]
    : [], // 스마트폰 IP는 .env.local에서 관리하여 Git에 올라가지 않도록 처리
};

export default nextConfig;
