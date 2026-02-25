/**
 * Test helpers — creates synthetic CodecImageData without fixture files.
 */
import type { CodecImageData, ImageDescriptor } from '@dimkatet/jcodecs-processing';

// ============================================================================
// Image factories
// ============================================================================

export function makeUint8Image(
  width: number,
  height: number,
  channels: 1 | 2 | 3 | 4 = 4,
  fill?: number,
): CodecImageData {
  const data = new Uint8Array(width * height * channels);
  if (fill !== undefined) {
    data.fill(fill);
  } else {
    // Gradient pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels;
        if (channels >= 1) data[i]     = Math.round((x / (width  - 1 || 1)) * 255);
        if (channels >= 2) data[i + 1] = Math.round((y / (height - 1 || 1)) * 255);
        if (channels >= 3) data[i + 2] = 128;
        if (channels >= 4) data[i + 3] = 255;
      }
    }
  }
  return { data, descriptor: makeDescriptor(width, height, channels, 'uint8') };
}

export function makeUint16Image(
  width: number,
  height: number,
  channels: 1 | 2 | 3 | 4 = 4,
  fill?: number,
): CodecImageData {
  const data = new Uint16Array(width * height * channels);
  const max = 65535;
  if (fill !== undefined) {
    data.fill(fill);
  } else {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels;
        if (channels >= 1) data[i]     = Math.round((x / (width  - 1 || 1)) * max);
        if (channels >= 2) data[i + 1] = Math.round((y / (height - 1 || 1)) * max);
        if (channels >= 3) data[i + 2] = Math.round(max / 2);
        if (channels >= 4) data[i + 3] = max;
      }
    }
  }
  return { data, descriptor: makeDescriptor(width, height, channels, 'uint16') };
}

export function makeFloat32Image(
  width: number,
  height: number,
  channels: 1 | 2 | 3 | 4 = 4,
  fill?: number,
): CodecImageData {
  const data = new Float32Array(width * height * channels);
  if (fill !== undefined) {
    data.fill(fill);
  } else {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels;
        if (channels >= 1) data[i]     = x / (width  - 1 || 1);
        if (channels >= 2) data[i + 1] = y / (height - 1 || 1);
        if (channels >= 3) data[i + 2] = 0.5;
        if (channels >= 4) data[i + 3] = 1.0;
      }
    }
  }
  return { data, descriptor: makeDescriptor(width, height, channels, 'float32') };
}

export function makeFloat16Image(
  width: number,
  height: number,
  channels: 1 | 2 | 3 | 4 = 4,
  fill?: number,
): CodecImageData {
  const data = new Float16Array(width * height * channels);
  if (fill !== undefined) {
    data.fill(fill);
  } else {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * channels;
        if (channels >= 1) data[i]     = x / (width  - 1 || 1);
        if (channels >= 2) data[i + 1] = y / (height - 1 || 1);
        if (channels >= 3) data[i + 2] = 0.5;
        if (channels >= 4) data[i + 3] = 1.0;
      }
    }
  }
  return { data, descriptor: makeDescriptor(width, height, channels, 'float16') };
}

// ============================================================================
// Descriptor helpers
// ============================================================================

function channelModel(channels: number): ImageDescriptor['channels']['model'] {
  if (channels === 1) return 'gray';
  if (channels === 2) return 'graya';
  if (channels === 3) return 'rgb';
  return 'rgba';
}

function makeDescriptor(
  width: number,
  height: number,
  channels: number,
  dataType: 'uint8' | 'uint16' | 'float16' | 'float32',
): ImageDescriptor {
  const isFloat = dataType === 'float16' || dataType === 'float32';
  return {
    geometry: { width, height },
    channels: { model: channelModel(channels), count: channels },
    numeric: {
      sampleType: isFloat ? 'float' : 'uint',
      dataType,
      bitDepth: dataType === 'uint8' ? 8 : dataType === 'uint16' ? 16 : dataType === 'float16' ? 16 : 32,
    },
  };
}

// ============================================================================
// Assertion helpers
// ============================================================================

/** Check all values in typed array are finite (no NaN/Inf) */
export function allFinite(data: ArrayLike<number>): boolean {
  for (let i = 0; i < data.length; i++) {
    if (!isFinite(data[i])) return false;
  }
  return true;
}

/** Check all values in typed array are within [min, max] */
export function allInRange(data: ArrayLike<number>, min: number, max: number): boolean {
  for (let i = 0; i < data.length; i++) {
    if (data[i] < min || data[i] > max) return false;
  }
  return true;
}

/** Check all values are approximately equal to expected value */
export function allApprox(data: ArrayLike<number>, expected: number, tolerance = 1): boolean {
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i] - expected) > tolerance) return false;
  }
  return true;
}
