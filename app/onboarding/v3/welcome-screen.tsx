"use client";

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
  type Ref,
} from "react";
import { toast } from "sonner";

import { overlapPx } from "@/lib/keyboard";
import { TRAVEL, itemStyle, transition, type ItemPhase } from "@/lib/motion";
import {
  identityWrites,
  saveIdentity,
  welcomeHandle,
  welcomeShown,
  type SavedIdentity,
  type WelcomeShown,
} from "@/lib/onboarding-v3-identity";
import type { ActionResult, OnboardingV3Services } from "@/lib/onboarding-v3-services";
import { normalizeUsername } from "@/lib/social/username";

import { WelcomeStep } from "../steps/welcome-step";
import { aboveCta } from "./frame";
import { KeyboardFit, layoutTopWithin, type CtaEdge } from "./keyboard-fit";

// Screen 1 (OWNER-FIX-3, 2026-10-11): the welcome screen that's live today,
// v2's own WelcomeStep, mounted unchanged apart from the rainbow app icon in
// place of the navy mark. Name (optional), username with v2's check, and the
// photo through the step's own AvatarPicker. Its Continue is the v3 CTA,
// which saves the identity and then raises the UW sheet over this screen
// (UW on) or goes to Screen 2 (onboarding-client-v3.tsx says which).
//
// The owner, verbatim: "can you keep the original welcome to Progra screen,
// but then once complete pops up the UW student thing, and then has the new
// onboarding from there on out".

// The welcome's name and handle, kept here rather than in the wizard shell so
// a keystroke re-renders this screen alone: the shell mounts all six, and
// re-rendering them on every letter typed is felt on a slower phone. The
// shell hears only what it acts on (WelcomeScreen's onValid and onSaving),
// and the rest of the wizard shows what Continue last saved (welcomeShown).
// v2's rules (lib/onboarding-v3-identity.ts, welcomeHandle): the name is
// optional, and the handle only has to pass checkUsername. Whether it's free
// is setUsername's call on Continue: a handle someone else holds comes back
// "taken", which shows under Username, as v2 shows its other handle errors,
// until the field changes.
function useWelcomeIdentity({
  initialDisplayName,
  initialUsername,
  usernameDraft,
  services,
  onTaken,
}: {
  initialDisplayName: string | null;
  initialUsername: string;
  // Dev preview only: the username field opens with this typed, unsaved.
  usernameDraft?: string;
  services: OnboardingV3Services;
  // setUsername refused the handle as taken.
  onTaken: () => void;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [username, setUsername] = useState(usernameDraft ?? initialUsername);
  // The handle setUsername last refused as taken (welcomeHandle's `taken`).
  const [taken, setTaken] = useState<string | null>(null);
  const handle = welcomeHandle(username, taken);

  // What's already saved, so Continue writes only what changed, and nothing
  // twice after Back (identityWrites). A ref: it's read and written only in
  // the save, never rendered.
  const saved = useRef<SavedIdentity>({
    username: normalizeUsername(initialUsername),
    displayName: initialDisplayName?.trim() || null,
  });
  const [saving, startSaving] = useTransition();
  // Set the moment Continue is pressed, before `saving` has rendered. While
  // it's set the fields ignore edits, so what was written is what Continue
  // moves on with: typing during the round-trip would otherwise carry an
  // unsaved name or handle onto later screens.
  const writing = useRef(false);

  // The welcome's Continue, once welcomeContinue has let it through: the
  // writes identityWrites asks for (saveIdentity), then `onSaved` with what
  // was saved. A taken handle shows under Username and stays; any other
  // failure toasts and stays, keeping whatever did save. Returns false, and
  // calls nothing, when a save is already in flight or the handle isn't valid.
  function save(onSaved: (shown: WelcomeShown) => void): boolean {
    if (writing.current || !handle.valid) return false;
    const shown = welcomeShown(displayName, username);
    const writes = identityWrites(saved.current, { username, name: displayName });
    if (writes.username === null && writes.displayName === undefined) {
      onSaved(shown);
      return true;
    }
    writing.current = true;
    startSaving(async () => {
      try {
        const out = await saveIdentity(services, saved.current, writes);
        saved.current = out.saved;
        if (out.kind === "taken") {
          setTaken(out.handle);
          onTaken();
        }
        else if (out.kind === "failed") toast.error(out.error);
        else onSaved(shown);
      } finally {
        writing.current = false;
      }
    });
    return true;
  }

  return {
    displayName,
    username,
    handle,
    saving,
    setDisplayName(v: string) {
      if (!writing.current) setDisplayName(v);
    },
    setUsername(v: string) {
      if (!writing.current) setUsername(v);
    },
    save,
  };
}

// The photo the welcome's AvatarPicker shows, and the two writes it's handed
// in place of the real actions (its upload and Remove go through `services`,
// so the dev preview writes nothing). The server's URL is the truth: at `/`
// the upload's revalidation sends a new one. Until it does (always on
// /onboarding, which that revalidation doesn't reach, and in the preview),
// the square just uploaded shows from a local object URL, or nothing after a
// Remove. A local photo stands only against the server URL it replaced, so a
// newer one from the server wins.
export function useWelcomePhoto(avatarUrl: string | null, services: OnboardingV3Services) {
  const [local, setLocal] = useState<{ base: string | null; url: string | null } | null>(null);
  const server = useRef(avatarUrl);
  useEffect(() => {
    server.current = avatarUrl;
  }, [avatarUrl]);
  // Every object URL made here, revoked when the wizard goes.
  const objectUrls = useRef<string[]>([]);
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  return {
    photoUrl: local && local.base === avatarUrl ? local.url : avatarUrl,
    async upload(formData: FormData): Promise<ActionResult> {
      const r = await services.uploadAvatar(formData);
      const square = formData.get("photo");
      if ("ok" in r && square instanceof Blob) {
        const url = URL.createObjectURL(square);
        objectUrls.current.push(url);
        setLocal({ base: server.current, url });
      }
      return r;
    },
    async remove(): Promise<ActionResult> {
      const r = await services.removeAvatar();
      if ("ok" in r) setLocal({ base: server.current, url: null });
      return r;
    },
  };
}

export type WelcomePhoto = ReturnType<typeof useWelcomePhoto>;

// Room kept between the fields and the CTA riding on the keyboard, and
// between the CTA and where what's under it is cut off.
const CTA_CLEARANCE_PX = 16;
const CLIP_GAP_PX = 8;

// The shell's Continue, through the screen's ref: saves what changed, then
// `onSaved` with what the rest of the wizard shows of it.
export type WelcomeScreenHandle = {
  save: (onSaved: (shown: WelcomeShown) => void) => boolean;
};

export function WelcomeScreen({
  ref,
  phase,
  reduced,
  services,
  photo,
  initialDisplayName,
  initialUsername,
  usernameDraft,
  onValid,
  onSaving,
  onSubmit,
}: {
  ref?: Ref<WelcomeScreenHandle>;
  phase: ItemPhase;
  reduced: boolean;
  services: OnboardingV3Services;
  photo: WelcomePhoto;
  initialDisplayName: string | null;
  initialUsername: string;
  // Dev preview only: the username field opens with this typed, unsaved.
  usernameDraft?: string;
  // For the shell's CTA: whether the handle lets Continue through, and
  // whether a save is in flight, each as it changes, which a keystroke mostly
  // doesn't.
  onValid: (valid: boolean) => void;
  onSaving: (saving: boolean) => void;
  // Return in the username field, with the handle valid: the shell's Continue.
  onSubmit: () => void;
}) {
  // A taken handle disables Continue, so a keyboard user who pressed it would
  // be left with focus nowhere: it goes to the field instead, which reads out
  // the error with it (WelcomeStep).
  const usernameRef = useRef<HTMLInputElement>(null);
  const welcome = useWelcomeIdentity({
    initialDisplayName,
    initialUsername,
    usernameDraft,
    services,
    onTaken: () => usernameRef.current?.focus({ preventScroll: true }),
  });
  const valid = welcome.handle.valid;
  useEffect(() => onValid(valid), [valid, onValid]);
  useEffect(() => onSaving(welcome.saving), [welcome.saving, onSaving]);
  useImperativeHandle(ref, () => ({ save: welcome.save }));

  const active = phase === "active";
  const scrollRef = useRef<HTMLDivElement>(null);

  // The keyboard fit. v2's welcome scrolled with the page, so iOS kept the
  // field being typed in above the keyboard. Here the shell is fixed and the
  // CTA rides on the keyboard, so with it up the screen moves itself instead,
  // on the keyboard's own easing (TRAVEL.keyboard): up by just enough to
  // clear the last text field (the handle) above the lifted CTA, so the name
  // and the handle both stay in reach whichever is being typed in, and never
  // by more than puts the focused one's top at the screen's top. What's left
  // under the CTA (the photo row) is cut off at its edge until the keyboard
  // goes, as Screen 2 fades its own (nothing sits under the lifted CTA, and a
  // near miss on Continue can't open the photo picker). Measured from layout,
  // so the move never feeds back into it. Re-run as focus moves between the
  // fields, with the CTA's edge as last measured.
  const [fitted, setFitted] = useState({ shift: 0, clip: 0 });
  const lastCta = useRef<CtaEdge | null>(null);
  function fit(cta: CtaEdge | null) {
    const scroller = scrollRef.current;
    const section = scroller?.parentElement;
    const field = document.activeElement;
    const fields = scroller?.querySelectorAll<HTMLInputElement>("input:not([type='file'])");
    const last = fields?.[fields.length - 1];
    const rest = () => setFitted((f) => (f.shift === 0 && f.clip === 0 ? f : { shift: 0, clip: 0 }));
    if (
      !active ||
      !cta ||
      cta.lift <= 0 ||
      !Number.isFinite(cta.top) ||
      !scroller ||
      !section ||
      !last ||
      !(field instanceof HTMLInputElement) ||
      !scroller.contains(field)
    ) {
      rest();
      return;
    }
    const at = (el: HTMLElement) => layoutTopWithin(el, section) - scroller.scrollTop;
    const top = at(field);
    const lastTop = at(last);
    if (!Number.isFinite(top) || !Number.isFinite(lastTop)) {
      rest();
      return;
    }
    const shift = Math.min(
      overlapPx(lastTop + last.offsetHeight, cta.top, CTA_CLEARANCE_PX),
      Math.max(0, top)
    );
    const clip = Math.max(0, Math.round(scroller.clientHeight - (cta.top - CLIP_GAP_PX)));
    setFitted((f) => (f.shift === shift && f.clip === clip ? f : { shift, clip }));
  }

  return (
    <>
      <KeyboardFit
        onMeasure={(cta) => {
          lastCta.current = cta;
          fit(cta);
        }}
      />
      {/* v2's <main> around the step: 24px gutters, at most 420px, scrolling
          if a short screen can't fit it, and ending 14px over the CTA as v2's
          footer did, so the step's own centring puts it where v2 does. */}
      <div
        ref={scrollRef}
        onFocus={() => fit(lastCta.current)}
        className="absolute inset-x-0 top-0 overflow-x-hidden overflow-y-auto overscroll-contain px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          bottom: aboveCta(14),
          clipPath: fitted.clip > 0 ? `inset(0 0 ${fitted.clip}px 0)` : undefined,
        }}
      >
        {/* The wizard's item motion, as one item: it exits up as Screen 2
            comes, and comes back down on Back. The step's own rise-ins and
            typed headline play once, as the page loads. */}
        <div
          className="mx-auto flex min-h-full w-full max-w-[420px] flex-col"
          style={itemStyle(phase, 0, reduced)}
        >
          <div
            className="flex flex-1 flex-col"
            style={{
              transform: fitted.shift > 0 ? `translateY(${-fitted.shift}px)` : "none",
              transition: transition(reduced ? TRAVEL.keyboard.reduced : TRAVEL.keyboard.normal),
            }}
          >
            <WelcomeStep
              logo="rainbow"
              displayName={welcome.displayName}
              onDisplayName={welcome.setDisplayName}
              username={welcome.username}
              onUsername={welcome.setUsername}
              usernameValid={welcome.handle.valid}
              usernameError={welcome.handle.error}
              initialDisplayName={initialDisplayName}
              initialUsername={initialUsername}
              avatarUrl={photo.photoUrl}
              uploadAvatar={photo.upload}
              removeAvatar={photo.remove}
              onSubmit={onSubmit}
              pending={welcome.saving}
              usernameRef={usernameRef}
            />
          </div>
        </div>
      </div>
    </>
  );
}
