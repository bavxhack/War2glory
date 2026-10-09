// Each atlas contains ten genuinely different illustrations: five columns, two rows.
export const BUILDING_ART_LEVELS = 10;
export const BUILDING_ART_LABELS = Object.freeze({
  sawmill: 'Sägewerk', quarry: 'Steinbruch', farm: 'Bauernhof',
  warehouse: 'Lagerhaus', university: 'Universität', refinery: 'Ölraffinerie',
  barracks: 'Kaserne', vehicleFactory: 'Fahrzeugfabrik',
});

export function buildingArtFrame(type, level = 1) {
  if (!Object.hasOwn(BUILDING_ART_LABELS, type)) throw new Error(`Unbekanntes Gebäudemotiv: ${type}`);
  if (!Number.isInteger(level) || level < 1 || level > BUILDING_ART_LEVELS) throw new Error(`Ungültige Bildstufe: ${level}`);
  const index = level - 1;
  return {
    type, level, label: `${BUILDING_ART_LABELS[type]} · Stufe ${level}`,
    backgroundSize: '500% 200%',
    backgroundPosition: `${(index % 5) * 25}% ${Math.floor(index / 5) * 100}%`,
  };
}
