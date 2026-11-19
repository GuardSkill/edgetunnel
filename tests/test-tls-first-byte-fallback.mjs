import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const start = source.indexOf('async function connectStreams(');
const end = source.indexOf('function isSpeedTestSite(', start);
assert.ok(start >= 0 && end > start);
const sent = [];
const context = {
  Date, Promise, Error, Uint8Array, ArrayBuffer, setTimeout, clearTimeout,
  WebSocket: { OPEN: 1 }, 下行Grain包字节: 32768,
  创建下行Grain发送器: () => ({
    async flush() {}, async 停止并刷新() {},
    async 发送(bytes) { sent.push(Buffer.from(bytes)); },
    async 直接发送(bytes) { sent.push(Buffer.from(bytes)); },
  }),
  closeSocketQuietly(socket) { socket.readyState = 3; },
  log() {},
};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.connectStreams = connectStreams;`, context);

function fakeSocket() {
  let resolveRead;
  const reader = {
    read() { return new Promise(resolve => { resolveRead = resolve; }); },
    async cancel() { resolveRead?.({ done: true }); },
    releaseLock() {},
  };
  const socket = {
    closed: Promise.resolve(),
    readable: { getReader(options) { if (options?.mode === 'byob') throw Error('no BYOB'); return reader; } },
    close() { socket.didClose = true; },
    emit(value) { resolveRead?.({ done: false, value }); },
    end() { resolveRead?.({ done: true }); },
  };
  return socket;
}

{
  const socket = fakeSocket(), ws = { readyState: 1 }, state = {};
  let retried = 0;
  const task = context.connectStreams(socket, ws, null, async () => { retried++; }, null, state, 25);
  setTimeout(() => state.armTlsFirstByteTimeout(), 5);
  await task;
  assert.equal(retried, 1, 'silent TLS connection must fall back');
  assert.equal(socket.didClose, true);
  assert.equal(ws.readyState, 1, 'fallback keeps the client connection open');
}
{
  const socket = fakeSocket(), ws = { readyState: 1 };
  let retried = 0;
  const task = context.connectStreams(socket, ws, null, async () => { retried++; }, null, {}, 100, true);
  setTimeout(() => { socket.emit(new Uint8Array([22, 3, 3])); setTimeout(() => socket.end(), 5); }, 5);
  await task;
  assert.equal(retried, 0, 'received TLS data must not trigger fallback');
  assert.deepEqual(sent[0], Buffer.from([22, 3, 3]));
}
console.log('TLS first-byte fallback passed');
