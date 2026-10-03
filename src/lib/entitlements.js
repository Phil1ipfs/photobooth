// Centralised entitlement checks. The UI asks these functions — never
// `plan === 'premium'` directly — so adding a plan only touches config.
//
// `ent` is the object returned by the database (get_my_entitlements RPC), e.g.
// { plan: 'free' | 'premium' | 'admin', status, currentPeriodEnd, cancelAtPeriodEnd }.
// The database is the source of truth; these helpers only decide what to *show*.
// Saving Premium templates/layouts is also enforced server-side.
import { LEVELS } from '../config/plans';
import { FEATURES, filterTier, layoutTier, templateTier } from '../config/catalog';

export const FREE_ENTITLEMENTS = Object.freeze({ plan: 'free', status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false });

const level = (ent) => LEVELS[ent?.plan] ?? LEVELS.free;
const allows = (ent, tier) => level(ent) >= (LEVELS[tier] ?? LEVELS.free);

export const isPremium = (ent) => allows(ent, 'premium');
export const isAdmin = (ent) => ent?.plan === 'admin';

export const canUseFeature = (ent, feature) => {
  const def = FEATURES[feature];
  return def ? allows(ent, def.tier) : false;
};

export const canUseTemplate = (ent, template) => allows(ent, templateTier(template));
export const canUseLayout = (ent, layout) => allows(ent, layoutTier(layout));
export const canUseFilter = (ent, filterId) => allows(ent, filterTier(filterId));

/** Human-friendly description of the user's billing state. */
export function describePlan(ent) {
  if (isAdmin(ent)) return { label: 'Admin', detail: 'Full access to every feature.' };
  if (!isPremium(ent)) return { label: 'Free', detail: 'Upgrade any time to unlock Premium.' };
  const end = ent.currentPeriodEnd ? new Date(ent.currentPeriodEnd) : null;
  const date = end ? end.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  if (ent.cancelAtPeriodEnd) return { label: 'Premium', detail: date ? `Premium access continues until ${date}.` : 'Cancels at period end.' };
  if (ent.status === 'past_due') return { label: 'Premium', detail: 'Your last payment failed — please update your payment method.' };
  return { label: 'Premium', detail: date ? `Renews on ${date}.` : 'Active.' };
}
