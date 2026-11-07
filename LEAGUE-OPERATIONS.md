# Tracker maintenance

## Live inspection and verification

On November 7, 2026, the published JSON contained 300 matches: 100 per account. Each account had completed its first 100-ID page and reported `backfillComplete: false`. GitHub showed the first manual import succeeded and another push-triggered run queued. There were no completed scheduled collections in the inspected run history yet; this was an incomplete initial import, not evidence of a stalled importer.

Published summary: 3,740,201 bytes. Local pre-optimization summary: 3,848,794 bytes. The new local manifest plus all searchable indexes total 93,545 bytes (about 98% smaller). Raw match files remain unchanged. All 300 identities and core metrics match the previous summaries. There are 300 distinct Riot match IDs; eligible totals are 272 collected games, 153 wins and 119 losses. ARAM, Arena and remakes remain excluded. Collected totals do not imply complete lifetime history.

Chrome checks cover desktop/mobile rendering, sticky filters, champion sorting/expansion, filtered history and lazy match/ranked detail loading. Synthetic tests additionally cover ten thousand index rows, append-only updates, failed pages/details, resumed imports, duplicate detection, stale-account alerts, backup checksums and restoration.

## Deployment and backfill progress

1. Commit the tracker changes, generated public metadata and all `data/league/views/*.json` files. Keep all existing raw match files. Push to `main`; the existing workflow collects, compiles, commits and deploys the site. Navigation and other website pages are unchanged.
2. Existing `RIOT_API_KEY` and `RIOT_ACCOUNTS` settings continue to work. No new secret, account connection or backend service is required.
3. Run **Actions > League tracker > Run workflow** if you want an immediate update. The default discovers two historical pages per account per update. Optional repository variable `RIOT_BACKFILL_PAGES` accepts 1–5, subject to time/rate limits. Start with the default.
4. Inspect **Collect Riot data**, **Build compact frontend from permanent archives**, **Persist data**, **deploy**, and **health**. The run summary shows account counts, offsets, pending IDs, exhaustion/completion and last progress. Compare successive runs; do not assume a fixed number of games is available from Riot.
5. Refresh both tracker pages after deployment. The updated script URL avoids using the previous frontend during migration. Try all account/champion/item/queue/result filters, sorting, record links, match expansion and ranked arrows.
6. Enable the new **League collection health** workflow. Its hourly check fails if any account has no successful collection for three hours, reports an error, or incomplete backfill has made no progress for 24 hours. Enable Actions failure notifications in **GitHub profile > Settings > Notifications > Actions**. Notifications follow GitHub's [scheduled-workflow notification rules](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).

GitHub can delay/drop schedules or disable inactive public-repository schedules. A workflow that never starts cannot report its own failure. Periodically check account timestamps or use an independent monitor. See [GitHub schedule limits](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Resumable backfill

- New matches use all 100-ID pages within a fixed polling window, with a one-day overlap. Historical discovery has a separate saved end time and offset.
- Each discovered page is saved to `pending.json` before detail downloads. Its historical offset is checkpointed independently of detail failures; an unavailable match no longer restarts the same page repeatedly.
- Each account gets a seven-minute working budget so all three accounts can progress. A normal budget pause retains pending IDs and leaves completion false for the next run.
- Detail downloads use atomic, write-once publication keyed by Riot ID. Existing matches cannot be replaced. Failed details stay pending and are retried even if future ID listings omit them.
- `backfillExhausted` means a successful listing returned fewer than 100 IDs. Completion also requires no pending details. Errors never establish completion.
- Sequential requests share the key's rate budget, honor `Retry-After`, and retry transient connection/server/JSON errors. Logs include page, offset and counts, never credentials.
- Check pending IDs and logs when collection fails. Fix the key, account settings, quota, branch permissions or API problem and rerun. Do not clear IDs/cursors merely to obtain a green status. A permanently unavailable detail is a documented gap; games expired before collection cannot be reconstructed.

## Storage and loading

All paths below are relative to `data/league/`.

| Path | Purpose |
| --- | --- |
| `accounts/<id>/matches/<Riot-ID>.json` | Immutable permanent raw response and original normalized record, including challenge data. |
| `accounts/<id>/state.json` | Identity, discovery checkpoints, progress/success/error timestamps. |
| `accounts/<id>/pending.json` | IDs whose details are not yet safely saved. |
| `accounts/<id>/ranked.json` | All ranked snapshots; new writes preserve observations and sort chronologically. |
| `accounts/<id>/public.json` | Compact account metadata, progress, statistics, mastery and last two snapshots. |
| `public.json` | Schema-v2 manifest with accounts, coverage, collected lifetime/yearly totals and index URLs. |
| `views/index-<month>-<hash>.json` | Compact, column-based monthly search/stat indexes. No raw participants or challenge payloads. |
| `views/details/<account>/<Riot-ID>-<hash>.json` | Full tracked-player metrics/challenges, fetched only on match expansion. |

Both pages load the manifest and compact searchable metrics, with at most four parallel index requests. Loading these metrics preserves global filters, records, graphs and sortable champion statistics across the full collected history. Detailed lifetime match payloads are not downloaded initially. Index row counts and account/match uniqueness are validated.

Full raw match archives stay in Git and backups but are excluded from the Pages deployment. Expanding a match loads its compact per-player detail file once per page session, including advanced challenge values. Expanding ranked progress loads that account's full timeline. A failed request shows a retry message without discarding the dashboard. The old deployed format remains supported during rollout.

Indexes have content-addressed filenames; unchanged months can be cached. Previous generations remain for readers with cached manifests. Metadata and indexes are rebuildable from raw files without contacting Riot or using a key. Raw records are never rewritten. The publisher rejects corrupt input and duplicate configured PUUIDs before replacing the manifest. Shared games with different tracked players count as separate account performances; identical account/match keys never count twice.

Monitor repository/Pages limits, backup sizes, generated-index generations and browser load time as the archive grows. Raw payloads and Git history remain permanent and grow over years; future cleanup/partitioning must preserve raw records and all currently referenced indexes.

## Offline checks and rebuild

With Node 22+ and Git, from the repository root:

```powershell
node --test scripts/league/*.test.mjs
node scripts/league/archive.mjs
node scripts/league/publish.mjs
node scripts/league/report.mjs
```

The publisher needs no API key. Lifetime/yearly figures are derived from archived raw data using the collector's normalization. Year boundaries are UTC. The dashboard labels partial history rather than presenting it as complete lifetime history.

Optional local rendering check (Chrome installed):

```powershell
node scripts/league/browser-smoke.mjs
```

Set `CHROME_PATH` if Chrome is outside the default Windows install path. The helper starts a temporary HTTP server/headless browser, tests both pages, and closes them. No Riot credentials are used.

## Backups, independent copies and recovery

1. Run **Actions > League archive backup > Run workflow** for an initial backup. It subsequently runs weekly on Sunday at 08:23 UTC.
2. Download its `league-backup-…` artifact and extract the timestamped folder containing `data/league`, `repository.bundle`, `manifest.json` and `RESTORE.txt`.
3. Store a copy on an independent drive and another cloud account/location you control. Keep monthly/yearly copies. No independent destination has been configured automatically. GitHub artifacts expire (up to 90 days here) and belong to the repository; they alone do not protect against repository loss. See [artifact retention](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts).
4. Verify the extracted folder from a checkout with Node/Git, replacing the example path:

```powershell
node scripts/league/backup.mjs verify "E:\LeagueBackups\league-<timestamp>"
```

5. To create a local backup instead, first update a clean checkout using `git pull --ff-only`, then run:

```powershell
node scripts/league/backup.mjs create "E:\LeagueBackups"
```

6. To recover repository loss, clone the bundle into a new directory, then copy the snapshot's `data/league` over the restored checkout (the snapshot may contain complete downloads newer than its Git commit):

```powershell
git clone "E:\LeagueBackups\league-<timestamp>\repository.bundle" recovered-site
```

7. In the restored checkout, run the verifier, publisher and tests. Review/commit recovered changes, configure the repository remote, and push. Reconfigure repository secrets, account variables, Pages/custom domain, workflow permissions and notifications manually; credentials/settings are intentionally excluded from backups.
8. If collection/persistence fails, download the run's `league-recovery-…` JSON artifact promptly (30-day retention here). Merge complete new match files into the proper account directories without replacing existing ones. Verify/rebuild before committing. If a permanent file was accidentally edited/deleted, restore that file from known-good Git history or a verified backup before running the verifier.

A runner crash or manual cancellation can prevent cleanup, commit or artifact upload. The next run resumes committed checkpoints and pending IDs, subject to Riot retention. No system can recover details never successfully downloaded or never backed up. Keep independent copies and periodically perform a restore drill.
