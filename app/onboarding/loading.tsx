import { PageSkeleton } from "@/components/page-skeleton";
import { ONBOARDING_V3, ONBOARDING_V4 } from "@/lib/flags";

import { WizardSkeleton } from "./v3/wizard-skeleton";

// Onboarding was the only main route with no loading.tsx, so it fell back to
// the root app/loading.tsx — a wordless, slowly-rotating mark over padding
// reserved for a bottom nav this route hides. See the `onboarding` variant.
//
// NOTE: this only covers SOFT navigation (Settings → Replay onboarding). The
// sign-in path is a server redirect() from app/page.tsx, which makes the
// browser fetch a second document — there is no React boundary to fall back to
// there, so this does nothing for a cold open.
//
// With ONBOARDING_V3 on, the skeleton is v3's Screen 1 frame instead, so
// Replay doesn't flash v2's layout before the v3 wizard paints. v4 opens on
// the same welcome in the same frame, so it uses it too.
export default function Loading() {
  if (ONBOARDING_V3 || ONBOARDING_V4) return <WizardSkeleton />;
  return <PageSkeleton title="Welcome" variant="onboarding" />;
}
