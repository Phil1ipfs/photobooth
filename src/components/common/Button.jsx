import React from 'react';
import { Link } from '../../lib/router';
import Icon from './Icon';

/**
 * Button / link-button.
 * variant: primary | outline | outline-primary | soft | ghost | danger
 * size: sm | md | lg | xl
 */
const Button = React.forwardRef(function Button(
  { variant = 'primary', size = 'md', block, icon, iconRight, loading, to, className = '', children, disabled, ...rest },
  ref
) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size !== 'md' && `btn-${size}`,
    block && 'btn-block',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  const iconSize = size === 'sm' ? 16 : size === 'xl' ? 22 : 18;
  const content = (
    <>
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} size={iconSize} className={iconRight === 'arrow-right' ? 'btn-arrow' : undefined} />}
    </>
  );
  if (to) {
    return (
      <Link ref={ref} to={to} className={cls} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button ref={ref} type="button" className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

export default Button;
