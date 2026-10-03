// Which templates / layouts / filters are Premium. This is the single source of
// truth for the UI; the database copy (supabase/migrations/002_freemium.sql →
// public.premium_catalog) enforces the same list server-side, and a unit test
// (src/config/catalog.test.js) fails if the two ever drift apart.

// 16 free templates keep the free tier genuinely useful; the rest are Premium.
export const PREMIUM_TEMPLATE_IDS = [
  'magazine',
  'y2k-chrome',
  'dreamy-lavender',
  'black-red',
  'arcade',
  'newspaper',
  'valentines',
  'summer-vibes',
  'aesthetic-collage',
  'neon-y2k',
  'galaxy-dreams',
  'vintage-postcard',
  'bw-doodle',
  'space-adventure',
  'retro-90s',
  'floral-elegance',
  'comic-pop',
  'butterfly',
  'music-player',
  'kawaii-animals',
  'newspaper-style',
  'valentine-red',
  'birthday-pastel',
  'friends-blue',
];

// Classic 1 × 4 and 1 × 2 strips are free; grids and editorial layouts are Premium.
export const PREMIUM_LAYOUT_IDS = ['grid-2x2', 'grid-2x3', 'grid-3x2', 'feature-4', 'panels-4'];

// User-selectable photo filters (applied on top of / instead of the template's own).
export const FILTERS = [
  { id: 'auto', label: 'Template default', tier: 'free' },
  { id: 'none', label: 'Original', tier: 'free' },
  { id: 'noir', label: 'Black & white', tier: 'free' },
  { id: 'sepia', label: 'Sepia', tier: 'premium' },
  { id: 'warm', label: 'Warm glow', tier: 'premium' },
  { id: 'cool', label: 'Cool tone', tier: 'premium' },
  { id: 'fade', label: 'Faded film', tier: 'premium' },
];

/**
 * Feature catalogue. `tier` is the minimum plan; the plans in plans.js list the
 * features they include. Add a feature here, gate it with canUseFeature().
 */
export const FEATURES = {
  premium_templates: { label: 'All Premium templates', tier: 'premium' },
  advanced_layouts: { label: 'Advanced layouts (2 × 2, 2 × 3, 3 × 2, editorial, comic)', tier: 'premium' },
  premium_filters: { label: 'Premium photo filters', tier: 'premium' },
  hd_export: { label: 'HD downloads (2× resolution)', tier: 'premium' },
  admin_analytics: { label: 'Admin analytics', tier: 'admin' },
};

export const templateTier = (templateOrId) =>
  PREMIUM_TEMPLATE_IDS.includes(typeof templateOrId === 'string' ? templateOrId : templateOrId?.id) ? 'premium' : 'free';

export const layoutTier = (layoutOrId) =>
  PREMIUM_LAYOUT_IDS.includes(typeof layoutOrId === 'string' ? layoutOrId : layoutOrId?.id) ? 'premium' : 'free';

export const filterTier = (id) => FILTERS.find((f) => f.id === id)?.tier || 'free';
