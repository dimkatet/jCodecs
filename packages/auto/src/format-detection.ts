/**
 * Image format detection via magic bytes
 */

export type ImageFormat = 'avif' | 'jxl' | 'unknown';

interface FormatSignature {
  format: ImageFormat;
  check: (data: Uint8Array) => boolean;
}

// AVIF: ftyp box at offset 4, brand at offset 8
const AVIF_FTYP = [0x66, 0x74, 0x79, 0x70]; // 'ftyp'
const AVIF_BRANDS = [
  [0x61, 0x76, 0x69, 0x66], // 'avif'
  [0x61, 0x76, 0x69, 0x73], // 'avis' (animated)
  [0x6d, 0x69, 0x66, 0x31], // 'mif1'
];

// JPEG-XL: codestream (0xFF 0x0A) or container format
const JXL_CONTAINER = [
  0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a,
];

const FORMAT_SIGNATURES: FormatSignature[] = [
  {
    format: 'jxl',
    check: (data) => {
      // Codestream: starts with 0xFF 0x0A
      if (data.length >= 2 && data[0] === 0xff && data[1] === 0x0a) {
        return true;
      }
      // Container: 12-byte signature
      if (data.length >= 12) {
        return JXL_CONTAINER.every((byte, i) => data[i] === byte);
      }
      return false;
    },
  },
  {
    format: 'avif',
    check: (data) => {
      // Need at least 12 bytes: 4 (size) + 4 (ftyp) + 4 (brand)
      if (data.length < 12) return false;

      // Check for ftyp box at offset 4
      const hasFtyp = AVIF_FTYP.every((byte, i) => data[4 + i] === byte);
      if (!hasFtyp) return false;

      // Check brand at offset 8
      return AVIF_BRANDS.some((brand) =>
        brand.every((byte, i) => data[8 + i] === byte),
      );
    },
  },
];

/**
 * Detect image format from magic bytes
 */
export function detectFormat(data: Uint8Array | ArrayBuffer): ImageFormat {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

  for (const sig of FORMAT_SIGNATURES) {
    if (sig.check(bytes)) {
      return sig.format;
    }
  }

  return 'unknown';
}

/**
 * Get file extension for format
 */
export function getFormatExtension(format: ImageFormat): string {
  switch (format) {
    case 'avif':
      return '.avif';
    case 'jxl':
      return '.jxl';
    default:
      return '';
  }
}

/**
 * Get MIME type for format
 */
export function getMimeType(format: ImageFormat): string {
  switch (format) {
    case 'avif':
      return 'image/avif';
    case 'jxl':
      return 'image/jxl';
    default:
      return 'application/octet-stream';
  }
}
