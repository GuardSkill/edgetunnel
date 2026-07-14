import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const workerPath = new URL('../_worker.js', import.meta.url);
const workerSource = fs.readFileSync(workerPath, 'utf8');
const start = workerSource.indexOf('async function 获取订阅转换内容');
const end = workerSource.indexOf('async function 请求日志记录');

assert.notEqual(start, -1, 'could not find subconverter cache helper');
assert.notEqual(end, -1, 'could not find end of helper section');

function createContext(fetchImpl, initialCache = null) {
  const writes = [];
  const context = {
    Date,
    Error,
    JSON,
    setTimeout,
    clearTimeout,
    fetch: fetchImpl,
    console: { warn() {} },
    env: {
      KV: {
        get: async () => initialCache,
        put: async (key, value) => writes.push([key, value]),
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(`${workerSource.slice(start, end)}
globalThis.获取订阅转换内容 = 获取订阅转换内容;`, context);
  return { context, writes };
}

{
  let calls = 0;
  const { context, writes } = createContext(async () => {
    calls += 1;
    return { ok: true, text: async () => 'converted-subscription' };
  });
  const result = await context.获取订阅转换内容('https://sub.example/sub', context.env, 'cache-key', { 'User-Agent': 'test' }, { retries: 1, retryDelayMs: 1 });
  assert.equal(result.text, 'converted-subscription');
  assert.equal(result.fromCache, false);
  assert.equal(calls, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 'cache-key');
  assert.equal(JSON.parse(writes[0][1]).content, 'converted-subscription');
}

{
  const cached = JSON.stringify({ content: 'cached-subscription', updatedAt: '2026-07-14T00:00:00.000Z' });
  const { context } = createContext(async () => {
    throw new Error('backend timeout');
  }, cached);
  const result = await context.获取订阅转换内容('https://sub.example/sub', context.env, 'cache-key', {}, { retries: 2, retryDelayMs: 1 });
  assert.equal(result.text, 'cached-subscription');
  assert.equal(result.fromCache, true);
  assert.equal(result.error.includes('backend timeout'), true);
}

{
  const { context } = createContext(async () => ({ ok: false, status: 502, statusText: 'Bad Gateway', text: async () => '' }));
  await assert.rejects(
    () => context.获取订阅转换内容('https://sub.example/sub', context.env, 'cache-key', {}, { retries: 1, retryDelayMs: 1 }),
    /订阅转换后端异常：Bad Gateway/,
  );
}
