"use client";

import { useRef, useState, useTransition } from "react";
import { CameraIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { uploadSessionPhoto } from "@/app/actions/session-photos";
import { downscaleImage } from "@/lib/images/downscale";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  // Called once the step is done (skipped, dismissed, or uploaded). The session
  // already exists server-side — this is only for the parent to advance.
  onComplete?: () => void;
};

// The optional photo step in the clock flow. A session carries at most one
// photo, taken while it runs. Skipping is one tap and equal weight to taking a
// photo — never a guilt pattern. The session is never blocked or cancelled by
// this step; dismissing it just proceeds.
export function SessionPhotoStep({
  open,
  onOpenChange,
  sessionId,
  onComplete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function clearCapture() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Single close path — resets capture state and lets the parent advance. Used
  // by Skip, a successful upload, and backdrop/escape dismissal alike.
  function close() {
    clearCapture();
    onOpenChange(false);
    onComplete?.();
  }

  function handleFile(f: File | undefined) {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    setFile(f);
  }

  function handleUpload() {
    if (!file || !sessionId) return;
    startTransition(async () => {
      const optimized = await downscaleImage(file);
      const fd = new FormData();
      fd.append("photo", optimized);
      const r = await uploadSessionPhoto(sessionId, fd);
      if ("error" in r) {
        // Keep the dialog open so the user can retry; the session is untouched.
        toast.error(r.error);
        return;
      }
      close();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a photo</DialogTitle>
          <DialogDescription>
            Snap what you&apos;re working on — optional.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Selected photo preview"
            className="max-h-72 w-full rounded-md object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="border-border text-muted-foreground hover:bg-muted/40 flex h-40 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed transition-colors"
          >
            <CameraIcon className="size-6" />
            <span className="text-sm">Take a photo</span>
          </button>
        )}

        <DialogFooter>
          {preview ? (
            <>
              <Button
                variant="outline"
                className="h-11 flex-1 text-base"
                disabled={pending}
                onClick={() => {
                  clearCapture();
                  inputRef.current?.click();
                }}
              >
                Retake
              </Button>
              <Button
                className="h-11 flex-1 text-base"
                disabled={pending}
                onClick={handleUpload}
              >
                {pending ? "Uploading…" : "Use photo"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="h-11 flex-1 text-base"
                disabled={pending}
                onClick={close}
              >
                Skip
              </Button>
              <Button
                className="h-11 flex-1 text-base"
                disabled={pending}
                onClick={() => inputRef.current?.click()}
              >
                <CameraIcon /> Take a photo
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
