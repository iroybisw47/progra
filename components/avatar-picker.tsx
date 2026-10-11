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

type UploadResult = { ok: true } | { error: string };
type UploadAvatar = (formData: FormData) => Promise<UploadResult>;

// The longest edge a picked photo keeps before it is cropped. Big enough for
// the crop dialog to zoom into, and small enough that the bitmap it pans
// stays cheap on a phone.
const SOURCE_MAX_EDGE = 1600;

// Steps 2 and 3 of every avatar upload: crop to a 512px square (the area the
// crop dialog chose), then upload. Never rejects. A dropped connection rejects the action's promise, and inside a
// transition that would reach the error boundary, so it becomes the action's
// own "try again" text instead.
async function cropAndUpload(
  file: File,
  area: Area,
  upload: UploadAvatar
): Promise<UploadResult> {
  const square = await cropToSquareJpeg(file, area);
  const fd = new FormData();
  fd.set("photo", square);
  try {
    return await upload(fd);
  } catch {
    return { error: "Upload failed. Please try again." };
  }
}

// The client half of an avatar upload, for the picker below. Whatever reaches
// uploadAvatar is always downscaled to 1600px, then cropped to a 512px JPEG
// square, which keeps it far under the 1MB Server Action body limit a raw
// camera photo would break (next.config.ts doesn't raise it). The server
// re-encodes regardless; this is about size, not trust.
//
//   normalize      step 1, before the crop dialog shows
//   uploadCropped  steps 2-3 with the area the dialog chose
//
// The upload runs in a transition, so `pending` covers it, and reports through
// `onResult` inside it, so a caller's state updates land before `pending`
// drops. `upload` is injectable for onboarding's dev preview, which must not
// reach the real action. It defaults to uploadAvatar.
export function useAvatarUpload(upload: UploadAvatar = uploadAvatar) {
  const [pending, startTransition] = useTransition();
  return {
    pending,
    normalize: (file: File) => downscaleImage(file, SOURCE_MAX_EDGE),
    uploadCropped: (
      normalized: File,
      area: Area,
      onResult: (r: UploadResult) => void
    ) =>
      startTransition(async () => {
        onResult(await cropAndUpload(normalized, area, upload));
      }),
  };
}

// Profile-picture picker: round preview (photo or initials), tap to pick from
// the gallery, then a pan/zoom crop step (round viewport) before upload —
// cropToSquareJpeg bakes the chosen frame into a 512px square client-side, so
// the server pipeline is unchanged. Remove available when a photo is set.
// Uploads apply immediately — the action's revalidation delivers the new URL,
// no refresh calls. Used in the Settings edit-profile dialog and the welcome
// step, which onboarding v2 and v3 share (v3's Screen 1 since OWNER-FIX-3).
//
// `upload` and `remove` stand in for the two actions, which are the defaults:
// v3 passes its services' (lib/onboarding-v3-services.ts), so its dev preview
// can never change a signed-in developer's real photo. Nobody else passes them.
export function AvatarPicker({
  name,
  username,
  avatarUrl,
  sizeClassName = "size-16 text-lg",
  upload,
  remove = removeAvatar,
}: {
  name: string | null;
  username: string;
  avatarUrl: string | null;
  sizeClassName?: string;
  upload?: UploadAvatar;
  remove?: () => Promise<UploadResult>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { pending: uploading, normalize, uploadCropped } = useAvatarUpload(upload);
  const [removing, startRemove] = useTransition();
  const pending = uploading || removing;

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
      const normalized = await normalize(file);
      clearPending();
      setPendingFile(normalized);
      setPendingUrl(URL.createObjectURL(normalized));
    })();
  }

  function handleCropConfirm(area: Area) {
    const file = pendingFile;
    if (!file) return;
    uploadCropped(file, area, (r) => {
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      clearPending();
      toast.success("Profile photo updated");
    });
  }

  function handleRemove() {
    startRemove(async () => {
      const r = await remove();
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
