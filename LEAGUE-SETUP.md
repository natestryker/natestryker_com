# League tracker setup

This is a static GitHub Pages dashboard. A Node 22 GitHub Action polls Riot every 30 minutes at :17 and :47 UTC. Schedules may be delayed by GitHub. No backend or npm installation is required. The existing website remains static.

## 1. Upload the changes

Review and commit the new `league.html`, `match-history.html`, `assets/league/`, `scripts/league/`, `data/league/public.json`, `.github/workflows/league.yml`, this guide, and the Account Tracker card/navigation in `index.html`. Push to your repository's `main` branch. If your default branch has a different name, change both `main` references in the workflow before pushing. These changes have not been pushed for you.

## 2. Add the API key securely

1. Open your website repository on GitHub.
2. Click **Settings → Secrets and variables → Actions**.
3. In **Secrets**, click **New repository secret**.
4. Name it exactly `RIOT_API_KEY`.
5. Paste your approved Riot Personal API key into the secret value and click **Add secret**.
6. Never paste the key into HTML, JSON, a workflow file, a commit, an issue, or a chat. The collector reads it from an environment variable and sends it only in the HTTPS `X-Riot-Token` header. It does not log API bodies or headers.

## 3. Configure your three accounts

1. Open **Settings > Secrets and variables > Actions > Variables**.
2. Click **New repository variable**.
3. Name it exactly `RIOT_ACCOUNTS`.
4. Paste the JSON below, replacing the names and tags with your three actual Riot IDs. Do not include `#` in either field. The examples come from your existing OP.GG link; confirm all three before saving.
5. Click **Add variable** (or edit/save if it already exists).

```json
[
  {"id":"main","gameName":"natestryker","tagLine":"NA1","platform":"na1"},
  {"id":"alt","gameName":"T92_HMC","tagLine":"ARTY","platform":"na1"},
  {"id":"third","gameName":"shiak","tagLine":"shiak","platform":"na1"}
]
```

Only one `RIOT_API_KEY` secret is needed. Accounts are polled sequentially using that shared key. `RIOT_ACCOUNTS` overrides the older `RIOT_GAME_NAME`, `RIOT_TAG_LINE` and `RIOT_PLATFORM` variables; you can leave those unset for this configuration. Without `RIOT_ACCOUNTS`, the original single-account variables remain supported.

The tracker defaults to **All accounts**: match history, champion statistics, performance and personal records use all three accounts together. Every match and record identifies its account. The account dropdown narrows those sections to one account and also filters ranked progress. Overall summary cards always cover all accounts. Ranked observations are kept separate for each account. Mastery is still archived from the API but is not displayed: Riot mastery totals cannot be separated by queue, so they could include ARAM contributions.

Keep the `id` fields stable: they select permanent archive directories and form match links. Riot ID renames can update `gameName` and `tagLine` if the account PUUID stays the same. Changing an existing id's underlying account or platform is rejected to prevent mixing data. To replace an account, assign a new unique id; its old files remain in Git, but it no longer appears in the active combined view. Between one and three accounts can be configured; duplicates are rejected. Regional API routing is derived from each platform.

If upgrading an already populated single-account tracker, put that original account **first** in this list. Its archive is copied into its account directory automatically on the first run; source files are retained. For a fresh setup no migration is necessary. Once using multiple accounts, keep `RIOT_ACCOUNTS` configured rather than reverting to the legacy variables.

## 4. Enable Actions and Pages

1. Open the repository's **Actions** tab and enable workflows if prompted.
2. In **Settings → Actions → General → Workflow permissions**, allow **Read and write permissions**, then save. Organization policies or branch protection may require an administrator to allow the bot's data commits. Do not disable required protections blindly.
3. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. The workflow deploys the whole existing static site and retains `CNAME`, games, media and project folders. It excludes Git metadata and collector scripts from the deployment artifact.
4. Confirm the custom domain remains `natestryker.com` and HTTPS remains enabled. No DNS changes are needed for an existing working Pages domain.
5. Avoid leaving a competing Pages deployment workflow enabled; this repository had none when inspected.

## 5. Run and verify

1. Go to **Actions → League tracker → Run workflow**, choose `main`, then **Run workflow**.
2. Open the run. Tests must pass; the collection step should report saved unique matches and ranked observations.
3. Verify the bot's data commit appears and the **deploy** job succeeds.
4. Visit `https://natestryker.com/league.html`. You can also use the new homepage navigation link or Account Tracker homepage card.
5. Check all three account names and their last-collected timestamps. The initial run collects up to 100 historical match IDs per account, plus new matches. Later runs backfill another page per account until Riot's available history is exhausted. Large archives take multiple runs.
6. The arrow beside Tracker opens the wider match-history-only page and carries your current filters. Each connected account has its own expandable arrow under Ranked progress. Open a match for detailed stats, try champion/queue/result filters, and expand graph data for an accessible table of exact values.

If collection fails, completed downloaded matches are retained and the last complete dashboard remains available. The **health** job marks the overall workflow failed, even if Pages deployment succeeds. Inspect the **Collect Riot data** and **Persist data** steps, the run summary, pending IDs, and any recovery artifact. 401/403 usually means an invalid, expired, or unauthorized key; edit the existing repository secret to replace it. 404 often means the wrong Riot ID/platform or an unavailable match. 429 and server errors retry with backoff. Do not delete archives or clear pending IDs to fix an API outage.

## 6. Enable long-term backups and failure notifications

Read [LEAGUE-ARCHIVE.md](LEAGUE-ARCHIVE.md) for the durability audit, step-by-step notifications, weekly backup download, independent off-repository copies, and restore instructions. Include `.github/workflows/league-backup.yml` when committing the project. One successful backup downloaded and kept outside GitHub is essential for protection against repository loss.

## Data and limitations

- `accounts/<account-id>/matches/<match-id>.json` stores the raw match-v5 response and normalized tracked-player statistics permanently in Git. Match IDs prevent duplicates within each account. If two tracked accounts appear in the same game, each account performance remains a separate entry, labeled and linked by account; aggregate game counts count account performances. Raw responses include other participants' public match data and are publicly accessible in this public site/repository; they do not contain your API key.
- Each account directory has a `ranked.json` that appends a timestamped observation on each collection attempt that reaches the ranked stage, including unranked observations. It cannot reconstruct ranks before setup or infer exact LP changes per match. Promotions are separate graph segments rather than misleading LP drops. Solo/Duo and Flex remain separate.
- Root `public.json` combines all configured accounts for the frontend; each account directory retains its own summary, ranked history and `state.json` identity/backfill cursors. If one account fails, others continue and its last successful summary stays visible with a collection-delay indicator. Match files are written atomically before cursor advancement. A failed run can resume, and a failed summary update leaves the previous summary available.
- Available API history is finite. The archive retains data already collected but cannot recover matches Riot no longer serves. ARAM (including legacy queues, Clash and Mayhem), Arena (both queue IDs), and remakes remain in history but are excluded from all calculated statistics: game counts, wins/losses, champion summaries, records, KDA, CS, damage and performance graphs. Selecting an excluded queue only shows its match history, never its aggregate stats. Ranked snapshots remain unaffected. KDA uses `(kills + assists) / max(1, deaths)`.
- All match types returned by match-v5 are retained, with unknown queues shown by ID. Some modes do not populate conventional CS/role/challenge statistics. Item IDs and arbitrary challenge data are retained. The dashboard loads item names from Riot's public Data Dragon catalog and offers name autocomplete; partial names, boots/shoes wording, and numeric IDs are supported. Only final equipped items are searched, not purchases sold during the match. Removed items absent from the current catalog retain their numeric ID fallback. Mastery data is archived but hidden from the dashboard because the API does not provide queue-separated totals.
- Scheduled workflows run on the default branch; GitHub can delay them and disables schedules in inactive public repositories after 60 days. Re-enable in Actions when needed. Repository size and summary transfer time grow with history; Git is durable history, not unlimited storage. Back up the repository periodically.
- The collector spaces requests by 1.3 seconds and honors `Retry-After`. If other apps share the same API key, they also consume its budget. Manual workflow runs use the same concurrency group to avoid overlapping collectors. No API key is needed by visitors.
- Riot Personal keys are for personal or small private-community projects. This tracker supports up to three of your own accounts; consult Riot before expanding to a public multi-user service. See [Riot API policies](https://developer.riotgames.com/docs/portal) and [League documentation](https://developer.riotgames.com/docs/lol).

## Testing locally

Install Node.js 22 or newer, then run from the repository root:

```sh
node --test scripts/league/*.test.mjs
node --check scripts/league/collect.mjs
node --check assets/league/dashboard.js
```

Tests use synthetic responses, temporary directories and no real API key. They cover stat calculations, filters, remakes, retries, duplicate prevention, account isolation and interrupted-run recovery. To preview the page use an HTTP static server rather than opening `league.html` with `file://`, because ES modules and JSON fetch require HTTP. Do not save a real API key in a local file to preview the dashboard.
