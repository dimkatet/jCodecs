import type { FormatConfig } from '../types/format-config';

/**
 * AVIF Format Configuration
 */
export const AVIF_FORMAT: FormatConfig = {
  name: 'AVIF',
  extension: 'avif',
  mimeType: 'image/avif',
  controls: [
    {
      type: 'slider',
      key: 'quality',
      label: 'Quality',
      min: 0,
      max: 100,
      defaultValue: 75,
      step: 1,
    },
    {
      type: 'slider',
      key: 'speed',
      label: 'Speed',
      min: 0,
      max: 10,
      defaultValue: 6,
      step: 1,
    },
    {
      type: 'select',
      key: 'bitDepth',
      label: 'Bit Depth',
      options: [
        { value: 8, label: '8-bit' },
        { value: 10, label: '10-bit' },
        { value: 12, label: '12-bit' },
      ],
      defaultValue: 8,
    },
    {
      type: 'select',
      key: 'chromaSubsampling',
      label: 'Chroma Subsampling',
      options: [
        { value: '4:2:0', label: '4:2:0' },
        { value: '4:2:2', label: '4:2:2' },
        { value: '4:4:4', label: '4:4:4' },
      ],
      defaultValue: '4:2:0',
    },
    {
      type: 'select',
      key: 'transferFunction',
      label: 'Transfer Function',
      options: [
        { value: 'srgb', label: 'sRGB' },
        { value: 'pq', label: 'PQ (HDR10)' },
        { value: 'hlg', label: 'HLG' },
        { value: 'linear', label: 'Linear' },
      ],
      defaultValue: 'srgb',
    },
    {
      type: 'select',
      key: 'colorSpace',
      label: 'Color Space',
      options: [
        { value: 'srgb', label: 'sRGB' },
        { value: 'display-p3', label: 'Display P3' },
        { value: 'rec2020', label: 'Rec.2020' },
      ],
      defaultValue: 'srgb',
    },
    {
      type: 'checkbox',
      key: 'lossless',
      label: 'Lossless',
      defaultValue: false,
    },
  ],
};

/**
 * JPEG-XL Format Configuration
 */
export const JXL_FORMAT: FormatConfig = {
  name: 'JPEG-XL',
  extension: 'jxl',
  mimeType: 'image/jxl',
  controls: [
    {
      type: 'slider',
      key: 'quality',
      label: 'Quality',
      min: 0,
      max: 100,
      defaultValue: 90,
      step: 1,
    },
    {
      type: 'slider',
      key: 'effort',
      label: 'Effort',
      min: 1,
      max: 10,
      defaultValue: 7,
      step: 1,
    },
    {
      type: 'select',
      key: 'bitDepth',
      label: 'Bit Depth',
      options: [
        { value: 8, label: '8-bit' },
        { value: 10, label: '10-bit' },
        { value: 12, label: '12-bit' },
        { value: 16, label: '16-bit' },
      ],
      defaultValue: 8,
    },
    {
      type: 'select',
      key: 'colorSpace',
      label: 'Color Space',
      options: [
        { value: 'srgb', label: 'sRGB' },
        { value: 'display-p3', label: 'Display P3' },
        { value: 'rec2020', label: 'Rec.2020' },
      ],
      defaultValue: 'srgb',
    },
    {
      type: 'select',
      key: 'transferFunction',
      label: 'Transfer Function',
      options: [
        { value: 'srgb', label: 'sRGB' },
        { value: 'pq', label: 'PQ (HDR10)' },
        { value: 'hlg', label: 'HLG' },
        { value: 'linear', label: 'Linear' },
      ],
      defaultValue: 'srgb',
    },
    {
      type: 'checkbox',
      key: 'progressive',
      label: 'Progressive',
      defaultValue: false,
    },
    {
      type: 'checkbox',
      key: 'lossless',
      label: 'Lossless',
      defaultValue: false,
    },
  ],
};

/**
 * All supported formats
 */
export const FORMATS: Record<string, FormatConfig> = {
  avif: AVIF_FORMAT,
  jxl: JXL_FORMAT,
};

/**
 * Get format configuration by extension
 */
export function getFormatConfig(extension: string): FormatConfig | undefined {
  return FORMATS[extension.toLowerCase()];
}

/**
 * Get default options for a format
 */
export function getDefaultOptions(format: FormatConfig): Record<string, any> {
  const options: Record<string, any> = {};
  for (const control of format.controls) {
    options[control.key] = control.defaultValue;
  }
  return options;
}
