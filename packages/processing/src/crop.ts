import type { CodecImageData, DataType } from '@dimkatet/jcodecs-core';
import { copyToWasm, copyFromWasmByType } from '@dimkatet/jcodecs-core';
import type { InitConfig } from './_module';
import { init, getModule } from './_module';
import { validateImageInput, validateCropRegion } from './validation';

function bytesPerElement(dataType: DataType): number {
  if (dataType === 'uint16' || dataType === 'float16') return 2;
  if (dataType === 'float32') return 4;
  return 1; // uint8
}

/**
 * Crop a rectangular region from an image.
 *
 * Works on all data types (uint8, uint16, float16, float32) at the byte level.
 * The output descriptor has updated width/height; all other fields are preserved.
 *
 * @param image  - Source image with descriptor
 * @param region - Crop region { x, y, width, height } in pixels
 * @param config - Init config (custom WASM URL)
 */
export async function crop(
  image: CodecImageData,
  region: { x: number; y: number; width: number; height: number },
  config?: InitConfig,
): Promise<CodecImageData> {
  await init(config);

  validateImageInput(image);
  validateCropRegion(image, region);

  const module = getModule();
  const { descriptor, data } = image;
  const { width: srcW, height: srcH } = descriptor.geometry;
  const numChannels = descriptor.channels.count;
  const dataType    = descriptor.numeric.dataType;
  const bpe         = bytesPerElement(dataType);

  // No-op: crop equals full image
  if (region.x === 0 && region.y === 0 && region.width === srcW && region.height === srcH) {
    return {
      data: data.slice() as typeof data,
      descriptor: { ...descriptor },
    };
  }

  const inputPtr = copyToWasm(module, data);

  let result;
  try {
    result = module.crop(
      inputPtr,
      srcW, srcH,
      numChannels,
      region.x, region.y,
      region.width, region.height,
      bpe,
    );
  } finally {
    module._free(inputPtr);
  }

  if (result.error) {
    throw new Error(`jcodecs-processing crop: ${result.error}`);
  }

  const elementCount = region.width * region.height * numChannels;
  const outputData = copyFromWasmByType(module, result.dataPtr, elementCount, dataType);
  module._free(result.dataPtr);

  return {
    data: outputData,
    descriptor: {
      ...descriptor,
      geometry: { ...descriptor.geometry, width: region.width, height: region.height },
    },
  };
}
