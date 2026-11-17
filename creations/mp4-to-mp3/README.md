# MP4 to MP3

This entry page now redirects to `/creations/converter/`. The consolidated tool
is maintained in `../converter/` and uses a self-hosted FFmpeg WebAssembly worker.

Static browser tool at `/creations/mp4-to-mp3/`. No build, server, cross-origin
isolation headers, or uploads required. Web Audio decodes the MP4 audio at 44.1 kHz;
LAME encodes mono/stereo MP3 in a dedicated worker. Extra channels are downmixed
to stereo. Output bitrates: 128, 192, 256, 320 kbps. The result includes a local
audio preview and a download link.

The browser must support the input audio codec; AAC is commonly supported. Silent,
corrupt, or unsupported videos show an error. Limits: 100 MB and 20 minutes. The
whole audio track is decoded into memory, so shorter clips work best on phones.
Cancel immediately terminates encoding. When canceling during browser decoding,
the tool waits for decoding to finish and release its buffers before unlocking.

Vendored dependency: lamejs 1.2.1 (`vendor/lame.min.js`), with its license. Serve
the repository root over HTTP; the worker needs a web origin. No YouTube downloader
or link conversion is included.
