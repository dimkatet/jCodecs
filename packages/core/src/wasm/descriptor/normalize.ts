// ============================================================================
// WASM ImageDescriptor → TypeScript ImageDescriptor normalizer
// ============================================================================

import type {
  MainModule,
  ImageDescriptor as WasmImageDescriptor,
  GeometryInfo as WasmGeometryInfo,
  ChannelsInfo as WasmChannelsInfo,
  NumericInfo as WasmNumericInfo,
  QuantizationRange as WasmQuantizationRange,
  ColorInfo as WasmColorInfo,
  TransferInfo as WasmTransferInfo,
  LuminanceInfo as WasmLuminanceInfo,
  SamplingInfo as WasmSamplingInfo,
  AlphaInfo as WasmAlphaInfo,
  HDRMetadata as WasmHDRMetadata,
  MasteringDisplay as WasmMasteringDisplay,
  RenderingInfo as WasmRenderingInfo,
  VectorChannelDescriptor,
  VectorUint8,
} from './jcodecs-descriptor';

import type {
  ExifOrientation,
  QuantizationRange,
  ChannelRole,
  ImageDescriptor,
  GeometryInfo,
  ChannelDescriptor,
  ChannelsInfo,
  NumericInfo,
  ColorInfo,
  TransferInfo,
  LuminanceInfo,
  SamplingInfo,
  AlphaInfo,
  HDRMetadata,
  MasteringDisplay,
  RenderingInfo,
} from '../../types/descriptor';

// ============================================================================
// Enum reverse-lookup
// ============================================================================

function resolveEnum<K extends keyof MainModule>(
  module: MainModule,
  key: K,
  value: { value: number },
): string {
  const obj = module[key];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'object' && v !== null && 'value' in v && (v as { value: number }).value === value.value) {
      return k;
    }
  }
  throw new Error(`Unknown ${String(key)} value: ${value.value}`);
}

function resolveEnumOpt<K extends keyof MainModule>(
  module: MainModule,
  key: K,
  value: { value: number } | undefined,
): string | undefined {
  return value !== undefined ? resolveEnum(module, key, value) : undefined;
}

// ============================================================================
// Container conversions
// ============================================================================

function vectorChannelDescriptorToArray(
  module: MainModule,
  vec: VectorChannelDescriptor,
): ChannelDescriptor[] {
  const len = vec.size();
  const result: ChannelDescriptor[] = [];
  for (let i = 0; i < len; i++) {
    const ch = vec.get(i)!;
    result.push({
      name: ch.name as string,
      role: resolveEnum(module, 'ChannelRole', ch.role) as ChannelRole,
      index: ch.index,
    });
  }
  return result;
}

function vectorUint8ToArray(vec: VectorUint8): Uint8Array {
  const len = vec.size();
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = vec.get(i)!;
  return arr;
}

// ============================================================================
// Quantization (special case: type discriminant → string | { min, max })
// ============================================================================

function normalizeQuantization(
  module: MainModule,
  q: WasmQuantizationRange | undefined,
): QuantizationRange | undefined {
  if (q === undefined) return undefined;
  const type = resolveEnum(module, 'QuantizationRangeType', q.type);
  if (type === 'full') return 'full';
  if (type === 'limited') return 'limited';
  return { min: q.min!, max: q.max! };
}

// ============================================================================
// Per-section normalizers
// ============================================================================

function normalizeGeometry(wasm: WasmGeometryInfo): GeometryInfo {
  return {
    width: wasm.width,
    height: wasm.height,
    orientation: wasm.orientation as ExifOrientation | undefined,
    pixelAspectRatio: wasm.pixelAspectRatio,
  };
}

function normalizeChannels(module: MainModule, wasm: WasmChannelsInfo): ChannelsInfo {
  return {
    model: resolveEnum(module, 'ChannelModel', wasm.model) as ChannelsInfo['model'],
    count: wasm.count,
    channels: wasm.channels ? vectorChannelDescriptorToArray(module, wasm.channels) : undefined,
  };
}

function normalizeNumeric(module: MainModule, wasm: WasmNumericInfo): NumericInfo {
  return {
    sampleType: resolveEnum(module, 'SampleType', wasm.sampleType) as NumericInfo['sampleType'],
    dataType: resolveEnum(module, 'DataType', wasm.dataType) as NumericInfo['dataType'],
    bitDepth: wasm.bitDepth,
    endianness: resolveEnumOpt(module, 'Endianness', wasm.endianness) as NumericInfo['endianness'],
    quantization: normalizeQuantization(module, wasm.quantization),
  };
}

function normalizeColor(module: MainModule, wasm: WasmColorInfo): ColorInfo {
  return {
    primaries: resolveEnumOpt(module, 'ColorPrimaries', wasm.primaries) as ColorInfo['primaries'],
    whitePoint: resolveEnumOpt(module, 'WhitePoint', wasm.whitePoint) as ColorInfo['whitePoint'],
    matrix: resolveEnumOpt(module, 'MatrixCoefficients', wasm.matrix) as ColorInfo['matrix'],
    customPrimaries: wasm.customPrimaries,
    customWhitePoint: wasm.customWhitePoint,
  };
}

function normalizeTransfer(module: MainModule, wasm: WasmTransferInfo): TransferInfo {
  return {
    function: resolveEnumOpt(module, 'TransferFunction', wasm.function) as TransferInfo['function'],
    gammaValue: wasm.gammaValue,
  };
}

function normalizeLuminance(module: MainModule, wasm: WasmLuminanceInfo): LuminanceInfo {
  return {
    reference: resolveEnumOpt(module, 'LuminanceReference', wasm.reference) as LuminanceInfo['reference'],
    diffuseWhite: wasm.diffuseWhite,
    peakBrightness: wasm.peakBrightness,
    minBrightness: wasm.minBrightness,
  };
}

function normalizeSampling(module: MainModule, wasm: WasmSamplingInfo): SamplingInfo {
  return {
    layout: resolveEnumOpt(module, 'SampleLayout', wasm.layout) as SamplingInfo['layout'],
    chromaSubsampling: resolveEnumOpt(module, 'ChromaSubsampling', wasm.chromaSubsampling) as SamplingInfo['chromaSubsampling'],
    chromaSamplePosition: resolveEnumOpt(module, 'ChromaSamplePosition', wasm.chromaSamplePosition) as SamplingInfo['chromaSamplePosition'],
  };
}

function normalizeAlpha(module: MainModule, wasm: WasmAlphaInfo): AlphaInfo {
  return {
    mode: resolveEnumOpt(module, 'AlphaMode', wasm.mode) as AlphaInfo['mode'],
    colorSpace: resolveEnumOpt(module, 'AlphaColorSpace', wasm.colorSpace) as AlphaInfo['colorSpace'],
    matteColor: wasm.matteColor,
  };
}

function normalizeMasteringDisplay(wasm: WasmMasteringDisplay): MasteringDisplay {
  return {
    primaries: wasm.primaries,
    whitePoint: wasm.whitePoint,
    luminance: wasm.luminance,
  };
}

function normalizeHDR(module: MainModule, wasm: WasmHDRMetadata): HDRMetadata {
  return {
    maxCLL: wasm.maxCLL,
    maxPALL: wasm.maxPALL,
    masteringDisplay: wasm.masteringDisplay ? normalizeMasteringDisplay(wasm.masteringDisplay) : undefined,
    toneMappingHint: resolveEnumOpt(module, 'ToneMappingHint', wasm.toneMappingHint) as HDRMetadata['toneMappingHint'],
  };
}

function normalizeRendering(module: MainModule, wasm: WasmRenderingInfo): RenderingInfo {
  return {
    intent: resolveEnumOpt(module, 'RenderingIntent', wasm.intent) as RenderingInfo['intent'],
    domain: resolveEnumOpt(module, 'ImageDomain', wasm.domain) as RenderingInfo['domain'],
  };
}

// ============================================================================
// Root normalizer
// ============================================================================

export function normalizeDescriptor(
  module: MainModule,
  wasm: WasmImageDescriptor,
): ImageDescriptor {
  return {
    geometry: normalizeGeometry(wasm.geometry),
    channels: normalizeChannels(module, wasm.channels),
    numeric: normalizeNumeric(module, wasm.numeric),
    color: wasm.color ? normalizeColor(module, wasm.color) : undefined,
    transfer: wasm.transfer ? normalizeTransfer(module, wasm.transfer) : undefined,
    luminance: wasm.luminance ? normalizeLuminance(module, wasm.luminance) : undefined,
    sampling: wasm.sampling ? normalizeSampling(module, wasm.sampling) : undefined,
    alpha: wasm.alpha ? normalizeAlpha(module, wasm.alpha) : undefined,
    hdr: wasm.hdr ? normalizeHDR(module, wasm.hdr) : undefined,
    rendering: wasm.rendering ? normalizeRendering(module, wasm.rendering) : undefined,
    iccProfile: wasm.iccProfile ? vectorUint8ToArray(wasm.iccProfile) : undefined,
  };
}
