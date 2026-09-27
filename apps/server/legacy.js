import { BUILDING_SLOT_COUNT, RULESET } from '../../packages/game-core/index.js';

const LEGACY_RULESET = 'prototype-0.1';

export function migrateLegacyState(saved) {
  if (saved?.schemaVersion === 2 && saved.ruleset === RULESET && saved.city?.buildingSlots) return structuredClone(saved);
  if (saved?.schemaVersion !== 1 || saved.ruleset !== LEGACY_RULESET) {
    throw new Error('Unbekannte Spielstandsversion; Datei wird nicht überschrieben.');
  }
  const entries = Object.entries(saved.city?.buildings ?? {});
  const buildingSlots = Array.from({ length: BUILDING_SLOT_COUNT }, (_, index) => {
    const [building, level] = entries[index] ?? [];
    return { id: `plot-${index + 1}`, building: building ?? null, level: level ?? 0 };
  });
  const oldJob = saved.city.construction;
  return {
    ...saved,
    city: {
      name: saved.city.name, resources: structuredClone(saved.city.resources), buildingSlots,
      constructionQueue: oldJob ? [{
        id: `migration-${oldJob.building}-${oldJob.finishesAt}`, type: 'upgrade',
        slotId: buildingSlots.find(slot => slot.building === oldJob.building)?.id,
        building: oldJob.building, level: oldJob.level, startsAt: saved.city.updatedAt, finishesAt: oldJob.finishesAt,
      }] : [],
      updatedAt: saved.city.updatedAt,
    },
  };
}
