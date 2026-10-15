import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ChatConversationIdentity, createChatRequestId } from './chatRequestIdentity.ts';
import { requestVerifiedToolResponse } from './toolVerificationRequest.ts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('보안 컨텍스트에서는 브라우저 randomUUID를 쓰고 질문 원문을 인자로 받지 않는다', () => {
  const uuid = 'a47e414d-429e-45a4-a5b4-320a0642a69a';
  let nativeCalls = 0;
  assert.equal(createChatRequestId({
    randomUUID() { nativeCalls++; return uuid; },
    getRandomValues() { assert.fail('native UUID가 있으면 fallback을 쓰지 않는다'); },
  }), uuid);
  assert.equal(nativeCalls, 1);
});

test('HTTP LAN처럼 randomUUID가 없어도 getRandomValues로 RFC4122 v4 UUID를 만든다', () => {
  let fills = 0;
  const nonsecureCrypto = { getRandomValues(bytes) {
    assert.equal(bytes.length, 16);
    fills++;
    for (let index = 0; index < bytes.length; index++) bytes[index] = index;
    return bytes;
  } };
  const uuid = createChatRequestId(nonsecureCrypto);
  assert.equal(uuid, '00010203-0405-4607-8809-0a0b0c0d0e0f');
  assert.match(uuid, uuidPattern);
  assert.match(uuid, /^[A-Za-z0-9._:-]{1,128}$/);
  assert.equal(fills, 1);
  const allOnes = createChatRequestId({ getRandomValues(bytes) { return bytes.fill(255); } });
  assert.match(allOnes, uuidPattern);
});

test('Web Crypto 자체가 없으면 낮은 품질의 난수나 질문으로 ID를 대체하지 않는다', () => {
  assert.throws(() => createChatRequestId({}), /식별자/);
  const source = readFileSync(new URL('./chatRequestIdentity.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('Math.random'), false);
  assert.equal(source.includes('node:'), false);
  assert.equal(source.includes('localStorage'), false);
});

test('여러 질문은 대화 ID를 공유하고 새 입력별 턴 ID만 달라진다', () => {
  let counter = 0;
  const identity = new ChatConversationIdentity(() => `id-${++counter}`);
  const first = identity.nextTurnIds();
  const second = identity.nextTurnIds();
  assert.deepEqual(first, { conversationId: 'id-1', turnId: 'id-2' });
  assert.deepEqual(second, { conversationId: 'id-1', turnId: 'id-3' });
  identity.reset();
  const third = identity.nextTurnIds();
  assert.deepEqual(third, { conversationId: 'id-4', turnId: 'id-5' });
  assert.equal(first.conversationId, 'id-1', 'reset 이후에도 이전 pending 스냅숏은 변하지 않는다');
  const refreshedBrowser = new ChatConversationIdentity(() => `id-${++counter}`);
  assert.notEqual(refreshedBrowser.nextTurnIds().conversationId, third.conversationId);
});

test('동일 질문의 재시도와 도구 후속 확인은 같은 ID를 재사용하고 새 대화를 만들지 않는다', async () => {
  let creations = 0;
  const identity = new ChatConversationIdentity(() => `id-${++creations}`);
  const pending = { ...identity.nextTurnIds(), message: '테마를 바꿔 줘', history: [] };
  const retry = { ...pending };
  assert.equal(retry.conversationId, pending.conversationId);
  assert.equal(retry.turnId, pending.turnId);
  let verified;
  await requestVerifiedToolResponse(Promise.resolve(), pending, [],
    () => ({ pageContext: 'resume', viewState: { page: 'resume' } }),
    async (request) => { verified = request; return { toolExecutions: [] }; },
    new AbortController().signal);
  assert.equal(verified.conversationId, pending.conversationId);
  assert.equal(verified.turnId, pending.turnId);
  assert.equal(creations, 2, '확인 요청은 UUID를 추가로 생성하지 않는다');
});

test('Provider는 메시지와 같은 메모리 수명으로 ID를 보존하고 reset 시 회전한다', () => {
  const provider = readFileSync(new URL('./ChatProvider.tsx', import.meta.url), 'utf8');
  assert.ok(provider.includes('const conversationIdentityRef = useRef<ChatConversationIdentity | null>(null)'));
  assert.ok(provider.includes('conversationId: pending.conversationId'));
  assert.ok(provider.includes('turnId: pending.turnId'));
  assert.ok(provider.includes('...conversationIdentityRef.current.nextTurnIds()'));
  const reset = provider.slice(provider.indexOf('const resetConversation ='), provider.indexOf('/** 스트리밍 사용 여부'));
  assert.ok(reset.includes('conversationIdentityRef.current.reset()'));
  assert.ok(reset.includes('setMessages(initialMessages())'));
  const retry = provider.slice(provider.indexOf('const retry ='), provider.indexOf('const stopGenerating ='));
  assert.equal(retry.includes('nextTurnIds'), false);
  assert.ok(retry.includes('performRequest(pending)'));
  const api = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
  const serializedBodies = api.match(/body: JSON\.stringify\(\{ \.\.\.request, toolHistory: request\.toolVerification \? request\.toolHistory : undefined \}\)/g) ?? [];
  assert.equal(serializedBodies.length, 2, 'JSON 및 SSE 요청 모두 같은 request/ID를 그대로 전송하고 toolHistory만 검증 요청에 제한한다');
  assert.equal(api.includes('X-Conversation-ID'), false, '추적 헤더는 백엔드/런처가 맡는다');
});
