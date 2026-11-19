import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes, webcrypto } from 'node:crypto';

const source = fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const worker = source.slice(source.indexOf('// VMess AEAD over WebSocket.'));
const subtle = new Proxy(webcrypto.subtle, {
  get(target, property) {
    if (property === 'digest') return async (name, data) => name === 'MD5'
      ? createHash('md5').update(data).digest()
      : target.digest(name, data);
    return typeof target[property] === 'function' ? target[property].bind(target) : target[property];
  },
});
const sent = [];
const context = {
  crypto: { subtle, getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
  TextEncoder, TextDecoder, Uint8Array, DataView, BigInt, Date, WebSocket: { OPEN: 1 },
  数据转Uint8Array: value => new Uint8Array(value),
  WebSocket发送并等待: async (_, value) => sent.push(Buffer.from(value)),
  closeSocketQuietly: () => {}, log: () => {}, btoa, unescape, encodeURIComponent,
};
vm.createContext(context);
vm.runInContext(`${worker}\nglobalThis.testApi = { vmessKDF, vmessShake128, vmessNode, 创建VMess会话 };`, context);
const { vmessKDF, vmessShake128, vmessNode, 创建VMess会话 } = context.testApi;
const hex = bytes => Buffer.from(bytes).toString('hex');
assert.equal(hex(await vmessKDF(Buffer.from([9,10,11,12]), 'VMess Header AEAD Key_Length', Buffer.from([1,2,3,4]), Buffer.from([5,6,7,8]))), '8007734f9144dc41f6a56bec4782ab8288a72e40d545094c497e73a962c1db9d');
const seed = randomBytes(16), shake = vmessShake128(seed);
const expectedMask = createHash('shake128', { outputLength: 20 }).update(seed).digest();
for (let i = 0; i < 10; i++) assert.equal(shake(), expectedMask.readUInt16BE(i * 2));
const uuid = '90cd4a77-141a-43c9-991b-08263cfe9c10';
const node = JSON.parse(Buffer.from(vmessNode('1.2.3.4', 443, uuid, 'edge.example', '/path', 'test').slice(8), 'base64').toString());
assert.equal(node.scy, 'aes-128-gcm');
assert.equal(node.path, '/path?vmess=1');

// Build a client packet with Node's independent crypto primitives.
const uuidBytes = Buffer.from(uuid.replaceAll('-', ''), 'hex');
const cmdKey = createHash('md5').update(Buffer.concat([uuidBytes, Buffer.from('c48619fe-8f02-49e0-b9e9-edf763e17e21')])).digest();
const kdf = (key, ...parts) => {
  const digest = (level, message) => {
    if (level < 0) return createHmac('sha256', 'VMess AEAD KDF').update(message).digest();
    const block = Buffer.alloc(64);
    Buffer.from(parts[level]).copy(block);
    const inner = Buffer.from(block.map(b => b ^ 0x36)), outer = Buffer.from(block.map(b => b ^ 0x5c));
    return digest(level - 1, Buffer.concat([outer, digest(level - 1, Buffer.concat([inner, message]))]));
  };
  return digest(parts.length - 1, key);
};
const seal = (key, nonce, plain, aad = Buffer.alloc(0)) => {
  const cipher = createCipheriv('aes-128-gcm', key, nonce);
  cipher.setAAD(aad);
  return Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
};
const crc = bytes => {
  let c = 0xffffffff;
  for (const b of bytes) { c ^= b; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0); }
  return (c ^ 0xffffffff) >>> 0;
};
const fnv = bytes => { let v = 0x811c9dc5; for (const b of bytes) v = Math.imul(v ^ b, 0x01000193) >>> 0; return v; };
const authPlain = Buffer.alloc(16);
authPlain.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)), 0);
randomBytes(4).copy(authPlain, 8);
authPlain.writeUInt32BE(crc(authPlain.subarray(0, 12)), 12);
const authCipher = createCipheriv('aes-128-ecb', kdf(cmdKey, 'AES Auth ID Encryption').subarray(0,16), null);
authCipher.setAutoPadding(false);
const authID = Buffer.concat([authCipher.update(authPlain), authCipher.final()]);
const nonce = randomBytes(8), bodyIV = randomBytes(16), bodyKey = randomBytes(16), domain = Buffer.from('example.org');
const plain = Buffer.concat([Buffer.from([1]), bodyIV, bodyKey, Buffer.from([0x29, 0x0d, 0x03, 0, 1, 0x01, 0xbb, 2, domain.length]), domain]);
const check = Buffer.alloc(4); check.writeUInt32BE(fnv(plain));
const requestHead = Buffer.concat([plain, check]);
const len = Buffer.alloc(2); len.writeUInt16BE(requestHead.length);
const clientHead = Buffer.concat([
  authID,
  seal(kdf(cmdKey, 'VMess Header AEAD Key_Length', authID, nonce).subarray(0,16), kdf(cmdKey, 'VMess Header AEAD Nonce_Length', authID, nonce).subarray(0,12), len, authID),
  nonce,
  seal(kdf(cmdKey, 'VMess Header AEAD Key', authID, nonce).subarray(0,16), kdf(cmdKey, 'VMess Header AEAD Nonce', authID, nonce).subarray(0,12), requestHead, authID),
]);
const data = Buffer.from('hello');
const cipherData = seal(bodyKey, Buffer.concat([Buffer.alloc(2), bodyIV.subarray(2, 12)]), data);
const masks = createHash('shake128', { outputLength: 4 }).update(bodyIV).digest();
const bodyPadding = masks.readUInt16BE(0) % 64;
const bodyLen = Buffer.alloc(2); bodyLen.writeUInt16BE((cipherData.length + bodyPadding) ^ masks.readUInt16BE(2));
const session = await 创建VMess会话(uuid, { readyState: 1 });
assert.equal((await session.输入(clientHead.subarray(0, 27))).请求, null);
assert.equal((await session.输入(clientHead.subarray(27, -3))).请求, null);
const result = await session.输入(Buffer.concat([clientHead.subarray(-3), bodyLen, cipherData, randomBytes(bodyPadding)]));
assert.equal(result.请求.hostname, 'example.org');
assert.equal(result.请求.port, 443);
assert.equal(Buffer.from(result.数据块[0]).toString(), 'hello');
await assert.rejects(() => 创建VMess会话(uuid, { readyState: 1 }).then(other => other.输入(clientHead)), /replayed auth ID/);
const tampered = Buffer.from(clientHead);
tampered[0] ^= 1;
await assert.rejects(() => 创建VMess会话(uuid, { readyState: 1 }).then(other => other.输入(tampered)), /auth invalid|auth time expired/);
await session.回包Socket.send(Buffer.from('world'));
assert.equal(sent.length, 1);
const responseKey = createHash('sha256').update(bodyKey).digest().subarray(0, 16);
const responseIV = createHash('sha256').update(bodyIV).digest().subarray(0, 16);
const response = sent[0];
const open = (key, nonce, data) => {
  const decipher = createDecipheriv('aes-128-gcm', key, nonce);
  decipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]);
};
assert.equal(open(kdf(responseKey, 'AEAD Resp Header Len Key').subarray(0,16), kdf(responseIV, 'AEAD Resp Header Len IV').subarray(0,12), response.subarray(0,18)).readUInt16BE(), 4);
assert.equal(open(kdf(responseKey, 'AEAD Resp Header Key').subarray(0,16), kdf(responseIV, 'AEAD Resp Header IV').subarray(0,12), response.subarray(18,38))[0], 0x29);
const responseMasks = createHash('shake128', { outputLength: 4 }).update(responseIV).digest();
const responsePadding = responseMasks.readUInt16BE(0) % 64;
const maskedSize = response.readUInt16BE(38) ^ responseMasks.readUInt16BE(2);
assert.equal(open(responseKey, Buffer.concat([Buffer.alloc(2), responseIV.subarray(2,12)]), response.subarray(40,40 + maskedSize - responsePadding)).toString(), 'world');
console.log('VMess AEAD vectors and packet parsing passed');
