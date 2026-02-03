/**
 * Dynamic format configuration types
 * Describes UI inputs for different codec formats
 */

export type InputControlType = 'slider' | 'select' | 'checkbox';

export interface SliderControl {
  type: 'slider';
  key: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  step?: number;
}

export interface SelectControl {
  type: 'select';
  key: string;
  label: string;
  options: Array<{ value: string | number; label: string }>;
  defaultValue: string | number;
}

export interface CheckboxControl {
  type: 'checkbox';
  key: string;
  label: string;
  defaultValue: boolean;
}

export type InputControl = SliderControl | SelectControl | CheckboxControl;

export interface FormatConfig {
  name: string;
  extension: string;
  mimeType: string;
  controls: InputControl[];
}

export type FormatOptions = Record<string, any>;
