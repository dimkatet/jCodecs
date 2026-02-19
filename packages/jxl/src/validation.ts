import * as v from 'valibot';
import type { JXLEncodeDescriptor } from './types';

// ============================================================================
// Sub-schemas
// ============================================================================

const GeometrySchema = v.object({
  width: v.pipe(v.number(), v.integer(), v.minValue(1)),
  height: v.pipe(v.number(), v.integer(), v.minValue(1)),
});

const ChannelsSchema = v.object({
  model: v.picklist(['rgb', 'rgba', 'gray', 'graya']),
  count: v.picklist([1, 2, 3, 4]),
});

const NumericSchema = v.object({
  dataType: v.picklist(['uint8', 'uint16', 'float16', 'float32']),
  bitDepth: v.picklist([8, 10, 12, 16, 32]),
});

// Only primaries the C++ encoder can map
const ColorSchema = v.optional(v.object({
  primaries: v.optional(
    v.picklist([
      'bt709', 'bt2020', 'displayP3', 'dciP3',
    ]),
  ),
}));

// Only transfer functions the C++ encoder can map
const TransferSchema = v.optional(v.object({
  function: v.optional(
    v.picklist([
      'srgb', 'pq', 'hlg', 'linear',
      'bt709', 'bt470m', 'bt470bg', 'bt601',
      'smpte240', 'bt202010Bit', 'bt202012Bit',
    ]),
  ),
}));

// ============================================================================
// Composite descriptor schema
// ============================================================================

export const JXLEncodeDescriptorSchema = v.object({
  geometry: GeometrySchema,
  channels: ChannelsSchema,
  numeric: NumericSchema,
  color: ColorSchema,
  transfer: TransferSchema,
});

// ============================================================================
// Defaults for optional sections
// ============================================================================

const DESCRIPTOR_DEFAULTS = {
  color: { primaries: 'bt709' as const },
  transfer: { function: 'srgb' as const },
} as const;

// ============================================================================
// Validation functions
// ============================================================================

/** Validated descriptor with all optional sections filled with defaults */
export type ValidatedDescriptor = Required<JXLEncodeDescriptor>;

/**
 * Validate a JXLEncodeDescriptor and fill defaults for omitted optional fields.
 * Throws on validation failure with a descriptive error message.
 */
export function validateDescriptor(input: JXLEncodeDescriptor): ValidatedDescriptor {
  try {
    const parsed = v.parse(JXLEncodeDescriptorSchema, input);
    return {
      geometry: parsed.geometry,
      channels: parsed.channels,
      numeric: parsed.numeric,
      color: { ...DESCRIPTOR_DEFAULTS.color, ...parsed.color },
      transfer: { ...DESCRIPTOR_DEFAULTS.transfer, ...parsed.transfer },
    };
  } catch (e) {
    if (e instanceof v.ValiError) {
      const issues = e.issues.map(i => i.message).join('; ');
      throw new Error(`JXL encode descriptor validation failed: ${issues}`);
    }
    throw e;
  }
}

/**
 * Validate that the pixel data matches the descriptor.
 */
export function validateDataAgainstDescriptor(
  data: Uint8Array | Uint16Array | Float16Array | Float32Array,
  descriptor: ValidatedDescriptor,
): void {
  const { dataType } = descriptor.numeric;
  const { width, height } = descriptor.geometry;
  const { count: channels } = descriptor.channels;

  if (dataType === 'uint8' && !(data instanceof Uint8Array)) {
    throw new Error('descriptor.numeric.dataType "uint8" requires Uint8Array data');
  }
  if (dataType === 'uint16' && !(data instanceof Uint16Array)) {
    throw new Error('descriptor.numeric.dataType "uint16" requires Uint16Array data');
  }
  if (dataType === 'float16' && !(data instanceof Float16Array)) {
    throw new Error('descriptor.numeric.dataType "float16" requires Float16Array data');
  }
  if (dataType === 'float32' && !(data instanceof Float32Array)) {
    throw new Error('descriptor.numeric.dataType "float32" requires Float32Array data');
  }

  const expectedElements = width * height * channels;
  if (data.length < expectedElements) {
    throw new Error(
      `Data too small: expected at least ${expectedElements} elements ` +
      `(${width}x${height}x${channels}), got ${data.length}`
    );
  }
}
