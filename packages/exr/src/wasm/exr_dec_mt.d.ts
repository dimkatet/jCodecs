// TypeScript bindings for emscripten-generated code.  Automatically generated at compile time.
declare namespace RuntimeExports {
    /**
     * @param {string|null=} returnType
     * @param {Array=} argTypes
     * @param {Array=} args
     * @param {Object=} opts
     */
    function ccall(ident: any, returnType?: (string | null) | undefined, argTypes?: any[] | undefined, args?: any[] | undefined, opts?: any | undefined): any;
    /**
     * @param {string=} returnType
     * @param {Array=} argTypes
     * @param {Object=} opts
     */
    function cwrap(ident: any, returnType?: string | undefined, argTypes?: any[] | undefined, opts?: any | undefined): any;
    let HEAPU8: any;
    let HEAPU16: any;
}
interface WasmModule {
  _malloc(_0: number): number;
  _free(_0: number): void;
}

type EmbindString = ArrayBuffer|Uint8Array|Uint8ClampedArray|Int8Array|string;
export interface ClassHandle {
  isAliasOf(other: ClassHandle): boolean;
  delete(): void;
  deleteLater(): this;
  isDeleted(): boolean;
  // @ts-ignore - If targeting lower than ESNext, this symbol might not exist.
  [Symbol.dispose](): void;
  clone(): this;
}
export type EXRWindow = {
  xMin: number,
  yMin: number,
  xMax: number,
  yMax: number
};

export type EXRChromaticities = {
  redX: number,
  redY: number,
  greenX: number,
  greenY: number,
  blueX: number,
  blueY: number,
  whiteX: number,
  whiteY: number,
  present: boolean
};

export type DecodeTimings = {
  setup: number,
  headerParse: number,
  decode: number,
  memcpy: number,
  total: number
};

export type EXRFormatData = {
  compression: EmbindString,
  dataWindow: EXRWindow,
  displayWindow: EXRWindow,
  chromaticities: EXRChromaticities
};

export type ArrayFloat2 = [ number, number ];

export type ArrayFloat3 = [ number, number, number ];

export interface SampleLayoutValue<T extends number> {
  value: T;
}
export type SampleLayout = SampleLayoutValue<0>|SampleLayoutValue<1>|SampleLayoutValue<2>;

export interface ChromaSubsamplingValue<T extends number> {
  value: T;
}
export type ChromaSubsampling = ChromaSubsamplingValue<0>|ChromaSubsamplingValue<1>|ChromaSubsamplingValue<2>|ChromaSubsamplingValue<3>;

export interface ChromaSamplePositionValue<T extends number> {
  value: T;
}
export type ChromaSamplePosition = ChromaSamplePositionValue<0>|ChromaSamplePositionValue<1>|ChromaSamplePositionValue<2>|ChromaSamplePositionValue<3>;

export interface ChannelModelValue<T extends number> {
  value: T;
}
export type ChannelModel = ChannelModelValue<0>|ChannelModelValue<1>|ChannelModelValue<2>|ChannelModelValue<3>|ChannelModelValue<4>|ChannelModelValue<5>|ChannelModelValue<6>|ChannelModelValue<7>|ChannelModelValue<8>|ChannelModelValue<9>|ChannelModelValue<10>;

export interface ChannelRoleValue<T extends number> {
  value: T;
}
export type ChannelRole = ChannelRoleValue<0>|ChannelRoleValue<1>|ChannelRoleValue<2>|ChannelRoleValue<3>|ChannelRoleValue<4>|ChannelRoleValue<5>|ChannelRoleValue<6>|ChannelRoleValue<7>|ChannelRoleValue<8>|ChannelRoleValue<9>|ChannelRoleValue<10>|ChannelRoleValue<11>|ChannelRoleValue<12>|ChannelRoleValue<13>|ChannelRoleValue<14>|ChannelRoleValue<15>|ChannelRoleValue<16>|ChannelRoleValue<17>|ChannelRoleValue<18>|ChannelRoleValue<19>|ChannelRoleValue<20>|ChannelRoleValue<21>|ChannelRoleValue<22>|ChannelRoleValue<23>|ChannelRoleValue<24>|ChannelRoleValue<25>|ChannelRoleValue<26>;

export type ChannelDescriptor = {
  name: EmbindString,
  role: ChannelRole,
  index: number
};

export interface SampleTypeValue<T extends number> {
  value: T;
}
export type SampleType = SampleTypeValue<0>|SampleTypeValue<1>|SampleTypeValue<2>;

export interface DataTypeValue<T extends number> {
  value: T;
}
export type DataType = DataTypeValue<0>|DataTypeValue<1>|DataTypeValue<2>|DataTypeValue<3>;

export interface EndiannessValue<T extends number> {
  value: T;
}
export type Endianness = EndiannessValue<0>|EndiannessValue<1>|EndiannessValue<2>;

export interface QuantizationRangeTypeValue<T extends number> {
  value: T;
}
export type QuantizationRangeType = QuantizationRangeTypeValue<0>|QuantizationRangeTypeValue<1>|QuantizationRangeTypeValue<2>;

export interface ColorPrimariesValue<T extends number> {
  value: T;
}
export type ColorPrimaries = ColorPrimariesValue<0>|ColorPrimariesValue<1>|ColorPrimariesValue<2>|ColorPrimariesValue<3>|ColorPrimariesValue<4>|ColorPrimariesValue<5>|ColorPrimariesValue<6>|ColorPrimariesValue<7>|ColorPrimariesValue<8>|ColorPrimariesValue<9>|ColorPrimariesValue<10>|ColorPrimariesValue<11>|ColorPrimariesValue<12>;

export interface WhitePointValue<T extends number> {
  value: T;
}
export type WhitePoint = WhitePointValue<0>|WhitePointValue<1>|WhitePointValue<2>|WhitePointValue<3>;

export interface MatrixCoefficientsValue<T extends number> {
  value: T;
}
export type MatrixCoefficients = MatrixCoefficientsValue<0>|MatrixCoefficientsValue<1>|MatrixCoefficientsValue<2>|MatrixCoefficientsValue<3>|MatrixCoefficientsValue<4>|MatrixCoefficientsValue<5>|MatrixCoefficientsValue<6>|MatrixCoefficientsValue<7>|MatrixCoefficientsValue<8>;

export type CustomPrimaries = {
  red: ArrayFloat2,
  green: ArrayFloat2,
  blue: ArrayFloat2
};

export interface TransferFunctionValue<T extends number> {
  value: T;
}
export type TransferFunction = TransferFunctionValue<0>|TransferFunctionValue<1>|TransferFunctionValue<2>|TransferFunctionValue<3>|TransferFunctionValue<4>|TransferFunctionValue<5>|TransferFunctionValue<6>|TransferFunctionValue<7>|TransferFunctionValue<8>|TransferFunctionValue<9>|TransferFunctionValue<10>|TransferFunctionValue<11>|TransferFunctionValue<12>|TransferFunctionValue<13>|TransferFunctionValue<14>|TransferFunctionValue<15>|TransferFunctionValue<16>|TransferFunctionValue<17>;

export interface LuminanceReferenceValue<T extends number> {
  value: T;
}
export type LuminanceReference = LuminanceReferenceValue<0>|LuminanceReferenceValue<1>;

export interface AlphaModeValue<T extends number> {
  value: T;
}
export type AlphaMode = AlphaModeValue<0>|AlphaModeValue<1>|AlphaModeValue<2>;

export interface AlphaColorSpaceValue<T extends number> {
  value: T;
}
export type AlphaColorSpace = AlphaColorSpaceValue<0>|AlphaColorSpaceValue<1>;

export type MasteringDisplayPrimaries = {
  red: ArrayFloat2,
  green: ArrayFloat2,
  blue: ArrayFloat2
};

export type MasteringDisplayLuminance = {
  min: number,
  max: number
};

export type MasteringDisplay = {
  primaries: MasteringDisplayPrimaries,
  whitePoint: ArrayFloat2,
  luminance: MasteringDisplayLuminance
};

export interface ToneMappingHintValue<T extends number> {
  value: T;
}
export type ToneMappingHint = ToneMappingHintValue<0>|ToneMappingHintValue<1>|ToneMappingHintValue<2>|ToneMappingHintValue<3>|ToneMappingHintValue<4>|ToneMappingHintValue<5>;

export interface RenderingIntentValue<T extends number> {
  value: T;
}
export type RenderingIntent = RenderingIntentValue<0>|RenderingIntentValue<1>|RenderingIntentValue<2>|RenderingIntentValue<3>;

export interface ImageDomainValue<T extends number> {
  value: T;
}
export type ImageDomain = ImageDomainValue<0>|ImageDomainValue<1>|ImageDomainValue<2>;

export interface AuxiliaryRoleValue<T extends number> {
  value: T;
}
export type AuxiliaryRole = AuxiliaryRoleValue<0>|AuxiliaryRoleValue<1>|AuxiliaryRoleValue<2>|AuxiliaryRoleValue<3>|AuxiliaryRoleValue<4>|AuxiliaryRoleValue<5>|AuxiliaryRoleValue<6>|AuxiliaryRoleValue<7>|AuxiliaryRoleValue<8>|AuxiliaryRoleValue<9>|AuxiliaryRoleValue<10>|AuxiliaryRoleValue<11>|AuxiliaryRoleValue<12>;

export interface ImageDescriptorBuilder extends ClassHandle {
  setGeometry(_0: number, _1: number): ImageDescriptorBuilder;
  setOrientation(_0: number): ImageDescriptorBuilder;
  setPixelAspectRatio(_0: number): ImageDescriptorBuilder;
  setChannels(_0: ChannelModel, _1: number): ImageDescriptorBuilder;
  addChannel(_0: EmbindString, _1: ChannelRole, _2: number): ImageDescriptorBuilder;
  setNumeric(_0: SampleType, _1: DataType, _2: number): ImageDescriptorBuilder;
  setEndianness(_0: Endianness): ImageDescriptorBuilder;
  setColorPrimaries(_0: ColorPrimaries): ImageDescriptorBuilder;
  setWhitePoint(_0: WhitePoint): ImageDescriptorBuilder;
  setMatrixCoefficients(_0: MatrixCoefficients): ImageDescriptorBuilder;
  setCustomPrimaries(_0: CustomPrimaries): ImageDescriptorBuilder;
  setCustomWhitePoint(_0: number, _1: number): ImageDescriptorBuilder;
  setTransferFunction(_0: TransferFunction): ImageDescriptorBuilder;
  setGammaValue(_0: number): ImageDescriptorBuilder;
  setLuminanceReference(_0: LuminanceReference): ImageDescriptorBuilder;
  setDiffuseWhite(_0: number): ImageDescriptorBuilder;
  setPeakBrightness(_0: number): ImageDescriptorBuilder;
  setMinBrightness(_0: number): ImageDescriptorBuilder;
  setSampleLayout(_0: SampleLayout): ImageDescriptorBuilder;
  setChromaSubsampling(_0: ChromaSubsampling): ImageDescriptorBuilder;
  setChromaSamplePosition(_0: ChromaSamplePosition): ImageDescriptorBuilder;
  setAlphaMode(_0: AlphaMode): ImageDescriptorBuilder;
  setAlphaColorSpace(_0: AlphaColorSpace): ImageDescriptorBuilder;
  setMatteColor(_0: number, _1: number, _2: number): ImageDescriptorBuilder;
  setMaxCLL(_0: number): ImageDescriptorBuilder;
  setMaxPALL(_0: number): ImageDescriptorBuilder;
  setMasteringDisplay(_0: MasteringDisplay): ImageDescriptorBuilder;
  setToneMappingHint(_0: ToneMappingHint): ImageDescriptorBuilder;
  setRenderingIntent(_0: RenderingIntent): ImageDescriptorBuilder;
  setImageDomain(_0: ImageDomain): ImageDescriptorBuilder;
  setICCProfile(_0: VectorUint8): ImageDescriptorBuilder;
  setQuantization(_0: QuantizationRange): ImageDescriptorBuilder;
  build(): ImageDescriptor;
}

export interface VectorChannelDescriptor extends ClassHandle {
  push_back(_0: ChannelDescriptor): void;
  resize(_0: number, _1: ChannelDescriptor): void;
  size(): number;
  get(_0: number): ChannelDescriptor | undefined;
  set(_0: number, _1: ChannelDescriptor): boolean;
}

export interface VectorUint8 extends ClassHandle {
  push_back(_0: number): void;
  resize(_0: number, _1: number): void;
  size(): number;
  get(_0: number): number | undefined;
  set(_0: number, _1: number): boolean;
}

export type GeometryInfo = {
  width: number,
  height: number,
  orientation?: number | undefined,
  pixelAspectRatio?: number | undefined
};

export type QuantizationRange = {
  type: QuantizationRangeType,
  min?: number | undefined,
  max?: number | undefined
};

export type SamplingInfo = {
  layout?: SampleLayout | undefined,
  chromaSubsampling?: ChromaSubsampling | undefined,
  chromaSamplePosition?: ChromaSamplePosition | undefined
};

export type TransferInfo = {
  function?: TransferFunction | undefined,
  gammaValue?: number | undefined
};

export type LuminanceInfo = {
  reference?: LuminanceReference | undefined,
  diffuseWhite?: number | undefined,
  peakBrightness?: number | undefined,
  minBrightness?: number | undefined
};

export type AlphaInfo = {
  mode?: AlphaMode | undefined,
  colorSpace?: AlphaColorSpace | undefined,
  matteColor?: ArrayFloat3 | undefined
};

export type RenderingInfo = {
  intent?: RenderingIntent | undefined,
  domain?: ImageDomain | undefined
};

export type ColorInfo = {
  primaries?: ColorPrimaries | undefined,
  whitePoint?: WhitePoint | undefined,
  matrix?: MatrixCoefficients | undefined,
  customPrimaries?: CustomPrimaries | undefined,
  customWhitePoint?: ArrayFloat2 | undefined
};

export type HDRMetadata = {
  maxCLL?: number | undefined,
  maxPALL?: number | undefined,
  masteringDisplay?: MasteringDisplay | undefined,
  toneMappingHint?: ToneMappingHint | undefined
};

export type NumericInfo = {
  sampleType: SampleType,
  dataType: DataType,
  bitDepth: number,
  endianness?: Endianness | undefined,
  quantization?: QuantizationRange | undefined
};

export type ChannelsInfo = {
  model: ChannelModel,
  count: number,
  channels?: VectorChannelDescriptor | undefined
};

export type ImageDescriptor = {
  geometry: GeometryInfo,
  channels: ChannelsInfo,
  numeric: NumericInfo,
  color?: ColorInfo | undefined,
  transfer?: TransferInfo | undefined,
  luminance?: LuminanceInfo | undefined,
  sampling?: SamplingInfo | undefined,
  alpha?: AlphaInfo | undefined,
  hdr?: HDRMetadata | undefined,
  rendering?: RenderingInfo | undefined,
  iccProfile?: VectorUint8 | undefined
};

export type DecodeResult = {
  dataPtr: number,
  dataSize: number,
  descriptor: ImageDescriptor,
  formatData: EXRFormatData,
  timings: DecodeTimings,
  error: EmbindString
};

export type ImageInfo = {
  descriptor: ImageDescriptor,
  formatData: EXRFormatData
};

interface EmbindModule {
  MAX_THREADS: number;
  SampleLayout: {interleaved: SampleLayoutValue<0>, planar: SampleLayoutValue<1>, semiPlanar: SampleLayoutValue<2>};
  ChromaSubsampling: {444: ChromaSubsamplingValue<0>, 422: ChromaSubsamplingValue<1>, 420: ChromaSubsamplingValue<2>, 400: ChromaSubsamplingValue<3>};
  ChromaSamplePosition: {centered: ChromaSamplePositionValue<0>, cosited: ChromaSamplePositionValue<1>, vertical: ChromaSamplePositionValue<2>, topleft: ChromaSamplePositionValue<3>};
  ChannelModel: {rgb: ChannelModelValue<0>, rgba: ChannelModelValue<1>, gray: ChannelModelValue<2>, graya: ChannelModelValue<3>, ycbcr: ChannelModelValue<4>, ycbcra: ChannelModelValue<5>, cmyk: ChannelModelValue<6>, cmyka: ChannelModelValue<7>, xyz: ChannelModelValue<8>, lab: ChannelModelValue<9>, custom: ChannelModelValue<10>};
  ChannelRole: {red: ChannelRoleValue<0>, green: ChannelRoleValue<1>, blue: ChannelRoleValue<2>, luma: ChannelRoleValue<3>, chromaBlue: ChannelRoleValue<4>, chromaRed: ChannelRoleValue<5>, cyan: ChannelRoleValue<6>, magenta: ChannelRoleValue<7>, yellow: ChannelRoleValue<8>, black: ChannelRoleValue<9>, gray: ChannelRoleValue<10>, alpha: ChannelRoleValue<11>, depth: ChannelRoleValue<12>, normalX: ChannelRoleValue<13>, normalY: ChannelRoleValue<14>, normalZ: ChannelRoleValue<15>, specular: ChannelRoleValue<16>, roughness: ChannelRoleValue<17>, metallic: ChannelRoleValue<18>, occlusion: ChannelRoleValue<19>, x: ChannelRoleValue<20>, y: ChannelRoleValue<21>, z: ChannelRoleValue<22>, lightness: ChannelRoleValue<23>, a: ChannelRoleValue<24>, b: ChannelRoleValue<25>, custom: ChannelRoleValue<26>};
  SampleType: {uint: SampleTypeValue<0>, sint: SampleTypeValue<1>, float: SampleTypeValue<2>};
  DataType: {uint8: DataTypeValue<0>, uint16: DataTypeValue<1>, float16: DataTypeValue<2>, float32: DataTypeValue<3>};
  Endianness: {little: EndiannessValue<0>, big: EndiannessValue<1>, native: EndiannessValue<2>};
  QuantizationRangeType: {full: QuantizationRangeTypeValue<0>, limited: QuantizationRangeTypeValue<1>, custom: QuantizationRangeTypeValue<2>};
  ColorPrimaries: {bt709: ColorPrimariesValue<0>, bt2020: ColorPrimariesValue<1>, displayP3: ColorPrimariesValue<2>, dciP3: ColorPrimariesValue<3>, bt470m: ColorPrimariesValue<4>, bt470bg: ColorPrimariesValue<5>, bt601: ColorPrimariesValue<6>, smpte240: ColorPrimariesValue<7>, genericFilm: ColorPrimariesValue<8>, xyz: ColorPrimariesValue<9>, ebu3213: ColorPrimariesValue<10>, aces: ColorPrimariesValue<11>, acescg: ColorPrimariesValue<12>};
  WhitePoint: {d65: WhitePointValue<0>, d50: WhitePointValue<1>, dci: WhitePointValue<2>, e: WhitePointValue<3>};
  MatrixCoefficients: {identity: MatrixCoefficientsValue<0>, bt709: MatrixCoefficientsValue<1>, bt2020Ncl: MatrixCoefficientsValue<2>, bt2020Cl: MatrixCoefficientsValue<3>, bt601: MatrixCoefficientsValue<4>, smpte240: MatrixCoefficientsValue<5>, ycgco: MatrixCoefficientsValue<6>, ictcp: MatrixCoefficientsValue<7>, fcc: MatrixCoefficientsValue<8>};
  TransferFunction: {linear: TransferFunctionValue<0>, srgb: TransferFunctionValue<1>, bt709: TransferFunctionValue<2>, pq: TransferFunctionValue<3>, hlg: TransferFunctionValue<4>, gamma: TransferFunctionValue<5>, bt470m: TransferFunctionValue<6>, bt470bg: TransferFunctionValue<7>, bt601: TransferFunctionValue<8>, smpte240: TransferFunctionValue<9>, bt202010Bit: TransferFunctionValue<10>, bt202012Bit: TransferFunctionValue<11>, log100: TransferFunctionValue<12>, log100Sqrt10: TransferFunctionValue<13>, iec61966: TransferFunctionValue<14>, bt1361: TransferFunctionValue<15>, smpte428: TransferFunctionValue<16>, dci: TransferFunctionValue<17>};
  LuminanceReference: {sdr: LuminanceReferenceValue<0>, hdr: LuminanceReferenceValue<1>};
  AlphaMode: {none: AlphaModeValue<0>, straight: AlphaModeValue<1>, premultiplied: AlphaModeValue<2>};
  AlphaColorSpace: {linear: AlphaColorSpaceValue<0>, encoded: AlphaColorSpaceValue<1>};
  ToneMappingHint: {none: ToneMappingHintValue<0>, clip: ToneMappingHintValue<1>, reinhard: ToneMappingHintValue<2>, filmic: ToneMappingHintValue<3>, aces: ToneMappingHintValue<4>, custom: ToneMappingHintValue<5>};
  RenderingIntent: {perceptual: RenderingIntentValue<0>, relative: RenderingIntentValue<1>, absolute: RenderingIntentValue<2>, saturation: RenderingIntentValue<3>};
  ImageDomain: {sceneReferred: ImageDomainValue<0>, displayReferred: ImageDomainValue<1>, outputReferred: ImageDomainValue<2>};
  AuxiliaryRole: {gainMap: AuxiliaryRoleValue<0>, alpha: AuxiliaryRoleValue<1>, depth: AuxiliaryRoleValue<2>, disparity: AuxiliaryRoleValue<3>, normal: AuxiliaryRoleValue<4>, specular: AuxiliaryRoleValue<5>, roughness: AuxiliaryRoleValue<6>, metallic: AuxiliaryRoleValue<7>, occlusion: AuxiliaryRoleValue<8>, emissive: AuxiliaryRoleValue<9>, thumbnail: AuxiliaryRoleValue<10>, mipmap: AuxiliaryRoleValue<11>, custom: AuxiliaryRoleValue<12>};
  ImageDescriptorBuilder: {
    new(): ImageDescriptorBuilder;
  };
  VectorChannelDescriptor: {
    new(): VectorChannelDescriptor;
  };
  VectorUint8: {
    new(): VectorUint8;
  };
  decode(_0: number, _1: number, _2: EmbindString, _3: number): DecodeResult;
  getImageInfo(_0: number, _1: number): ImageInfo;
  createSDRDescriptor(_0: number, _1: number, _2: ChannelModel, _3: DataType, _4: number): ImageDescriptor;
  createHDRDescriptor(_0: number, _1: number, _2: ChannelModel, _3: DataType, _4: number, _5: ColorPrimaries, _6: TransferFunction): ImageDescriptor;
  isValidDescriptor(_0: ImageDescriptor): boolean;
  areDescriptorsCompatible(_0: ImageDescriptor, _1: ImageDescriptor): boolean;
}

export type MainModule = WasmModule & typeof RuntimeExports & EmbindModule;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
