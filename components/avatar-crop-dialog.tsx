"use client";

import { useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Pan/zoom crop step for the avatar picker: a round viewport over the chosen
// photo; drag and pinch (or the slider) to frame it. Dumb component — upload
// state lives in the picker; Save hands back the pixel rect to extract.
export function AvatarCropDialog({
  open,
  imageUrl,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  imageUrl: string | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (areaPixels: Area) => void;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next && !pending) onCancel();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Frame your photo</DialogTitle>
          <DialogDescription>
            Drag to reposition, pinch or use the slider to zoom. The circle is
            what everyone sees.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-xl bg-black/85">
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, croppedAreaPixels) =>
                setAreaPixels(croppedAreaPixels)
              }
            />
          )}
        </div>

        <input
          type="range"
          aria-label="Zoom"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="accent-brand w-full"
        />

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() => areaPixels && onConfirm(areaPixels)}
            disabled={pending || !areaPixels}
          >
            {pending ? "Saving…" : "Save photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
