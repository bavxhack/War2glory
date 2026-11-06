// Shared limits, rights and projections only. Decoding belongs to the server.
import { membership } from './alliances.js';
export const ALLIANCE_IMAGE_LIMITS = Object.freeze({ maxBytes: 2 * 1024 * 1024, chunkBytes: 8192, maxPixels: 2048 * 2048, maxDimension: 2048, side: 256, maxOutputBytes: 65536, ttlMs: 120000, maxSessions: 8, maxReservedBytes: 8 * 1024 * 1024, attemptsPerPlayer: 6, attemptsPerAlliance: 12 });
export function requireAllianceImageAdmin(world, playerId, p) {
  const own = membership(world, playerId);
  if (!own || own.alliance.id !== p.allianceId || own.member.membershipId !== p.membershipId || !['leader','officer'].includes(own.member.role)) throw new Error('Nur aktuelle Anführer und Offiziere dürfen das Bündnisbild ändern.');
  if (p.imageVersion !== (own.alliance.imageVersion ?? 0)) throw new Error('Bündnisbild inzwischen geändert. Aktuellen Stand laden.');
  return own.alliance;
}
export function checkAllianceImageAttempt(world, playerId, p, now) {
  const a = requireAllianceImageAdmin(world, playerId, p), d = world.alliances;
  if ((d.imageRates?.[playerId]?.filter(at => at > now-3600000).length ?? 0) >= ALLIANCE_IMAGE_LIMITS.attemptsPerPlayer || (d.imageAllianceRates?.[a.id]?.filter(at => at > now-3600000).length ?? 0) >= ALLIANCE_IMAGE_LIMITS.attemptsPerAlliance) throw new Error('Uploadlimit erreicht. Bitte später erneut versuchen.');
}
export function reserveAllianceImageAttempt(world, playerId, p, now) {
  const a = requireAllianceImageAdmin(world, playerId, p), d = world.alliances;
  d.imageRates ??= {}; d.imageAllianceRates ??= {};
  for (const table of [d.imageRates,d.imageAllianceRates]) for (const id of Object.keys(table)) { table[id] = table[id].filter(at => at > now-3600000); if (!table[id].length) delete table[id]; }
  if ((d.imageRates[playerId]?.length ?? 0) >= ALLIANCE_IMAGE_LIMITS.attemptsPerPlayer || (d.imageAllianceRates[a.id]?.length ?? 0) >= ALLIANCE_IMAGE_LIMITS.attemptsPerAlliance) throw new Error('Uploadlimit erreicht. Bitte später erneut versuchen.');
  (d.imageRates[playerId] ??= []).push(now); (d.imageAllianceRates[a.id] ??= []).push(now);
}
export function allianceImage(a) {
  return a?.image ? { url: `/alliance-images/${a.id}/${a.image.hash}.webp`, width: 256, height: 256 } : null;
}
export function validateAllianceImage(a) {
  if (a.imageVersion !== undefined && (!Number.isSafeInteger(a.imageVersion) || a.imageVersion < 0)) throw new Error('Beschädigte Bündnisbildversion.');
  const i = a.image;
  if (i == null) return;
  if (!a.imageVersion || !/^[a-f0-9]{64}$/.test(i.hash) || i.type !== 'image/webp' || i.width !== 256 || i.height !== 256 || typeof i.data !== 'string' || i.data.length > Math.ceil(ALLIANCE_IMAGE_LIMITS.maxOutputBytes/3)*4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(i.data) || i.data.length < 16) throw new Error('Beschädigtes Bündnisbild.');
}
