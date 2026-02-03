import { ExtendedImageData } from "@dimkatet/jcodecs-avif";

/**
 * Convert decoded image data to displayable ImageData (8-bit RGBA)
 */
export function toDisplayableImageData(result: ExtendedImageData): ImageData {
  let displayData: Uint8ClampedArray<ArrayBuffer>;

  if (result.bitDepth > 8) {
    // Convert 10/12/16-bit to 8-bit for display
    const src = result.data as Uint16Array;
    const shift = result.bitDepth - 8;
    displayData = new Uint8ClampedArray(result.width * result.height * 4);

    for (let i = 0; i < result.width * result.height; i++) {
      const srcIdx = i * result.channels;
      const dstIdx = i * 4;
      displayData[dstIdx] = src[srcIdx] >> shift;
      displayData[dstIdx + 1] = src[srcIdx + 1] >> shift;
      displayData[dstIdx + 2] = src[srcIdx + 2] >> shift;
      displayData[dstIdx + 3] =
        result.channels === 4 ? src[srcIdx + 3] >> shift : 255;
    }
  } else {
    // 8-bit: copy directly
    const src = result.data as Uint8Array;
    displayData = new Uint8ClampedArray(result.width * result.height * 4);

    for (let i = 0; i < result.width * result.height; i++) {
      const srcIdx = i * result.channels;
      const dstIdx = i * 4;
      displayData[dstIdx] = src[srcIdx];
      displayData[dstIdx + 1] = src[srcIdx + 1];
      displayData[dstIdx + 2] = src[srcIdx + 2];
      displayData[dstIdx + 3] = result.channels === 4 ? src[srcIdx + 3] : 255;
    }
  }

  return new ImageData(displayData, result.width, result.height);
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
