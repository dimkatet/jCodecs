import type { AutoImageData } from "@dimkatet/jcodecs-auto";

/**
 * Convert decoded image data to displayable ImageData (8-bit RGBA)
 */
export function toDisplayableImageData(result: AutoImageData): ImageData {
  const { geometry, numeric, channels } = result.descriptor;
  const width = geometry.width;
  const height = geometry.height;
  const channelCount = channels.count;
  const dataType = numeric.dataType;
  const bitDepth = numeric.bitDepth;

  let displayData: Uint8ClampedArray<ArrayBuffer>;

  if (dataType === 'uint16') {
    const src = result.data as Uint16Array;
    const shift = bitDepth - 8;
    displayData = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * channelCount;
      const dstIdx = i * 4;
      displayData[dstIdx] = src[srcIdx] >> shift;
      displayData[dstIdx + 1] = src[srcIdx + 1] >> shift;
      displayData[dstIdx + 2] = src[srcIdx + 2] >> shift;
      displayData[dstIdx + 3] = channelCount === 4 ? src[srcIdx + 3] >> shift : 255;
    }
  } else if (dataType === 'uint8') {
    const src = result.data as Uint8Array;
    displayData = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * channelCount;
      const dstIdx = i * 4;
      displayData[dstIdx] = src[srcIdx];
      displayData[dstIdx + 1] = src[srcIdx + 1];
      displayData[dstIdx + 2] = src[srcIdx + 2];
      displayData[dstIdx + 3] = channelCount === 4 ? src[srcIdx + 3] : 255;
    }
  } else {
    // float16 or float32 → normalize to 8-bit for display
    const src = result.data as Float32Array;
    displayData = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * channelCount;
      const dstIdx = i * 4;
      displayData[dstIdx] = Math.min(255, src[srcIdx] * 255);
      displayData[dstIdx + 1] = Math.min(255, src[srcIdx + 1] * 255);
      displayData[dstIdx + 2] = Math.min(255, src[srcIdx + 2] * 255);
      displayData[dstIdx + 3] =
        channelCount === 4 ? Math.min(255, src[srcIdx + 3] * 255) : 255;
    }
  }

  return new ImageData(displayData, width, height);
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format metadata for display
 */
export function formatMetadata(metadata: Record<string, any>): Array<{
  key: string;
  value: string;
}> {
  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
  })).filter(item => item.key !== 'iccProfile');
}
