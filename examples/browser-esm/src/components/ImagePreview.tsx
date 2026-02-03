import React, { useEffect, useRef } from 'react';
import { formatMetadata } from '../utils/image';

interface ImagePreviewProps {
  imageData: ImageData | null;
  info: string;
  metadata?: Record<string, any>;
  title: string;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  imageData,
  info,
  metadata,
  title,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !imageData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
  }, [imageData]);

  return (
    <div>
      <h2>{title}</h2>
      <canvas
        ref={canvasRef}
        width={400}
        height={300}
        style={{ maxWidth: '100%' }}
      />
      <div className="info">{info}</div>

      {metadata && (
        <div className="metadata">
          <h3>Metadata</h3>
          <table>
            <tbody>
              {formatMetadata(metadata).map(({ key, value }) => (
                <tr key={key}>
                  <td className="metadata-key">{key}</td>
                  <td className="metadata-value">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
