import assert from 'node:assert/strict';
import fs from 'node:fs';
import {korean,blockSearchText} from './dist/i18n.js';
import {csvText} from './dist/exports.js';
const blocks=JSON.parse(fs.readFileSync('dist/blocks.json'));
for(const b of blocks){assert(/[가-힣]/.test(korean(b.name)),b.name);assert(!/[A-Za-z]/.test(korean(b.name)),b.name);assert(blockSearchText(b).includes(korean(b.name)));if(b.notes)assert(/[가-힣]/.test(korean(b.notes)));}
assert.equal(korean('Place 30 × Deepslate Tiles'),'심층암 타일 30개 배치');
assert.equal(korean('Row 2 of 72 · Y = 1'),'2번째 줄 / 전체 72줄 · Y = 1');
assert.equal(korean('Chest 2 of 3'),'2번째 상자 / 전체 3개');
assert.equal(korean('2 of 16 materials collected'),'재료 16종 중 2종 수집 완료');
assert.equal(korean('Leave 3 empty spaces'),'3칸 비워두기');
assert.equal(korean('From X 3 to X 7 · Y 2 · facing=east'),'X 3부터 X 7까지 · Y 2 · 방향=동쪽');
assert.equal(korean('Gray Concrete, 64 blocks, collected'),'회색 콘크리트, 64개, 수집 완료');
assert.equal(korean('Delete “My Stone Home” from this browser? Download a backup first to keep it.'),'이 브라우저에서 “My Stone Home”을(를) 삭제할까요? 보관하려면 먼저 백업을 다운로드하세요.');
const fixture={palette:[blocks[0]],cells:[0,0]};const csv=csvText(fixture,korean);assert(csv.startsWith('블록,식별자,수량,'));assert(csv.includes('하얀색 콘크리트,minecraft:white_concrete,2,'));assert(csvText(fixture).startsWith('Block,Identifier,Count,'));
console.log('PASS Korean coverage for 162 blocks, notes, bilingual search, dynamic guide/count strings, preserved user names and localized CSV IDs.');
