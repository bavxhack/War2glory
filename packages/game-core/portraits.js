// Stable catalogue order matches the locally served 5 × 4 portrait atlas.
export const GENERAL_PORTRAITS = Object.freeze(Array.from({ length: 20 }, (_, index) => Object.freeze({
  id: `general-portrait-${String(index + 1).padStart(2, '0')}`,
  gender: index < 10 ? 'woman' : 'man', index,
})));
export function randomPortraitId(randomIndex, excludedIds = []) {
  const unused = GENERAL_PORTRAITS.filter(p => !excludedIds.includes(p.id));
  const choices = unused.length ? unused : GENERAL_PORTRAITS;
  const index = randomIndex(choices.length);
  if (!Number.isInteger(index) || index < 0 || index >= choices.length) throw new Error('Ungültige Porträtauswahl.');
  return choices[index].id;
}
export function assignMissingPortraits(player, randomIndex) {
  const characters = [...player.military.generals, ...(player.military.candidatePool?.candidates ?? [])];
  const used = characters.map(c => c.portraitId).filter(id => id != null);
  if (used.some(id => !GENERAL_PORTRAITS.some(p => p.id === id))) throw new Error('Unbekannte General-Porträtkennung.');
  for (const character of characters) {
    if (character.portraitId == null) { character.portraitId = randomPortraitId(randomIndex, used); used.push(character.portraitId); }
  }
  return player;
}
