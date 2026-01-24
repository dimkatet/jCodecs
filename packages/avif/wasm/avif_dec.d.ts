import type {
  ColorPrimaries,
  TransferFunction,
  MatrixCoefficients,
} from '../src/types';

/** Emscripten std::vector<uint8_t> binding */
interface EmscriptenVector {
  size(): number;
  get(index: number): number;
  delete(): void;
}

interface WASMMasteringDisplay {
  redX: number;
  redY: number;
  greenX: number;
  greenY: number;
  blueX: number;
  blueY: number;
  whiteX: number;
  whiteY: number;
  minLuminance: number;
  maxLuminance: number;
  present: boolean;
}

interface WASMImageMetadata {
  colorPrimaries: ColorPrimaries;
  transferFunction: TransferFunction;
  matrixCoefficients: MatrixCoefficients;
  fullRange: boolean;
  maxCLL: number;
  maxPALL: number;
  masteringDisplay: WASMMasteringDisplay;
  iccProfile: EmscriptenVector;
  isHDR: boolean;
}

interface DecodeResult {
  dataPtr: number;   // Pointer to pixel data in WASM heap
  dataSize: number;  // Size in bytes
  width: number;
  height: number;
  depth: number;
  hasAlpha: boolean;
  metadata: WASMImageMetadata;
  error: string;
}

interface WASMImageInfo {
  width: number;
  height: number;
  depth: number;
  hasAlpha: boolean;
  metadata: WASMImageMetadata;
}

interface AVIFDecoderModule {
  decode(
    data: string,
    targetBitDepth: number,
    maxThreads: number
  ): DecodeResult;
  getImageInfo(data: string): WASMImageInfo;

  // Direct WASM heap access for zero-copy
  HEAPU8: Uint8Array;
  _free(ptr: number): void;
}

type ModuleFactory = (
  config?: Record<string, unknown>
) => Promise<AVIFDecoderModule>;

declare const createModule: ModuleFactory;
export default createModule;
export type {
  AVIFDecoderModule,
  DecodeResult,
  WASMImageInfo,
  WASMImageMetadata,
  WASMMasteringDisplay,
};
