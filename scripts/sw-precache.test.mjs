import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
const root = process.env.CANDIDATE_ROOT || process.cwd();

test('postbuild includes static files before SW activation; source maps excluded', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carequest-precache-'));
  try {
    fs.mkdirSync(path.join(dir, 'out/_next/static/chunks'), { recursive: true });
    fs.copyFileSync(path.join(root, 'public/sw.js'), path.join(dir, 'out/sw.js'));
    for (const name of ['app.js', 'style.css', 'app.js.map']) fs.writeFileSync(path.join(dir, 'out/_next/static/chunks', name), 'fixture');
    execFileSync(process.execPath, [path.join(root, 'scripts/inject-sw-version.mjs')], { cwd: dir, stdio: 'pipe' });
    const handlers = {}, cached = new Set();
    let skipWaiting = false;
    const cache = { add: async url => cached.add(url), addAll: async urls => urls.forEach(url => cached.add(url)) };
    vm.runInNewContext(fs.readFileSync(path.join(dir, 'out/sw.js'), 'utf8'), {
      self: { addEventListener: (type, cb) => handlers[type] = cb, skipWaiting: async () => { skipWaiting = true; }, clients: { claim: async () => {} } },
      caches: { open: async () => cache },
    });
    let pending;
    handlers.install({ waitUntil: promise => pending = promise });
    await pending;
    assert(cached.has('/carequest/_next/static/chunks/app.js'), 'initial JS must be precached');
    assert(cached.has('/carequest/_next/static/chunks/style.css'), 'initial CSS must be precached');
    assert(!cached.has('/carequest/_next/static/chunks/app.js.map'));
    assert(skipWaiting);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a missing static asset prevents activation of a partial cache', async () => {
  const handlers = {};
  let activated = false;
  const source = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8')
    .replace('const STATIC_PRECACHE = [];', 'const STATIC_PRECACHE = ["/carequest/_next/static/missing.js"];');
  vm.runInNewContext(source, {
    self: { addEventListener: (type, cb) => handlers[type] = cb, skipWaiting: async () => { activated = true; } },
    caches: { open: async () => ({ add: async () => {}, addAll: async () => { throw new Error('404'); } }) },
  });
  let pending;
  handlers.install({ waitUntil: promise => pending = promise });
  await assert.rejects(pending, /404/);
  assert.equal(activated, false);
});
