import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const workerPath = new URL('../_worker.js', import.meta.url);
const workerSource = fs.readFileSync(workerPath, 'utf8');
const start = workerSource.indexOf('function 判定反代目标HTTP响应');
const end = workerSource.indexOf('async function nginx');

assert.notEqual(start, -1, 'could not find proxyip reachability classifier');
assert.notEqual(end, -1, 'could not find end of helper section');

const context = {};
vm.createContext(context);
vm.runInContext(`${workerSource.slice(start, end)}
globalThis.判定反代目标HTTP响应 = 判定反代目标HTTP响应;
globalThis.应用已验证HK反代IP池 = 应用已验证HK反代IP池;`, context);

assert.equal(
  context.判定反代目标HTTP响应('openai', 401, 'content-type: application/json\r\n', '{"error":{"message":"missing api key"}}').ok,
  true,
);

assert.equal(
  context.判定反代目标HTTP响应('openai', 403, 'content-type: text/html\r\n', '<html><body>blocked</body></html>').ok,
  false,
);

assert.equal(
  context.判定反代目标HTTP响应('codex', 404, 'content-type: application/json\r\n', '{"detail":"not found"}').ok,
  true,
);

assert.equal(
  context.判定反代目标HTTP响应('codex', 403, 'content-type: text/html\r\n', '<html><body>blocked</body></html>').ok,
  false,
);

assert.equal(
  context.判定反代目标HTTP响应('okx', 200, 'content-type: application/json\r\n', '{"code":"0","data":[{"ts":"1"}]}').ok,
  true,
);

assert.equal(
  context.判定反代目标HTTP响应('okx', 200, 'content-type: text/html\r\n', '<html></html>').ok,
  false,
);

const pool = context.应用已验证HK反代IP池(
  { 反代: { HK_PROXYIP_GOOD: ['198.51.100.1:443', '198.51.100.2:443'] } },
  { HK: ['203.0.113.1:443'], SG: ['203.0.113.2:443'] },
);

assert.deepEqual(JSON.parse(JSON.stringify(pool.HK)), ['198.51.100.1:443', '198.51.100.2:443']);
assert.deepEqual(JSON.parse(JSON.stringify(pool.SG)), ['203.0.113.2:443']);
