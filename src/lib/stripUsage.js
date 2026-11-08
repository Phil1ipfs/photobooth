import { FREE_STRIPS_PER_MODE, FREE_TEMPLATE_IDS } from '../config/catalog';

export const stripMediaType = (mode) => mode === 'live' || mode === 'live_strip' ? 'live_strip' : 'photo';

// Return only the selected design/type's allowance. Exhausting photos must not
// block Live Strips or another design. Unknown usage stays unknown until loaded.
export function templateStripUsage(usage, templateId, mode) {
  if (!usage || !FREE_TEMPLATE_IDS.includes(templateId)) return null;
  const bucket = usage.templates?.[templateId]?.[stripMediaType(mode)];
  if (!bucket) return null;
  return { used: bucket.used, limit: bucket.limit ?? FREE_STRIPS_PER_MODE, unlimited: !!usage.unlimited };
}
