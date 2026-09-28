const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { download, main } = require('../bin/pocket-deck.cjs');

function fixture(bytes = Buffer.from('mock installer')) {
  return { bytes, manifest: { version: '1.0.3', url: 'https://github.com/masa-dev-2000/pocket-deck/releases/download/v1.0.3/mock.exe', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }, log() {} };
}

test('download verifies checksum; cached file is rechecked without fetching', async () => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deck-npm-'));
  const f = fixture(); let requests = 0;
  try {
    const options = { ...f, cacheDir, fetchImpl: async () => { requests++; return new Response(f.bytes); } };
    const file = await download(options);
    assert.deepEqual(await fs.readFile(file), f.bytes);
    assert.equal(await download(options), file);
    assert.equal(requests, 1);
    assert((await fs.readdir(cacheDir)).every(name => !name.endsWith('.part')));
  } finally { await fs.rm(cacheDir, { recursive: true, force: true }); }
});

test('corrupted same-size download is refused and incomplete file is removed', async () => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deck-npm-'));
  const f = fixture();
  try {
    await assert.rejects(download({ ...f, cacheDir, fetchImpl: async () => new Response(Buffer.alloc(f.bytes.length)) }), /チェックサム/);
    assert.deepEqual(await fs.readdir(cacheDir), []);
  } finally { await fs.rm(cacheDir, { recursive: true, force: true }); }
});

test('unpublished release gives a readable error; no installer is created', async () => {
  const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deck-npm-'));
  try {
    await assert.rejects(download({ ...fixture(), cacheDir, fetchImpl: async () => new Response('', { status: 404 }) }), /Release/);
    assert.deepEqual(await fs.readdir(cacheDir), []);
  } finally { await fs.rm(cacheDir, { recursive: true, force: true }); }
});

test('invalid source URL is rejected before a network request', async () => {
  const f = fixture(); f.manifest.url = 'https://other.example/file.exe';
  await assert.rejects(download({ ...f, fetchImpl: () => { throw new Error('should not fetch'); } }), /URL/);
});

test('help and unsupported platforms never download or launch', async () => {
  const options = { platform: 'linux', arch: 'x64', log() {}, downloadImpl() { assert.fail('should not download'); }, launchImpl() { assert.fail('should not launch'); } };
  await main([], options);
  await assert.rejects(main(['install'], options), /Windows/);
  await assert.rejects(main(['unknown'], options), /引数/);
});

test('download-only does not launch; install launches only after successful download', async () => {
  const events = [];
  const options = { platform: 'win32', arch: 'x64', log() {}, downloadImpl: async () => { events.push('verified'); return 'mock.exe'; }, launchImpl: async file => events.push('launch:' + file) };
  await main(['download'], options);
  assert.deepEqual(events, ['verified']);
  events.length = 0;
  await main(['install'], options);
  assert.deepEqual(events, ['verified', 'launch:mock.exe']);
  events.length = 0;
  await assert.rejects(main(['install'], { ...options, downloadImpl: async () => { throw new Error('bad checksum'); } }), /checksum/);
  assert.deepEqual(events, []);
});
