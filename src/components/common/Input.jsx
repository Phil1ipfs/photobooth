import React, { useId, useState } from 'react';
import Icon from './Icon';

export default function Input({ label, icon, error, hint, className = '', hideLabel, type = 'text', trailing, id, ...rest }) {
  const autoId = useId();
  const inputId = id || autoId;
  const describedBy = [error && `${inputId}-error`, hint && `${inputId}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field${error ? ' has-error' : ''} ${className}`}>
      {label && (
        <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'field-label'}>
          {label}
        </label>
      )}
      <div className="input-wrap">
        {icon && <Icon name={icon} size={18} className="input-icon" />}
        <input
          id={inputId}
          type={type}
          className="input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {trailing && <span className="input-trailing">{trailing}</span>}
      </div>
      {error && (
        <div className="field-error" id={`${inputId}-error`}>
          <Icon name="alert" size={14} />
          {error}
        </div>
      )}
      {hint && !error && (
        <div className="field-hint" id={`${inputId}-hint`}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <Input
      {...props}
      type={show ? 'text' : 'password'}
      icon={props.icon ?? 'lock'}
      trailing={
        <button
          type="button"
          className="icon-btn icon-btn-sm icon-btn-plain"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          <Icon name={show ? 'eye-off' : 'eye'} size={18} />
        </button>
      }
    />
  );
}

export function SearchInput({ label = 'Search', className = '', ...rest }) {
  return (
    <div className={`search-input ${className}`} role="search">
      <Icon name="search" size={17} />
      <input type="search" className="input" aria-label={label} {...rest} />
    </div>
  );
}

export function SelectPill({ icon, label, value, onChange, options, className = '', disabled }) {
  return (
    <label className={`select-pill ${className}`}>
      <span className="sr-only">{label}</span>
      {icon && <Icon name={icon} size={18} className="lead" />}
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={16} className="chev" />
    </label>
  );
}
