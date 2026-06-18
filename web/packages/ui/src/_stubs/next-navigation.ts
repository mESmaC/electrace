// Browser-safe stand-in for `next/navigation`, aliased in tsup for the design-system bundle.
// Design components (AuthForm) call useRouter()/useSearchParams() at render but only navigate on
// user actions (submit), which don't happen in a static preview — so no-op router + empty params.
const noop = () => {};
export function useRouter() {
  return { push: noop, replace: noop, back: noop, forward: noop, refresh: noop, prefetch: noop };
}
export function usePathname() { return "/"; }
export function useSearchParams() { return new URLSearchParams(); }
export function useParams() { return {} as Record<string, string>; }
export const redirect = noop;
export const notFound = noop;
