import React from 'react';
import Icon from '../common/Icon';
import { SelectPill } from '../common/Input';
import { ASPECTS, LAYOUTS } from '../../templates/data';

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
        onChange={(v) => setPref({ layout: v })}
        options={LAYOUTS.map((l) => ({ value: l.id, label: `${l.label} — ${l.name}` }))}
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
    </div>
  );
}
