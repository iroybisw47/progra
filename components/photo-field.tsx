"use client";

import { useEffect, useRef, useState } from "react";

import { downscaleImage } from "@/lib/images/downscale";

// An inline "attach a photo" form row that hands the picked File back to its
// parent WITHOUT uploading. That's the whole reason it exists separately from
// components/session-photo-step.tsx: that one uploads immediately and needs a
// sessionId, but a past session doesn't exist yet while you're filling the form
// in. The parent uploads after it has an id.
//
// NO `capture` ATTRIBUTE, deliberately. session-photo-step.tsx sets
// capture="environment", which sends iOS straight to the rear camera and hides
// the Photo Library option entirely — correct for a photo taken while a session
// runs, wrong for one you already took. Omitting it gives the full iOS sheet:
// Photo Library, Take Photo, Choose File. Same as components/avatar-picker.tsx.
//
// Not a Dialog: it renders inside an open form. Two Base UI dialogs stack
// backdrops and fight over the focus trap.
// The field owns the preview; the PARENT owns the File (it needs it at save
// time). So there's no `file` prop — passing one back in would just duplicate
// state and risk the two drifting.
export function PhotoField({
  onChange,
  disabled,
}: {
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Mirrors `preview` so the unmount cleanup can revoke the live URL without
  // the effect depending on it (and so re-running on every pick).
  const urlRef = useRef<string | null>(null);

  // The object URL is created and revoked in the handlers below, never in an
  // effect — setState inside an effect body is a lint error in this repo, and
  // deriving it from `file` would mean exactly that. This effect only cleans
  // up the last URL when the field goes away, and sets no state.
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function setPicked(next: File | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next ? URL.createObjectURL(next) : null;
    setPreview(urlRef.current);
    onChange(next);
  }

  async function handleFile(picked: File | undefined) {
    if (!picked) return;
    setBusy(true);
    try {
      // Canvas re-encode to JPEG at 1600px. Bandwidth, but it also normalises
      // an iPhone HEIC into something sharp can definitely read, and keeps the
      // file under the server's 8 MB cap. Returns the original on any failure.
      setPicked(await downscaleImage(picked));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption text-xs font-medium">Photo (optional)</span>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          // Reset so picking the SAME file twice still fires onChange.
          e.target.value = "";
        }}
      />

      {preview ? (
        <div className="flex flex-col gap-2">
          {/* Raw <img>: the src is a blob: URL, which next/image can't take. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Selected photo preview"
            className="max-h-48 w-full rounded-[12px] object-cover"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || busy}
              className="text-ink text-sm font-medium hover:underline disabled:opacity-50"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => setPicked(null)}
              disabled={disabled || busy}
              className="text-caption text-sm hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          className="border-control-border text-body h-11 w-full rounded-[13px] border-[1.5px] border-dashed text-sm font-medium transition-transform active:scale-[.98] disabled:opacity-50"
        >
          {busy ? "Preparing…" : "Add a photo"}
        </button>
      )}
    </div>
  );
}
