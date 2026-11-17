/* LAME runs off the main thread so encoding does not freeze the page. */
importScripts('./vendor/lame.min.js');

self.onmessage = event => {
  try {
    const {channels, sampleRate, bitrate} = event.data;
    const samples = channels.map(buffer => new Float32Array(buffer));
    const encoder = new lamejs.Mp3Encoder(samples.length, sampleRate, bitrate);
    const chunks = [], blockSize = 1152, length = samples[0].length;
    let lastProgress = -1;
    for (let offset = 0; offset < length; offset += blockSize) {
      const count = Math.min(blockSize, length - offset);
      const pcm = samples.map(channel => {
        const out = new Int16Array(count);
        for (let i = 0; i < count; i++) {
          const value = Math.max(-1, Math.min(1, channel[offset + i]));
          out[i] = Math.round(value < 0 ? value * 32768 : value * 32767);
        }
        return out;
      });
      const data = encoder.encodeBuffer(pcm[0], pcm[1]);
      if (data.length) chunks.push(new Uint8Array(data));
      const progress = Math.floor(Math.min(1, (offset + count) / length) * 100);
      if (progress !== lastProgress) { self.postMessage({type: 'progress', progress}); lastProgress = progress; }
    }
    const end = encoder.flush(); if (end.length) chunks.push(new Uint8Array(end));
    self.postMessage({type: 'done', chunks}, chunks.map(chunk => chunk.buffer));
  } catch (error) {
    self.postMessage({type: 'error', message: error.message || 'MP3 encoding failed.'});
  }
};
