import React from 'react';
import Icon from '../common/Icon';
import { SelectPill } from '../common/Input';
import { ASPECTS, LAYOUTS } from '../../templates/data';
import { FILTERS } from '../../config/catalog';
import { useEntitlements } from '../../context/EntitlementsContext';

export const COUNTDOWNS = [
  { value: '0', label: 'No timer' },
  { value: '3', label: '3s' },
  { value: '5', label: '5s' },
  { value: '10', label: '10s' },
];

const MODES = [
  { value: 'auto', label: 'Auto (fill all)' },
  { value: 'single', label: 'One shot' },
];

export default function CameraControls({ devices, cameraId, onCamera, prefs, setPref, disabled }) {
  const { canUseLayout, canUseFilter, openUpgrade } = useEntitlements();
  const lockTag = (locked) => (locked ? '  ✦ Premium' : '');

  // Locked choices stay visible (with a Premium tag) but open the upgrade modal.
  const chooseLayout = (id) => {
    const l = LAYOUTS.find((x) => x.id === id);
    if (!canUseLayout(l)) {
      openUpgrade({
        feature: 'advanced_layouts',
        title: `Unlock the ${l.label} ${l.name} layout`,
        description: 'Grid, editorial and comic layouts are part of Premium. The classic 1 × 4 and 1 × 2 strips are always free.',
      });
      return;
    }
    setPref({ layout: id });
  };
  const chooseFilter = (id) => {
    if (!canUseFilter(id)) {
      const f = FILTERS.find((x) => x.id === id);
      openUpgrade({
        feature: 'premium_filters',
        title: `Unlock the ${f.label} filter`,
        description: 'Sepia, Warm glow, Cool tone and Faded film are Premium filters. Original and Black & white are free.',
      });
      return;
    }
    setPref({ filter: id });
  };
  const cameraOptions = devices.length
    ? devices.map((d) => ({ value: d.id, label: d.label }))
    : [{ value: '', label: 'Camera' }];

  return (
    <div className="cam-controls" role="group" aria-label="Camera settings">
      <SelectPill
        className="layout-select"
        icon="templates"
        label="Photo layout"
        value={prefs.layout}
        onChange={chooseLayout}
        options={LAYOUTS.map((l) => ({ value: l.id, label: `${l.label} — ${l.name}${lockTag(!canUseLayout(l))}` }))}
        disabled={disabled}
      />
      <SelectPill
        className="cam-select"
        icon="camera"
        label="Camera"
        value={cameraId}
        onChange={onCamera}
        options={cameraOptions}
        disabled={disabled || devices.length < 2}
      />
      <SelectPill
        icon="timer"
        label="Countdown"
        value={String(prefs.countdown)}
        onChange={(v) => setPref({ countdown: Number(v) })}
        options={COUNTDOWNS}
        disabled={disabled}
      />
      <button
        type="button"
        className="select-pill toggle-pill"
        aria-pressed={prefs.flash}
        onClick={() => setPref({ flash: !prefs.flash })}
        disabled={disabled}
      >
        <Icon name={prefs.flash ? 'zap' : 'zap-off'} size={18} className="lead" />
        <span>Flash {prefs.flash ? 'on' : 'off'}</span>
      </button>
      <SelectPill
        icon="aspect"
        label="Aspect ratio"
        value={prefs.aspect}
        onChange={(v) => setPref({ aspect: v })}
        options={ASPECTS.map((a) => ({ value: a.id, label: a.label }))}
        disabled={disabled}
      />
      <SelectPill
        icon="layers"
        label="Capture mode"
        value={prefs.captureMode}
        onChange={(v) => setPref({ captureMode: v })}
        options={MODES}
        disabled={disabled}
      />
      <SelectPill
        className="filter-select"
        icon="wand"
        label="Photo filter"
        value={prefs.filter || 'auto'}
        onChange={chooseFilter}
        options={FILTERS.map((f) => ({ value: f.id, label: `${f.label}${lockTag(!canUseFilter(f.id))}` }))}
      />
    </div>
  );
}
