"use client";

import dynamic from "next/dynamic";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Area } from "react-easy-crop";

import { removeAvatar, uploadAvatar } from "@/app/actions/avatar";
import { AvatarInitials } from "@/components/avatar-initials";
import { cropToSquareJpeg } from "@/lib/images/crop";
import { downscaleImage } from "@/lib/images/downscale";

// The crop dialog (and react-easy-crop with it) loads as a lazy chunk after
// hydration — it only matters once a file is picked.
const AvatarCropDialog = dynamic(
  () =>
    import("@/components/avatar-crop-dialog").then((m) => m.AvatarCropDialog),
  { ssr: false }
);

// Profile-picture picker: round preview (photo or initials), tap to pick from
// the gallery, then a pan/zoom crop step (round viewport) before upload —
// cropToSquareJpeg bakes the chosen frame into a 512px square client-side, so
// the server pipeline is unchanged. Remove available when a photo is set.
// Uploads apply immediately — the action's revalidation delivers the new URL,
// no refresh calls. Used in the Settings edit-profile dialog and the
// onboarding welcome step.
export function AvatarPicker({
  name,
  username,
  avatarUrl,
  sizeClassName = "size-16 text-lg",
}: {
  name: string | null;
  username: string;
  avatarUrl: string | null;
  sizeClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  // The orientation-normalized photo awaiting a crop, and its preview URL.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  function clearPending() {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingFile(null);
    setPendingUrl(null);
  }

  function handleFile(file: File | null) {
    if (!file) return;
    // Normalize BEFORE cropping: downscaleImage bakes EXIF orientation into
    // the pixels (react-easy-crop's coordinates assume upright pixels) and
    // caps the bitmap the cropper has to pan.
    void (async () => {
      const normalized = await downscaleImage(file, 1600);
      clearPending();
      setPendingFile(normalized);
      setPendingUrl(URL.createObjectURL(normalized));
    })();
  }

  function handleCropConfirm(area: Area) {
    const file = pendingFile;
    if (!file) return;
    startTransition(async () => {
      const cropped = await cropToSquareJpeg(file, area);
      const fd = new FormData();
      fd.set("photo", cropped);
      const r = await uploadAvatar(fd);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      clearPending();
      toast.success("Profile photo updated");
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const r = await removeAvatar();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Profile photo removed");
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-label={avatarUrl ? "Change profile photo" : "Add profile photo"}
        className="rounded-full transition-opacity active:scale-95 disabled:opacity-60"
      >
        <AvatarInitials
          name={name}
          username={username}
          avatarUrl={avatarUrl}
          className={sizeClassName}
        />
      </button>
      <div className="flex flex-col items-start gap-0.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="text-ink text-sm font-medium hover:underline disabled:opacity-50"
        >
          {pending ? "Uploading…" : avatarUrl ? "Change photo" : "Add photo"}
        </button>
        {avatarUrl && !pending && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-caption text-xs hover:underline"
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {/* Keyed by the preview URL so crop/zoom state resets per photo. */}
      <AvatarCropDialog
        key={pendingUrl ?? "none"}
        open={pendingUrl !== null}
        imageUrl={pendingUrl}
        pending={pending}
        onCancel={clearPending}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
