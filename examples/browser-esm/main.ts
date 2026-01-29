import {
  decodeInWorker,
  initWorkerPool,
  getWorkerPoolStats,
} from "@dimkatet/jcodecs-avif";

const fileInput = document.getElementById("fileInput");
const inputCanvas = document.getElementById("inputCanvas");
const outputCanvas = document.getElementById("outputCanvas");
const inputInfo = document.getElementById("inputInfo");
const outputInfo = document.getElementById("outputInfo");
const qualitySlider = document.getElementById("quality");
const qualityValue = document.getElementById("qualityValue");
const speedSlider = document.getElementById("speed");
const speedValue = document.getElementById("speedValue");
const losslessCheckbox = document.getElementById("lossless");
const encodeBtn = document.getElementById("encodeBtn");
const downloadBtn = document.getElementById("downloadBtn");

const inputCtx = inputCanvas!.getContext("2d");
const outputCtx = outputCanvas!.getContext("2d");

let currentImageData = null;
let encodedAvif = null;

// Update slider values
qualitySlider.addEventListener("input", () => {
  qualityValue.textContent = qualitySlider.value;
});

speedSlider.addEventListener("input", () => {
  speedValue.textContent = speedSlider.value;
});

// Handle file input
fileInput.addEventListener("change", async (e) => {
  console.log(typeof SharedArrayBuffer);
  console.log(window.crossOriginIsolated);
  const file: File | undefined = e.target.files[0];
  if (!file) return;

  // Check if it's an AVIF file
  if (file.name.endsWith(".avif")) {
    const buffer = await file.arrayBuffer();

    console.log("Decoding AVIF in worker...");

    const start = performance.now();
    const { metadata, width, height, bitDepth } = await decodeInWorker(buffer);

    const elapsed = performance.now() - start;
    console.log(`Worker decode completed in ${elapsed.toFixed(2)}ms`);
    console.log("Worker pool stats:", getWorkerPoolStats());

    inputInfo.textContent = `${width}x${height}, ${bitDepth}-bit, ${
      metadata.isHDR ? "HDR" : "SDR"
    } (${elapsed.toFixed(0)}ms)`;
    return;
  }

  // Load as regular image
  const img = new Image();
  img.onload = () => {
    inputCanvas.width = img.width;
    inputCanvas.height = img.height;
    inputCtx.drawImage(img, 0, 0);
    currentImageData = inputCtx.getImageData(0, 0, img.width, img.height);

    inputInfo.textContent = `Size: ${img.width}x${img.height}, ${file.size} bytes`;
    encodeBtn.disabled = false;
  };
  img.src = URL.createObjectURL(file);
});

// Encode button
encodeBtn!.addEventListener("click", async () => {
  if (!currentImageData) return;

  encodeBtn!.disabled = true;
  encodeBtn!.textContent = "Encoding...";
  try {
    // Placeholder - actual encoding would use:
    // encodedAvif = await encode(currentImageData, {
    //   quality: parseInt(qualitySlider.value),
    //   speed: parseInt(speedSlider.value),
    //   lossless: losslessCheckbox.checked,
    // });

    // For now, just show a message
    outputInfo!.textContent = "WASM not yet built. Run: pnpm build:wasm";

    // After encoding:
    // outputInfo.textContent = `Encoded size: ${encodedAvif.length} bytes`;
    // downloadBtn.disabled = false;

    // Decode and display:
    // const decoded = await decode(encodedAvif);
    // const imageData = new ImageData(
    //   new Uint8ClampedArray(decoded.data),
    //   decoded.width,
    //   decoded.height
    // );
    // outputCanvas.width = decoded.width;
    // outputCanvas.height = decoded.height;
    // outputCtx.putImageData(imageData, 0, 0);
  } catch (err) {
    outputInfo!.textContent = `Error: ${err!.message}`;
  } finally {
    encodeBtn!.disabled = false;
    encodeBtn!.textContent = "Encode to AVIF";
  }
});

// Download button
downloadBtn!.addEventListener("click", () => {
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
    await initWorkerPool({ poolSize: 1 });
    console.log("jCodecs AVIF Worker Pool ready");
    console.log("Pool stats:", getWorkerPoolStats());
  } catch (err) {
    console.error("Failed to initialize:", err);
    inputInfo!.textContent = "Failed to load WASM module";
  }
}

// window.initWasm = initModules;

initModules();
