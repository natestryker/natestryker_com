Tank Intel

Play: /games/tank-intel/
Quality review: /games/tank-intel/?review=1
The invisible button immediately right of Daily also opens review. It becomes
visible when focused from the keyboard. Review lists every prompt, answer,
alias, rarity, evidence summary, and source. Search accepts multiple words;
rarity filters and Expand all / Collapse all help inspect the catalogue.

Rules
- Seven deterministic prompts per Eastern calendar day, drawn across topics.
  At least two come from creators, Holiday Ops, crew, eras, mechanics, or curiosities.
- Each prompt gets 25 seconds. Invalid entries have unlimited retries and never
  restart the clock. Typo suggestions require confirmation before scoring.
- Accepted answers or Pass finish a prompt. Timeout scores zero. Prompt screens
  contain no explanatory paragraphs or accepted-answer lists. The final debrief
  keeps the score table and provides an expandable answer/rarity row per prompt,
  searchable by name, abbreviation, or rarity.
- Corrections compare complete names, meaningful words, word order, missing
  particles, phonetic signatures, abbreviations, and model-number groups. They
  appear after a short typing pause or submission. Different model numbers are
  not silently substituted; every suggested correction needs confirmation.
- Rarities: Tomato 20, Average 40, Unicum 60, Super Unicum 80, Tank Ace 100.
  Exactly one accepted answer per prompt is Tank Ace. Scoring feedback matches
  the rarity color, with blue for Unicum and purple for Super Unicum.
- Midnight in America/New_York loads the next daily set, including during an
  unfinished run. The check also runs on focus, visibility change, and pageshow.
  DST and page suspension are handled using absolute timestamps, not tick counts.
- Opening review does not pause the active prompt's absolute deadline.
- Saves include the rules and catalogue versions plus exact prompt IDs. A data
  refresh invalidates incompatible saved runs instead of re-scoring old answers.

Data and rarity
catalogue.json is a frozen, self-contained reference snapshot. The game performs
no live third-party API requests. Every downloaded source has a URL and SHA-256
in meta.sources. Selected tanks.gg production snapshots span 9.17.1 through the
current release. Older FV4202, T-50-2, and WT E 100 records have explicit history
references. Distinct past tiers/classes and historical names remain accepted.

Observed tank exposure uses 60% normalized log tracked-player counts, 30%
normalized log lifetime battles, and 10% historical roster coverage. NA and EU
samples are combined. These are recognition proxies, not surveyed trivia-answer
frequencies, and are relative to each prompt's accepted roster. Missing samples
use an availability prior rather than zero popularity.

Other categories use labelled proxies: equipment mounting compatibility and
availability; map archival status and scope; consumable national eligibility;
award-condition complexity and legacy status. Map archive dates describe client
files, not exact Random Battle rotation-removal dates. Exposure ties use name
ordering to produce a stable, singular Tank Ace.

Private, secret, test-tagged, and special-mode vehicles are filtered. Very small
non-tech-tree samples (under 100 tracked players) require a first-party release
reference. meta.heldForReleaseVerification lists withheld records; add a verified
release reference in update-tank-intel.mjs when a release is established. Rare
released vehicles are explicitly retained with publisher sources. Client
catalogues and tracked-player samples can have gaps, so review evidence before
changing eligibility or inferring population-wide rarity.

Refresh from public sources (Node 22+):
  node scripts/update-tank-intel.mjs
Reuse previously downloaded source responses:
  node scripts/update-tank-intel.mjs --cached --cache-dir <directory>
The default cache directory is the OS temporary directory. Inspect the generated
catalogue and review screen after updates. No API keys are required.

Validation:
  node --test scripts/tank-intel.test.mjs scripts/site-routes.test.mjs
Tank Intel checks also run in the existing website CI workflow.

Creative topics
creative.mjs contains sourced Holiday Ops box rosters (event years, not box-sale
calendar years), current crew-role facts, historical creators, and vehicle-name
or mechanic filters. topics.mjs stores the publisher creator-directory and
2020–2023 vehicle-yearbook extracts plus source hashes. Returning vehicles in
the yearbooks are excluded from first-release prompts. Yearbook entries are
resolved back to the main vehicle identities so spellings and scoring agree.

Refresh those public reference extracts:
  node scripts/update-tank-intel-topics.mjs
Use --cached to reuse downloaded HTML/JSON from the OS temporary directory.
Changing the prompt or matching rules also requires bumping BANK_VERSION.
