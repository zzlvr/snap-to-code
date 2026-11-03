import type { ImageData } from "./types";

const MAX_SIDE = 1600;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Loads an image file, downsizes it and re-encodes it as JPEG for the vision API. */
export async function fileToImageData(file: File): Promise<ImageData> {
  if (!file.type.startsWith("image/")) throw new Error("Это не изображение. Выберите PNG, JPEG или WebP.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Файл больше 20 МБ. Сделайте скриншот поменьше.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Не удалось открыть изображение. Попробуйте PNG или JPEG.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен в этом браузере");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { mimeType: "image/jpeg", base64: dataUrl.split(",")[1], dataUrl, width, height };
}
