import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const checkout = process.argv[2] || fileURLToPath(new URL('../',import.meta.url));
const source = fs.readFileSync(path.join(checkout, 'web/client.js'), 'utf8');
const startup = source.indexOf("document.querySelector('#rules-open')");
assert.ok(startup > 0, 'client startup boundary must exist');
const session = { code: 'ABCDEF', token: 'a'.repeat(64) };
const room = (phase, revision) => ({
  code: session.code, phase, revision, serverNow: Date.now(), gameId: 'game1', roundId: null,
  players: [{ id: 'p1', name: 'Test', score: 0 }], hostId: 'p1', submittedCount: 0,
  mine: { id: 'p1', isHost: false, submitted: false, vote: null, prompt: 'Test prompt' },
});
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const response = data => ({ ok: true, status: 200, json: async () => data });

function harness() {
  const storage = new Map(), calls = [], timers = new Map();
  let timerId = 0, handle = async () => response({ room: room('lobby', 1) });
  const element = () => ({ innerHTML: '', textContent: '', hidden: false, disabled: false,
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, insertAdjacentHTML() {} });
  const nodes = new Map();
  const context = { Date, Map, Set, AbortController, console,
    document: { querySelector(k) { if (!nodes.has(k)) nodes.set(k, element()); return nodes.get(k); } },
    window: { scrollTo() {} }, location: { origin: 'https://test.invalid' },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    setTimeout: (f, ms) => { timers.set(++timerId, { f, ms }); return timerId; },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => { const call = { url, body: options.body ? JSON.parse(options.body) : null }; calls.push(call); return handle(call); },
  };
  vm.createContext(context);
  // Only expose existing entry points in memory; the checkout remains untouched.
  vm.runInContext(source.slice(0, startup) + 'globalThis.clientTest={setSession,apply,action,poll,restore};})();', context);
  return { client: context.clientTest, storage, calls, handle: f => { handle = f; } };
}

const tests = [
  ['poll recovery permits submit while original generation response is delayed', async () => {
    const h = harness(), start = deferred();
    h.client.setSession(session); h.client.apply({ room: room('lobby', 1) });
    h.handle(c => c.body?.type === 'start' ? start.promise : Promise.resolve(response({ room: room('writing', 2) })));
    const pending = h.client.action('start');
    await h.client.poll();
    await h.client.action('submit', { answer: '12345678' });
    const submitted = h.calls.some(c => c.body?.type === 'submit');
    start.resolve(response({ room: room('writing', 2) })); await pending;
    assert.ok(submitted, 'writing was recovered by GET, but submit POST was suppressed');
  }],
  ['older generation completion cannot unlock a newer pending reset', async () => {
    const h = harness(), start = deferred(), reset = deferred();
    h.client.setSession(session); h.client.apply({ room: room('lobby', 1) });
    h.handle(c => c.body?.type === 'start' ? start.promise : c.body?.type === 'reset' ? reset.promise : Promise.resolve(response({ room: room('preparing', 2) })));
    const first = h.client.action('start'); await h.client.poll();
    const second = h.client.action('reset');
    assert.ok(h.calls.some(c => c.body?.type === 'reset'), 'reset must remain available during preparation');
    start.resolve(response({ room: room('preparing', 2) })); await first;
    await h.client.action('extend');
    const leaked = h.calls.some(c => c.body?.type === 'extend');
    reset.resolve(response({ room: room('lobby', 3) })); await second;
    assert.equal(leaked, false, 'old start finally unlocked a newer reset; a second mutation escaped');
  }],
  ['transient initial restore followed by poll recovery persists session', async () => {
    const h = harness(); h.handle(async () => { throw new Error('temporary network failure'); });
    await h.client.restore(session);
    h.handle(async () => response({ room: room('lobby', 1) })); await h.client.poll();
    assert.deepEqual(JSON.parse(h.storage.get('ningen-session-ABCDEF') || 'null'), session, 'recovered session was not persisted for reload');
    assert.equal(JSON.parse(h.storage.get('ningen-last-room') || 'null'), session.code);
  }],
];
let failed = 0;
for (const [name, run] of tests) {
  try { await run(); console.log('PASS:', name); }
  catch (error) { failed++; console.error('FAIL:', name, '\n ', error.message); }
}
console.log(`${tests.length - failed}/${tests.length} client resilience checks passed`);
process.exitCode = failed ? 1 : 0;
