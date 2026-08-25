/**
 * Avatar image helpers. Drawn avatars are exported from the full (tall) canvas,
 * but an avatar wants a small, square image. On web we center-crop to a square
 * (matching the centered circle guide) and downscale so the data-URI stays
 * small — it rides along in user + every response/roster payload. On native
 * (no DOM canvas in this POC slice) we store the export as-is; the <Avatar>
 * `resizeMode="cover"` still center-crops it into the circle for display.
 */

/**
 * Center-crops a PNG data-URI to a square and downscales it to `size`×`size`.
 * Returns the original uri unchanged when no DOM canvas is available (native)
 * or on any decode failure — callers always get a usable data-URI.
 */
export async function squareAvatarDataUri(uri: string, size = 256): Promise<string> {
  const doc = (globalThis as { document?: any }).document;
  if (!doc || typeof doc.createElement !== "function") {
    return uri;
  }
  return new Promise<string>((resolve) => {
    const img = doc.createElement("img");
    img.onload = () => {
      try {
        const w = img.naturalWidth as number;
        const h = img.naturalHeight as number;
        const square = Math.min(w, h);
        if (square <= 0) {
          resolve(uri);
          return;
        }
        const sx = (w - square) / 2;
        const sy = (h - square) / 2;
        const canvas = doc.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(uri);
          return;
        }
        ctx.drawImage(img, sx, sy, square, square, 0, 0, size, size);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(uri);
      }
    };
    img.onerror = () => resolve(uri);
    img.src = uri;
  });
}
