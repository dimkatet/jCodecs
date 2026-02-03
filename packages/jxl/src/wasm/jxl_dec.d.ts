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
export type MasteringDisplay = {
  redX: number,
  redY: number,
  greenX: number,
  greenY: number,
  blueX: number,
  blueY: number,
  whiteX: number,
  whiteY: number,
  minLuminance: number,
  maxLuminance: number,
  present: boolean
};

export type DecodeTimings = {
  setup: number,
  basicInfo: number,
  colorInfo: number,
  decode: number,
  memcpy: number,
  total: number
};

export type ImageMetadata = {
  colorPrimaries: EmbindString,
  transferFunction: EmbindString,
  matrixCoefficients: EmbindString,
  fullRange: boolean,
  maxCLL: number,
  maxPALL: number,
  masteringDisplay: MasteringDisplay,
  iccProfilePtr: number,
  iccProfileSize: number,
  isHDR: boolean,
  isAnimated: boolean,
  frameCount: number
};

export type ImageInfo = {
  width: number,
  height: number,
  depth: number,
  channels: number,
  metadata: ImageMetadata
};

export type DecodeResult = {
  dataPtr: number,
  dataSize: number,
  width: number,
  height: number,
  depth: number,
  channels: number,
  dataType: EmbindString,
  metadata: ImageMetadata,
  timings: DecodeTimings,
  error: EmbindString
};

interface EmbindModule {
  MAX_THREADS: number;
  getImageInfo(_0: number, _1: number): ImageInfo;
  decode(_0: number, _1: number, _2: number): DecodeResult;
}

export type MainModule = WasmModule & typeof RuntimeExports & EmbindModule;
export default function MainModuleFactory (options?: unknown): Promise<MainModule>;
