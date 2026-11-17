# File Converter

One static, browser-only converter at `/creations/converter/`. The old PDF/image
and MP4/MP3 routes redirect here. No build, backend, API keys, external conversion
service, uploads, service worker, cookies, analytics, or cross-origin isolation.
All conversion assets are self-hosted. User data is held in browser memory and
downloadable blobs, with no persistent file storage.

## Architecture

- `catalog.mjs`: implemented conversion registry, compatibility filtering and search.
- `app.mjs`: one drop zone, content inspection, per-file targets, batch actions,
  contextual settings, progress, cancel, downloads, ZIP and errors.
- `progress.mjs`: clip-aware media progress and elapsed-speed estimates; batch
  progress is combined in the UI, with time remaining scoped to the current file.
- `worker.js` / `client.mjs`: serialized background jobs; cancel terminates worker.
- `core.mjs`: content signatures, limits, safe paths, data shapes and page ranges.
- `image.mjs`: bitmap decode, OffscreenCanvas encoding, TIFF, BMP and PNG-based ICO.
- `pdf-read.mjs`: PDF.js worker parsing with browser canvas rendering. Known
  passwords are supported for exports. Rendering yields between pages.
- `pdf-write.mjs`: PDF creation/editing in the worker, with a bundled Unicode font.
- `documents.mjs`: inert DOM parsing and sanitization. Marked and Mammoth parsing
  run in the worker; DOM-only sanitization stays on the main thread with limits.
- `data.mjs`: delimited tables, SheetJS workbooks, YAML/TOML/JSON/INI and typed XML.
- `sqlite.mjs`: SQL.js database files with parameterized inserts and quoted names.
- `media.mjs`: unmodified single-thread @ffmpeg/core 0.12.10. The binary loads only
  for media/GIF work, inside a classic worker. A local protocol allowlist prevents
  remote media references. WORKERFS reads input File slices without a full input
  copy. Actual streams/decoders are probed before choices appear. Media conversions
  have no duration limit or encoding/client timeout; Cancel terminates the worker.
- `archive.mjs`: bounded ZIP/GZIP/TAR processing, directory preflight, checksums,
  path validation and extraction limits.

Canvas converts pixels; FFmpeg actually decodes/encodes; archive formats are
rebuilt; data formats are parsed/serialized. No conversion just renames an extension.
Only registry operations are displayed. Unsupported data shapes hide incompatible
outputs (INI/TOML/JSONL/tabular); browser encoder checks hide WebP when unavailable.

Limits and all skipped requests are documented on the [support page](support/index.html).
Dependency versions/checksums are in `vendor/versions.json`; licenses and source
links are on the [credits page](licenses/index.html). Shared PDF.js/pdf-lib/fflate
assets stay in `../pdf-image-converter/vendor/` to avoid duplicated downloads.

## Verification

Serve the repository root over HTTP. No special response headers are required.

```text
node --test scripts/converters.test.mjs scripts/site-routes.test.mjs
python scripts/converter_hub_browser_check.py --browser <installed-chrome-path>
```

The browser check needs Python Playwright. It starts and closes its own localhost
server and browser, exercises real exports/round trips, and checks for uploads or
external requests. Screenshots are written to an OS temporary directory.
