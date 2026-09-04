/**
 * 포트폴리오 도구가 공유하는 작은 입력 계약 조립기다.
 *
 * JSON Schema 라이브러리를 감싼 범용 계층이 아니라, 이 프로젝트에서 쓰는
 * 빈 객체·문자열 enum 객체만 다룬다. 런타임 정의 하나에서 입력 타입, WebMCP
 * 스키마와 실행 직전 검증을 함께 만들기 위한 최소 단위다.
 */

export type JsonObjectSchema = Readonly<{
  type: 'object';
  properties: Readonly<Record<string, unknown>>;
  required?: readonly string[];
  additionalProperties?: false;
  anyOf?: readonly unknown[];
}>;

export interface InputDefinition<TInput> {
  readonly schema: JsonObjectSchema;
  parse(input: Record<string, unknown>): TInput;
}

/** 하나의 UI 도구가 이름·입력 계약을 함께 소유한다. */
export class ToolDefinition<TInput, TName extends string = string> {
  readonly name: TName;
  readonly inputSchema: JsonObjectSchema;
  readonly input: InputDefinition<TInput>;

  constructor(name: TName, input: InputDefinition<TInput>) {
    this.name = name;
    this.input = input;
    this.inputSchema = input.schema;
  }

  parse(input: Record<string, unknown>): TInput {
    return this.input.parse(input);
  }
}

/** 중복 이름을 조기에 막고 등록용 definition map을 만든다. */
type DefinitionsByName<TDefinitions extends readonly ToolDefinition<unknown, string>[]> = {
  [TDefinition in TDefinitions[number] as TDefinition['name']]: TDefinition;
};

export class ToolRegistry<
  TDefinitions extends readonly ToolDefinition<unknown, string>[],
> {
  readonly definitions: TDefinitions;
  readonly byName: Readonly<DefinitionsByName<TDefinitions>>;

  constructor(definitions: TDefinitions) {
    const byName = Object.create(null) as Record<string, ToolDefinition<unknown, string>>;
    for (const definition of definitions) {
      if (!/^[a-z][a-z0-9_]*$/u.test(definition.name)) {
        throw new TypeError(`포트폴리오 도구 이름은 snake_case여야 합니다: ${definition.name}`);
      }
      if (Object.hasOwn(byName, definition.name)) {
        throw new TypeError(`중복된 포트폴리오 도구 이름입니다: ${definition.name}`);
      }
      byName[definition.name] = definition;
    }
    this.definitions = Object.freeze([...definitions]) as TDefinitions;
    this.byName = Object.freeze(byName) as Readonly<DefinitionsByName<TDefinitions>>;
  }
}

export function assertInputObject(
  input: unknown,
): asserts input is Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('도구 인자는 객체여야 합니다.');
  }
}

export function assertOnlyKeys(
  input: Record<string, unknown>,
  allowedKeys: readonly string[],
): void {
  if (Object.keys(input).some((key) => !allowedKeys.includes(key))) {
    throw new TypeError('도구 인자에 지원하지 않는 항목이 포함돼 있습니다.');
  }
}

export function isAllowed<T extends string>(
  value: unknown,
  allowlist: readonly T[],
): value is T {
  return typeof value === 'string' && (allowlist as readonly string[]).includes(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

type EnumValues = readonly string[];

export type EnumInput<TValues extends EnumValues, TKey extends string> = {
  [Key in TKey]: TValues[number];
};

/** 빈 객체 입력의 schema와 검증을 같은 정의로 만든다. */
export function emptyInputDefinition(label: string): InputDefinition<Record<string, never>> {
  return {
    schema: Object.freeze({
      type: 'object',
      properties: Object.freeze({}),
      additionalProperties: false,
    }),
    parse(input) {
      assertOnlyKeys(input, []);
      if (Object.keys(input).length > 0) {
        throw new TypeError(`${label} 도구에는 인자가 필요하지 않습니다.`);
      }
      return {};
    },
  };
}

/** 키 하나의 문자열 enum 입력을 타입·schema·검증에서 함께 파생한다. */
export function enumInputDefinition<
  const TValues extends EnumValues,
  const TKey extends string,
>(
  key: TKey,
  values: TValues,
  description: string,
  label: string,
): InputDefinition<EnumInput<TValues, TKey>> {
  return {
    schema: Object.freeze({
      type: 'object',
      properties: Object.freeze({
        [key]: Object.freeze({ type: 'string', enum: Object.freeze([...values]), description }),
      }),
      required: Object.freeze([key]),
      additionalProperties: false,
    }),
    parse(input) {
      assertOnlyKeys(input, [key]);
      const value = input[key];
      if (!isAllowed(value, values)) {
        throw new TypeError(`${label} 도구 인자가 올바르지 않습니다.`);
      }
      return { [key]: value } as EnumInput<TValues, TKey>;
    },
  };
}

/** 여러 enum 필드가 필요하지만 추가 조건도 있는 입력에 쓰는 작은 조립기다. */
export function enumObjectSchema(
  fields: Readonly<Record<string, { values: readonly string[]; description: string }>>,
  required: readonly string[],
): JsonObjectSchema {
  return Object.freeze({
    type: 'object',
    properties: Object.freeze(Object.fromEntries(Object.entries(fields).map(([key, field]) => [
      key,
      Object.freeze({ type: 'string', enum: Object.freeze([...field.values]), description: field.description }),
    ]))),
    required: Object.freeze([...required]),
    additionalProperties: false,
  });
}
