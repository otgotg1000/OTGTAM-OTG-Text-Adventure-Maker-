export interface ProcessedImageResult {
  dataUrl: string;
  compressed: boolean;
  originalKb: number;
  finalKb: number;
}

function estimateDataUrlKb(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  const b64Len = commaIdx >= 0 ? dataUrl.length - commaIdx - 1 : dataUrl.length;
  const bytes = Math.round((b64Len * 3) / 4);
  return Math.max(1, Math.round(bytes / 1024));
}

function readFileAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Optionally downscales (max 1200px) and re-encodes raster images to WebP/JPEG
 * when auto-compression is enabled, keeping whichever result is smaller.
 */
export async function processUploadedImage(
  file: File,
  compress: boolean
): Promise<ProcessedImageResult | null> {
  const originalDataUrl = await readFileAsDataUrl(file);
  if (!originalDataUrl) return null;

  const originalKb = Math.max(1, Math.round(file.size / 1024));

  // Skip vectors and animated GIFs, or if compression is disabled
  if (
    !compress ||
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif'
  ) {
    return {
      dataUrl: originalDataUrl,
      compressed: false,
      originalKb,
      finalKb: originalKb,
    };
  }

  const img = await loadImageElement(originalDataUrl);
  if (!img || !img.width || !img.height) {
    return {
      dataUrl: originalDataUrl,
      compressed: false,
      originalKb,
      finalKb: originalKb,
    };
  }

  const MAX_DIM = 1200;
  let targetW = img.width;
  let targetH = img.height;

  if (targetW > MAX_DIM || targetH > MAX_DIM) {
    const scale = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
    targetW = Math.max(1, Math.round(targetW * scale));
    targetH = Math.max(1, Math.round(targetH * scale));
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        dataUrl: originalDataUrl,
        compressed: false,
        originalKb,
        finalKb: originalKb,
      };
    }

    ctx.drawImage(img, 0, 0, targetW, targetH);

    let compressedUrl = canvas.toDataURL('image/webp', 0.84);
    if (!compressedUrl.startsWith('data:image/webp')) {
      compressedUrl = canvas.toDataURL('image/jpeg', 0.85);
    }

    if (compressedUrl.length < originalDataUrl.length) {
      return {
        dataUrl: compressedUrl,
        compressed: true,
        originalKb,
        finalKb: estimateDataUrlKb(compressedUrl),
      };
    }
  } catch {
    // Fallback to original on canvas taint or browser quirk
  }

  return {
    dataUrl: originalDataUrl,
    compressed: false,
    originalKb,
    finalKb: originalKb,
  };
}
