# jCodecs - Technical Documentation

> Документация для разработчиков. Архитектура, сборка WASM, внутренние API.

## Текущий статус

| Пакет | Библиотека | Версия | Статус |
|-------|------------|--------|--------|
| @jcodecs/avif | libavif + dav1d/aom | 1.3.0 / 1.5.3 / 3.11.0 | Stable |
| @jcodecs/jxl | libjxl | 0.11.x | Stable |
| @jcodecs/auto | TypeScript facade | 0.1.0 | Stable |

**Общие возможности:**
- HDR: uint8, uint16, float16, float32
- Color spaces: sRGB, Display-P3, Rec.2020
- Transfer functions: sRGB, PQ, HLG, linear
- Multi-threading: до 8 потоков через pthread
- Worker Pool API

---

## Архитектура

```
User Code
    ↓
┌──────────────────────────────────────┐
│  Public API (decode/encode)          │  ← Direct usage (main thread)
└──────────────────────────────────────┘
    ↓
┌──────────────────────────────────────┐
│  Worker API (createWorkerPool, etc)  │  ← Worker pool usage
└──────────────────────────────────────┘
    ↓
┌──────────────────────────────────────┐
│  Worker (worker.ts)                  │  ← Web Worker instance
└──────────────────────────────────────┘
    ↓
┌──────────────────────────────────────┐
│  WASM Module (*_dec/*_enc)           │  ← C++ + Embind
└──────────────────────────────────────┘
    ↓
┌──────────────────────────────────────┐
│  Native libs (libavif, libjxl, etc)  │  ← Pre-compiled .a files
└──────────────────────────────────────┘
```

---

## Структура проекта

```
jCodecs/
├── packages/
│   ├── core/                    # @jcodecs/core
│   │   └── src/
│   │       ├── types.ts             # DataType, ExtendedImageData
│   │       ├── wasm-utils.ts        # copyToWasm*, copyFromWasm*
│   │       ├── worker-pool.ts       # Generic worker pool
│   │       ├── codec-worker.ts      # Worker helper
│   │       └── codec-worker-client.ts
│   │
│   ├── avif/                    # @jcodecs/avif
│   │   └── src/
│   │       ├── wasm/
│   │       │   ├── avif_dec.cpp     # Decoder (libavif + dav1d)
│   │       │   ├── avif_enc.cpp     # Encoder (libavif + aom)
│   │       │   └── CMakeLists.txt
│   │       ├── decode.ts
│   │       ├── encode.ts
│   │       ├── worker.ts
│   │       └── worker-api.ts
│   │
│   ├── jxl/                     # @jcodecs/jxl
│   │   └── src/
│   │       ├── wasm/
│   │       │   ├── jxl_dec.cpp      # Decoder (libjxl)
│   │       │   ├── jxl_enc.cpp      # Encoder (libjxl)
│   │       │   └── CMakeLists.txt
│   │       ├── decode.ts
│   │       ├── encode.ts
│   │       ├── worker.ts
│   │       └── worker-api.ts
│   │
│   └── auto/                    # @jcodecs/auto
│       └── src/
│           ├── format-detection.ts  # Magic bytes detection
│           ├── codec-registry.ts    # Dynamic codec loading
│           ├── types.ts             # AutoImageData, AutoMetadata
│           ├── options.ts           # Unified options
│           ├── decode.ts            # Auto-detect decode
│           ├── encode.ts            # Encode + transcode
│           ├── worker.ts
│           └── worker-api.ts
│
├── examples/browser-esm/        # Browser demo
├── Dockerfile                   # Multi-stage WASM build
└── CLAUDE.md                    # This file
```

---

## Threading Architecture

### PTHREAD_POOL_SIZE

**Значение:** `8` (compile-time constant в CMakeLists.txt)

```cmake
set(MAX_THREADS 8)
set(MT_FLAGS
    "-pthread"
    "-s USE_PTHREADS=1"
    "-s PTHREAD_POOL_SIZE=${MAX_THREADS}"
)
```

**Почему 8:**
- dav1d/libjxl decoder: оптимальны на 4-8 потоках
- aom/libjxl encoder: хорошо масштабируются до 8 потоков
- Больше потоков = diminishing returns + overhead

### maxThreads Validation

```typescript
// В каждом кодеке
const validation = validateThreadCount(opts.maxThreads, maxThreads, isMultiThreadedModule, "jcodecs-*");
if (validation.warning) console.warn(validation.warning);
opts.maxThreads = validation.validatedCount;
```

**Защита от deadlock:**
- `maxThreads > PTHREAD_POOL_SIZE` → deadlock
- TypeScript clamp'ит значение до `MAX_THREADS`
- `MAX_THREADS` экспортируется из WASM через Embind

---

## DataType System

### Core Types

```typescript
// @jcodecs/core/types.ts
type DataType = 'uint8' | 'uint16' | 'float16' | 'float32';

interface ExtendedImageData<TDataType extends DataType, TMeta> {
  data: TypedArrayForDataType<TDataType>;
  dataType: TDataType;
  bitDepth: number;
  width: number;
  height: number;
  channels: number;
  metadata: TMeta;
}
```

### WASM Memory Helpers

```typescript
// @jcodecs/core/wasm-utils.ts
copyToWasm(module, data)      // Uint8Array | Uint16Array | Float16Array | Float32Array
copyToWasm16f(module, data)   // Float16Array
copyToWasm32f(module, data)   // Float32Array

copyFromWasm(module, ptr, len)    // → Uint8Array
copyFromWasm16(module, ptr, len)  // → Uint16Array
copyFromWasm16f(module, ptr, len) // → Float16Array
copyFromWasm32f(module, ptr, len) // → Float32Array

copyFromWasmByType<T>(module, ptr, len, dataType: T) // → TypedArrayForDataType<T>
```

---

## Сборка WASM

### Dockerfile Multi-stage

```dockerfile
FROM emscripten/emsdk AS base           # Toolchain
FROM base AS common                     # libyuv
FROM common AS avif-build               # dav1d + aom + libavif
FROM common AS jxl-build                # libjxl + highway
FROM scratch AS avif                    # AVIF artifacts
FROM scratch AS jxl                     # JXL artifacts
```

### Build Commands

```bash
pnpm build:wasm    # Docker: all WASM modules + .d.ts types
pnpm build:ts      # TypeScript: packages
pnpm build         # All (via turbo)
```

### CMake Output (per codec)

Каждый кодек собирает 4 модуля:
- `*_dec.js` (ST decoder)
- `*_dec_mt.js` (MT decoder)
- `*_enc.js` (ST encoder)
- `*_enc_mt.js` (MT encoder)

TypeScript типы генерируются автоматически через `--emit-tsd`.

---

## AVIF Specifics

### Native Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| libavif | 1.3.0 | AVIF container |
| dav1d | 1.5.3 | AV1 decoder |
| aom | v3.11.0 | AV1 encoder |

### libavif Build

Собирается дважды:
- `libavif-dec` с dav1d (только декодер)
- `libavif-enc` с aom (декодер + энкодер для codec_aom.c)

### Encoder Stack Size

```cmake
# aom требует больше стека
set_target_properties(avif_enc_mt PROPERTIES
    LINK_FLAGS "... -s STACK_SIZE=131072 ..."  # 128KB per thread
)
```

---

## JXL Specifics

### Native Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| libjxl | 0.11.x | JPEG-XL codec |
| highway | latest | SIMD operations |
| brotli | latest | Compression |

### Float Format Detection

Декодер автоматически определяет формат из файла:

```cpp
// jxl_dec.cpp
if (info.exponent_bits_per_sample > 0) {
    // Float format
    if (info.exponent_bits_per_sample == 5 && info.bits_per_sample == 16) {
        format.data_type = JXL_TYPE_FLOAT16;
        result.dataType = "float16";
    } else if (info.exponent_bits_per_sample == 8 && info.bits_per_sample == 32) {
        format.data_type = JXL_TYPE_FLOAT;
        result.dataType = "float32";
    }
} else {
    // Integer format
    format.data_type = (outDepth > 8) ? JXL_TYPE_UINT16 : JXL_TYPE_UINT8;
}
```

### Float Encoding

Энкодер устанавливает exponent bits для правильного сохранения:

```cpp
// jxl_enc.cpp
if (options.dataType == "float32") {
    info.bits_per_sample = 32;
    info.exponent_bits_per_sample = 8;
} else if (options.dataType == "float16") {
    info.bits_per_sample = 16;
    info.exponent_bits_per_sample = 5;
}
// alpha also needs exponent bits
info.alpha_exponent_bits = (info.alpha_bits > 0) ? info.exponent_bits_per_sample : 0;
```

---

## Worker Pool Configuration

```typescript
interface WorkerPoolConfig {
  poolSize?: number;        // default: hardwareConcurrency / 2
  workerUrl?: string | URL; // Custom worker script
  preferMT?: boolean;       // Multi-threaded WASM (default: false)
  type?: 'decoder' | 'encoder' | 'both';
  lazyInit?: boolean;       // Delay WASM init
}
```

### Recommended Configurations

**Decoder:** MT WASM + большой пул
```typescript
const pool = await createWorkerPool({
  type: 'decoder',
  poolSize: 4-8,
  preferMT: true,
});
```

**Encoder:** MT WASM + один воркер
```typescript
const pool = await createWorkerPool({
  type: 'encoder',
  poolSize: 1,
  preferMT: true,
  lazyInit: true,
});
```

---

## Auto Package (@jcodecs/auto)

Фасадный пакет для автоматического определения формата и унифицированного API.

### Архитектура

```
User Code
    ↓
┌──────────────────────────────────────┐
│  @jcodecs/auto                       │  ← Unified API
│  detectFormat() → decode()/encode()  │
└──────────────────────────────────────┘
    ↓ (dynamic import)
┌──────────────────────────────────────┐
│  @jcodecs/avif | @jcodecs/jxl        │  ← Peer dependencies
└──────────────────────────────────────┘
```

### Format Detection (magic bytes)

```typescript
// AVIF: ftyp box at offset 4, brand at offset 8 (avif/avis/mif1)
// JXL codestream: 0xFF 0x0A
// JXL container: 12-byte signature

detectFormat(buffer) // → 'avif' | 'jxl' | 'unknown'
```

### Peer Dependencies

```json
{
  "peerDependencies": {
    "@dimkatet/jcodecs-avif": "workspace:*",
    "@dimkatet/jcodecs-jxl": "workspace:*"
  },
  "peerDependenciesMeta": {
    "@dimkatet/jcodecs-avif": { "optional": true },
    "@dimkatet/jcodecs-jxl": { "optional": true }
  }
}
```

### Codec Registry

Динамическая загрузка кодеков через `import()`:

```typescript
// codec-registry.ts
async function tryRegisterAVIF() {
  try {
    const avif = await import('@dimkatet/jcodecs-avif');
    registerCodec('avif', () => adaptCodec(avif));
  } catch {
    // Not installed, skip
  }
}
```

### Unified Types

```typescript
// Discriminated union для metadata
type AutoMetadata =
  | ({ format: 'avif' } & AVIFMetadata)
  | ({ format: 'jxl' } & JXLMetadata);

// Type guards
isAVIFImageData(data) // narrows to AVIFMetadata
isJXLImageData(data)  // narrows to JXLMetadata
```

### Unified Options

```typescript
interface AutoEncodeOptions {
  format: 'avif' | 'jxl';      // Required
  quality?: number;             // Common
  bitDepth?: 8 | 10 | 12 | 16;
  // ...common options...
  avif?: AVIFEncodeOptions;     // Format-specific override
  jxl?: JXLEncodeOptions;
}
```

---

## Добавление нового кодека

### 1. Dockerfile stage

```dockerfile
FROM common AS newcodec-build
RUN git clone https://github.com/...
# Build steps
FROM scratch AS newcodec
COPY --from=newcodec-build /build/*.js /
```

### 2. Package structure

```
packages/newcodec/
├── src/
│   ├── wasm/
│   │   ├── newcodec_dec.cpp
│   │   ├── newcodec_enc.cpp
│   │   └── CMakeLists.txt
│   ├── types.ts
│   ├── options.ts
│   ├── decode.ts
│   ├── encode.ts
│   ├── worker.ts
│   ├── worker-api.ts
│   └── index.ts
├── tests/
└── package.json
```

### 3. Worker implementation

```typescript
// worker.ts
import { createCodecWorker } from '@jcodecs/core/codec-worker';

const handlers = {
  init: async (payload) => { /* ... */ },
  encode: (payload) => encode(payload.imageData, payload.options),
  decode: (payload) => decode(payload.data, payload.options),
};

export type NewCodecWorkerHandlers = typeof handlers;
createCodecWorker<NewCodecWorkerHandlers>(handlers);
```

---

## Известные ограничения

### Threading
- **Max threads:** 8 (compile-time)
- **SharedArrayBuffer:** требует COOP/COEP headers
- **PTHREAD_POOL_SIZE_STRICT=0:** deadlock (не использовать!)

### WASM Size
- MT модули: ~2-3MB (SINGLE_FILE mode)
- ST модули: ~1.5-2MB
- Используй lazy loading для encoder если не нужен сразу

### Browser Compatibility
- **MT:** Chrome 92+, Firefox 89+, Safari 15.2+
- **ST:** все современные браузеры

---

## Версии зависимостей

| Dependency | Version |
|------------|---------|
| libavif | 1.3.0 |
| dav1d | 1.5.3 |
| aom | v3.11.0 |
| libjxl | 0.11.x |
| Emscripten | latest |
| Node.js | 20+ |
| pnpm | 9+ |
| turbo | 2.x |
