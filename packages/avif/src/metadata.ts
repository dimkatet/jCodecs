import type {
  AVIFMetadata,
  MasteringDisplay,
  ColorPrimaries,
  TransferFunction,
  MatrixCoefficients,
} from './types';
import type {
  MainModule,
  ImageMetadata,
  MasteringDisplay as WASMMasteringDisplay,
} from './wasm/avif_dec';

/**
 * Convert WASM mastering display metadata to JS format
 */
export function convertMasteringDisplay(
  wasm: WASMMasteringDisplay,
): MasteringDisplay | undefined {
  if (!wasm.present) return undefined;

  return {
    primaries: {
      red: [wasm.redX, wasm.redY],
      green: [wasm.greenX, wasm.greenY],
      blue: [wasm.blueX, wasm.blueY],
    },
    whitePoint: [wasm.whiteX, wasm.whiteY],
    luminance: {
      min: wasm.minLuminance,
      max: wasm.maxLuminance,
    },
  };
}

/**
 * Convert WASM image metadata to AVIFMetadata format
 */
export function convertMetadata(
  wasm: ImageMetadata,
  module: MainModule,
): AVIFMetadata {
  // Copy ICC profile from WASM heap in one bulk operation
  let iccProfile: Uint8Array | undefined;
  if (wasm.iccProfileSize > 0 && wasm.iccProfilePtr !== 0) {
    iccProfile = module.HEAPU8.slice(
      wasm.iccProfilePtr,
      wasm.iccProfilePtr + wasm.iccProfileSize,
    );
    module._free(wasm.iccProfilePtr);
  }

  return {
    colorPrimaries: wasm.colorPrimaries as ColorPrimaries,
    transferFunction: wasm.transferFunction as TransferFunction,
    matrixCoefficients: wasm.matrixCoefficients as MatrixCoefficients,
    fullRange: wasm.fullRange,
    maxCLL: wasm.maxCLL,
    maxPALL: wasm.maxPALL,
    masteringDisplay: convertMasteringDisplay(wasm.masteringDisplay),
    iccProfile,
    isHDR: wasm.isHDR,
  };
}

export const defaultMetadata: AVIFMetadata = {
  colorPrimaries: "bt709",
  transferFunction: "bt709", // or srgb?
  matrixCoefficients: "bt709",
  fullRange: false,
  isHDR: false,
  maxCLL: 0,
  maxPALL: 0,
};
