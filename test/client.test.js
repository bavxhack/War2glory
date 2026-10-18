import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestId } from '../apps/client/request-id.js';
import { MAP_DIRECTIONS, mapViewport, canPan } from '../apps/client/map-navigation.js';
import { forceSummary } from '../apps/client/force-summary.js';

test('Truppenbestand trennt Stationierung, lebende Einsatztruppen und Ausbildung', () => {
  const military = {
    units: { scout: 4, infantry: 12 },
    trainingQueue: [{ unit: 'infantry', amount: 30 }, { unit: 'scout', amount: 2 }],
    missions: [
      { status: 'outbound', type: 'raid', infantry: 20 },
      { status: 'returning', type: 'raid', infantry: 10, result: { survivors: 7 } },
      { status: 'returning', type: 'raid', infantry: 5, result: { survivors: 0 } },
      { status: 'completed', type: 'raid', infantry: 50, result: { survivors: 48 } },
      { status: 'outbound', scouts: 3 },
      { status: 'returning', type: 'scout', scouts: 2 },
    ],
  };
  assert.deepEqual(forceSummary(military, ['scout', 'infantry']), {
    scout: { stationed: 4, deployed: 5, training: 2, total: 9 },
    infantry: { stationed: 12, deployed: 27, training: 30, total: 39 },
  });
  military.units.infantry += 7;
  military.missions[1].status = 'completed';
  assert.equal(forceSummary(military, ['infantry']).infantry.total, 39);
});

test('leere Truppenbestände zeigen Null', () => {
  assert.deepEqual(forceSummary({ units: {}, missions: [], trainingQueue: [] }, ['scout']), {
    scout: { stationed: 0, deployed: 0, training: 0, total: 0 },
  });
});

test('Anfrage-IDs funktionieren ohne crypto.randomUUID', () => {
  const generated = createRequestId({
    getRandomValues(bytes) {
      bytes.forEach((_, index) => { bytes[index] = index; });
      return bytes;
    },
  });

  assert.equal(generated, '000102030405060708090a0b0c0d0e0f');
  assert.match(generated, /^[a-zA-Z0-9_-]{8,100}$/);
});

test('Anfrage-IDs besitzen einen kompatiblen Fallback ohne Web Crypto', () => {
  const first = createRequestId(null);
  const second = createRequestId(null);

  assert.match(first, /^[a-zA-Z0-9_-]{8,100}$/);
  assert.match(second, /^[a-zA-Z0-9_-]{8,100}$/);
  assert.notEqual(first, second);
});

test('Kartenausschnitte bleiben bei Zentrierung und Zoom innerhalb der Welt', () => {
  assert.deepEqual(mapViewport({x:12,y:12},5,{width:24,height:24}),{x:10,y:10,width:5,height:5});
  assert.deepEqual(mapViewport({x:-20,y:40},5,{width:24,height:24}),{x:0,y:19,width:5,height:5});
  assert.deepEqual(mapViewport({x:0,y:0},5,{width:2,height:3}),{x:0,y:0,width:2,height:2});
  assert.throws(()=>mapViewport({x:0,y:0},0,{width:24,height:24}),/Weltgrenzen/);
});

test('Die Windrose enthält acht eindeutige Richtungen einschließlich Diagonalen', () => {
  assert.equal(MAP_DIRECTIONS.length,8);
  assert.equal(new Set(MAP_DIRECTIONS.map(d=>`${d.x}:${d.y}`)).size,8);
  const bounds={width:24,height:24},view={x:10,y:10,width:5,height:5};
  for(const d of MAP_DIRECTIONS){assert.equal(canPan(view,bounds,d),true);const next=mapViewport({x:view.x+2.5+d.x,y:view.y+2.5+d.y},5,bounds);assert.equal(next.x,view.x+d.x);assert.equal(next.y,view.y+d.y);}
});

test('Richtungstasten werden am Kartenrand auch diagonal begrenzt', () => {
 const view={x:0,y:19,width:5,height:5},bounds={width:24,height:24};
 const available=MAP_DIRECTIONS.filter(d=>canPan(view,bounds,d)).map(d=>d.short);
 assert.deepEqual(available,['N','NO','O']);
 for(const d of MAP_DIRECTIONS)assert.equal(canPan({x:0,y:0,width:2,height:2},{width:2,height:2},d),false);
});
