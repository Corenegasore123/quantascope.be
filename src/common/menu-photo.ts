import { AppError } from "../common/app-error";

export const MENU_PHOTO_MIN_PX = 800;
export const MENU_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

function isJpeg(buf: Buffer) {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

function isPng(buf: Buffer) {
  return buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

function jpegSize(buf: Buffer) {
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

function pngSize(buf: Buffer) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export function readImageSize(buf: Buffer) {
  if (isJpeg(buf)) return jpegSize(buf);
  if (isPng(buf)) return pngSize(buf);
  return null;
}

/** Restaurant-provided dish photos only: square, min 800px, JPEG/PNG. */
export function assertRestaurantDishPhoto(file: { mimetype?: string; buffer: Buffer; size?: number }) {
  if (!file?.buffer?.length) throw new AppError(400, "Restaurant dish photo required", "NO_PHOTO");
  if ((file.size ?? file.buffer.length) > MENU_PHOTO_MAX_BYTES) {
    throw new AppError(400, "Dish photo is too large", "PHOTO_TOO_LARGE");
  }
  const mime = file.mimetype ?? "";
  const okType = /^image\/(jpeg|jpg|png)$/i.test(mime) || isJpeg(file.buffer) || isPng(file.buffer);
  if (!okType) throw new AppError(400, "Dish photos must be JPEG or PNG", "BAD_PHOTO_TYPE");
  const dim = readImageSize(file.buffer);
  if (!dim) throw new AppError(400, "Could not read photo dimensions", "BAD_PHOTO");
  if (Math.abs(dim.width - dim.height) > 2) {
    throw new AppError(400, "Dish photos must be square-cropped", "PHOTO_NOT_SQUARE");
  }
  if (dim.width < MENU_PHOTO_MIN_PX || dim.height < MENU_PHOTO_MIN_PX) {
    throw new AppError(400, `Dish photos must be at least ${MENU_PHOTO_MIN_PX}×${MENU_PHOTO_MIN_PX}`, "PHOTO_TOO_SMALL");
  }
}
