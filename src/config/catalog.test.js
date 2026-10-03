// Keeps the Premium catalogue in the app and in the database migration in sync,
// and checks every Premium id refers to a real template / layout.
import fs from 'fs';
import path from 'path';
import { FREE_TEMPLATE_IDS, PREMIUM_LAYOUT_IDS, PREMIUM_TEMPLATE_IDS, FILTERS, FEATURES, FREE_STRIP_LIMIT } from './catalog';
import { DEFAULT_TEMPLATE_ID, LAYOUTS, TEMPLATES } from '../templates/data';
import { canUseFeature, canUseLayout, canUseTemplate, canUseFilter, isPremium, isAdmin } from '../lib/entitlements';

// Each migration that seeds premium_catalog replaces a kind wholesale, so the
// latest migration that seeds a kind is what the database holds.
const migrationsDir = path.join(__dirname, '../../supabase/migrations');
const migrations = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort().map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf8'));
// Only the seed rows (indented `  ('kind', 'id')` lines), not the CHECK constraint.
const seedIn = (sql, kind) => [...sql.matchAll(new RegExp(`^\\s+\\('${kind}', '([a-z0-9-]+)'\\)`, 'gm'))].map((m) => m[1]);
const seeded = (kind) => (migrations.map((sql) => seedIn(sql, kind)).filter((ids) => ids.length).pop() || []).sort();

test('database premium_catalog matches src/config/catalog.js', () => {
  expect(seeded('template')).toEqual([...PREMIUM_TEMPLATE_IDS].sort());
  expect(seeded('layout')).toEqual([...PREMIUM_LAYOUT_IDS].sort());
});

test('premium ids refer to real templates and layouts', () => {
  const templateIds = TEMPLATES.map((t) => t.id);
  const layoutIds = LAYOUTS.map((l) => l.id);
  PREMIUM_TEMPLATE_IDS.forEach((id) => expect(templateIds).toContain(id));
  PREMIUM_LAYOUT_IDS.forEach((id) => expect(layoutIds).toContain(id));
});

test('free tier stays genuinely usable', () => {
  const free = TEMPLATES.filter((t) => !PREMIUM_TEMPLATE_IDS.includes(t.id));
  expect(free.map((t) => t.id).sort()).toEqual([...FREE_TEMPLATE_IDS].sort());
  expect(FREE_TEMPLATE_IDS).toContain(DEFAULT_TEMPLATE_ID); // the booth falls back to it
  // every template is exactly one of free / premium
  expect(new Set(PREMIUM_TEMPLATE_IDS).size).toBe(PREMIUM_TEMPLATE_IDS.length);
  expect(free.length + PREMIUM_TEMPLATE_IDS.length).toBe(TEMPLATES.length);
  // Every free template must work in a free layout (no free template forces a Premium layout)
  free.forEach((t) => expect(PREMIUM_LAYOUT_IDS).not.toContain(t.layoutId));
  expect(LAYOUTS.some((l) => !PREMIUM_LAYOUT_IDS.includes(l.id))).toBe(true);
});

test('entitlements: free vs premium vs admin', () => {
  const free = { plan: 'free' };
  const premium = { plan: 'premium' };
  const admin = { plan: 'admin' };
  const premiumTpl = TEMPLATES.find((t) => PREMIUM_TEMPLATE_IDS.includes(t.id));
  const freeTpl = TEMPLATES.find((t) => !PREMIUM_TEMPLATE_IDS.includes(t.id));

  expect(canUseTemplate(free, freeTpl)).toBe(true);
  expect(canUseTemplate(free, premiumTpl)).toBe(false);
  expect(canUseTemplate(premium, premiumTpl)).toBe(true);
  expect(canUseLayout(free, 'strip-1x4')).toBe(true);
  expect(canUseLayout(free, 'grid-2x2')).toBe(false);
  expect(canUseLayout(premium, 'grid-2x2')).toBe(true);
  expect(canUseFilter(free, 'noir')).toBe(true);
  expect(canUseFilter(free, 'sepia')).toBe(false);
  expect(canUseFeature(free, 'hd_export')).toBe(false);
  expect(canUseFeature(premium, 'hd_export')).toBe(true);
  expect(canUseFeature(premium, 'admin_analytics')).toBe(false);
  expect(canUseFeature(admin, 'admin_analytics')).toBe(true);
  expect(isPremium(admin)).toBe(true);
  expect(isAdmin(premium)).toBe(false);
  expect(canUseFeature(undefined, 'hd_export')).toBe(false); // logged out = free
  expect(Object.keys(FEATURES).length).toBeGreaterThan(0);
  expect(FILTERS.some((f) => f.tier === 'free')).toBe(true);
});

test('free photostrip limit matches the database', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/005_strip_creation_limit.sql'), 'utf8');
  expect(Number(migration.match(/free_limit constant int := (\d+);/)[1])).toBe(FREE_STRIP_LIMIT);
  expect(Number(migration.match(/'limit', (\d+),/)[1])).toBe(FREE_STRIP_LIMIT);
  expect(canUseFeature({ plan: 'free' }, 'unlimited_strips')).toBe(false);
  expect(canUseFeature({ plan: 'premium' }, 'unlimited_strips')).toBe(true);
  expect(canUseFeature({ plan: 'admin' }, 'unlimited_strips')).toBe(true);
});
