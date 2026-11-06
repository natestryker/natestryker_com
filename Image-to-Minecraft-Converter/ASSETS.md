# Minecraft block data and texture provenance

The catalog contains **162 full-cube blocks**, targeting **Minecraft Java Edition 1.20.4** (data version 3700). Each identifier was checked against the corresponding version's `assets/minecraft/blockstates/<id>.json`. Each downloaded texture was decoded and verified as 16×16 with 100% opaque pixels. This is a deliberately curated wall-art catalog, not every Minecraft block.

## Source

- Extracted Minecraft assets: https://github.com/InventivetalentDev/minecraft-assets/tree/1.20.4
- Pinned source commit: `90d256dfee7b6fd8014e1bc3b107e64a530c5f9b`
- Texture paths: `assets/minecraft/textures/block/<name>.png`
- Glazed model definition: `assets/minecraft/models/block/template_glazed_terracotta.json`
- Example orientation mapping: `assets/minecraft/blockstates/white_glazed_terracotta.json`

Minecraft textures remain the property of Mojang/Microsoft. This independent utility is not affiliated with, approved by, or an official product of Mojang or Microsoft. Review Minecraft usage guidelines before distributing a commercial derivative: https://www.minecraft.net/en-us/usage-guidelines . These are extracted game assets, not newly licensed artwork.

`build-assets.py` reproduces the palette and textures from the pinned revision (Python 3 and Pillow required). It verifies existence of a blockstate file and opaque 16×16 textures before accepting each entry. Asset retrieval is a development step; the deployed app serves local files and does not fetch a player's image or textures from external services.

## Color matching

`color` is the rounded arithmetic average of the 256 source texels in encoded sRGB; it is a texture-based representative color, not a measurement of in-game appearance under lighting. `textureVariance` is the mean per-channel squared deviation of the texels from this average in 8-bit sRGB units. It can be used to prefer visually smoother blocks. Color matching can convert these averages to a perceptual space; actual lighting, shaders and resource packs can change apparent colors.

## Orientation and suitability

The build is a vertical wall viewed **from south (+Z), looking north (-Z)**. Image left-to-right increases X; image bottom-to-top increases Y.

- Concrete, wool and terracotta include all 16 dye colors. Concrete powder and all gravity-dependent blocks are excluded.
- Glazed terracotta includes all 16 colors with `facing=east`. The blockstate's model rotation `y=270` puts the template's unrotated west face on the wall's visible south face. Follow this state for correct pattern orientation. Other faces have different UV rotations; rendering one image on all six faces is only an approximation of side/back patterns.
- Deepslate explicitly sets `axis=y`. Its top texture differs from its wall face.
- Sandstone, blackstone, quartz, dried kelp and melon use their **south wall face** for matching. Top/bottom may differ. Single-texture 3D cubes therefore approximate these secondary faces, while the front wall preview uses the source face texture.
- Copper blocks use **waxed IDs** to stop oxidation from changing their colors. IDs correctly map to their unwaxed appearance texture filenames.
- Only full opaque cubes are included. No glass, leaves, slabs, stairs, biome-tinted blocks, gravity blocks, animated textures or changing-light blocks are included. Glowstone and shroomlight are opaque, static textured full cubes; their emitted lighting is not simulated.
- `survival` is a convenience **low-cost palette heuristic**, not a claim about obtainability: all catalog blocks can be obtained in ordinary survival play, but metals and obsidian are excluded from this convenient subset because of material/tool costs. Wool and concrete can still require dye production at scale.

## JSON contract

`dist/blocks.json` is an ordered array. Each entry has:

- `id`: namespaced Minecraft block ID, without state suffix.
- `name`: display name.
- `category`: palette group.
- `color`: three integer sRGB components.
- `hex`: equivalent hexadecimal color.
- `texture`: relative path to local 16×16 PNG.
- `textureVariance`: nonnegative sRGB texture variance.
- `survival`: low-cost filtering heuristic.
- `properties`: required blockstate properties, such as `{"facing":"east"}`.
- `notes`: placement/rendering caveats.
- `version`: validated game asset version, `1.20.4`.
