// Version of the Terms of Use + Privacy Policy that users agree to. Bump it (and the
// "Last updated" dates in src/pages/Static.jsx) when either document changes
// materially — every account is then asked to agree again. Must fit 32 chars
// (supabase/migrations/006_terms_consent.sql).
export const TERMS_VERSION = '2026-10-04';

// Set when someone ticks the box on Sign Up and then continues with Google, so the
// agreement is recorded as soon as they come back signed in.
export const PENDING_TERMS_KEY = 'pb:terms-pending';
