import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const workerPath = new URL('../_worker.js', import.meta.url);
const workerSource = fs.readFileSync(workerPath, 'utf8');
const start = workerSource.indexOf('function 提取优选IP备注');
const end = workerSource.indexOf('async function 请求优选API');

assert.notEqual(start, -1, 'could not find business proxyip naming helpers');
assert.notEqual(end, -1, 'could not find end of naming helper section');

const context = {};
vm.createContext(context);
vm.runInContext(`${workerSource.slice(start, end)}
globalThis.生成业务反代优选IP = 生成业务反代优选IP;`, context);

const nodes = [
  '203.0.113.1:443#🇭🇰 HK [北京测速#17 ip.zip]',
  '203.0.113.2:443#🇩🇪 DE [北京测速#03 ip.zip]',
];
const proxyipPool = {
  HK: ['198.51.100.1:443'],
  AU: ['198.51.100.2:443'],
};

const result = context.生成业务反代优选IP(nodes, proxyipPool);

assert.equal(
  result[0],
  '203.0.113.1:443#🇭🇰 HK ↪ [北京测速#17 ip.zip] $proxyip=198.51.100.1:443',
);
assert.equal(
  result[1],
  '203.0.113.2:443#🇩🇪 DE → 🇦🇺 AU [北京测速#03 ip.zip] $proxyip=198.51.100.2:443',
);
assert.equal(result.length, 2);
