import type { CodecImageData } from '@dimkatet/jcodecs-core';
import { copyToWasm, copyFromWasmByType } from '@dimkatet/jcodecs-core';
import type { ResizeOptions } from './options';
import { DEFAULT_RESIZE_OPTIONS } from './options';
import type { InitConfig } from './_module';
import { init, getModule } from './_module';
import { validateImageInput, validateResizeTarget } from './validation';

/**
 * Resize an image to the given target dimensions.
 *
 * Supports uint8, uint16, float16, and float32 data.
 * For uint8 images, gamma-correct (sRGB-aware) resampling is applied.
 * For higher bit-depth and float images, linear-light resampling is used.
 *
 * @param image  - Source image with descriptor
 * @param target - Target dimensions
 * @param options - Resize options (algorithm, etc.)
 * @param config  - Init config (custom WASM URL)
 */
export async function resize(
  image: CodecImageData,
  target: { width: number; height: number },
  options?: ResizeOptions,
  config?: InitConfig,
): Promise<CodecImageData> {
  await init(config);

  validateImageInput(image);
  validateResizeTarget(target);

  const opts = { ...DEFAULT_RESIZE_OPTIONS, ...options };
  const module = getModule();

  const { descriptor, data } = image;
  const { width: srcW, height: srcH } = descriptor.geometry;
  const { width: dstW, height: dstH } = target;

  // No-op: same dimensions
  if (srcW === dstW && srcH === dstH) {
    return {
      data: data.slice() as typeof data,
      descriptor: { ...descriptor },
    };
  }

  const dataTypeStr  = descriptor.numeric.dataType;          // "uint8"|"uint16"|"float16"|"float32"
  const alphaStr     = descriptor.alpha?.mode ?? 'none';     // "none"|"straight"|"premultiplied"
  const numChannels  = descriptor.channels.count;

  const inputPtr = copyToWasm(module, data);

  let result;
  try {
    result = module.resize(
      inputPtr,
      data.byteLength,
      srcW, srcH,
      dstW, dstH,
      numChannels,
      dataTypeStr,
      opts.algorithm,
      alphaStr,
    );
  } finally {
    module._free(inputPtr);
  }

  if (result.error) {
    throw new Error(`jcodecs-processing resize: ${result.error}`);
  }

  const elementCount = dstW * dstH * numChannels;
  const outputData = copyFromWasmByType(module, result.dataPtr, elementCount, dataTypeStr);
  module._free(result.dataPtr);

  return {
    data: outputData,
    descriptor: {
      ...descriptor,
      geometry: { ...descriptor.geometry, width: dstW, height: dstH },
    },
  };
}

export { isInitialized } from './_module';
export { init } from './_module';
export type { InitConfig } from './_module';
