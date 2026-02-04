import { describe, it, expect } from 'vitest';

/**
 * Integration tests - require actual codec packages installed
 * Run with: pnpm test:integration
 */

describe.skip('integration: AVIF only', () => {
  // Scenario: user installed only @jcodecs/avif

  it.todo('isCodecAvailable("avif") returns true');
  it.todo('isCodecAvailable("jxl") returns false');
  it.todo('decode(avifBuffer) succeeds');
  it.todo('decode(jxlBuffer) throws CodecNotInstalledError');
  it.todo('encode(data, { format: "avif" }) succeeds');
  it.todo('encode(data, { format: "jxl" }) throws CodecNotInstalledError');
});

describe.skip('integration: both codecs', () => {
  // Scenario: user installed both @jcodecs/avif and @jcodecs/jxl

  it.todo('getAvailableFormats() returns ["avif", "jxl"]');
  it.todo('transcode(avifBuffer, "jxl") succeeds');
  it.todo('transcode(jxlBuffer, "avif") succeeds');
  it.todo('round-trip: encode->decode preserves dimensions');
});

describe.skip('integration: worker pool', () => {
  it.todo('parallel decode in workers');
  it.todo('parallel encode in workers');
  it.todo('transcode batch in workers');
});
