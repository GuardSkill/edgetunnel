import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const start = source.indexOf('function 获取传输协议配置(');
const end = source.indexOf('function 获取传输路径参数值(', start);
assert.ok(start >= 0 && end > start, 'transport config function must exist');

const context = { 获取本机标识: () => ['padding-header', '_padding-key'] };
vm.runInNewContext(source.slice(start, end), context);

function extra(config) {
  const type = context.获取传输协议配置({ UUID: 'test', 传输协议: 'xhttp', ...config }).type;
  assert.match(type, /^xhttp&mode=stream-one&extra=/);
  return JSON.parse(decodeURIComponent(type.split('&extra=')[1]));
}

const defaults = extra({});
assert.equal(defaults.xPaddingHeader, 'padding-header');
assert.equal(defaults.xPaddingKey, '_padding-key');
assert.equal(Object.hasOwn(defaults, 'xmux'), false, 'connection reuse is off by default');

const disabled = extra({ 连接复用: { 启用: false, xmux: { maxConnections: 4 } } });
assert.equal(Object.hasOwn(disabled, 'xmux'), false);

const enabled = extra({ 连接复用: { 启用: true, xmux: { maxConnections: 4, hMaxReusableSecs: 1800 } } });
assert.equal(enabled.xmux.maxConnections, 4);
assert.equal(enabled.xmux.hMaxReusableSecs, 1800);

assert.equal(context.获取传输协议配置({ UUID: 'test', 传输协议: 'ws', 连接复用: { 启用: true } }).type, 'ws');
assert.equal(context.获取传输协议配置({ UUID: 'test', 传输协议: 'grpc', 连接复用: { 启用: true } }).type, 'grpc&mode=gun');

console.log('XHTTP xmux transport options passed');
