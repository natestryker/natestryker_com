# RiftGuessr

A full-screen Summoner's Rift location game built with HTML, CSS and JavaScript modules. No dependencies or build step are required to play.

## Play

Serve this directory with a static HTTP server, or launch it from the site's Creations card. JavaScript modules require HTTP rather than a direct `file://` URL.

1. Choose Easy, Normal or Hard, then press **Start game**.
2. Find the location shown at the center reticle in the full-screen clue.
3. Hover over the bottom-right map to expand it, or use its expand button on touch devices. Keyboard focus also expands it.
4. Place a pin and **Lock in guess** before the timer expires. Gold marks your guess; teal marks the answer.
5. Complete five rounds to save a score out of 25,000. **Play again** returns to difficulty selection.

## Normal in-game views and a sharper map

The default map is an 11,537 × 9,544 pixel Season 14 in-game camera capture: over five times the pixels of the previous 5,000 × 4,196 capture. Clues keep the capture's original orientation, camera angle and colors. There is no added rotation, reflection, grayscale or perspective distortion.

The capture is packaged as a local pyramid of JPEG tiles, with full, half and quarter resolution plus a small overview. The map and clues request only the detail needed for their current viewport. A 24-tile cache keeps decoded images bounded, and stale renders are discarded when a newer view is requested.

| Difficulty | Clue span along the longest screen dimension | Time per location |
| --- | --- | --- |
| Easy | 8% of map width | 20 seconds |
| Normal | 4% | 13 seconds |
| Hard | 2% | 8 seconds |

The timer starts when the clue finishes loading, turns red with five seconds remaining, and stops on submission. On expiry, the current pin is automatically scored; no pin earns zero points and still reveals the answer. Results remain on screen until **Next round** or **View results** is pressed. A new round gets its full time limit. Returning to difficulty selection cancels the timer.

An absolute deadline keeps time accurate when a tab is in the background. Pin placement, clearing and manual submission check that deadline before accepting input. Expiry resolves once; callbacks from earlier rounds cannot alter a later round.

The selection pool uses a 120 × 100 grid across the whole capture, filters out blank regions, and jitters locations within the remaining regions. The bundled capture yields 11,979 terrain regions before crop-safe filtering. Margins adapt to difficulty and image aspect ratio. Lanes, bases and outer jungle can now appear, expanding beyond the previous central 18–82% range. Five locations are separated within each run.

## Forgiving scoring

Every difficulty uses the same accuracy curve. Difficulty changes how much terrain is visible.

- Within 1% of the map width: **5,000 points**.
- 5% away: about **4,094 points**.
- 10% away: about **3,188 points**.
- 20% away: about **1,934 points**.

Distance accounts for the capture's aspect ratio. After the perfect-score radius, points decrease smoothly using `5000 * exp(-5 * (distance - 0.01))`.

## Map controls

- Scroll, pinch, or use **+ / −** to zoom. There is no game-imposed upper zoom limit. Native-resolution tiles load as needed, and further zoom magnifies their pixels.
- Drag to pan while zoomed. A pan or pinch does not place an accidental pin.
- Arrow keys move the pin; Shift makes larger steps and Alt makes precise steps. Enter or Space places a pin if none exists.
- Keyboard **+ / −** zoom. **Home** or the target button resets the view.
- The expand button keeps the map open. Escape releases it; round results keep it expanded.

The guess map renders into a viewport-sized canvas instead of scaling one giant DOM image. Markers and the result line are projected separately, retaining their size and alignment at deep zoom.

## Scores and map settings

Completed games save immediately after the fifth guess, before the final results screen. Local storage retains separate best scores for each difficulty and the latest 20 runs. Existing scores remain intact; the original `riftguessr-best` key is retained as an overall best, and the score book uses `riftguessr-scores-v2`.

Invalid records are ignored. If storage is blocked, results remain available for the visit and the interface reports that they could not be saved.

**Map & credits** accepts a high-resolution local image for both clue and guess views; no image is uploaded. The previous classic capture and illustrated map remain fallbacks if the tiled map cannot load.

## Assets and maintenance

The bundled image pyramid contains 159 detail tiles, one overview and a manifest, approximately 30 MB total. All assets are served locally; gameplay does not depend on the capture author's server.

Source and attribution are documented in [assets/SOURCES.md](assets/SOURCES.md). To rebuild the pyramid on Windows with Node and System.Drawing available:

```text
node scripts/fetch-terrain.mjs all
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-terrain.ps1
```

The fetch script caches public source tiles in the OS temporary directory, uses four concurrent requests and retries failed downloads. The packer writes only under `assets/terrain` by default. The PowerShell execution-policy override applies to that process only.

## Validation

All 23 tests pass with `npm test` or `node --test tests/*.test.js`, covering crop-safe selection, expanded spot coverage, normal-view scene data, forgiving scoring, unlimited zoom coordinate transforms, score persistence, image-pyramid integrity and deadline-based timers.

Desktop and mobile browser checks pass for image orientation and pixel alignment, exact joins across tile boundaries, zoom beyond one billion times without oversized DOM layers, pin placement, mobile touch/pinch, forgiving scores, five-round score saving, reload and missing-asset fallbacks. No browser exceptions were observed.

Timer browser checks pass for all three displayed limits, delayed asset loading, manual submission, cancellation on leaving, a real eight-second expiry, automatic scoring of an existing pin, no-pin zero scores, rejection of late pin/clear/submit inputs, fresh timers each round, five-round persistence and the mobile HUD layout.

## Files

- `index.html`, `styles.css`: lobby, full-screen game, results and score dialogs.
- `game.js`: game flow, map interaction and score persistence.
- `core.js`: scene selection, spot grid, scoring, zoom math and score-book validation.
- `terrain-source.js`: image pyramid, bounded tile cache and custom/fallback images.
- `clue-renderer.js`: unmodified camera-view crops.
- `round-clock.js`: round deadlines, countdown updates and timer cleanup.
- `scripts/`: reproducible source download and asset packaging.
- `assets/`: high-resolution terrain pyramid, classic fallback and source notes.
