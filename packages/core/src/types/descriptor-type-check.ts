// ============================================================================
// Compile-time validation: NormalizeWasm<WasmImageDescriptor> = ImageDescriptor
// ============================================================================
//
// Per-section mapped types derived FROM Wasm* types.
// Non-enum fields: auto-derived (new WASM fields propagate automatically).
// Enum fields: explicit WK<'ModuleKey'> — unavoidable, TypeScript can't
//   distinguish {value:0}|{value:1}|{value:2} (SampleLayout) from
//   {value:0}|{value:1}|{value:2} (SampleType) structurally.
//
// TS-only fields (not in WASM): explicitly added at the end via intersection.
//

import type {
  MainModule,
  ImageDescriptor as WasmImageDescriptor,
  GeometryInfo as WasmGeometryInfo,
  SamplingInfo as WasmSamplingInfo,
  ChannelDescriptor as WasmChannelDescriptor,
  ChannelsInfo as WasmChannelsInfo,
  NumericInfo as WasmNumericInfo,
  ColorInfo as WasmColorInfo,
  TransferInfo as WasmTransferInfo,
  LuminanceInfo as WasmLuminanceInfo,
  AlphaInfo as WasmAlphaInfo,
  MasteringDisplay as WasmMasteringDisplay,
  HDRMetadata as WasmHDRMetadata,
  RenderingInfo as WasmRenderingInfo,
  VectorChannelDescriptor,
  VectorUint8,
  EmbindString,
} from '../wasm/descriptor/jcodecs-descriptor';

import type {
  ExifOrientation,
  QuantizationRange,
  ImageDescriptor,
} from './descriptor';

// ============================================================================
// Utility types
// ============================================================================

type StringKeys<T> = `${Extract<keyof T, string | number>}`;
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;
type Assert<T extends true> = T;
type Simplify<T> = { [K in keyof T]: T[K] };

/** Resolve WASM module enum to string union */
type WK<K extends keyof MainModule> = StringKeys<MainModule[K]>;

/** Convert Embind container types to their JS equivalents */
type NormalizeContainer<T> =
  T extends VectorChannelDescriptor ? WasmChannelDescriptor[] :
  T extends VectorUint8 ? Uint8Array :
  T extends EmbindString ? string :
  T;

// ============================================================================
// Per-section normalizers — mapped over WASM types
// ============================================================================

type NormalizeWasmGeometry = {
  [K in keyof WasmGeometryInfo]:
    K extends 'orientation' ? ExifOrientation | undefined :
    NormalizeContainer<WasmGeometryInfo[K]>
};

type NormalizeWasmSampling = {
  [K in keyof WasmSamplingInfo]:
    K extends 'layout' ? WK<'SampleLayout'> | undefined :
    K extends 'chromaSubsampling' ? WK<'ChromaSubsampling'> | undefined :
    K extends 'chromaSamplePosition' ? WK<'ChromaSamplePosition'> | undefined :
    NormalizeContainer<WasmSamplingInfo[K]>
};

type NormalizeWasmChannelDescriptor = {
  [K in keyof WasmChannelDescriptor]:
    K extends 'role' ? WK<'ChannelRole'> :
    K extends 'name' ? string :
    NormalizeContainer<WasmChannelDescriptor[K]>
};

type NormalizeWasmChannels = {
  [K in keyof WasmChannelsInfo]:
    K extends 'model' ? WK<'ChannelModel'> :
    K extends 'channels' ? NormalizeWasmChannelDescriptor[] | undefined :
    NormalizeContainer<WasmChannelsInfo[K]>
};

type NormalizeWasmNumeric = {
  [K in keyof WasmNumericInfo]:
    K extends 'sampleType' ? WK<'SampleType'> :
    K extends 'dataType' ? WK<'DataType'> :
    K extends 'endianness' ? WK<'Endianness'> | undefined :
    K extends 'quantization' ? QuantizationRange | undefined :
    NormalizeContainer<WasmNumericInfo[K]>
};

type NormalizeWasmColor = {
  [K in keyof WasmColorInfo]:
    K extends 'primaries' ? WK<'ColorPrimaries'> | undefined :
    K extends 'whitePoint' ? WK<'WhitePoint'> | undefined :
    K extends 'matrix' ? WK<'MatrixCoefficients'> | undefined :
    NormalizeContainer<WasmColorInfo[K]>
};

type NormalizeWasmTransfer = Simplify<
  {
    [K in keyof WasmTransferInfo]:
      K extends 'function' ? WK<'TransferFunction'> | undefined :
      NormalizeContainer<WasmTransferInfo[K]>
  } & {
    customCurve?: { type: 'parametric' | 'lut'; data: unknown };
  }
>;

type NormalizeWasmLuminance = {
  [K in keyof WasmLuminanceInfo]:
    K extends 'reference' ? WK<'LuminanceReference'> | undefined :
    NormalizeContainer<WasmLuminanceInfo[K]>
};

type NormalizeWasmAlpha = {
  [K in keyof WasmAlphaInfo]:
    K extends 'mode' ? WK<'AlphaMode'> | undefined :
    K extends 'colorSpace' ? WK<'AlphaColorSpace'> | undefined :
    K extends 'matteColor' ? [r: number, g: number, b: number] | null | undefined :
    NormalizeContainer<WasmAlphaInfo[K]>
};

type NormalizeWasmMasteringDisplay = {
  [K in keyof WasmMasteringDisplay]:
    NormalizeContainer<WasmMasteringDisplay[K]>
};

type NormalizeWasmHDR = {
  [K in keyof WasmHDRMetadata]:
    K extends 'toneMappingHint' ? WK<'ToneMappingHint'> | undefined :
    K extends 'masteringDisplay' ? NormalizeWasmMasteringDisplay | undefined :
    NormalizeContainer<WasmHDRMetadata[K]>
};

type NormalizeWasmRendering = {
  [K in keyof WasmRenderingInfo]:
    K extends 'intent' ? WK<'RenderingIntent'> | undefined :
    K extends 'domain' ? WK<'ImageDomain'> | undefined :
    NormalizeContainer<WasmRenderingInfo[K]>
};

// ============================================================================
// Full descriptor — mapped over WasmImageDescriptor
// ============================================================================

type NormalizeWasmDescriptor = Simplify<
  // Derive all fields from WASM (new fields auto-propagate)
  {
    [K in keyof WasmImageDescriptor]:
      K extends 'geometry'  ? NormalizeWasmGeometry :
      K extends 'channels'  ? NormalizeWasmChannels :
      K extends 'numeric'   ? NormalizeWasmNumeric :
      K extends 'color'     ? NormalizeWasmColor | undefined :
      K extends 'transfer'  ? NormalizeWasmTransfer | undefined :
      K extends 'luminance' ? NormalizeWasmLuminance | undefined :
      K extends 'sampling'  ? NormalizeWasmSampling | undefined :
      K extends 'alpha'     ? NormalizeWasmAlpha | undefined :
      K extends 'hdr'       ? NormalizeWasmHDR | undefined :
      K extends 'rendering' ? NormalizeWasmRendering | undefined :
      K extends 'iccProfile' ? Uint8Array | undefined :
      NormalizeContainer<WasmImageDescriptor[K]>
  }
  // TS-only fields not present in WASM
  & { formatSpecific?: unknown }
>;

// ============================================================================
// Assertion + debug helpers
// ============================================================================

export type Descriptor = Assert<IsEqual<NormalizeWasmDescriptor, ImageDescriptor>>;

export type DiffKeys<A, B> =
  | Exclude<keyof A, keyof B>
  | Exclude<keyof B, keyof A>;

export type TypeDiff<A, B> = {
  missing: Exclude<keyof A, keyof B>;
  extra: Exclude<keyof B, keyof A>;
  mismatch: {
    [K in keyof A & keyof B]:
      IsEqual<A[K], B[K]> extends true
        ? never
        : { left: A[K]; right: B[K] }
  };
};

export type AssertSame<A, B> =
  IsEqual<A, B> extends true ? true : TypeDiff<A, B>;

