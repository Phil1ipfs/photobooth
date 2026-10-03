// Booth-side sequencing of the Free photostrip allowance. The fake API below mirrors
// the SQL functions in supabase/migrations/005_strip_creation_limit.sql.
import { compositionSignature, createStripGate } from './stripGate';

function fakeDb({ tier = 'free', used = 0, limit = 2, delay = 0 } = {}) {
  const db = { tier, limit, creations: new Map(), claims: 0, finalizes: 0 };
  const freeUsed = () => [...db.creations.values()].filter((c) => c.tier === 'free').length + used;
  const sleep = () => new Promise((r) => setTimeout(r, delay));
  db.api = {
    async claim() {
      db.claims += 1;
      await sleep();
      const n = freeUsed();
      if (db.tier === 'free' && n >= db.limit) return { allowed: false, reason: 'strip_limit_reached', used: n, limit: db.limit, unlimited: false };
      const id = `c${db.creations.size + 1}`;
      db.creations.set(id, { tier: db.tier, signature: null });
      return { allowed: true, id, used: freeUsed(), limit: db.limit, unlimited: db.tier !== 'free' };
    },
    async finalize(id, sig) {
      db.finalizes += 1;
      await sleep();
      const c = db.creations.get(id);
      if (!c) return { allowed: false, reason: 'unknown_creation' };
      if (!c.signature) {
        c.signature = sig;
        return { allowed: true };
      }
      return c.signature === sig || db.tier !== 'free' ? { allowed: true } : { allowed: false, reason: 'composition_changed' };
    },
  };
  db.freeUsed = freeUsed;
  return db;
}

const sig = (photos, templateId = 'classic', extra = {}) =>
  compositionSignature({ photos, templateId, layoutId: 'strip-4', filter: 'auto', aspect: 4 / 3, ...extra });
const A = ['data:a1', 'data:a2', 'data:a3', 'data:a4'];
const B = ['data:b1', 'data:b2', 'data:b3', 'data:b4'];
const C = ['data:c1', 'data:c2', 'data:c3', 'data:c4'];

test('signature changes with photos, template, layout, filter and aspect', () => {
  const base = sig(A);
  expect(sig(A)).toBe(base);
  expect(sig(['data:a1', 'data:a2', 'data:a3', 'data:XX'])).not.toBe(base);
  expect(sig(A, 'retro')).not.toBe(base);
  expect(sig(A, 'classic', { layoutId: 'grid-2x2' })).not.toBe(base);
  expect(sig(A, 'classic', { filter: 'noir' })).not.toBe(base);
  expect(sig(A, 'classic', { aspect: 1 })).not.toBe(base);
  expect(base.length).toBeGreaterThanOrEqual(8);
});

test('free: strip #1 and #2 allowed, #3 blocked', async () => {
  const db = fakeDb();
  const gate = createStripGate({ api: db.api });
  // strip 1: capture, download twice, save
  expect((await gate.ensureCreation()).allowed).toBe(true);
  expect((await gate.authorizeExport(sig(A))).allowed).toBe(true);
  expect((await gate.authorizeExport(sig(A))).allowed).toBe(true); // re-download: same strip
  // strip 2
  gate.beginStrip();
  expect((await gate.ensureCreation()).allowed).toBe(true);
  expect((await gate.authorizeExport(sig(B))).allowed).toBe(true);
  // strip 3: blocked before any photo is taken
  gate.beginStrip();
  const third = await gate.ensureCreation();
  expect(third).toEqual({ allowed: false, reason: 'strip_limit_reached' });
  expect(db.freeUsed()).toBe(2);
});

test('free: switching template/layout after exporting counts as a new strip', async () => {
  const db = fakeDb();
  const gate = createStripGate({ api: db.api });
  await gate.ensureCreation();
  await gate.authorizeExport(sig(A, 'classic'));
  const r = await gate.authorizeExport(sig(A, 'retro')); // same photos, other template
  expect(r).toEqual({ allowed: true, created: true });
  expect(db.freeUsed()).toBe(2);
  // a third look is refused
  expect((await gate.authorizeExport(sig(A, 'polaroid'))).allowed).toBe(false);
  // …but re-downloading the last allowed one still works
  expect((await gate.authorizeExport(sig(A, 'retro'))).allowed).toBe(true);
});

test('free: edits before the first export are free (draft), and clearing reuses the draft', async () => {
  const db = fakeDb();
  const gate = createStripGate({ api: db.api });
  await gate.ensureCreation();
  gate.beginStrip(); // cleared photos before exporting
  await gate.ensureCreation();
  expect(db.claims).toBe(1);
  expect((await gate.authorizeExport(sig(C, 'retro'))).allowed).toBe(true); // changed template before export
  expect(db.freeUsed()).toBe(1);
});

test('rapid clicks never create more than the allowance', async () => {
  const db = fakeDb({ delay: 5 });
  const gate = createStripGate({ api: db.api });
  const results = await Promise.all(Array.from({ length: 10 }, () => gate.ensureCreation()));
  expect(results.every((r) => r.allowed)).toBe(true);
  expect(db.claims).toBe(1); // one shared claim
  const exports = await Promise.all([sig(A), sig(B), sig(C), sig(A, 'x'), sig(B, 'y')].map((s) => gate.authorizeExport(s)));
  expect(exports.filter((r) => r.allowed).length).toBeLessThanOrEqual(2);
  expect(db.freeUsed()).toBe(2);
});

test('a refresh restores the creation instead of claiming another', async () => {
  const db = fakeDb();
  const first = createStripGate({ api: db.api });
  await first.ensureCreation();
  await first.authorizeExport(sig(A));
  const restored = createStripGate({ api: db.api, initial: first.state });
  expect((await restored.authorizeExport(sig(A))).allowed).toBe(true);
  expect(db.claims).toBe(1);
});

test('a forged creation id is useless: the server refuses it and a real claim is needed', async () => {
  const db = fakeDb({ used: 2 });
  const gate = createStripGate({ api: db.api, initial: { id: 'forged', signature: null } });
  expect((await gate.authorizeExport(sig(A))).allowed).toBe(false);
  expect(db.creations.size).toBe(0);
});

test('premium and admin: unlimited', async () => {
  for (const tier of ['premium', 'admin']) {
    const db = fakeDb({ tier, used: 2 });
    const gate = createStripGate({ api: db.api });
    for (let i = 0; i < 6; i++) {
      gate.beginStrip();
      expect((await gate.ensureCreation()).allowed).toBe(true);
      expect((await gate.authorizeExport(sig([`p${i}`]))).allowed).toBe(true);
    }
    expect((await gate.authorizeExport(sig(['other'], 'retro'))).allowed).toBe(true);
  }
});

test('usage updates are reported from claims', async () => {
  const db = fakeDb();
  const seen = [];
  const gate = createStripGate({ api: db.api, onUsage: (u) => seen.push(u) });
  await gate.ensureCreation();
  expect(seen.at(-1)).toEqual({ used: 1, limit: 2, unlimited: false });
});
