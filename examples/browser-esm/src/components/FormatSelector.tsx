import React from 'react';
import type { FormatConfig } from '../types/format-config';

interface FormatSelectorProps {
  formats: FormatConfig[];
  selectedFormat: FormatConfig | null;
  onFormatChange: (format: FormatConfig) => void;
  disabled?: boolean;
}

export const FormatSelector: React.FC<FormatSelectorProps> = ({
  formats,
  selectedFormat,
  onFormatChange,
  disabled = false,
}) => {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label>
        Output Format:{' '}
        <select
          value={selectedFormat?.extension || ''}
          onChange={(e) => {
            const format = formats.find((f) => f.extension === e.target.value);
            if (format) onFormatChange(format);
          }}
          disabled={disabled}
        >
          {!selectedFormat && <option value="">Select format</option>}
          {formats.map((format) => (
            <option key={format.extension} value={format.extension}>
              {format.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};
