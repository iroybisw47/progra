import { PageSkeleton } from "@/components/page-skeleton";

// Onboarding was the only main route with no loading.tsx, so it fell back to
// the root app/loading.tsx — a wordless, slowly-rotating mark over padding
// reserved for a bottom nav this route hides. See the `onboarding` variant.
//
// NOTE: this only covers SOFT navigation (Settings → Replay onboarding). The
// sign-in path is a server redirect() from app/page.tsx, which makes the
// browser fetch a second document — there is no React boundary to fall back to
// there, so this does nothing for a cold open.
export default function Loading() {
  return <PageSkeleton title="Welcome" variant="onboarding" />;
}
