import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import type { OnboardingV3Services } from "@/lib/onboarding-v3-services";
import { uwWriteNeeded } from "@/lib/onboarding-v3-uw";
import type { UwProfileInput } from "@/lib/uw";

const SAVE_FAILED = "Couldn't save your UW details. Check your connection and try again.";

// The UW answer's write, held by the shell like useGoalWrites: the sheet's No
// tile and its CTA trigger it through there. Its own module, so the sheet
// (uw-sheet.tsx) can load as a lazy chunk while this stays in the shell's.
//
// One save at a time. An exit writes only what differs from the baseline
// (uwWriteNeeded): `stored`, a replayer's answer as the profile held it at
// page load (uwStoredInput), so leaving the Yes path as they found it writes
// nothing, or null for anyone else, whose first exit then stores the answer.
// Each save becomes the baseline, so Back and on again writes nothing twice. A
// failure toasts (setUwProfile's errors are already generic), unless `quiet`,
// and calls `onFailed`, so the caller can put the tiles back. `save` returns
// false when one was already in flight and this one was ignored, in which
// case neither callback runs.
//
// `inCohort`: whether the profile is in the cohort as far as this page knows,
// at load and then after each save. While it's false, a No has nothing to
// take away, so the shell lets a failed one through rather than hold someone
// on the welcome. While it's true, the tiles say what No clears (uwTilesNote).
export function useUwWrites(services: OnboardingV3Services, stored: UwProfileInput | null) {
  const [saving, startSaving] = useTransition();
  const writing = useRef(false);
  const written = useRef<UwProfileInput | null>(stored);
  const [inCohort, setInCohort] = useState(stored?.isUw === true);

  function save(
    input: UwProfileInput,
    onSaved: () => void,
    { onFailed, quiet = false }: { onFailed?: () => void; quiet?: boolean } = {}
  ): boolean {
    if (writing.current) return false;
    if (!uwWriteNeeded(written.current, input)) {
      onSaved();
      return true;
    }
    writing.current = true;
    startSaving(async () => {
      try {
        const r = await services.setUwProfile(input);
        if ("error" in r) {
          if (!quiet) toast.error(r.error);
          onFailed?.();
          return;
        }
        written.current = input;
        setInCohort(input.isUw);
        onSaved();
      } catch {
        if (!quiet) toast.error(SAVE_FAILED);
        onFailed?.();
      } finally {
        writing.current = false;
      }
    });
    return true;
  }

  return { saving, inCohort, save };
}
