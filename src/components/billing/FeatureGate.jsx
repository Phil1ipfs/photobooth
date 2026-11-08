import React from 'react';
import AppLayout, { PageHeader } from '../layout/AppLayout';
import Button from '../common/Button';
import PremiumBadge from './PremiumBadge';
import { FEATURES } from '../../config/catalog';
import { useEntitlements } from '../../context/EntitlementsContext';

/** Keep protected pages unmounted until the account's actual plan is known. */
export default function FeatureGate({ feature, children }) {
  const { ready, canUseFeature, openUpgrade } = useEntitlements();
  if (!ready) return <div className="route-loading" role="status" aria-label="Checking your plan"><span className="btn-spinner" /></div>;
  if (canUseFeature(feature)) return children;
  const label = FEATURES[feature].label;
  return (
    <AppLayout>
      <PageHeader title={label} subtitle="Available with PhotoBooth Premium." />
      <section className="card feature-locked" aria-label={`${label} requires Premium`}>
        <PremiumBadge locked />
        <h2>Unlock {label}</h2>
        <p className="muted">Free accounts include five designs with photo and Live Strip downloads. Upgrade to use {label} and every other Premium feature.</p>
        <Button icon="sparkle" onClick={() => openUpgrade({ feature, title: `Unlock ${label}`, description: `${label} is included with Premium for ₱99/month (30 days).` })}>Upgrade to Premium</Button>
        <Button variant="ghost" to="/booth">Try a free design</Button>
      </section>
    </AppLayout>
  );
}
