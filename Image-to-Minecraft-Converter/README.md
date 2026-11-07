# Image to Minecraft Converter

A static browser-local image converter with live 3D, real Minecraft textures, editable blueprints, a bottom-up build guide, materials and binary schematic exports.

## Implemented

- Local image upload/drop; up to 30 MB. Saved source downsampled to 1600 pixels maximum on its longest side.
- 1–256 blocks per axis, aspect lock, presets, fit/crop/stretch and crop alignment.
- 162 Java 1.20.4 blocks with real opaque textures, measured RGB averages, categories, properties and notes. See ASSETS.md.
- OKLab perceptual matching, optional RGB comparison, Floyd–Steinberg dithering, brightness/contrast/saturation, texture-variance preference, transparency as air/white/black, and pixel-art scaling.
- Concrete/wool/combined/all/survival-friendly/custom palettes, block search and maximum 4/8/16/32 material limits.
- GPU instanced-cube 3D viewer: orbit, zoom, pan, front/reset and block inspection. An orthographic Canvas 3D renderer automatically supports browsers without WebGL.
- Original, representative-color, actual-texture and side-by-side previews.
- Materials with counts, stacks/remainders, inventory slots, sorting, filtering, collected checkboxes, clipboard, CSV with shulker quantities and printing.
- Scrollable/zoomable numbered blueprint; paint, erase, eyedropper, replace all, 40-step undo/redo. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z outside fields.
- Per-cell or per-row placement progress; bottom-up guide with numbered placement steps, a large highlighted row overview, and state/orientation notes.
- IndexedDB autosave, project thumbnails, naming, reopen, duplication, deletion, JSON backup/import and restoration on reload.
- PNG blueprint and legend, CSV, printable materials, .blockloom backup, real gzip-compressed Sponge v2 .schem and native Litematica v6 .litematic.

## Build orientation

The structure is a one-block-deep vertical image wall at Z=0. Stand **south (+Z), looking north (-Z)**. Left-to-right is +X; bottom-to-top is +Y; bottom-left is (0,0,0). Guide row 1 means Y=0. Image index i maps to x=i%width and y=height-1-floor(i/width). Glazed terracotta uses facing=east and deepslate axis=y; exports encode these properties. Both file formats iterate X fastest, then Z, then Y.

Exports, materials, previews and guide all use the current edited cells. Generate resets edits and progress; duplicate first to preserve an earlier version. Setting changes apply when Generate is clicked.

## Privacy and saving

Images are processed on-device. There are no image-upload servers, analytics or accounts. IndexedDB is browser- and origin-specific: localhost, the hosted app and natestryker.com have separate projects. Clearing site data removes projects. Export .blockloom backups to move between devices or hosts. Browser storage failures are reported.

## Compatibility and limitations

The palette and exports target **Java 1.20.4, DataVersion 3700**, not Bedrock. Native Litematica uses version 6/subversion 1, one region, an air-first palette and continuous 64-bit packing. Sponge v2 uses palette varints and big-endian NBT. Both are real binary files and have been checked with independent readers. **Actual Minecraft/WorldEdit/Litematica in-game import has not been tested here.** Try a small test-world build first.

Front textures are actual assets. Side/top/back faces reuse the wall texture and can differ from the game's per-face textures/rotations. CPU fallback sides use shaded colors. Lighting, emissions, resource packs and biome effects are not simulated. CPU edge overlap at grazing angles is approximate. The preview browser originally disabled WebGL, so the GPU path needs additional device testing.

Color averages are encoded-sRGB averages converted to OKLab. Material reduction picks frequent initial matches and rematches; it is a heuristic, not global optimization. Survival-friendly is a convenience filter. Image cropping is target-aspect cover cropping with alignment, not a freehand crop rectangle. Blueprint zoom is bounded to 4096 pixels on its longest axis. Map art, height-stepped shading and description-generated 3D builds are not included.

## Tests

```sh
node tests.mjs
node translation-tests.mjs
python3 -m pip install litemapy
python3 verify_exports.py
```

Tests verify 162 unique assets, exact palette colors, synthetic gradient/portrait/landscape/logo/pixel-art/transparency images, dithering and palette limits, counts, coordinate orientation and project validation. A 256×256 conversion with 162 blocks completed in roughly 140–200 ms in the development runtime; device times vary.

Independent `litemapy` and `nbtlib` verification checks every block, property and coordinate in small, 5-bit packing across word boundaries, and >127-palette-index fixtures. Sponge varints are decoded separately because litemapy's Sponge importer does not handle large palettes correctly. These tests are rerun after source recovery.

Prior browser QA verified the CPU 3D preview, row progress across reload, palette search, editing and undo/redo with matching totals. The file-chooser test stalled in browser tooling; successful browser upload is not claimed from that run. Broad real-photo quality and mobile-device testing remain outstanding.

## Source layout

`app.js` handles UI, editing, IndexedDB and canvas tools. `engine.js`/`worker.js` handle conversion off the main thread. `viewer.js` and `software-viewer.js` handle 3D. `exports.js` handles validation, CSV and both NBT formats. `blocks.json`/`textures/` contain the palette; `build-assets.py` reproduces it. Three.js 0.170.0 and its MIT license are in `vendor/`.

Format references:
- https://github.com/SpongePowered/Schematic-Specification/blob/master/versions/schematic-2.md
- https://github.com/SmylerMC/litemapy/blob/master/litemapy/schematic.py
- https://github.com/SmylerMC/litemapy/blob/master/litemapy/storage.py

Minecraft textures belong to Mojang/Microsoft. Not an official Minecraft product; not approved by or associated with Mojang or Microsoft.

## Camera and materials

Select Free camera in Live 3D, then click the viewer. WASD moves, Q/E moves down/up, drag looks around, Shift moves faster and Escape returns to orbit. The Blocks needed panel offers a list or a chest view with 64-item stacks and 54 slots per double chest. The build guide shows each row left to right, larger material cards and individual placement tracking.

## English and Korean

Use the 한국어 / English button in the header. The preference is remembered. Block names, controls, guides, help, and material exports support Korean. Search accepts English or Korean. User-entered names and filenames are preserved. Translation files: dist/i18n.js and dist/locales/ko.js.
