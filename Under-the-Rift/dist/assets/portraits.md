# Expanded player portraits — v0.6

Generated with the built-in image-generation tool. Each sheet is an 8 × 8 atlas of 64 male adult esports-player portrait tiles. The original atlas remains for compatible identities. New files:

- `players-a.png`: clean-shaven young pros, varied face shapes, skin tones and hair silhouettes.
- `players-b.png`: broader age range, beards, mustaches, curls, shaved heads and glasses.
- `players-c.png`: emphasis on different eyeglasses, face proportions and haircuts.
- `players-d.png`: stronger silhouettes, freckles, subtle scars, facial hair and dyed hair.

Prompt set: production pixel-art esports portrait atlas for Under the Rift; exactly eight columns and eight rows of equally sized square tiles with no gutters, labels or text; one complete centered male adult head and shoulders contained within each tile; muted slate-gray background, crisp pixel art, consistent lighting and scale, plain esports jerseys. Request distinct people rather than recolors, varied East Asian, Black, South Asian, white, Latino and Middle Eastern appearances, ages 18–35. Sheet-specific directions are listed above. No women, children, helmets or masks.

Portrait identity is an atlas/tile index. IDs 16–271 address the new sheets; the 11 usable original IDs remain supported. Allocation favors unused tiles, then the least-used tiles when the population exceeds 267. These are 267 portrait tiles, not an unlimited supply of distinct faces: generated art can share similar features, and long careers eventually reuse tiles.
