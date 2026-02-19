import * as v from 'valibot';
import type { AVIFEncodeDescriptor } from './types';

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
  dataType: v.picklist(['uint8', 'uint16']),
  bitDepth: v.picklist([8, 10, 12]),
});

const SamplingSchema = v.optional(v.object({
  chromaSubsampling: v.optional(
    v.picklist(['444', '422', '420', '400']),
  ),
}));

// Only primaries the C++ encoder can map to libavif CICP values
const ColorSchema = v.optional(v.object({
  primaries: v.optional(
    v.picklist([
      'bt709', 'bt2020', 'displayP3', 'dciP3',
      'bt470m', 'bt470bg', 'bt601', 'smpte240',
      'genericFilm', 'xyz', 'ebu3213',
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

export const AVIFEncodeDescriptorSchema = v.object({
  geometry: GeometrySchema,
  channels: ChannelsSchema,
  numeric: NumericSchema,
  sampling: SamplingSchema,
  color: ColorSchema,
  transfer: TransferSchema,
});

// ============================================================================
// Defaults for optional sections
// ============================================================================

const DESCRIPTOR_DEFAULTS = {
  sampling: { chromaSubsampling: '420' as const },
  color: { primaries: 'bt709' as const },
  transfer: { function: 'srgb' as const },
} as const;

// ============================================================================
// Validation functions
// ============================================================================

/** Validated descriptor with all optional sections filled with defaults */
export type ValidatedDescriptor = Required<AVIFEncodeDescriptor>;

/**
 * Validate an AVIFEncodeDescriptor and fill defaults for omitted optional fields.
 * Throws on validation failure with a descriptive error message.
 */
export function validateDescriptor(input: AVIFEncodeDescriptor): ValidatedDescriptor {
  try {
    const parsed = v.parse(AVIFEncodeDescriptorSchema, input);
    return {
      geometry: parsed.geometry,
      channels: parsed.channels,
      numeric: parsed.numeric,
      sampling: { ...DESCRIPTOR_DEFAULTS.sampling, ...parsed.sampling },
      color: { ...DESCRIPTOR_DEFAULTS.color, ...parsed.color },
      transfer: { ...DESCRIPTOR_DEFAULTS.transfer, ...parsed.transfer },
    };
  } catch (e) {
    if (e instanceof v.ValiError) {
      const issues = e.issues.map(i => i.message).join('; ');
      throw new Error(`AVIF encode descriptor validation failed: ${issues}`);
    }
    throw e;
  }
}

/**
 * Validate that the pixel data matches the descriptor.
 */
export function validateDataAgainstDescriptor(
  data: Uint8Array | Uint16Array,
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

  const expectedElements = width * height * channels;
  if (data.length < expectedElements) {
    throw new Error(
      `Data too small: expected at least ${expectedElements} elements ` +
      `(${width}x${height}x${channels}), got ${data.length}`
    );
  }
}
