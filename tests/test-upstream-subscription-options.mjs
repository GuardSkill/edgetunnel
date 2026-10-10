import assert from 'node:assert/strict';
import fs from 'node:fs';

const workerPath = new URL('../_worker.js', import.meta.url);
const workerSource = fs.readFileSync(workerPath, 'utf8');

assert.equal(workerSource.includes('Tanach with Nikkud'), false, 'unrelated Tanakh payload must not be bundled');
assert.match(workerSource, /const 汇聚订阅_UA = 'v2rayN\/edge'/);
assert.match(workerSource, /headers: \{ 'User-Agent': 汇聚订阅_UA \+ ' Uid\/0x' \+ uid \+ ' Version\/' \+ EDT_版本号 \}/);
assert.match(workerSource, /signal: controller\.signal, headers: \{ 'User-Agent': 汇聚订阅_UA \+ ' Uid\/0x' \+ uid \+ ' Version\/' \+ EDT_版本号 \}/);

assert.match(workerSource, /EXPAND: true, \/\/ 展开规则全文/);
assert.match(workerSource, /typeof config_JSON\.订阅转换配置\.EXPAND !== 'boolean'/);

for (const option of ['xudp', 'udp', 'tls13', 'append_type', 'sort', 'expand']) {
  assert.equal(
    workerSource.includes(`&${option}=\${config_JSON.订阅转换配置.`),
    true,
    `subscription conversion URL is missing ${option}`,
  );
}

const cacheKeyLine = workerSource
  .split('\n')
  .find((line) => line.includes("const 订阅转换缓存键 = 'subconverter-cache:'"));

assert.ok(cacheKeyLine, 'could not find subscription conversion cache key');
for (const option of ['XUDP', 'UDP', 'TLS13', 'APPEND_TYPE', 'SORT', 'EXPAND']) {
  assert.equal(cacheKeyLine.includes(`订阅转换配置.${option}`), true, `cache key is missing ${option}`);
}
