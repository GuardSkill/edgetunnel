import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const workerPath = new URL('../_worker.js', import.meta.url);
const workerSource = fs.readFileSync(workerPath, 'utf8');
const start = workerSource.indexOf('function 获取反代IP池来源URL');
const end = workerSource.indexOf('function 提取优选IP备注');

assert.notEqual(start, -1, 'could not find proxyip pool source helpers');
assert.notEqual(end, -1, 'could not find end of proxyip pool helper section');

const failedFetchContext = {
  Date,
  Set,
  console: { warn() {} },
  fetch: async () => {
    throw new Error('simulated cold-start fetch failure');
  },
};
vm.createContext(failedFetchContext);
vm.runInContext(`let 缓存国家反代IP池 = {}, 缓存国家反代IP池时间 = {};
${workerSource.slice(start, end)}
globalThis.获取国家反代IP池 = 获取国家反代IP池;`, failedFetchContext);

const failedFetchResult = await failedFetchContext.获取国家反代IP池('https://example.invalid/proxyip-best.txt');

assert.deepEqual(Object.keys(failedFetchResult).sort(), ['AT', 'DE', 'GB', 'HK', 'IE', 'JP', 'KR', 'SG']);
assert.equal(failedFetchResult.JP.length > 0, true);
assert.equal(failedFetchResult.SG.length > 0, true);

const emptySourceContext = {
  Date,
  Set,
  console: { warn() {} },
  fetch: async () => ({
    ok: true,
    text: async () => '# temporarily empty source\n',
  }),
};
vm.createContext(emptySourceContext);
vm.runInContext(`let 缓存国家反代IP池 = {}, 缓存国家反代IP池时间 = {};
${workerSource.slice(start, end)}
globalThis.获取国家反代IP池 = 获取国家反代IP池;`, emptySourceContext);

const emptySourceResult = await emptySourceContext.获取国家反代IP池('https://example.invalid/empty.txt');

assert.equal(emptySourceResult.JP.length > 0, true);
