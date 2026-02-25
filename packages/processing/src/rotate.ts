import type { CodecImageData, DataType } from '@dimkatet/jcodecs-core';
import { copyToWasm, copyFromWasmByType } from '@dimkatet/jcodecs-core';
import type { InitConfig } from './_module';
import { init, getModule } from './_module';
import { validateImageInput } from './validation';

function bytesPerElement(dataType: DataType): number {
  if (dataType === 'uint16' || dataType === 'float16') return 2;
  if (dataType === 'float32') return 4;
  return 1; // uint8
}

/**
 * Rotate an image by 90, 180, or 270 degrees clockwise.
 *
 * Works on all data types (uint8, uint16, float16, float32) at the byte level.
 * For 90° and 270° rotations, width and height are swapped in the output descriptor.
 * The EXIF orientation field is reset to 1 (normal) after rotation.
 *
 * @param image   - Source image with descriptor
 * @param degrees - Rotation angle: 90 | 180 | 270 (clockwise)
 * @param config  - Init config (custom WASM URL)
 */
export async function rotate(
  image: CodecImageData,
  degrees: 90 | 180 | 270,
  config?: InitConfig,
): Promise<CodecImageData> {
  await init(config);

  validateImageInput(image);

  const module = getModule();
  const { descriptor, data } = image;
  const { width: srcW, height: srcH } = descriptor.geometry;
  const numChannels = descriptor.channels.count;
  const dataType    = descriptor.numeric.dataType;
  const bpe         = bytesPerElement(dataType);

  const inputPtr = copyToWasm(module, data);

  let result;
  try {
    result = module.rotate(
      inputPtr,
      srcW, srcH,
      numChannels,
      degrees,
      bpe,
    );
  } finally {
    module._free(inputPtr);
  }

  if (result.error) {
    throw new Error(`jcodecs-processing rotate: ${result.error}`);
  }

  // For 90°/270° swap width ↔ height; reset EXIF orientation to 1 (upright)
  const swapDims = degrees === 90 || degrees === 270;
  const dstW = swapDims ? srcH : srcW;
  const dstH = swapDims ? srcW : srcH;

  const elementCount = dstW * dstH * numChannels;
  const outputData = copyFromWasmByType(module, result.dataPtr, elementCount, dataType);
  module._free(result.dataPtr);

  return {
    data: outputData,
    descriptor: {
      ...descriptor,
      geometry: {
        ...descriptor.geometry,
        width: dstW,
        height: dstH,
        // Reset EXIF orientation after explicit rotation
        orientation: descriptor.geometry.orientation != null ? 1 : undefined,
      },
    },
  };
}
