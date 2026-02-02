import type {
  AVIFWorkerClient,
  ChromaSubsampling,
  ColorSpace,
  TransferFunctionOption,
} from "@dimkatet/jcodecs-avif";
import {
  initEncoder,
  initDecoder,
  decode,
  encode,
  createWorkerPool,
  decodeInWorker,
  encodeInWorker,
} from "@dimkatet/jcodecs-avif";

const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const inputCanvas = document.getElementById("inputCanvas") as HTMLCanvasElement;
const outputCanvas = document.getElementById(
  "outputCanvas",
) as HTMLCanvasElement;
const inputInfo = document.getElementById("inputInfo") as HTMLDivElement;
const outputInfo = document.getElementById("outputInfo") as HTMLDivElement;
const qualitySlider = document.getElementById("quality") as HTMLInputElement;
const qualityValue = document.getElementById("qualityValue") as HTMLSpanElement;
const speedSlider = document.getElementById("speed") as HTMLInputElement;
const speedValue = document.getElementById("speedValue") as HTMLSpanElement;
const bitDepthSelect = document.getElementById("bitDepth") as HTMLSelectElement;
const chromaSelect = document.getElementById("chroma") as HTMLSelectElement;
const transferSelect = document.getElementById("transfer") as HTMLSelectElement;
const colorSpaceSelect = document.getElementById(
  "colorSpace",
) as HTMLSelectElement;
const losslessCheckbox = document.getElementById(
  "lossless",
) as HTMLInputElement;
const encodeBtn = document.getElementById("encodeBtn") as HTMLButtonElement;
const downloadBtn = document.getElementById("downloadBtn") as HTMLButtonElement;

const inputCtx = inputCanvas.getContext("2d")!;
const outputCtx = outputCanvas.getContext("2d")!;

let decodeClient: AVIFWorkerClient | null = null;
let encodeClient: AVIFWorkerClient | null = null;

let currentImageData: ImageData | null = null;
let encodedAvif: Uint8Array | null = null;

// Map color primaries to color space option
function mapColorPrimariesToColorSpace(primaries: string): ColorSpace {
  switch (primaries) {
    case "display-p3":
    case "dci-p3":
      return "display-p3";
    case "bt2020":
      return "rec2020";
    default:
      return "srgb";
  }
}

// Map transfer function from metadata to option
function mapTransferFunction(tf: string): TransferFunctionOption {
  switch (tf) {
    case "pq":
      return "pq";
    case "hlg":
      return "hlg";
    case "linear":
      return "linear";
    default:
      return "srgb";
  }
}

// Update controls to match decoded file
function updateControlsFromMetadata(
  bitDepth: number,
  metadata: { colorPrimaries: string; transferFunction: string },
) {
  // Bit depth
  if (bitDepth === 10 || bitDepth === 12) {
    bitDepthSelect.value = String(bitDepth);
  } else {
    bitDepthSelect.value = "8";
  }

  // Color space
  colorSpaceSelect.value = mapColorPrimariesToColorSpace(
    metadata.colorPrimaries,
  );

  // Transfer function
  transferSelect.value = mapTransferFunction(metadata.transferFunction);

  // HDR typically uses 4:4:4
  if (
    metadata.transferFunction === "pq" ||
    metadata.transferFunction === "hlg"
  ) {
    chromaSelect.value = "4:4:4";
  }
}

// Update slider values
qualitySlider.addEventListener("input", () => {
  qualityValue.textContent = qualitySlider.value;
});

speedSlider.addEventListener("input", () => {
  speedValue.textContent = speedSlider.value;
});

// Handle file input
fileInput.addEventListener("change", async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // Reset state
  encodedAvif = null;
  downloadBtn.disabled = true;

  // Check if it's an AVIF file
  if (file.name.toLowerCase().endsWith(".avif")) {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    console.log("Decoding AVIF...");
    inputInfo.textContent = "Decoding AVIF...";

    try {
      const start = performance.now();
      // const result = await decode(data, { maxThreads: 8 });
      if (!decodeClient) throw new Error("Decoder not initialized");
      const result = await decodeInWorker(decodeClient, data, { maxThreads: 17 });
      const elapsed = performance.now() - start;

      console.log(`Decode completed in ${elapsed.toFixed(2)}ms`);

      // Display on canvas (convert to 8-bit if needed)
      let displayData: Uint8ClampedArray;
      if (result.bitDepth > 8) {
        // Convert 10/12/16-bit to 8-bit for display
        const src = result.data as Uint16Array;
        const shift = result.bitDepth - 8;
        displayData = new Uint8ClampedArray(result.width * result.height * 4);
        for (let i = 0; i < result.width * result.height; i++) {
          const srcIdx = i * result.channels;
          const dstIdx = i * 4;
          displayData[dstIdx] = src[srcIdx] >> shift;
          displayData[dstIdx + 1] = src[srcIdx + 1] >> shift;
          displayData[dstIdx + 2] = src[srcIdx + 2] >> shift;
          displayData[dstIdx + 3] =
            result.channels === 4 ? src[srcIdx + 3] >> shift : 255;
        }
      } else {
        const src = result.data as Uint8Array;
        displayData = new Uint8ClampedArray(result.width * result.height * 4);
        for (let i = 0; i < result.width * result.height; i++) {
          const srcIdx = i * result.channels;
          const dstIdx = i * 4;
          displayData[dstIdx] = src[srcIdx];
          displayData[dstIdx + 1] = src[srcIdx + 1];
          displayData[dstIdx + 2] = src[srcIdx + 2];
          displayData[dstIdx + 3] =
            result.channels === 4 ? src[srcIdx + 3] : 255;
        }
      }

      inputCanvas.width = result.width;
      inputCanvas.height = result.height;
      const imageData = new ImageData(displayData, result.width, result.height);
      inputCtx.putImageData(imageData, 0, 0);
      currentImageData = imageData;

      inputInfo.textContent =
        `${result.width}x${result.height}, ${result.bitDepth}-bit, ` +
        `${result.metadata.isHDR ? "HDR" : "SDR"} ${
          result.metadata.colorPrimaries
        } ` +
        `(${elapsed.toFixed(0)}ms, ${(file.size / 1024).toFixed(1)} KB)`;

      // Update controls to match decoded file settings
      updateControlsFromMetadata(result.bitDepth, result.metadata);
      encodeBtn.disabled = false;
    } catch (err) {
      inputInfo.textContent = `Error: ${(err as Error).message}`;
    }
    return;
  }

  // Load as regular image (PNG, JPEG, etc.)
  const img = new Image();
  img.onload = () => {
    inputCanvas.width = img.width;
    inputCanvas.height = img.height;
    inputCtx.drawImage(img, 0, 0);
    currentImageData = inputCtx.getImageData(0, 0, img.width, img.height);

    inputInfo.textContent = `${img.width}x${img.height}, ${(
      file.size / 1024
    ).toFixed(1)} KB`;
    encodeBtn.disabled = false;
  };
  img.src = URL.createObjectURL(file);
});

// Encode button
encodeBtn.addEventListener("click", async () => {
  if (!currentImageData) return;

  encodeBtn.disabled = true;
  encodeBtn.textContent = "Encoding...";
  outputInfo.textContent = "Encoding...";

  try {
    const quality = parseInt(qualitySlider.value);
    const speed = parseInt(speedSlider.value);
    const bitDepth = parseInt(bitDepthSelect.value) as 8 | 10 | 12;
    const chromaSubsampling = chromaSelect.value as ChromaSubsampling;
    const transferFunction = transferSelect.value as TransferFunctionOption;
    const colorSpace = colorSpaceSelect.value as ColorSpace;
    const lossless = losslessCheckbox.checked;

    if (!encodeClient) throw new Error("Encoder not initialized");
    if (!decodeClient) throw new Error("Decoder not initialized");

    const start = performance.now();
    // encodedAvif = await encode(currentImageData, {
    //   quality,
    //   speed,
    //   bitDepth,
    //   chromaSubsampling,
    //   transferFunction,
    //   colorSpace,
    //   lossless,
    //   maxThreads: 15,
    // });
    encodedAvif = await encodeInWorker(encodeClient, currentImageData, {
      quality,
      speed,
      bitDepth,
      chromaSubsampling,
      transferFunction,
      colorSpace,
      lossless,
      maxThreads: 20,
    });
    const encodeTime = performance.now() - start;

    // Decode and display the result
    const decoded = await decodeInWorker(decodeClient, encodedAvif);
    // const decoded = await decode(encodedAvif);

    // Convert to displayable format
    let displayData: Uint8ClampedArray;
    if (decoded.bitDepth > 8) {
      const src = decoded.data as Uint16Array;
      const shift = decoded.bitDepth - 8;
      displayData = new Uint8ClampedArray(decoded.width * decoded.height * 4);
      for (let i = 0; i < decoded.width * decoded.height; i++) {
        const srcIdx = i * decoded.channels;
        const dstIdx = i * 4;
        displayData[dstIdx] = src[srcIdx] >> shift;
        displayData[dstIdx + 1] = src[srcIdx + 1] >> shift;
        displayData[dstIdx + 2] = src[srcIdx + 2] >> shift;
        displayData[dstIdx + 3] =
          decoded.channels === 4 ? src[srcIdx + 3] >> shift : 255;
      }
    } else {
      const src = decoded.data as Uint8Array;
      displayData = new Uint8ClampedArray(decoded.width * decoded.height * 4);
      for (let i = 0; i < decoded.width * decoded.height; i++) {
        const srcIdx = i * decoded.channels;
        const dstIdx = i * 4;
        displayData[dstIdx] = src[srcIdx];
        displayData[dstIdx + 1] = src[srcIdx + 1];
        displayData[dstIdx + 2] = src[srcIdx + 2];
        displayData[dstIdx + 3] =
          decoded.channels === 4 ? src[srcIdx + 3] : 255;
      }
    }

    outputCanvas.width = decoded.width;
    outputCanvas.height = decoded.height;
    const imageData = new ImageData(displayData, decoded.width, decoded.height);
    outputCtx.putImageData(imageData, 0, 0);

    const inputSize = currentImageData.data.length;
    const ratio = ((encodedAvif.length / inputSize) * 100).toFixed(1);

    outputInfo.textContent =
      `${(encodedAvif.length / 1024).toFixed(1)} KB ` +
      `(${ratio}%), ${bitDepth}-bit, ${chromaSubsampling}, ${transferFunction}` +
      `${lossless ? ", lossless" : `, q${quality}`} (${encodeTime.toFixed(
        0,
      )}ms)`;
    downloadBtn.disabled = false;
  } catch (err) {
    outputInfo.textContent = `Error: ${(err as Error).message}`;
    console.error(err);
  } finally {
    encodeBtn.disabled = false;
    encodeBtn.textContent = "Encode to AVIF";
  }
});

// Download button
downloadBtn.addEventListener("click", () => {
  if (!encodedAvif) return;

  const blob = new Blob([encodedAvif], { type: "image/avif" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "output.avif";
  a.click();
  URL.revokeObjectURL(url);
});

// Initialize
async function initModules() {
  try {
    inputInfo.textContent = "Loading WASM modules...";
    [decodeClient, encodeClient] = await Promise.all([
      createWorkerPool({ poolSize: 1, type: "decoder", preferMT: true }),
      createWorkerPool({ poolSize: 1, type: "encoder", lazyInit: true, preferMT: true }),
    ]);
    // initEncoder({ preferMT: true });
    // initDecoder({ preferMT: true });
    console.log("jCodecs AVIF ready (decoder + encoder)");
    inputInfo.textContent = "Select an image file";
  } catch (err) {
    console.error("Failed to initialize:", err);
    inputInfo.textContent = "Failed to load WASM modules";
  }
}

initModules();
