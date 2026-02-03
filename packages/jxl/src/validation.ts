import { DataType } from '@dimkatet/jcodecs-core';
import type { JXLDataType, JXLImageData } from './types';
import { SUPPORTED_DATA_TYPES } from './types';

/**
 * Validate dataType is supported by JXL encoder/decoder
 */
export function validateDataType(dataType: DataType): void {
  if (!SUPPORTED_DATA_TYPES.includes(dataType as JXLDataType)) {
    throw new Error(
      `JXL codec: unsupported dataType "${dataType}". ` +
      `Supported: ${SUPPORTED_DATA_TYPES.join(', ')}`
    );
  }
}

/**
 * Validate data TypedArray matches declared dataType
 */
export function validateDataTypeMatch(imageData: JXLImageData): void {
  const { data, dataType } = imageData;

  if (dataType === 'uint8' && !(data instanceof Uint8Array)) {
    throw new Error('dataType "uint8" requires Uint8Array');
  }
  if (dataType === 'uint16' && !(data instanceof Uint16Array)) {
    throw new Error('dataType "uint16" requires Uint16Array');
  }
  if (dataType === 'float16' && !(data instanceof Float16Array)) {
    throw new Error('dataType "float16" requires Float16Array');
  }
  if (dataType === 'float32' && !(data instanceof Float32Array)) {
    throw new Error('dataType "float32" requires Float32Array');
  }
}
