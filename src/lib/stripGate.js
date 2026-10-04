// Photostrip creation allowance (Free: 2 strips, lifetime — Premium/admin: unlimited).
//
// The database is the authority (supabase/migrations/005_strip_creation_limit.sql):
//   claim_strip_creation    — atomically reserves a creation, or refuses at the limit
//   finalize_strip_creation — locks a creation to the composition on first export
//   strips insert trigger   — a saved strip must reference a finalized creation
// This module only sequences those calls for the booth. Nothing here is trusted:
// tampering with it (or with sessionStorage) can't produce an extra creation.
import { isSupabaseConfigured, supabase } from './supabase';

/** Supabase RPC calls (injectable for tests). */
export const stripApi = {
  async usage() {
    const { data, error } = await supabase.rpc('get_my_strip_usage');
    if (error) throw new Error(error.message);
    return data;
  },
  async claim(meta) {
    const { data, error } = await supabase.rpc('claim_strip_creation', { p_template: meta?.template || null, p_layout: meta?.layout || null });
    if (error) throw new Error(error.message || 'Could not start a new strip.');
    return data;
  },
  async finalize(id, signature, meta) {
    const { data, error } = await supabase.rpc('finalize_strip_creation', {
      p_id: id,
      p_signature: signature,
      p_template: meta?.template || null,
      p_layout: meta?.layout || null,
    });
    if (error) throw new Error(error.message || 'Could not verify this strip.');
    return data;
  },
};

export const stripApiAvailable = () => isSupabaseConfigured;

/** Fast 53-bit string hash (cyrb53) → hex. Used to fingerprint a composition. */
function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/**
 * Fingerprint of everything that makes a strip look different: the photos and
 * the template / layout / filter / aspect. Same fingerprint = same photostrip.
 */
export function compositionSignature({ photos, templateId, layoutId, filter, aspect }) {
  const photoPart = (photos || []).map((p) => (p ? hash53(p) : '-')).join('.');
  return `v1:${hash53([photoPart, templateId, layoutId, filter || 'auto', aspect].join('|'))}`;
}

/**
 * Sequences claim/finalize calls for one booth. State = the current creation
 * ({ id, signature }) — persisted by the caller so a refresh doesn't use a new one.
 * Every operation is queued, so rapid clicks share one server call.
 */
export function createStripGate({ api = stripApi, initial = null, onChange = () => {}, onUsage = () => {} } = {}) {
  let state = { id: initial?.id || null, signature: initial?.signature || null };
  let queue = Promise.resolve();

  const set = (next) => {
    state = next;
    onChange({ ...state });
  };
  const run = (fn) => {
    const p = queue.then(fn, fn);
    queue = p.catch(() => {});
    return p;
  };
  const usageOf = (r) => ({ used: r.used, limit: r.limit, unlimited: !!r.unlimited });

  async function claim(meta) {
    const r = await api.claim(meta);
    if (r && typeof r.used === 'number') onUsage(usageOf(r));
    if (!r?.allowed) return { allowed: false, reason: r?.reason || 'strip_limit_reached' };
    set({ id: r.id, signature: null });
    return { allowed: true, created: true };
  }

  return {
    get state() {
      return { ...state };
    },
    /** True while a creation is reserved for the strip in progress. */
    get active() {
      return !!state.id;
    },

    /**
     * A new strip is starting. An unexported (draft) creation is reused — clearing
     * photos before exporting never costs an extra strip.
     */
    beginStrip() {
      if (state.id && state.signature) set({ id: null, signature: null });
    },

    /** Make sure a creation is reserved before taking photos for a strip. */
    ensureCreation(meta) {
      return run(async () => (state.id ? { allowed: true, created: false } : claim(meta)));
    },

    /**
     * Authorise an export of `signature`. Same composition → allowed without a new
     * creation; a changed composition after an export → needs a new creation.
     * Resolves to { allowed, created, reason? }.
     */
    authorizeExport(signature, meta) {
      return run(async () => {
        if (state.id && state.signature === signature) return { allowed: true, created: false };
        // An unexported (draft) creation is locked to this composition on first export.
        if (state.id && !state.signature && (await api.finalize(state.id, signature, meta))?.allowed) {
          set({ id: state.id, signature });
          return { allowed: true, created: false };
        }
        // No creation yet, one already locked to a DIFFERENT composition, or an unknown id:
        // this is a new photostrip and needs its own creation — on every plan. (Each
        // creation can be saved once — strips_creation_unique — so it must never be reused
        // for another design, even where the plan is unlimited.) If that's refused, keep
        // the current one (it can still be re-exported).
        const previous = state;
        set({ id: null, signature: null });
        const c = await claim(meta);
        if (!c.allowed) {
          set(previous);
          return c;
        }
        if ((await api.finalize(state.id, signature, meta))?.allowed) {
          set({ id: state.id, signature });
          return { allowed: true, created: true };
        }
        set(previous);
        return { allowed: false, reason: 'strip_limit_reached' };
      });
    },

    /** Forget the creation (e.g. signed out). */
    reset() {
      set({ id: null, signature: null });
    },
  };
}
