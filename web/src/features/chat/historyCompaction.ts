import type { ChatHistoryItem } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function structuralKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(structuralKey).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${structuralKey(value[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}

function catalogResult(item: ChatHistoryItem): {
  key: string;
  result: Record<string, unknown>;
} | null {
  if (item.role !== "tool") return null;
  let result: unknown;
  try { result = JSON.parse(item.content); } catch { return null; }
  if (!isRecord(result) || !Object.hasOwn(result, "supportedOptions")) return null;
  return { key: structuralKey(result.supportedOptions), result };
}

/**
 * 오래된 도구 결과에 반복된 동일 supportedOptions만 제거한다. 가장 최근 턴은
 * 현재 요청의 도구 체인일 수 있으므로 그대로 두고, 서로 다른 카탈로그 버전은
 * 각각 최신 사본을 남긴다.
 */
export function compactRepeatedSupportedOptions(
  history: readonly ChatHistoryItem[],
): ChatHistoryItem[] {
  const lastUserIndex = history.findLastIndex(({ role }) => role === "user");
  const protectedStart = lastUserIndex < 0 ? 0 : lastUserIndex;
  const catalogs = history.map(catalogResult);
  const protectedCatalogs = new Set<string>();
  const protectedIndices = new Set<number>();
  for (let index = protectedStart; index < catalogs.length; index += 1) {
    const catalog = catalogs[index];
    if (catalog && !protectedCatalogs.has(catalog.key)) {
      protectedCatalogs.add(catalog.key);
      protectedIndices.add(index);
    }
  }
  const seenCatalogs = new Set(protectedCatalogs);
  const compacted = [...history];

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    const catalog = catalogs[index];
    if (!catalog) continue;
    if (protectedIndices.has(index) || !seenCatalogs.has(catalog.key)) {
      seenCatalogs.add(catalog.key);
      continue;
    }

    const observation = { ...catalog.result };
    delete observation.supportedOptions;
    compacted[index] = { ...item, content: JSON.stringify(observation) };
  }
  return compacted;
}
