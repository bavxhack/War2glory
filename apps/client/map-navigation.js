export function dragToPan(start, end, tileSize) {
  if (![start?.x, start?.y, end?.x, end?.y, tileSize].every(Number.isFinite) || tileSize <= 0) {
    throw new TypeError('Gültige Zeigerpositionen und eine positive Feldgröße werden benötigt.');
  }
  return {
    x: Math.round((start.x - end.x) / tileSize),
    y: Math.round((start.y - end.y) / tileSize),
  };
}

export function finishMapPointer(start, end, tileSize) {
  const offset = dragToPan(start, end, tileSize);
  return { offset, suppressClick: offset.x !== 0 || offset.y !== 0 };
}
