import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Accessible modal dialog with focus trap, Esc to close and fade/scale animation. */
export default function Modal({ open, onClose, title, description, children, width, className = '', hideClose }) {
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);
  const dialogRef = useRef(null);
  const lastFocus = useRef(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
    } else if (render) {
      setClosing(true);
      const t = setTimeout(() => setRender(false), 200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, render]);

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const el = dialogRef.current?.querySelector('[data-autofocus]') || dialogRef.current?.querySelector(FOCUSABLE);
      el?.focus();
    }, 30);
    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
      if (e.key === 'Tab' && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus?.();
    };
  }, [open]);

  if (!render) return null;

  return createPortal(
    <div
      className={`modal-backdrop${closing ? ' closing' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        style={width ? { '--modal-w': typeof width === 'number' ? `${width}px` : width } : undefined}
      >
        {!hideClose && (
          <button className="icon-btn icon-btn-sm modal-close" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={16} />
          </button>
        )}
        {title && (
          <h2 className="modal-title" id={titleId}>
            {title}
          </h2>
        )}
        {description && (
          <p className="muted" id={descId}>
            {description}
          </p>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
