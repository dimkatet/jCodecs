import React from 'react';
import type {
  InputControl,
  SliderControl,
  SelectControl,
  CheckboxControl,
  FormatOptions,
} from '../types/format-config';

interface DynamicControlsProps {
  controls: InputControl[];
  values: FormatOptions;
  onChange: (key: string, value: any) => void;
}

export const DynamicControls: React.FC<DynamicControlsProps> = ({
  controls,
  values,
  onChange,
}) => {
  const renderControl = (control: InputControl) => {
    switch (control.type) {
      case 'slider':
        return <SliderInput control={control} value={values[control.key]} onChange={onChange} />;
      case 'select':
        return <SelectInput control={control} value={values[control.key]} onChange={onChange} />;
      case 'checkbox':
        return <CheckboxInput control={control} value={values[control.key]} onChange={onChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="controls">
      {controls.map((control) => (
        <div key={control.key}>{renderControl(control)}</div>
      ))}
    </div>
  );
};

// Slider component
const SliderInput: React.FC<{
  control: SliderControl;
  value: number;
  onChange: (key: string, value: number) => void;
}> = ({ control, value, onChange }) => {
  return (
    <label>
      {control.label}:{' '}
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step ?? 1}
        value={value}
        onChange={(e) => onChange(control.key, parseInt(e.target.value))}
      />
      <span>{value}</span>
    </label>
  );
};

// Select component
const SelectInput: React.FC<{
  control: SelectControl;
  value: string | number;
  onChange: (key: string, value: string | number) => void;
}> = ({ control, value, onChange }) => {
  return (
    <label>
      {control.label}:{' '}
      <select
        value={value}
        onChange={(e) => {
          const val = e.target.value;
          // Try to parse as number if original defaultValue was number
          const parsedVal =
            typeof control.defaultValue === 'number' ? parseInt(val) : val;
          onChange(control.key, parsedVal);
        }}
      >
        {control.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
};

// Checkbox component
const CheckboxInput: React.FC<{
  control: CheckboxControl;
  value: boolean;
  onChange: (key: string, value: boolean) => void;
}> = ({ control, value, onChange }) => {
  return (
    <label>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(control.key, e.target.checked)}
      />
      {control.label}
    </label>
  );
};
