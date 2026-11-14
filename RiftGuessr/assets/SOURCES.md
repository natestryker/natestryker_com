# Map imagery

## Default: high-resolution Season 14 capture

- Author/source viewer: https://summonersrift.mvilim.dev/
- Capture method and game-camera projection: https://summonersrift.mvilim.dev/about.html
- Source tile pattern: `https://summonersrift.mvilim.dev/combined_S14/{z}/{x}/{y}.png`
- Native captured extent: **11,537 × 9,544 pixels**, from the viewer's published source metadata.
- This is a Season 14 capture; it is not labelled as the latest live map.

The author assembled in-game camera captures at the normal League camera angle. RiftGuessr uses the imagery in its existing orientation and colors. No additional camera rotation, skew, mirroring or desaturation is applied.

`terrain/` locally repackages level-6 source tiles into 1,024-pixel JPEG tiles at quality 95, with half/quarter-resolution levels and an overview. Edge tiles are cropped to the original captured extent. The original level-3 source provides the overview. This preserves native pixel detail without decoding the full 110-megapixel image at once. Gameplay does not hotlink to the source server.

Reproduction scripts are in `../scripts/fetch-terrain.mjs` and `../scripts/build-terrain.ps1`.

## Classic fallback

`rift-map.jpg` is the previous 5,000 × 4,196 pixel classic Rift capture:

- Repository: https://github.com/Emiree69/SummonersRiftMap
- Original: https://raw.githubusercontent.com/Emiree69/SummonersRiftMap/main/img/summonersRiftBG.jpg

`fallback.svg` is the existing illustrated map, used if both captured-map sources are unavailable.

League of Legends and Summoner's Rift imagery belong to Riot Games. This is an unofficial fan project. Custom map images stay local to the browser.
