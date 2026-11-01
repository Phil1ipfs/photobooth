import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEntitlements } from '../../context/EntitlementsContext';
import { getCheckoutEligibility } from '../../config/checkoutPolicy';

export default function useCheckoutEligibility() {
  const { ready: authReady } = useAuth();
  const { entitlements, ready, loading } = useEntitlements();
  const [now, setNow] = useState(Date.now);
  const result = getCheckoutEligibility({
    tier: entitlements.plan,
    currentPeriodEnd: entitlements.status === 'active' ? entitlements.currentPeriodEnd : null,
  }, now);
  const pending = !authReady || !ready || loading;

  useEffect(() => {
    if (!result.opensAt) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(2147483647, Math.max(0, Date.parse(result.opensAt) - Date.now())));
    return () => clearTimeout(timer);
  }, [result.opensAt, now]);

  const message = result.reason === 'early'
    ? `Renewal opens on ${new Date(result.opensAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}. Your current Premium time stays active.`
    : result.reason === 'unknown' ? 'Your renewal details are unavailable. Refresh your account before trying again.' : null;
  return { ...result, allowed: !pending && result.allowed, pending, message };
}
