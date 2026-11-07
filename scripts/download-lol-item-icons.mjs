#!/usr/bin/env node
/**
 * Download League of Legends item icons from Riot Data Dragon.
 * Run from your website repository root: node scripts/download-lol-item-icons.mjs
 * Node.js 18+ required. Uses only built-in Node APIs; no npm install needed.
 */
import { mkdir, readFile, readdir, rename, stat, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { optimizePng } from './lib/png.mjs';

const ROOT = process.cwd();
const ICON_DIR = path.join(ROOT, 'assets', 'league', 'items');
const MANIFEST_FILE = path.join(ROOT, 'assets', 'league', 'item-manifest.json');
const REPORT_FILE = path.join(ROOT, 'assets', 'league', 'item-icon-report.json');
const BASE = 'https://ddragon.leagueoflegends.com';
const QUICK = process.argv.includes('--quick');
const NO_SCAN = process.argv.includes('--no-scan');
const ICON_CONCURRENCY = 10;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.cache', 'coverage', '.venv', 'venv', '.vscode', 'assets']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(url, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'Personal-LoL-Item-Icon-Archive/1.0' } });
      if (!response.ok) {
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < retries - 1) {
          const delay = Math.min(7000, 700 * 2 ** attempt);
          await sleep(delay);
          continue;
        }
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) await sleep(700 * 2 ** attempt);
    }
  }
  throw lastError ?? new Error(`Fetch failed: ${url}`);
}

async function getJson(url) { return (await get(url)).json(); }
async function fileExists(filename) { try { await access(filename); return true; } catch { return false; } }
async function saveJson(filename, obj) {
  const tmp = `${filename}.tmp-${randomUUID()}`;
  await writeFile(tmp, JSON.stringify(obj, null, 2) + '\n');
  await rename(tmp, filename);
}
function validId(value) {
  const v = String(value);
  return /^\d{3,6}$/.test(v) && Number(v) > 0 ? v : null;
}
export function collectIds(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found;
  // The tracker also stores compact column-based search indexes.
  if(Array.isArray(value.columns) && Array.isArray(value.rows)){
    const itemColumn=value.columns.indexOf('items');
    if(itemColumn>=0)for(const row of value.rows)for(const entry of row[itemColumn] || []){const id=validId(entry);if(id)found.add(id);}
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectIds(entry, found);
    return found;
  }
  for (const [key, entry] of Object.entries(value)) {
    const idField = /^(item[0-6]|item_?id|itemId|itemID|purchasedItemId)$/i.test(key);
    const itemList = /^(items|itemIds|item_ids|itemBuild)$/i.test(key);
    if (idField) {
      const id = validId(entry);
      if (id) found.add(id);
    }
    if (itemList && Array.isArray(entry)) {
      for (const el of entry) {
        const id = validId(el);
        if (id) found.add(id);
      }
    }
    if (entry && typeof entry === 'object') collectIds(entry, found);
  }
  return found;
}
async function scanJson(root, ids, stats) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await scanJson(full, ids, stats);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const info = await stat(full);
      if (info.size > 150_000_000) { stats.skippedBigFiles++; continue; }
      const json = JSON.parse(await readFile(full, 'utf8'));
      collectIds(json, ids);
      stats.scannedFiles++;
    } catch { stats.badJsonFiles++; }
  }
}
function buildEntry(id, item, version) {
  return {
    id,
    name: item.name || `Item ${id}`,
    icon: `assets/league/items/${id}.png`,
    sourceVersion: version,
    tags: Array.isArray(item.tags) ? item.tags : [],
  };
}
async function downloadIcon(id, item, version) {
  const target = path.join(ICON_DIR, `${id}.png`);
    if (await fileExists(target)) {
      const existing=await readFile(target);
      if(existing.length>=8 && existing.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return { id, status: 'existing' };
    }
  const full = String(item?.image?.full || `${id}.png`);
  const url = `${BASE}/cdn/${encodeURIComponent(version)}/img/item/${encodeURIComponent(full)}`;
  try {
    const buffer = Buffer.from(await (await get(url)).arrayBuffer());
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error(`Response is not a PNG: ${url}`);
    }
    const tmp = `${target}.tmp-${randomUUID()}`;
    await writeFile(tmp, optimizePng(buffer));
    await rename(tmp, target);
    return { id, status: 'downloaded' };
  } catch (error) {
    return { id, status: 'failed', error: error.message };
  }
}
async function pool(jobs, worker, concurrency) {
  const results = [];
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (index < jobs.length) {
      const job = jobs[index++];
      results.push(await worker(job));
    }
  }));
  return results;
}
function historicalCandidates(versions, current) {
  const newestForPatch = new Map();
  for (const version of versions) {
    const m = /^(\d+)\.(\d+)\.\d+$/.exec(version);
    if (!m || version === current) continue;
    const patch = `${m[1]}.${m[2]}`;
    if (!newestForPatch.has(patch)) newestForPatch.set(patch, version);
  }
  const entries = [...newestForPatch.entries()];
  const firstPass = entries.filter(([patch]) => {
    const minor = Number(patch.split('.')[1]);
    return minor % 2 === 0 || minor === 1;
  }).map(([, v]) => v);
  const secondPass = entries.filter(([patch]) => {
    const minor = Number(patch.split('.')[1]);
    return minor % 2 !== 0 && minor !== 1;
  }).map(([, v]) => v);
  return [...firstPass, ...secondPass];
}
async function main() {
  console.log('League Item Icons — official Riot Data Dragon downloader');
  console.log('Repository:', ROOT);
  await mkdir(ICON_DIR, { recursive: true });
  const versions = await getJson(`${BASE}/api/versions.json`);
  if (!Array.isArray(versions) || !versions.length) throw new Error('Could not retrieve Riot Data Dragon versions');
  const version = versions[0];
  console.log('Latest available Data Dragon version:', version);
  const current = (await getJson(`${BASE}/cdn/${version}/data/en_US/item.json`)).data;
  if (!current || typeof current !== 'object') throw new Error('Invalid item metadata returned');

  let old = { items: {} };
  try { old = JSON.parse(await readFile(MANIFEST_FILE, 'utf8')); } catch(error) { if(error.code!=='ENOENT')throw new Error('Existing item manifest is unreadable; restore it before updating icons.'); }
  const items = { ...(old.items || {}) };
  const sources = new Map();
  for (const [id, item] of Object.entries(current)) {
    if (!validId(id)) continue;
    items[id] = buildEntry(id, item, version);
    sources.set(id, { item, version });
  }
  for(const [id,entry] of Object.entries(old.items || {})){
    if(validId(id) && !sources.has(id) && entry.sourceVersion)sources.set(id,{item:{name:entry.name,image:{full:`${id}.png`}},version:entry.sourceVersion});
  }
  console.log('Current item entries:', sources.size);

  const referenced = new Set();
  const scanStats = { scannedFiles: 0, badJsonFiles: 0, skippedBigFiles: 0 };
  if (!NO_SCAN) {
    console.log('Scanning project JSON files for referenced (including older) item IDs...');
    const archiveRoot=path.join(ROOT,'data','league');
    await scanJson(await fileExists(archiveRoot)?archiveRoot:ROOT, referenced, scanStats);
    console.log(`Found ${referenced.size} referenced item IDs across ${scanStats.scannedFiles} JSON files.`);
  }
  const unresolved = new Set([...referenced].filter((id) => !sources.has(id) && !items[id]));
  const foundLegacy = new Map();
  if (unresolved.size && !QUICK) {
    const candidates = historicalCandidates(versions, version);
    console.log(`Searching historical patches for ${unresolved.size} absent item IDs (this can take a little while)...`);
    for (let start = 0; start < candidates.length && unresolved.size; start += 6) {
      const batch = candidates.slice(start, start + 6);
      const oldPatches = await Promise.all(batch.map(async (v) => {
        try { return { version: v, data: (await getJson(`${BASE}/cdn/${v}/data/en_US/item.json`)).data || {} }; }
        catch { return { version: v, data: {} }; }
      }));
      for (const patch of oldPatches) {
        for (const id of [...unresolved]) {
          if (patch.data[id]) {
            const item = patch.data[id];
            items[id] = buildEntry(id, item, patch.version);
            sources.set(id, { item, version: patch.version });
            foundLegacy.set(id, patch.version);
            unresolved.delete(id);
          }
        }
      }
      if (start === 0 || (start + 6) % 30 === 0 || !unresolved.size) {
        console.log(`  Searched ${Math.min(start + 6, candidates.length)}/${candidates.length} historical patches; remaining: ${unresolved.size}`);
      }
    }
  }
  // On subsequent runs, keep icons already archived, including historical entries.
  const jobs = [...sources.entries()].map(([id, source]) => ({ id, ...source }));
  console.log(`Verifying/downloading ${jobs.length} item icons...`);
  const results = await pool(jobs, ({ id, item, version }) => downloadIcon(id, item, version), ICON_CONCURRENCY);
  const failed = results.filter((r) => r.status === 'failed');
  const successful = results.filter((r) => r.status === 'downloaded');
  const existing = results.filter((r) => r.status === 'existing');
  // Do not advertise icons as present when the PNG download did not succeed.
  for (const { id } of failed) {
    if (!(await fileExists(path.join(ICON_DIR, `${id}.png`)))) delete items[id];
  }
  const sortedItems = Object.fromEntries(Object.entries(items).sort(([a], [b]) => Number(a) - Number(b)));
  const manifest = {
    dataDragonVersion: version,
    generatedAt: new Date().toISOString(),
    iconDirectory: 'assets/league/items',
    items: sortedItems,
  };
  const report = {
    generatedAt: manifest.generatedAt,
    dataDragonVersion: version,
    currentItemCount: Object.keys(current).length,
    manifestItemCount: Object.keys(items).length,
    downloaded: successful.length,
    alreadyPresent: existing.length,
    failedDownloads: failed,
    referencedItemCount: referenced.size,
    legacyItemsFound: Object.fromEntries(foundLegacy),
    unresolvedReferencedItemIds: [...unresolved].sort((a, b) => Number(a) - Number(b)),
    scanStats,
    note: 'Unresolved IDs may represent deprecated items, placeholders, or data not present in the sampled historical Data Dragon patches. The manifest never replaces your match archive.',
  };
  await saveJson(MANIFEST_FILE, manifest);
  // Small browser catalog: paths are deterministic, so avoid transferring paths/tags for every ID.
  await writeFile(path.join(ROOT,'assets','league','item-catalog.json'),JSON.stringify({dataDragonVersion:version,names:Object.fromEntries(Object.entries(sortedItems).map(([id,item])=>[id,item.name]))})+'\n');
  await saveJson(REPORT_FILE, report);
  console.log('Downloaded:', successful.length, '| Already present:', existing.length, '| Failed:', failed.length);
  console.log('Historical IDs located:', foundLegacy.size, '| Unresolved:', unresolved.size);
  console.log('Saved:', path.relative(ROOT, MANIFEST_FILE));
  console.log('Report:', path.relative(ROOT, REPORT_FILE));
  if (failed.length) {
    console.log('Some images could not be downloaded; see report. Re-running will retry missing icons.');
    process.exitCode = 1;
  }
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch((error) => { console.error('Download failed:', error.message); process.exitCode = 1; });
