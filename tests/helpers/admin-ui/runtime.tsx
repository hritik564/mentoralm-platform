import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type RouterState = { pathname: string; search: string };
const RouterContext = createContext<RouterState>({
  pathname: '/admin',
  search: '',
});
const routeEvent = 'mentoralm-offline-fixture-navigation';

export function navigate(href: string, replace = false) {
  const target = new URL(href, location.href);
  if (
    target.origin !== location.origin ||
    !target.pathname.startsWith('/admin')
  ) {
    throw Error(
      'Offline fixture navigation rejected an external/non-Admin destination.',
    );
  }
  if (replace) history.replaceState({}, '', target);
  else history.pushState({}, '', target);
  window.dispatchEvent(new Event(routeEvent));
}

export function FixtureRouter({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RouterState>(() => ({
    pathname: location.pathname,
    search: location.search,
  }));
  useEffect(() => {
    const update = () =>
      setState({ pathname: location.pathname, search: location.search });
    window.addEventListener(routeEvent, update);
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener(routeEvent, update);
      window.removeEventListener('popstate', update);
    };
  }, []);
  return (
    <RouterContext.Provider value={state}>{children}</RouterContext.Provider>
  );
}

export function usePathname() {
  return useContext(RouterContext).pathname;
}
export function useSearchParams() {
  const { search } = useContext(RouterContext);
  return useMemo(() => new URLSearchParams(search), [search]);
}
export function useRouter() {
  return useMemo(
    () => ({
      push: (href: string) => navigate(href),
      replace: (href: string) => navigate(href, true),
      refresh: () => window.dispatchEvent(new Event(routeEvent)),
      back: () => history.back(),
      forward: () => history.forward(),
      prefetch: async () => {},
    }),
    [],
  );
}
