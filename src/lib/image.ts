import type { ImageData } from "./types";

const MAX_SIDE = 1600;

/** Loads an image file, downsizes it and re-encodes it as JPEG for the vision API. */
export async function fileToImageData(file: File): Promise<ImageData> {
  if (!file.type.startsWith("image/")) throw new Error("Это не изображение");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { mimeType: "image/jpeg", base64: dataUrl.split(",")[1], dataUrl };
}
