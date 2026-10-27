// Inert next/navigation for the design bundle (wired by .design-sync/tsconfig.json).
// usePathname returns "/" — the Progress tab — so BottomNav highlights a tab and
// WhatsNewModal (which only opens on "/") renders. Previews that need another
// tab pass BottomNav's own `activePath` prop instead.
const noop = () => {};

export function usePathname(): string {
  return "/";
}

export function useRouter() {
  return { push: noop, replace: noop, back: noop, forward: noop, refresh: noop, prefetch: noop };
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useParams(): Record<string, string> {
  return {};
}

export function redirect(): never {
  throw new Error("redirect() is unavailable in the design bundle");
}

export function notFound(): never {
  throw new Error("notFound() is unavailable in the design bundle");
}
