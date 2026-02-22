import React, { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { ImagePreview } from './components/ImagePreview';
import { DynamicControls } from './components/DynamicControls';
import { FormatSelector } from './components/FormatSelector';
import { getFormatConfig, getDefaultOptions, FORMATS } from './config/formats';
import type { FormatConfig, FormatOptions } from './types/format-config';
import { initializeCodecs, decode, encode, getApiMode } from './utils/codec';
import { toDisplayableImageData, formatFileSize } from './utils/image';
import type { AutoImageData } from '@dimkatet/jcodecs-auto';

export const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [targetFormat, setTargetFormat] = useState<FormatConfig | null>(null);
  const [encodeOptions, setEncodeOptions] = useState<FormatOptions>({});

  const [inputImageData, setInputImageData] = useState<AutoImageData | null>(null);
  const [inputInfo, setInputInfo] = useState<string>('Loading WASM modules...');
  const [inputMetadata, setInputMetadata] = useState<Record<string, any> | undefined>();

  const [outputImageData, setOutputImageData] = useState<AutoImageData | null>(null);
  const [outputInfo, setOutputInfo] = useState<string>('Encode an image to see output');
  const [outputMetadata, setOutputMetadata] = useState<Record<string, any> | undefined>();

  const [encodedData, setEncodedData] = useState<Uint8Array | null>(null);
  const [isEncoding, setIsEncoding] = useState(false);
  const [originalFileSize, setOriginalFileSize] = useState<number>(0);

  // Initialize codecs on mount
  useEffect(() => {
    initializeCodecs()
      .then(() => {
        setIsInitialized(true);
        setInputInfo(`Select an image file (API Mode: ${getApiMode()})`);
      })
      .catch((err) => {
        console.error('Failed to initialize codecs:', err);
        setInputInfo('Failed to load WASM modules');
      });
  }, []);

  const handleFileSelect = async (file: File, extension: string) => {
    setEncodedData(null);
    setOutputImageData(null);
    setOutputInfo('Encode an image to see output');
    setOutputMetadata(undefined);

    const sourceFormat = getFormatConfig(extension);
    if (!sourceFormat) {
      setInputInfo(`Unsupported format: ${extension}`);
      return;
    }

    // Set target format to source format if not set yet
    if (!targetFormat) {
      setTargetFormat(sourceFormat);
      setEncodeOptions(getDefaultOptions(sourceFormat));
    }

    setInputInfo('Decoding...');
    setOriginalFileSize(file.size);

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);

      const start = performance.now();
      const result: AutoImageData = await decode(data, extension);
      const elapsed = performance.now() - start;
      setInputImageData(result);

      console.log('[Decode] Completed in', elapsed.toFixed(2), 'ms');

      const { geometry, numeric, channels, color, transfer, luminance, sampling } =
        result.descriptor;
      const isHDR = luminance?.reference === 'hdr';

      // Build flat metadata for display (exclude undefined values)
      setInputMetadata(
        Object.fromEntries(
          Object.entries({
            width: geometry.width,
            height: geometry.height,
            bitDepth: numeric.bitDepth,
            dataType: numeric.dataType,
            channels: channels.count,
            channelModel: channels.model,
            colorPrimaries: color?.primaries,
            transferFunction: transfer?.function,
            isHDR,
            chromaSubsampling: sampling?.chromaSubsampling,
          }).filter(([, v]) => v !== undefined),
        ),
      );

      const infoStr =
        `${geometry.width}x${geometry.height}, ${numeric.bitDepth}-bit, ` +
        `${isHDR ? 'HDR' : 'SDR'} ${color?.primaries ?? 'unknown'} ` +
        `(${elapsed.toFixed(0)}ms, ${formatFileSize(file.size)})`;
      setInputInfo(infoStr);
    } catch (err) {
      setInputInfo(`Error: ${(err as Error).message}`);
      console.error('[Decode] Error:', err);
    }
  };

  const handleOptionChange = (key: string, value: any) => {
    setEncodeOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleFormatChange = (format: FormatConfig) => {
    setTargetFormat(format);
    setEncodeOptions(getDefaultOptions(format));
  };

  const handleEncode = async () => {
    if (!inputImageData || !targetFormat) return;

    setIsEncoding(true);
    setOutputInfo('Encoding...');

    try {
      const start = performance.now();
      const encoded = await encode(inputImageData, targetFormat.extension, encodeOptions);
      const encodeTime = performance.now() - start;

      console.log('[Encode] Completed in', encodeTime.toFixed(2), 'ms');
      setEncodedData(encoded);

      // Decode to display
      const decoded = await decode(encoded, targetFormat.extension);
      setOutputImageData(decoded);

      const outDesc = decoded.descriptor;
      const outIsHDR = outDesc.luminance?.reference === 'hdr';

      setOutputMetadata(
        Object.fromEntries(
          Object.entries({
            width: outDesc.geometry.width,
            height: outDesc.geometry.height,
            bitDepth: outDesc.numeric.bitDepth,
            dataType: outDesc.numeric.dataType,
            channels: outDesc.channels.count,
            channelModel: outDesc.channels.model,
            colorPrimaries: outDesc.color?.primaries,
            transferFunction: outDesc.transfer?.function,
            isHDR: outIsHDR,
            chromaSubsampling: outDesc.sampling?.chromaSubsampling,
          }).filter(([, v]) => v !== undefined),
        ),
      );

      const ratio = ((encoded.length / originalFileSize) * 100).toFixed(1);
      const infoStr =
        `${formatFileSize(encoded.length)} (${ratio}% of original), ` +
        `${outDesc.numeric.bitDepth}-bit ` +
        `(${encodeTime.toFixed(0)}ms)`;
      setOutputInfo(infoStr);
    } catch (err) {
      setOutputInfo(`Error: ${(err as Error).message}`);
      console.error('[Encode] Error:', err);
    } finally {
      setIsEncoding(false);
    }
  };

  const handleDownload = () => {
    if (!encodedData || !targetFormat) return;

    const blob = new Blob([encodedData], { type: targetFormat.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `output.${targetFormat.extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h1>jCodecs Example ({getApiMode()} API)</h1>
      <p>Encode and decode images in the browser using WebAssembly.</p>

      <div className="container">
        <div className="panel">
          <ImagePreview
            title="Input"
            imageData={inputImageData && toDisplayableImageData(inputImageData)}
            info={inputInfo}
            metadata={inputMetadata}
          />
          <FileUpload
            onFileSelect={handleFileSelect}
            acceptedFormats={['avif', 'jxl', 'exr']}
          />
        </div>

        <div className="panel">
          <h2>Output</h2>

          <FormatSelector
            formats={Object.values(FORMATS)}
            selectedFormat={targetFormat}
            onFormatChange={handleFormatChange}
            disabled={!inputImageData}
          />

          {targetFormat && (
            <>
              <DynamicControls
                controls={targetFormat.controls}
                values={encodeOptions}
                onChange={handleOptionChange}
              />
              <button onClick={handleEncode} disabled={!inputImageData || isEncoding}>
                {isEncoding ? 'Encoding...' : `Encode to ${targetFormat.name}`}
              </button>
              <button onClick={handleDownload} disabled={!encodedData}>
                Download {targetFormat.extension.toUpperCase()}
              </button>
            </>
          )}

          <ImagePreview
            title=""
            imageData={outputImageData && toDisplayableImageData(outputImageData)}
            info={outputInfo}
            metadata={outputMetadata}
          />
        </div>
      </div>
    </div>
  );
};
