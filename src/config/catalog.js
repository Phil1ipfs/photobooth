// Which templates / layouts / filters are Premium. This is the single source of
// truth for the UI; the database copy (public.premium_catalog — latest seed in
// supabase/migrations/012_illustrated_halloween_templates.sql) enforces the same list
// server-side, and a unit test (src/config/catalog.test.js) fails if they drift.

// Free accounts can take and download classic still photos.
export const FREE_TEMPLATE_IDS = ['classic'];

export const PREMIUM_TEMPLATE_IDS = [
  'love-hearts',
  'polaroid',
  'vintage-film',
  'pink-pop',
  'magazine',
  'cat',
  'y2k-chrome',
  'dreamy-lavender',
  'retro-70s',
  'scrapbook',
  'black-red',
  'arcade',
  'mono',
  'cute-pastel',
  'korean',
  'newspaper',
  'valentines',
  'birthday',
  'friends',
  'modern-minimal',
  'film-frame',
  'summer-vibes',
  'aesthetic-collage',
  'neon-y2k',
  'cherry-pop',
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
  // Halloween collection
  'happy-halloween',
  'spooky-love',
  'boo-together',
  'pumpkin-night',
  'vampire-date',
  'haunted-mansion',
  'trick-or-treat',
  'witching-hour',
  'skeleton-couple',
  'blood-moon',
  // Illustrated Halloween collection
  'ghost-garden',
  'black-cat-club',
  'haunted-arcade',
  'potion-post',
  'candy-coven',
  'midnight-masquerade',
  'ghost-train',
  'stitched-sweethearts',
  'crystal-visions',
  'haunted-seaside',
  // LDR
  'miles-apart',
];

// Classic 1 × 4 and 1 × 2 strips are free; grids and editorial layouts are Premium.
export const PREMIUM_LAYOUT_IDS = ['grid-2x2', 'grid-2x3', 'grid-3x2', 'feature-4', 'panels-4'];

// User-selectable photo filters (applied on top of / instead of the template's own).
export const FILTERS = [
  { id: 'auto', label: 'Template default', tier: 'premium' },
  { id: 'none', label: 'Original', tier: 'free' },
  { id: 'noir', label: 'Black & white', tier: 'premium' },
  { id: 'sepia', label: 'Sepia', tier: 'premium' },
  { id: 'warm', label: 'Warm glow', tier: 'premium' },
  { id: 'cool', label: 'Cool tone', tier: 'premium' },
  { id: 'fade', label: 'Faded film', tier: 'premium' },
];

// Free accounts can create this many photostrips in total (Premium/admin: unlimited).
// Enforced in the database by supabase/migrations/005_strip_creation_limit.sql;
// deleting strips doesn't give the allowance back.
export const FREE_STRIP_LIMIT = 2;

/**
 * Feature catalogue. `tier` is the minimum plan; the plans in plans.js list the
 * features they include. Add a feature here, gate it with canUseFeature().
 */
export const FEATURES = {
  live_strips: { label: 'Live Strips', tier: 'premium' },
  ldr_rooms: { label: 'LDR Photobooth', tier: 'premium' },
  music_library: { label: 'Music library', tier: 'premium' },
  cloud_save: { label: 'Save to My Photos', tier: 'premium' },
  share_print: { label: 'Share and print', tier: 'premium' },
  favorites: { label: 'Favorites', tier: 'premium' },
  premium_templates: { label: 'All Premium templates', tier: 'premium' },
  advanced_layouts: { label: 'Advanced layouts (2 × 2, 2 × 3, 3 × 2, editorial, comic)', tier: 'premium' },
  premium_filters: { label: 'Premium photo filters', tier: 'premium' },
  hd_export: { label: 'HD downloads (2× resolution)', tier: 'premium' },
  unlimited_strips: { label: 'Unlimited photostrips', tier: 'premium' },
  admin_analytics: { label: 'Admin analytics', tier: 'admin' },
};

export const templateTier = (templateOrId) =>
  PREMIUM_TEMPLATE_IDS.includes(typeof templateOrId === 'string' ? templateOrId : templateOrId?.id) ? 'premium' : 'free';

export const layoutTier = (layoutOrId) =>
  PREMIUM_LAYOUT_IDS.includes(typeof layoutOrId === 'string' ? layoutOrId : layoutOrId?.id) ? 'premium' : 'free';

export const filterTier = (id) => FILTERS.find((f) => f.id === id)?.tier || 'free';
