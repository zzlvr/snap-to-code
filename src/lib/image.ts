import type { ImageData, ImagePart } from "./types";

/** Claude downsizes anything over 1568 px on its long side, so every image we send stays within it. */
const MAX_SIDE = 1568;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** A single image taller than this (height / width) is treated as a long page and sliced. Phone screenshots are not. */
const SINGLE_IMAGE_MAX_RATIO = 2.4;
const MAX_TOTAL_HEIGHT = 12000;
const OVERLAP = 48;

export const MAX_FILES = 8;

export interface Size {
  width: number;
  height: number;
}
export interface Segment {
  y: number;
  height: number;
}
export interface Layout {
  /** Width of the whole page. */
  width: number;
  /** Scaled height of each source image, top to bottom. */
  heights: number[];
  /** Height of the whole page. */
  total: number;
  /** The slices sent to the model. */
  segments: Segment[];
}

/** Cuts a page of `total` px into equal slices of at most MAX_SIDE px that overlap a little, so no row of text is lost at a cut. */
export function planSegments(total: number): Segment[] {
  if (total <= MAX_SIDE) return [{ y: 0, height: total }];
  const n = Math.ceil((total - OVERLAP) / (MAX_SIDE - OVERLAP));
  const height = Math.ceil((total + (n - 1) * OVERLAP) / n);
  const step = height - OVERLAP;
  return Array.from({ length: n }, (_, i) => {
    const y = Math.min(i * step, total - height);
    return { y, height };
  });
}

/** Decides how source images become one page and which slices the model sees. Pure, so it can be tested without a browser. */
export function planLayout(sizes: Size[]): Layout {
  if (sizes.length === 0) throw new Error("No image to read.");
  if (sizes.length === 1 && sizes[0].height / sizes[0].width <= SINGLE_IMAGE_MAX_RATIO) {
    const { width: w, height: h } = sizes[0];
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const width = Math.round(w * scale);
    const height = Math.round(h * scale);
    return { width, heights: [height], total: height, segments: [{ y: 0, height }] };
  }
  const width = Math.min(MAX_SIDE, Math.max(...sizes.map((s) => s.width)));
  const heights = sizes.map((s) => Math.round((s.height * width) / s.width));
  const total = heights.reduce((a, b) => a + b, 0);
  if (total > MAX_TOTAL_HEIGHT) {
    throw new Error(
      `This page is taller than ${MAX_TOTAL_HEIGHT.toLocaleString("en-US")} px once scaled. Capture it in two runs.`,
    );
  }
  return { width, heights, total, segments: planSegments(total) };
}

async function decode(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name || "That file"} is not an image. Choose PNG, JPEG or WebP.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name || "The file"} is larger than 20 MB. Use a smaller screenshot.`);
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error(`Could not open ${file.name || "the image"}. Try a PNG or JPEG.`);
  }
}

function newCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

const toPart = (canvas: HTMLCanvasElement): ImagePart & { dataUrl: string } => {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { mimeType: "image/jpeg", base64: dataUrl.split(",")[1], dataUrl };
};

/** Cuts a picture of the rendered page into the parts sent to the model, by the same rules as a screenshot. */
export async function pictureToParts(dataUrl: string, width: number, height: number): Promise<ImagePart[]> {
  if (width > MAX_SIDE || height > MAX_TOTAL_HEIGHT) throw new Error("The rendered page is too large to compare.");
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  return planSegments(height).map((s) => {
    const { canvas, ctx } = newCanvas(width, s.height);
    ctx.drawImage(img, 0, s.y, width, s.height, 0, 0, width, s.height);
    const { mimeType, base64 } = toPart(canvas);
    return { mimeType, base64 };
  });
}

/**
 * Reads one or more screenshots as ONE page, top to bottom, and prepares the images for the model.
 * Several files are stacked in the given order; a very tall page is sliced into overlapping parts.
 */
export async function filesToImageData(files: File[]): Promise<ImageData> {
  if (files.length > MAX_FILES) throw new Error(`Use at most ${MAX_FILES} screenshots per page.`);
  const bitmaps: ImageBitmap[] = [];
  try {
    for (const file of files) bitmaps.push(await decode(file));
    const layout = planLayout(bitmaps.map((b) => ({ width: b.width, height: b.height })));
    const { canvas, ctx } = newCanvas(layout.width, layout.total);
    let y = 0;
    bitmaps.forEach((bitmap, i) => {
      ctx.drawImage(bitmap, 0, y, layout.width, layout.heights[i]);
      y += layout.heights[i];
    });
    const page = toPart(canvas);
    const parts: ImagePart[] =
      layout.segments.length === 1
        ? [{ mimeType: page.mimeType, base64: page.base64 }]
        : layout.segments.map((s) => {
            const slice = newCanvas(layout.width, s.height);
            slice.ctx.drawImage(canvas, 0, s.y, layout.width, s.height, 0, 0, layout.width, s.height);
            const { mimeType, base64 } = toPart(slice.canvas);
            return { mimeType, base64 };
          });
    return { ...page, width: layout.width, height: layout.total, parts };
  } finally {
    bitmaps.forEach((b) => b.close());
  }
}
