export const AVATAR_SIZE = 256;
export const MAX_AVATAR_ZOOM = 4;

/** The square is expressed in source-image pixels, independently of preview size. */
export function avatarCropRect({ width, height, zoom = 1, centerX = width / 2, centerY = height / 2 }) {
  if (![width, height, zoom, centerX, centerY].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new RangeError("Invalid image dimensions or crop position");
  }
  const size = Math.min(width, height) / Math.max(1, Math.min(MAX_AVATAR_ZOOM, zoom));
  const x = Math.max(0, Math.min(width - size, centerX - size / 2));
  const y = Math.max(0, Math.min(height - size, centerY - size / 2));
  return { x, y, size };
}
