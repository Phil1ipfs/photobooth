import React, { useState } from 'react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Button from '../components/common/Button';
import Icon from '../components/common/Icon';
import { Sparkle, DoodleHeart } from '../components/common/misc';
import PremiumBadge from '../components/billing/PremiumBadge';
import { useAuth } from '../context/AuthContext';
import { useEntitlements } from '../context/EntitlementsContext';
import { useToast } from '../context/ToastContext';
import { useRouter } from '../lib/router';
import { TIERS, enabledPlans, formatPrice } from '../config/plans';
import { FREE_STRIP_LIMIT, PREMIUM_LAYOUT_IDS, PREMIUM_TEMPLATE_IDS } from '../config/catalog';
import { LAYOUTS, TEMPLATES } from '../templates/data';
import { startCheckout } from '../lib/billing';
import { describePlan } from '../lib/entitlements';
import { track } from '../lib/analytics';

const freeTemplates = TEMPLATES.length - PREMIUM_TEMPLATE_IDS.length;
const COMPARE = [
  { label: 'Live photobooth, countdown & flash', free: true, premium: true },
  { label: 'Download, share & print strips', free: true, premium: true },
  { label: 'Photostrips you can create', free: `${FREE_STRIP_LIMIT} in total`, premium: 'Unlimited' },
  { label: 'Templates', free: `${freeTemplates}`, premium: `All ${TEMPLATES.length}` },
  { label: 'Layouts', free: '1 × 4, 1 × 2', premium: `All ${LAYOUTS.length}` },
  { label: 'Photo filters', free: 'Original, B&W', premium: '+ Sepia, Warm, Cool, Faded' },
  { label: 'HD downloads (2× resolution)', free: false, premium: true },
  { label: 'New template collections', free: false, premium: true },
  { label: 'Ads', free: 'Never', premium: 'Never' },
];

const FAQ = [
  ['Does it renew automatically?', 'No. Each payment gives you 1 year of Premium — there’s no subscription to cancel and you’re never charged again unless you choose to. Renew from Settings → Billing during the last 30 days of your year; the new year is added on top of the time you have left.'],
  ['Is the free plan really free?', `Yes — no card needed. Your free account includes ${FREE_STRIP_LIMIT} photostrips with the full photobooth, ${freeTemplates} templates and classic layouts — download, save and share them as often as you like.`],
  ['How can I pay?', 'Pay with GCash, Maya or a debit/credit card on PayMongo’s secure checkout page. PhotoBooth never sees or stores your payment details.'],
  ['What happens to Premium strips if I downgrade?', 'Everything you’ve already saved stays in My Photos. You just can’t create new strips with Premium templates or layouts until you upgrade again.'],
];

export default function Pricing() {
  const { user } = useAuth();
  const { entitlements, isPremium } = useEntitlements();
  const { navigate } = useRouter();
  const toast = useToast();
  const plans = enabledPlans();
  const [planId, setPlanId] = useState(plans[0]?.id);
  const [busy, setBusy] = useState(false);
  const plan = plans.find((p) => p.id === planId) || plans[0];

  const upgrade = async () => {
    track('upgrade_clicked', { source: 'pricing', plan: plan.id });
    if (!user) {
      navigate(`/signup?next=${encodeURIComponent('/pricing')}`);
      return;
    }
    setBusy(true);
    try {
      await startCheckout(plan.id);
    } catch (err) {
      toast.error('Couldn’t start checkout', err.message);
      setBusy(false);
    }
  };


  return (
    <div className="landing">
      <Header />
      <main id="main" className="pricing container page-enter">
        <section className="pricing-hero">
          <Sparkle size={16} className="deco-twinkle" style={{ left: '18%', top: 10 }} />
          <DoodleHeart size={36} className="pricing-heart" />
          <span className="eyebrow">Pricing</span>
          <h1>
            Simple plans for <span className="script accent">beautiful</span> memories
          </h1>
          <p className="muted">Make your first 2 photostrips free. Upgrade for unlimited strips and every look.</p>
          {plans.length > 1 && (
            <div className="segmented pricing-toggle" role="group" aria-label="Billing interval">
              {plans.map((p) => (
                <button key={p.id} aria-pressed={p.id === planId} onClick={() => setPlanId(p.id)}>
                  {p.interval === 'year' ? 'Yearly' : 'Monthly'}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="plan-grid" aria-label="Plans">
          <article className="plan-card card">
            <h2>{TIERS.free.name}</h2>
            <p className="plan-tagline muted">{TIERS.free.tagline}</p>
            <p className="plan-price">
              <strong>{formatPrice(0)}</strong>
              <span>forever</span>
            </p>
            <ul className="plan-features">
              {TIERS.free.features.map((f) => (
                <li key={f}>
                  <Icon name="check" size={16} strokeWidth={2.4} />
                  {f}
                </li>
              ))}
            </ul>
            {user && !isPremium ? (
              <Button variant="outline" block disabled>
                Current plan
              </Button>
            ) : (
              <Button variant="outline" block to="/booth">
                Start for free
              </Button>
            )}
          </article>

          <article className="plan-card plan-card-premium card">
            <span className="plan-ribbon">
              <Icon name="sparkle" size={12} /> Most loved
            </span>
            <h2>
              {TIERS.premium.name} <PremiumBadge compact />
            </h2>
            <p className="plan-tagline">{TIERS.premium.tagline}</p>
            {plan && (
              <p className="plan-price">
                <strong>{formatPrice(plan.price)}</strong>
                <span>/ {plan.interval}</span>
              </p>
            )}
            <ul className="plan-features">
              {TIERS.premium.features.map((f) => (
                <li key={f}>
                  <Icon name="check" size={16} strokeWidth={2.4} />
                  {f}
                </li>
              ))}
            </ul>
            {isPremium ? (
              <>
                <Button block variant="soft" icon="sparkle" onClick={upgrade} loading={busy}>
                  Extend {plan.period}
                </Button>
                <p className="plan-note">{describePlan(entitlements).detail}</p>
              </>
            ) : (
              <>
                <Button block size="lg" icon="sparkle" onClick={upgrade} loading={busy} className="plan-cta">
                  {user ? 'Upgrade to Premium' : 'Sign up & upgrade'}
                </Button>
                <p className="plan-note">One-time payment · No auto-renewal · GCash, Maya or card via PayMongo</p>
              </>
            )}
          </article>
        </section>

        <section className="compare card" aria-labelledby="compare-title">
          <h2 id="compare-title">Compare plans</h2>
          <div className="compare-table" role="table">
            <div className="compare-row compare-head" role="row">
              <span role="columnheader">Feature</span>
              <span role="columnheader">Free</span>
              <span role="columnheader">Premium</span>
            </div>
            {COMPARE.map((r) => (
              <div className="compare-row" role="row" key={r.label}>
                <span role="cell">{r.label}</span>
                {[r.free, r.premium].map((v, i) => (
                  <span role="cell" key={i} className={i === 1 ? 'is-premium' : ''}>
                    {v === true ? (
                      <Icon name="check" size={18} strokeWidth={2.4} title="Included" />
                    ) : v === false ? (
                      <span className="muted" aria-label="Not included">—</span>
                    ) : (
                      v
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="muted compare-note">
            {PREMIUM_TEMPLATE_IDS.length} Premium templates · {PREMIUM_LAYOUT_IDS.length} Premium layouts · prices in Philippine pesos.
          </p>
        </section>

        <section className="faq" aria-labelledby="faq-title">
          <h2 id="faq-title" className="section-heading">
            Questions
          </h2>
          {FAQ.map(([q, a]) => (
            <details key={q} className="faq-item card">
              <summary>
                {q}
                <Icon name="chevron-down" size={18} />
              </summary>
              <p className="muted">{a}</p>
            </details>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
