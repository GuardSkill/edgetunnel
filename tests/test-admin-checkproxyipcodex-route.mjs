import assert from 'node:assert/strict';
import fs from 'node:fs';

const workerPath = new URL('../_worker.js', import.meta.url);
const workerSource = fs.readFileSync(workerPath, 'utf8');

assert.match(
  workerSource,
  /访问路径\s*===\s*'admin\/checkproxyipcodex'/,
  'checkProxyIPCodex admin route must compare against the lower-cased path',
);

assert.doesNotMatch(
  workerSource,
  /访问路径\s*===\s*'admin\/checkProxyIPCodex'/,
  'checkProxyIPCodex route should not use a mixed-case comparison with 访问路径',
);
