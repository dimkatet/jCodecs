import type { CodecImageData } from '@dimkatet/jcodecs-core';

export function validateImageInput(image: CodecImageData): void {
  const { width, height } = image.descriptor.geometry;
  if (width <= 0 || height <= 0) {
    throw new Error(
      `jcodecs-processing: invalid source dimensions ${width}x${height}`,
    );
  }

  const numChannels = image.descriptor.channels.count;
  if (numChannels < 1 || numChannels > 4) {
    throw new Error(
      `jcodecs-processing: supports 1–4 channels, got ${numChannels}`,
    );
  }

  const expectedElements = width * height * numChannels;
  if (image.data.length !== expectedElements) {
    throw new Error(
      `jcodecs-processing: data length mismatch — expected ` +
      `${expectedElements} elements (${width}×${height}×${numChannels}), ` +
      `got ${image.data.length}`,
    );
  }

  const layout = image.descriptor.sampling?.layout ?? 'interleaved';
  if (layout !== 'interleaved') {
    throw new Error(
      `jcodecs-processing: only interleaved layout is supported, got "${layout}"`,
    );
  }
}

export function validateResizeTarget(target: { width: number; height: number }): void {
  if (target.width <= 0 || target.height <= 0) {
    throw new Error(
      `jcodecs-processing: invalid resize target ${target.width}x${target.height}`,
    );
  }
}

export function validateCropRegion(
  image: CodecImageData,
  region: { x: number; y: number; width: number; height: number },
): void {
  const { width: srcW, height: srcH } = image.descriptor.geometry;
  if (
    region.x < 0 || region.y < 0 ||
    region.width <= 0 || region.height <= 0 ||
    region.x + region.width > srcW ||
    region.y + region.height > srcH
  ) {
    throw new Error(
      `jcodecs-processing: crop region ` +
      `(${region.x}, ${region.y}, ${region.width}×${region.height}) ` +
      `is out of bounds for source ${srcW}×${srcH}`,
    );
  }
}
