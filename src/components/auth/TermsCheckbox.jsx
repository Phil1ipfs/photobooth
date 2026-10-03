import React from 'react';

/** Required "I agree to the Terms and Privacy Policy" checkbox (links open in a new tab). */
export default function TermsCheckbox({ checked, onChange, error, id = 'terms-agree' }) {
  return (
    <div className={`terms-check${error ? ' has-error' : ''}`}>
      <label className="check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          required
        />
        <span>
          I agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer">
            Terms of Use
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
          , and consent to PhotoBooth processing my account details and the photo strips I choose to save, as
          described there.
        </span>
      </label>
      {error && (
        <div className="field-error" id={`${id}-error`} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
