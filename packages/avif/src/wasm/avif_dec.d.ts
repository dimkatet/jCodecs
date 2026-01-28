import type {
  ColorPrimaries,
  TransferFunction,
  MatrixCoefficients,
} from '../types';

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
  iccProfilePtr: number;  // Pointer to ICC data in WASM heap
  iccProfileSize: number; // Size in bytes
  isHDR: boolean;
}

interface DecodeResult {
  dataPtr: number;   // Pointer to pixel data in WASM heap
  dataSize: number;  // Size in bytes
  width: number;
  height: number;
  depth: number;
  channels: number;
  metadata: WASMImageMetadata;
  error: string;
  timings: object;
}

interface WASMImageInfo {
  width: number;
  height: number;
  depth: number;
  channels: number;
  metadata: WASMImageMetadata;
}

interface AVIFDecoderModule {
  decode(
    inputPtr: number,
    inputSize: number,
    targetBitDepth: number,
    maxThreads: number
  ): DecodeResult;
  getImageInfo(inputPtr: number, inputSize: number): WASMImageInfo;

  // WASM memory management
  HEAPU8: Uint8Array;
  HEAPU16: Uint16Array;
  _malloc(size: number): number;
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
