// Client-side downscale before upload — a BANDWIDTH optimization only. The
// server re-encodes with sharp regardless (that's the security boundary that
// strips EXIF/GPS). Because a canvas re-encode drops EXIF, we must bake the
// photo's orientation into the pixels here (via createImageBitmap's
// imageOrientation) — otherwise a mis-rotated image with no EXIF would reach the
// server with nothing left to rotate. On any failure we return the original file
// untouched and let the server handle everything.
export async function downscaleImage(
  file: File,
  maxEdge = 1600,
  quality = 0.8
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const { width, height } = bitmap;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );
    if (!blob) return file;
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
