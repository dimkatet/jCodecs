import type { EXRDataType, EXREncodeDescriptor } from './types';
import { SUPPORTED_DATA_TYPES } from './types';

/**
 * Validate dataType is supported by EXR encoder/decoder
 */
export function validateDataType(dataType: string): void {
  if (!SUPPORTED_DATA_TYPES.includes(dataType as EXRDataType)) {
    throw new Error(
      `EXR encoder: unsupported dataType "${dataType}". ` +
      `Supported: ${SUPPORTED_DATA_TYPES.join(', ')}`
    );
  }
}

/**
 * Validate data TypedArray matches descriptor.numeric.dataType
 */
export function validateDataAgainstDescriptor(
  data: Float16Array | Float32Array,
  descriptor: EXREncodeDescriptor,
): void {
  const { dataType } = descriptor.numeric;

  if (dataType === 'float16' && !(data instanceof Float16Array)) {
    throw new Error('dataType "float16" requires Float16Array');
  }
  if (dataType === 'float32' && !(data instanceof Float32Array)) {
    throw new Error('dataType "float32" requires Float32Array');
  }
}
