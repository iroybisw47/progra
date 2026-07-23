// Extract a chosen square region of an image to a fixed-edge JPEG. The input
// should already be orientation-normalized (run it through downscaleImage
// first — react-easy-crop's coordinates assume the pixels are upright).
// Client-side counterpart of the server's sharp cover-crop; falls back to the
// input file on any failure (the server re-encodes regardless).
export async function cropToSquareJpeg(
  file: File,
  area: { x: number; y: number; width: number; height: number },
  edge = 512,
  quality = 0.8
): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = edge;
    canvas.height = edge;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(
      bitmap,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      edge,
      edge
    );
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return file;
    return new File([blob], "avatar.jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
