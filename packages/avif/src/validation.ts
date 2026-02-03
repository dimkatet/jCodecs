import { DataType } from '@dimkatet/jcodecs-core';
import type { AVIFDataType, AVIFImageData } from './types';
import { SUPPORTED_DATA_TYPES } from './types';

/**
 * Validate dataType is supported by AVIF encoder
 */
export function validateDataType(dataType: DataType): void {
  if (!SUPPORTED_DATA_TYPES.includes(dataType as AVIFDataType)) {
    throw new Error(
      `AVIF encoder: unsupported dataType "${dataType}". ` +
      `Supported: ${SUPPORTED_DATA_TYPES.join(', ')}`
    );
  }
}

/**
 * Validate data TypedArray matches declared dataType
 */
export function validateDataTypeMatch(imageData: AVIFImageData): void {
  const { data, dataType } = imageData;

  if (dataType === 'uint8' && !(data instanceof Uint8Array)) {
    throw new Error('dataType "uint8" requires Uint8Array');
  }
  if (dataType === 'uint16' && !(data instanceof Uint16Array)) {
    throw new Error('dataType "uint16" requires Uint16Array');
  }
}
