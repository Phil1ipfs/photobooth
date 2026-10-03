// The signed-in user's plan, loaded from the database (get_my_entitlements RPC —
// computed from PayMongo-verified payments; the browser can't change it).
// Also owns the Premium upgrade modal so any component can open it.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import * as ent from '../lib/entitlements';
import { track } from '../lib/analytics';
import UpgradeModal from '../components/billing/UpgradeModal';
import { stripApi } from '../lib/stripGate';

const EntitlementsContext = createContext(null);

const fromRow = (row) => ({
  plan: row?.plan || 'free',
  billingPlan: row?.billingPlan || null,
  provider: row?.provider || null,
  status: row?.status || null,
  currentPeriodEnd: row?.currentPeriodEnd || null,
  cancelAtPeriodEnd: !!row?.cancelAtPeriodEnd,
  hasBillingAccount: !!row?.hasBillingAccount,
});

export function EntitlementsProvider({ children }) {
  const { user } = useAuth();
  const [entitlements, setEntitlements] = useState(ent.FREE_ENTITLEMENTS);
  const [loading, setLoading] = useState(false);
  // Which user the current entitlements belong to (null = signed out). Until this
  // matches the signed-in user, callers must not act on "free" (it may be stale).
  const [loadedFor, setLoadedFor] = useState(undefined);
  const ready = loadedFor === (user?.id || null);
  const [upgrade, setUpgrade] = useState(null); // { feature, title, description } | null
  // Free photostrip allowance from the database: { used, limit, unlimited } | null (unknown / signed out).
  const [stripUsage, setStripUsage] = useState(null);

  const refresh = useCallback(async () => {
    if (!user || !isSupabaseConfigured) {
      setEntitlements(ent.FREE_ENTITLEMENTS);
      setStripUsage(null);
      setLoadedFor(user?.id || null);
      return ent.FREE_ENTITLEMENTS;
    }
    setLoading(true);
    try {
      stripApi.usage().then(setStripUsage, () => {}); // in parallel; best-effort display only
      const { data, error } = await supabase.rpc('get_my_entitlements');
      const next = error ? ent.FREE_ENTITLEMENTS : fromRow(data);
      setEntitlements(next);
      return next;
    } finally {
      setLoading(false);
      setLoadedFor(user.id);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Returning from PayMongo checkout in another tab → re-check.
  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [refresh]);

  /** Show the upgrade modal for a locked feature. */
  const openUpgrade = useCallback((info = {}) => {
    track('premium_gate_shown', { feature: info.feature || 'premium' });
    setUpgrade(info);
  }, []);

  const value = useMemo(
    () => ({
      entitlements,
      loading,
      ready,
      refresh,
      openUpgrade,
      isPremium: ent.isPremium(entitlements),
      isAdmin: ent.isAdmin(entitlements),
      canUseTemplate: (t) => ent.canUseTemplate(entitlements, t),
      canUseLayout: (l) => ent.canUseLayout(entitlements, l),
      canUseFilter: (f) => ent.canUseFilter(entitlements, f),
      canUseFeature: (f) => ent.canUseFeature(entitlements, f),
      stripUsage,
      setStripUsage,
    }),
    [entitlements, loading, ready, refresh, openUpgrade, stripUsage]
  );

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
      <UpgradeModal info={upgrade} onClose={() => setUpgrade(null)} />
    </EntitlementsContext.Provider>
  );
}

export const useEntitlements = () => useContext(EntitlementsContext);
