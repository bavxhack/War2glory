import { allianceImage } from '../../packages/game-core/alliance-images.js';
import { randomUUID, createHash } from 'node:crypto';
import { allianceQuote, applyAlliance, membership, alliancePublic, alliancePage, validateAlliances } from '../../packages/game-core/alliances.js';
import { stableJSON } from '../../packages/game-core/city-logistics.js';
import { exposeCity, ownedCity, refreshCities } from '../../packages/game-core/multicity.js';

const reads = new Set(['alliance.list', 'alliance.get', 'alliance.invitations', 'alliance.chat.list', 'alliance.events.list', 'alliance.create.preview']);
const mutations = new Set(['alliance.create', 'alliance.invite', 'alliance.invitation.respond', 'alliance.invitation.revoke', 'alliance.description.update', 'alliance.notice.update', 'alliance.role.change', 'alliance.leadership.transfer', 'alliance.member.remove', 'alliance.leave', 'alliance.dissolve', 'alliance.chat.send', 'alliance.chat.remove', 'alliance.chat.read', 'alliance.image.finish', 'alliance.image.remove']);
export async function allianceRequest(storage, peer, message, now, preparedImage) {
  // Always in the world's exclusive queue. Recovery precedes reads too.
  await storage.advanceWorld(now);
  const { type, payload: p, requestId } = message, actor = { id: peer.playerId, name: peer.account.displayName, deliveredSequence: 0 };
  const world = storage.world, own = membership(world, actor.id);
  const rules = storage.config.alliances;
  if (!reads.has(type) && !mutations.has(type)) throw new Error('Unbekannter Bündnisbefehl.');
  if (type === 'alliance.list') {
    const query = typeof p.query === 'string' ? p.query.normalize('NFKC').trim().toLocaleLowerCase('de-DE').slice(0,40) : '';
    return alliancePage(world.alliances.items.filter(a => `${a.name} ${a.tag}`.toLocaleLowerCase('de-DE').includes(query)).map(a => ({ id: a.id, name: a.name, tag: a.tag, image: allianceImage(a), memberCount: a.members.length, maxMembers: a.maxMembers })), p.cursor);
  }
  if (type === 'alliance.invitations') return alliancePage(world.alliances.items.flatMap(a => a.invitations.filter(i => i.status === 'open' && i.expiresAt > now && (i.recipientId === actor.id || (own?.alliance.id === a.id && own.member.role !== 'member'))).map(i => ({ ...i, allianceName: a.name, tag: a.tag, image: allianceImage(a) }))).sort((a,b) => a.id.localeCompare(b.id)), p.cursor);
  if (type === 'alliance.get') {
    const a = world.alliances.items.find(a => a.id === (p.allianceId ?? own?.alliance.id));
    if (!a) throw new Error('Bündnis nicht gefunden.');
    const pub = alliancePublic(world, a, p.memberCursor);
    if (own?.alliance.id !== a.id) return pub;
    // Chat/events are fetched separately, never in snapshots or replay receipts.
    return { ...pub, membershipId: own.member.membershipId, role: own.member.role, adminVersion: a.adminVersion, notice: a.notice, lastReadSequence: own.member.lastReadSequence,
      members: pub.members.map(m => ({ ...m, membershipId: a.members.find(x => x.playerId === m.playerId).membershipId })) };
  }
  if (type === 'alliance.chat.list' || type === 'alliance.events.list') {
    if (!own || own.alliance.id !== p.allianceId || own.member.membershipId !== p.membershipId) throw new Error('Aktuelle Mitgliedschaft erforderlich.');
    const chat = type === 'alliance.chat.list', list = chat ? own.alliance.chat : own.alliance.events;
    const page = alliancePage(chat ? [...list].reverse() : list, p.cursor, 'sequence');
    if (chat) {
      peer.allianceDelivered ??= {};
      peer.allianceDelivered[own.member.membershipId] = Math.max(peer.allianceDelivered[own.member.membershipId] ?? 0, ...page.items.map(i => i.sequence));
    }
    return { ...page, membershipId: own.member.membershipId, allianceId: own.alliance.id, retainedFrom: list[0]?.sequence ?? null };
  }
  if (type === 'alliance.create.preview') {
    const player = await storage.loadPlayer(actor.id), city = ownedCity(player, p.cityId);
    const quote = allianceQuote(world, actor, p, rules, now);
    if (city.resources.wood < quote.cost.wood || city.resources.stone < quote.cost.stone) throw new Error('Nicht genügend Holz oder Stein in der zahlenden Stadt.');
    return quote;
  }
  const fingerprint = createHash('sha256').update(stableJSON([type,p])).digest('hex'), data = world.alliances;
  const existing = data.receipts.find(r => r.playerId === actor.id && r.id === requestId);
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new Error('Diese Befehls-ID wurde bereits mit anderem Inhalt verwendet.');
    return { duplicate: true }; // Never replay former private content after expulsion.
  }
  if (type === 'alliance.image.finish' && !preparedImage) throw new Error('Ein geprüfter Bild-Upload ist erforderlich.');
  const next = structuredClone(world), command = type === 'alliance.image.finish' ? { ...p, ...preparedImage.context, image: preparedImage.image } : { ...p };
  if (type === 'alliance.invite') {
    if (typeof p.recipientName !== 'string') throw new Error('Empfängername erforderlich.');
    const account = storage.accounts.accounts.find(a => a.normalized === p.recipientName.trim().normalize('NFKC').toLocaleLowerCase('de-DE'));
    if (!account) throw new Error('Kommandant nicht gefunden.');
    command.recipientId = account.playerId; command.recipientName = account.displayName;
  }
  actor.deliveredSequence = peer.allianceDelivered?.[p.membershipId] ?? 0;
  const result = applyAlliance(next, actor, type, command, now, rules, randomUUID);
  const players = [];
  if (type === 'alliance.create') {
    const player = await storage.loadPlayer(actor.id); exposeCity(player, ownedCity(player, p.cityId).id);
    for (const key of ['wood','stone']) {
      if (player.city.resources[key] < result.cost[key]) throw new Error('Nicht genügend Ressourcen.');
      player.city.resources[key] -= result.cost[key];
    }
    Object.assign(player, refreshCities(player, now)); players.push(player);
  }
  // 30-day replay protection for ordinary mutations; creation receipts never expire.
  next.alliances.receipts = next.alliances.receipts.filter(r => r.durable || r.at + rules.replayMs > now);
  next.alliances.receipts.push({ id: requestId, playerId: actor.id, fingerprint, at: now, durable: type === 'alliance.create' });
  // Terminal invitations are no longer authority. Receipts protect replays independently.
  for (const a of next.alliances.items) a.invitations = a.invitations.filter(i => i.status === 'open' && i.expiresAt > now);
  for (const [table, duration] of [[next.alliances.inviteRates,3600000],[next.alliances.chatRates,60000]]) for (const id of Object.keys(table)) { table[id] = table[id].filter(t => t > now-duration); if (!table[id].length) delete table[id]; }
  validateAlliances(next);
  storage.world = next;
  try { await storage.commitPlayers(players, true); }
  catch (error) { storage.world = world; if (type.startsWith('alliance.image.') && error.code) throw new Error('Bild konnte nicht gespeichert werden. Gespeicherten Stand vor erneutem Versuch prüfen.'); throw error; } // needsRecovery forces journal synchronization before the next action.
  return { accepted: true };
}
