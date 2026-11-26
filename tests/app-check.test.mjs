import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkApp} from '../lib/app-check.mjs';

test('app check separates offline, login, application errors and iframe restrictions', async () => {
  assert.equal((await checkApp()).state, 'unconfigured');
  assert.equal((await checkApp('http://localhost:3000', async () => {throw Error('offline');})).state, 'offline');
  for (const status of [302, 401, 403]) {
    assert.equal((await checkApp('http://localhost:3000', async () => new Response('', {status}))).state, 'login');
  }
  assert.equal((await checkApp('http://localhost:3000', async () => new Response('', {status:500}))).state, 'error');
  for (const headers of [{'x-frame-options':'SAMEORIGIN'}, {'content-security-policy':"frame-ancestors 'none'"}]) {
    assert.equal((await checkApp('http://localhost:3000', async () => new Response('', {headers}))).state, 'frame-blocked');
  }
  const result = await checkApp('http://localhost:3000', async (url, options) => {
    assert.equal(url, 'http://localhost:3000');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers, undefined);
    assert.ok(options.signal);
    return new Response('<html>App</html>');
  });
  assert.equal(result.state, 'reachable');
  assert.match(result.message, /실제 데이터는 앱에서 확인/);
});
