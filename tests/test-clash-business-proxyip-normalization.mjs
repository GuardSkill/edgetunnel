import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const workerPath = new URL('../_worker.js', import.meta.url);
const workerSource = fs.readFileSync(workerPath, 'utf8');
const start = workerSource.indexOf('function 规范化Clash业务反代节点名');
const end = workerSource.indexOf('function Clash订阅配置文件热补丁');

assert.notEqual(start, -1, 'could not find Clash business proxyip normalization helper');
assert.notEqual(end, -1, 'could not find end of normalization helper section');

const context = {};
vm.createContext(context);
vm.runInContext(`${workerSource.slice(start, end)}
globalThis.规范化Clash业务反代节点名 = 规范化Clash业务反代节点名;`, context);

const input = `
proxies:
  - {name: "🇦🇺 DE → 🇦🇺 AU [北京测速#01 ip.zip]", server: 203.0.113.1}
  - {name: "🇮🇪 DE → 🇮🇪 IE [北京测速#02 ip.zip]", server: 203.0.113.2}
  - {name: "🇦🇹 DE → 🇦🇹 AT [北京测速#03 ip.zip]", server: 203.0.113.3}
proxy-groups:
  - name: 🇩🇪 Germany Entry + 🇮🇪 IE Proxy
    proxies:
      - 🇦🇺 DE → 🇦🇺 AU [北京测速#01 ip.zip]
      - 🇮🇪 DE → 🇮🇪 IE [北京测速#02 ip.zip]
      - 🇦🇹 DE → 🇦🇹 AT [北京测速#03 ip.zip]
`;

const result = context.规范化Clash业务反代节点名(input);

assert.equal(result.includes('🇦🇺 DE → 🇦🇺 AU'), false);
assert.equal((result.match(/🇩🇪 DE → 🇦🇺 AU/g) || []).length, 2);
assert.equal(result.includes('🇮🇪 DE → 🇮🇪 IE'), false);
assert.equal((result.match(/🇩🇪 DE → 🇮🇪 IE/g) || []).length, 2);
assert.equal(result.includes('🇦🇹 DE → 🇦🇹 AT'), false);
assert.equal((result.match(/🇩🇪 DE → 🇦🇹 AT/g) || []).length, 2);
