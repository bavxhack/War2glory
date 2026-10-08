import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GENERAL_PORTRAITS, assignMissingPortraits, randomPortraitId } from '../packages/game-core/portraits.js';
import { WorldStorage } from '../apps/server/storage.js';
import { OFFICER_RULES, recruitGeneral, recruitQuote, syncCandidates } from '../packages/game-core/officers.js';
import { newCity } from '../packages/game-core/index.js';
import { newMilitary, renameGeneral, applySkillConversion, applySkillDistribution } from '../packages/game-core/military.js';

test('catalogue has 20 distinct stable entries, ten women and ten men; random selection covers all', () => {
  assert.equal(GENERAL_PORTRAITS.length, 20); assert.equal(new Set(GENERAL_PORTRAITS.map(p => p.id)).size, 20);
  assert.equal(GENERAL_PORTRAITS.filter(p => p.gender === 'woman').length, 10); assert.equal(GENERAL_PORTRAITS.filter(p => p.gender === 'man').length, 10);
  for (let i = 0; i < 20; i++) assert.equal(randomPortraitId(n => { assert.equal(n, 20); return i; }), GENERAL_PORTRAITS[i].id);
  assert.throws(() => randomPortraitId(() => 20));
  assert.equal(randomPortraitId(() => 0, [GENERAL_PORTRAITS[0].id]), GENERAL_PORTRAITS[1].id);
  assert.equal(randomPortraitId(() => 0, GENERAL_PORTRAITS.map(p => p.id)), GENERAL_PORTRAITS[0].id);
});

test('existing portraits stay fixed and appearance never changes skills, names or owners', () => {
  const p = { military: newMilitary('p') }; const before = structuredClone(p.military.generals[0]); let draws = 0;
  assignMissingPortraits(p, () => { draws++; return 19; }); assert.equal(draws, 1);
  const { portraitId, ...unchanged } = p.military.generals[0]; assert.deepEqual(unchanged, before); assert.equal(portraitId, GENERAL_PORTRAITS[19].id);
  assignMissingPortraits(p, () => { throw new Error('must not reroll'); });
  p.military.generals[0].experience = 100;
  const renamed = renameGeneral(p.military, { generalId: before.id, name: 'New name', expectedVersion: 1 });
  const skilled = applySkillDistribution(applySkillConversion(renamed.generals[0], 1), { attack: 1 }); assert.equal(skilled.portraitId, portraitId);
});

test('candidate portrait survives recruitment and cannot be chosen through client payload', () => {
  const p = { playerId: 'p', city: newCity(0), military: newMilitary('p') }; p.city.resources = { wood: 1000, stone: 1000, food: 1000 };
  Object.assign(p.city.militarySlots[0], { building: 'barracks', level: 1 }); let seq = 0;
  syncCandidates(p, 0, OFFICER_RULES, () => 0, () => `id-${++seq}`);
  const candidate = p.military.candidatePool.candidates[0];
  assert.equal(new Set(p.military.candidatePool.candidates.map(c => c.portraitId)).size, 3);
  const command = { ...recruitQuote(p, candidate.id, 0), portraitId: GENERAL_PORTRAITS[19].id };
  const hired = recruitGeneral(p, command, 0, OFFICER_RULES, () => 'hired');
  assert.equal(hired.military.generals.at(-1).portraitId, candidate.portraitId); assert.equal(hired.military.generals.at(-1).acquisition.portraitId, candidate.portraitId);
});

test('schema 10 migration saves random portraits once for all generals and open candidates; restart retains full state', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'portrait-save-')); t.after(() => rm(dir, { recursive: true, force: true }));
  let storage = await new WorldStorage(dir, 'test', () => 100000).initialize();
  let { player } = await storage.register('PortraitOwner', 'sicheres-passwort');
  await storage.advanceWorld(100000); player = await storage.loadPlayer(player.playerId);
  assert.ok(GENERAL_PORTRAITS.some(p => p.id === player.military.generals[0].portraitId));
  Object.assign(player.city.militarySlots[0], { building: 'barracks', level: 1 });
  syncCandidates(player, 100000, OFFICER_RULES, () => 0, (() => { let n = 0; return () => `candidate-${++n}`; })());
  player.schemaVersion = 10;
  delete player.military.generals[0].portraitId;
  for (const c of player.military.candidatePool.candidates) delete c.portraitId;
  const before = structuredClone(player); await storage.savePlayer(player);
  player = await storage.loadPlayer(player.playerId); assert.equal(player.schemaVersion, 13);
  const compare = structuredClone(player); compare.schemaVersion = 10;
  for (const c of [...compare.military.generals, ...compare.military.candidatePool.candidates]) delete c.portraitId;
  assert.deepEqual(compare, before);
  for (const c of [...player.military.generals, ...player.military.candidatePool.candidates]) assert.ok(GENERAL_PORTRAITS.some(p => p.id === c.portraitId));
  const saved = structuredClone(player);
  storage = await new WorldStorage(dir, 'test', () => 100000).initialize(); assert.deepEqual(await storage.loadPlayer(player.playerId), saved);
});
