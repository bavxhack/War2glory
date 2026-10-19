export const MAP_DIRECTIONS = Object.freeze([
  { label: 'Nordwesten', short: 'NW', arrow: '↖', x: -1, y: -1 },
  { label: 'Norden', short: 'N', arrow: '↑', x: 0, y: -1 },
  { label: 'Nordosten', short: 'NO', arrow: '↗', x: 1, y: -1 },
  { label: 'Westen', short: 'W', arrow: '←', x: -1, y: 0 },
  { label: 'Osten', short: 'O', arrow: '→', x: 1, y: 0 },
  { label: 'Südwesten', short: 'SW', arrow: '↙', x: -1, y: 1 },
  { label: 'Süden', short: 'S', arrow: '↓', x: 0, y: 1 },
  { label: 'Südosten', short: 'SO', arrow: '↘', x: 1, y: 1 },
]);

export function mapViewport(center, size, bounds) {
  if (![center?.x, center?.y, size, bounds?.width, bounds?.height].every(Number.isFinite) || size < 1 || bounds.width < 1 || bounds.height < 1) throw new TypeError('Gültige Kartenmitte, Feldanzahl und Weltgrenzen benötigt.');
  const actual = Math.min(Math.floor(size), bounds.width, bounds.height);
  return { x: Math.max(0, Math.min(bounds.width - actual, Math.round(center.x - actual / 2))),
    y: Math.max(0, Math.min(bounds.height - actual, Math.round(center.y - actual / 2))), width: actual, height: actual };
}

export function canPan(viewport, bounds, direction) {
  return (direction.x < 0 ? viewport.x > 0 : direction.x > 0 ? viewport.x + viewport.width < bounds.width : true)
    && (direction.y < 0 ? viewport.y > 0 : direction.y > 0 ? viewport.y + viewport.height < bounds.height : true);
}
