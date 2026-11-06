import { allianceImage, requireAllianceImageAdmin, reserveAllianceImageAttempt, validateAllianceImage } from './alliance-images.js';
// Local prototype rules. No transport, clock, randomness or filesystem dependencies.
export const ALLIANCE_RULES = Object.freeze({ version: 'alliance-1-provisional', wood: 1000, stone: 1000, maxMembers: 20, inviteTtlMs: 604800000,
  createCooldownMs: 86400000, openPerAlliance: 20, openPerRecipient: 10, invitesPerHour: 10, chatPerMinute: 5, chatRetention: 200, eventRetention: 100, replayMs: 30 * 86400000 });
const fail = message => { throw new Error(message); };
export function allianceText(value, min, max, multiline = false) {
  if (typeof value !== 'string') fail('Text erwartet.');
  const text = value.normalize('NFKC').trim();
  if ([...text].length < min || [...text].length > max || (multiline ? /[\p{Cc}\p{Cf}]/u.test(text.replace(/\n/g, '')) : /[\p{Cc}\p{Cf}]/u.test(text))) fail(`Text: ${min}–${max} Zeichen, keine Steuerzeichen.`);
  return text;
}
export const allianceNameKey = value => value.normalize('NFKC').trim().toLocaleLowerCase('de-DE');
export const emptyAlliances = () => ({ items: [], receipts: [], founders: {}, inviteRates: {}, chatRates: {} });
export function membership(world, playerId) {
  for (const alliance of world.alliances.items) {
    const member = alliance.members.find(m => m.playerId === playerId);
    if (member) return { alliance, member };
  }
  return null;
}
export function validateAlliances(world) {
  const data = world.alliances;
  if (!data || !Array.isArray(data.items) || !Array.isArray(data.receipts) || !data.founders || !data.inviteRates || !data.chatRates) fail('Beschädigter Bündnisbestand.');
  const memberships = new Set();
  const players = new Set(), names = new Set(), tags = new Set(), ids = new Set();
  for (const a of data.items) {
    if (!Array.isArray(a.members) || !Array.isArray(a.invitations) || !Array.isArray(a.chat) || !Array.isArray(a.events) || a.chat.length > 200 || a.events.length > 100 || !Number.isInteger(a.maxMembers) || a.maxMembers < 2 || a.maxMembers > 100 || !a.id || ids.has(a.id) || names.has(allianceNameKey(a.name)) || tags.has(a.tag) || a.members.length < 1 || a.members.length > a.maxMembers || a.members.filter(m => m.role === 'leader').length !== 1 || !Number.isInteger(a.adminVersion) || !Number.isInteger(a.sequence)) fail('Widersprüchlicher Bündnisbestand.');
    validateAllianceImage(a);
    ids.add(a.id); names.add(allianceNameKey(a.name)); tags.add(a.tag);
    for (const m of a.members) {
      if (players.has(m.playerId) || memberships.has(m.membershipId) || !m.membershipId || !['leader', 'officer', 'member'].includes(m.role) || m.lastReadSequence > a.sequence) fail('Widersprüchliche Mitgliedschaft/Rolle.');
      players.add(m.playerId); memberships.add(m.membershipId);
    }
  }
  return true;
}
function event(a, actor, type, now, targetId, targetName) {
  a.events.push({ sequence: ++a.eventSequence, actorId: actor.id, actorName: actor.name, type, at: now, ...(targetId ? { targetId, targetName: targetName ?? a.members.find(m => m.playerId === targetId)?.name ?? targetId } : {}) });
  a.events = a.events.slice(-ALLIANCE_RULES.eventRetention);
}
function rate(table, id, now, duration, max) {
  const list = (table[id] ?? []).filter(at => at > now - duration);
  if (list.length >= max) fail('Zeitliches Aktionslimit erreicht. Bitte später erneut versuchen.');
  table[id] = [...list, now];
}
const open = (i, now) => i.status === 'open' && i.expiresAt > now;
export function allianceQuote(world, actor, payload, rules, now) {
  if (membership(world, actor.id)) fail('Du gehörst bereits einem Bündnis an.');
  if ((world.alliances.founders[actor.id]?.at ?? -Infinity) + rules.createCooldownMs > now) fail('Nur eine Gründung innerhalb von 24 Stunden.');
  const name = allianceText(payload.name, 3, 40), tag = allianceText(payload.tag, 2, 5).toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(tag)) fail('Kürzel: 2–5 ASCII-Buchstaben/Ziffern.');
  const description = allianceText(payload.description ?? '', 0, 500);
  if (world.alliances.items.some(a => allianceNameKey(a.name) === allianceNameKey(name) || a.tag === tag)) fail('Name oder Kürzel bereits vergeben.');
  return { name, tag, description, cost: { wood: rules.wood, stone: rules.stone, food: 0, oil: 0 }, maxMembers: rules.maxMembers, rulesVersion: rules.version };
}
// Mutates a caller-owned candidate only. Caller commits or discards the entire candidate.
export function applyAlliance(world, actor, type, p, now, rules, uuid) {
  const d = world.alliances;
  if (type === 'alliance.create') {
    const quote = allianceQuote(world, actor, p, rules, now);
    if (p.rulesVersion !== quote.rulesVersion) fail('Gründungsregeln geändert. Neue Vorschau bestätigen.');
    const a = { id: uuid(), instanceId: world.instanceId, name: quote.name, tag: quote.tag, description: quote.description, createdAt: now, maxMembers: quote.maxMembers, adminVersion: 1,
      members: [{ playerId: actor.id, name: actor.name, role: 'leader', membershipId: uuid(), lastReadSequence: 0 }], invitations: [], chat: [], sequence: 0,
      notice: { text: '', version: 0 }, events: [], eventSequence: 0 };
    d.items.push(a); d.founders[actor.id] = { at: now, allianceId: a.id };
    event(a, actor, 'created', now); world.map.revision++;
    return { allianceId: a.id, cost: quote.cost };
  }
  if (type === 'alliance.invitation.respond') {
    const a = d.items.find(a => a.invitations.some(i => i.id === p.invitationId)), i = a?.invitations.find(i => i.id === p.invitationId);
    if (!i || i.recipientId !== actor.id || !open(i, now)) fail('Einladung ungültig oder abgelaufen.');
    if (!['accept', 'decline'].includes(p.response)) fail('Annehmen oder ablehnen wählen.');
    if (p.response === 'accept') {
      if (membership(world, actor.id)) fail('Bereits Mitglied eines Bündnisses.');
      if (a.members.length >= a.maxMembers) fail('Bündnis ist voll. Einladung bleibt bis Ablauf offen.');
      a.members.push({ playerId: actor.id, name: actor.name, role: 'member', membershipId: uuid(), lastReadSequence: a.sequence });
      for (const other of d.items) for (const invite of other.invitations) if (invite.recipientId === actor.id && invite.status === 'open') { invite.status = 'invalid'; invite.closedAt = now; }
      i.status = 'accepted'; a.adminVersion++; world.map.revision++; event(a, actor, 'joined', now);
    } else i.status = 'declined';
    i.closedAt = now;
    return { allianceId: a.id };
  }
  const own = membership(world, actor.id), a = own?.alliance, m = own?.member;
  if (!a || a.id !== p.allianceId || m.membershipId !== p.membershipId) fail('Aktuelle Bündnismitgliedschaft erforderlich.');
  const admin = ['leader', 'officer'].includes(m.role), leader = m.role === 'leader';
  const administrative = ['alliance.invite', 'alliance.invitation.revoke', 'alliance.role.change', 'alliance.leadership.transfer', 'alliance.member.remove', 'alliance.leave', 'alliance.dissolve', 'alliance.description.update'];
  if (administrative.includes(type) && p.adminVersion !== a.adminVersion) fail('Verwaltung inzwischen geändert. Bitte neu laden.');
  const target = a.members.find(x => x.membershipId === p.targetMembershipId);
  if (['alliance.role.change', 'alliance.leadership.transfer', 'alliance.member.remove'].includes(type) && (!target || target === m)) fail('Aktuelles anderes Mitglied wählen.');
  if (type === 'alliance.invite') {
    if (!admin) fail('Keine Einladungsrechte.');
    if (!p.recipientId || p.recipientId === actor.id || membership(world, p.recipientId)) fail('Empfänger ist bereits Mitglied oder ungültig.');
    if (a.invitations.some(i => i.recipientId === p.recipientId && open(i, now))) return { alreadyInvited: true };
    if (a.invitations.filter(i => open(i, now)).length >= rules.openPerAlliance || d.items.flatMap(a => a.invitations).filter(i => i.recipientId === p.recipientId && open(i, now)).length >= rules.openPerRecipient) fail('Zu viele offene Einladungen.');
    rate(d.inviteRates, actor.id, now, 3600000, rules.invitesPerHour);
    a.invitations.push({ id: uuid(), allianceId: a.id, issuerId: actor.id, recipientId: p.recipientId, recipientName: p.recipientName, createdAt: now, expiresAt: now + rules.inviteTtlMs, status: 'open' });
  } else if (type === 'alliance.invitation.revoke') {
    if (!admin) fail('Keine Einladungsrechte.');
    const i = a.invitations.find(i => i.id === p.invitationId);
    if (!i || !open(i, now)) fail('Keine offene Einladung.');
    i.status = 'revoked'; i.closedAt = now;
  } else if (type === 'alliance.description.update') {
    if (!admin) fail('Keine Verwaltungsrechte.');
    a.description = allianceText(p.text, 0, 500); a.adminVersion++;
  } else if (type === 'alliance.image.finish' || type === 'alliance.image.remove') {
    requireAllianceImageAdmin(world, actor.id, p);
    if (type === 'alliance.image.remove') reserveAllianceImageAttempt(world, actor.id, p, now);
    a.imageVersion = (a.imageVersion ?? 0) + 1;
    a.image = type === 'alliance.image.remove' ? null : p.image;
    validateAllianceImage(a); world.map.revision++; event(a, actor, type, now);
  } else if (type === 'alliance.notice.update') {
    if (!admin) fail('Keine Verwaltungsrechte.');
    if (p.noticeVersion !== a.notice.version) fail('Mitteilung inzwischen geändert.');
    a.notice = { text: allianceText(p.text, 0, 2000, true), version: a.notice.version + 1, authorId: actor.id, authorName: actor.name, updatedAt: now };
    event(a, actor, 'notice', now);
  } else if (type === 'alliance.role.change' || type === 'alliance.leadership.transfer') {
    if (!leader) fail('Nur der Anführer darf Rollen ändern.');
    if (type === 'alliance.leadership.transfer') { target.role = 'leader'; m.role = 'officer'; }
    else { if (!['officer', 'member'].includes(p.role)) fail('Ungültige Rolle.'); target.role = p.role; }
    a.adminVersion++; event(a, actor, type, now, target.playerId);
  } else if (type === 'alliance.leave' || type === 'alliance.member.remove') {
    const leaving = type === 'alliance.leave' ? m : target;
    if (leaving.role === 'leader') fail('Anführer muss zuerst Führung übertragen oder als letztes Mitglied auflösen.');
    if (type === 'alliance.member.remove' && (!admin || (target.role === 'officer' && !leader))) fail('Keine Ausschlussrechte.');
    a.members = a.members.filter(x => x !== leaving); a.adminVersion++; world.map.revision++; event(a, actor, type, now, leaving.playerId, leaving.name);
  } else if (type === 'alliance.dissolve') {
    if (!leader || a.members.length !== 1) fail('Auflösung nur durch letzten Anführer.');
    d.items = d.items.filter(x => x !== a); world.map.revision++;
  } else if (type === 'alliance.chat.send') {
    const text = allianceText(p.text, 1, 2000, true);
    rate(d.chatRates, actor.id, now, 60000, rules.chatPerMinute);
    a.chat.push({ id: uuid(), sequence: ++a.sequence, senderId: actor.id, senderName: actor.name, at: now, text }); a.chat = a.chat.slice(-rules.chatRetention);
  } else if (type === 'alliance.chat.remove') {
    const post = a.chat.find(c => c.id === p.messageId);
    if (!post || (!admin && post.senderId !== actor.id)) fail('Keine Moderationsrechte.');
    if (!post.removed) { delete post.text; post.removed = true; post.moderatorName = actor.name; event(a, actor, 'moderation', now); }
  } else if (type === 'alliance.chat.read') {
    if (!Number.isInteger(p.sequence) || p.sequence < 0 || p.sequence > a.sequence || p.sequence > (actor.deliveredSequence ?? 0)) fail('Ungültige Lesemarke.');
    m.lastReadSequence = Math.max(m.lastReadSequence, p.sequence);
  } else fail('Unbekannter Bündnisbefehl.');
  validateAlliances(world);
  return { allianceId: a.id };
}
export function allianceSummary(world, playerId, now) {
  const own = membership(world, playerId);
  return { allianceId: own?.alliance.id ?? null, membershipId: own?.member.membershipId ?? null, tag: own?.alliance.tag ?? null, image: allianceImage(own?.alliance),
    unread: own ? own.alliance.chat.filter(c => c.sequence > own.member.lastReadSequence).length : 0,
    invitations: world.alliances.items.reduce((n, a) => n + a.invitations.filter(i => i.recipientId === playerId && open(i, now)).length, 0) };
}
export function alliancePublic(world, a, cursor) {
  const members = a.members.map(m => ({ playerId: m.playerId, name: m.name, role: m.role, cities: world.map.entities.filter(e => e.kind === 'player' && e.playerId === m.playerId).map(({ id, name, x, y }) => ({ id, name, x, y })) }));
  const page = alliancePage(members, cursor, 'playerId', 20, 3000);
  return { id: a.id, image: allianceImage(a), imageVersion: a.imageVersion ?? 0, instanceId: a.instanceId, name: a.name, tag: a.tag, description: a.description, createdAt: a.createdAt, memberCount: a.members.length, maxMembers: a.maxMembers,
    members: page.items, nextMemberCursor: page.nextCursor };
}
// Count and encoded-byte bounded pages, stable ID/sequence cursors. No executable content.
export function alliancePage(items, cursor, key = 'id', limit = 20, maxBytes = 12000) {
  if (cursor != null && !['string','number'].includes(typeof cursor)) fail('Ungültiger Cursor.');
  const start = cursor == null ? 0 : items.findIndex(i => i[key] === cursor) + 1;
  if (cursor != null && start === 0) fail('Cursor nicht mehr verfügbar. Neu laden.');
  const page = []; let bytes = 0;
  for (const item of items.slice(start)) {
    const size = new TextEncoder().encode(JSON.stringify(item)).length;
    if (page.length >= limit || bytes + size > maxBytes) break;
    page.push(item); bytes += size;
  }
  return { items: page, nextCursor: start + page.length < items.length ? page.at(-1)?.[key] ?? null : null };
}
