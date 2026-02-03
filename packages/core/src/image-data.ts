import { ExtendedImageData } from "./types";

export const getExtendedImageData = <T extends object>(imageData: ImageData, metadata: T): ExtendedImageData<'uint8', T> => {
  const data = new Uint8Array(imageData.data);
  return {
    data,
    dataType: 'uint8',
    width: imageData.width,
    height: imageData.height,
    bitDepth: 8,
    channels: 4,
    metadata,
  };
}
