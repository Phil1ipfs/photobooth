// Minimal history-based router (avoids adding react-router for a handful of routes).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext(null);

const readLocation = () => ({
  path: window.location.pathname.replace(/\/+$/, '') || '/',
  search: window.location.search,
  hash: window.location.hash,
});

const scrollToHash = (hash, smooth = true) => {
  if (!hash) return false;
  const el = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!el) return false;
  el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  return true;
};

export function RouterProvider({ children }) {
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // On first load, honour a hash in the URL once the page has rendered.
  useEffect(() => {
    if (window.location.hash) setTimeout(() => scrollToHash(window.location.hash, false), 80);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    const url = new URL(to, window.location.href);
    const next = url.pathname + url.search + url.hash;
    const samePage = url.pathname === window.location.pathname && url.search === window.location.search;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', next);
    setLocation(readLocation());
    if (url.hash) {
      setTimeout(() => scrollToHash(url.hash), samePage ? 0 : 60);
    } else {
      // Same page (e.g. clicking the logo on Home): glide back to the top.
      window.scrollTo({ top: 0, behavior: samePage ? 'smooth' : 'auto' });
    }
  }, []);

  const value = useMemo(
    () => ({ ...location, query: new URLSearchParams(location.search), navigate }),
    [location, navigate]
  );

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export const useRouter = () => useContext(RouterContext);

export const Link = React.forwardRef(function Link({ to, onClick, replace, children, ...rest }, ref) {
  const { navigate } = useRouter();
  const handleClick = (e) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      rest.target === '_blank'
    ) {
      return;
    }
    e.preventDefault();
    navigate(to, { replace });
  };
  return (
    <a ref={ref} href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
});

export function Redirect({ to }) {
  const { navigate } = useRouter();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
}
