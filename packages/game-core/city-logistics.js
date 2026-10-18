import { loadingRules } from './research.js';
import { canonicalJSON, cityView, ownedCity, exposeCity } from './multicity.js';
import { validateCargo, cargoAmount, oneWayFuelMilli, RESOURCE_ORDER } from './cargo.js';
import { cargoCapacity, fuelPlan, missionTimes, LOGISTICS_RULES } from './logistics.js';
import { MILITARY_RULES, validateMissionUnits } from './military.js';
import { resourceCapacities } from './index.js';
import { supplySummary } from './supply.js';

export const CITY_LOGISTICS_RULES = Object.freeze({ version: 'city-logistics-1-provisional', generalOilMilliPerField: 100, generalFuelCapacity: 20 });
export const isCityTransport = mission => ['delivery', 'transfer'].includes(mission.type);
const zero = () => validateCargo({});
const ceilOil = milli => Number((milli + 999n) / 1000n);
export function stableJSON(value) {
  const order = value => Array.isArray(value) ? value.map(order) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, order(value[key])])) : value;
  return JSON.stringify(order(value));
}

export function requireGeneralLocation(player, generalId, cityId) {
  const general = player.military.generals.find(g => g.id === generalId && g.ownerId === player.playerId);
  if (!general || general.cityId !== cityId || general.transitMissionId) throw new Error('General ist nicht in der Ausgangsstadt stationiert.');
  return general;
}

// One-time reconstruction; an ambiguous historical location is never guessed.
export function migrateGeneralLocations(player) {
  if (player.schemaVersion !== 16) return player;
  const first = player.cities[0].id, military = player.military;
  player.migrationNotices ??= [];
  for (const general of military.generals) {
    const mayors = player.cities.filter(c => c.military.mayorGeneralId === general.id);
    const missions = military.missions.filter(m => m.status !== 'completed' && m.generalId === general.id);
    const researcher = military.researcherGeneralId === general.id;
    if (mayors.length + missions.length + Number(researcher) > 1) throw new Error('Migration: General hat mehrere historische Rollen.');
    let cityId = mayors[0]?.id ?? missions[0]?.originCityId;
    if (researcher) {
      const active = player.research.active;
      if (active) cityId = active.cityId;
      else {
        const universities = player.cities.filter(c => c.buildingSlots.some(s => s.building === 'university' && s.level > 0));
        if (universities.length === 1) cityId = universities[0].id;
        else {
          military.researcherGeneralId = null; military.roleVersion++;
          general.status = 'idle'; general.version++;
          player.migrationNotices.push('Forschungsleitung ohne eindeutige Universitätsstadt freigegeben. Bitte neu zuweisen.');
        }
      }
    }
    if (!cityId && general.status !== 'idle') throw new Error('Migration: Generalstandort nicht eindeutig rekonstruierbar.');
    general.cityId = cityId ?? first;
    ownedCity(player, general.cityId);
  }
  player.schemaVersion = 17;
  return player;
}

export function cityTransportQuote(previous, command, world, logistics = LOGISTICS_RULES, rules = CITY_LOGISTICS_RULES, now = previous.city.updatedAt) {
  const player = canonicalJSON(previous), origin = ownedCity(player, command.originCityId);
  const view = cityView(player, origin.id), type = command.type;
  logistics = loadingRules(logistics, view.city);
  if (!['delivery', 'transfer'].includes(type)) throw new Error('Unbekannte Reiseart.');
  if (command.delayMinutes !== undefined && command.delayMinutes !== 0) throw new Error('Lieferung und Verlegung unterstützen keine Zusatzverzögerung.');
  if (command.instanceId !== undefined && command.instanceId !== world.instanceId) throw new Error('Ziel gehört zu einer anderen Welt.');
  const originEntity = world.map.entities.find(e => e.id === origin.id && e.playerId === player.playerId && e.kind === 'player');
  const target = world.map.entities.find(e => e.id === command.targetCityId && e.kind === 'player');
  if (!originEntity || !target || target.id === origin.id) throw new Error('Andere gültige Spielerstadt als Ziel benötigt.');
  if (type === 'transfer' && target.playerId !== player.playerId) throw new Error('Verlegung ist nur in eigene Städte erlaubt.');
  if (type === 'transfer') ownedCity(player, target.id);
  const input = command.units ?? {};
  if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some(k => !['infantry','scout','truck'].includes(k))) throw new Error('Unbekannte Transporttruppen.');
  const units = Object.fromEntries(['infantry','scout','truck'].map(k => [k, input[k] ?? 0]));
  const amount = Object.values(units).reduce((a,b) => a+b,0);
  if (amount > 0) validateMissionUnits(units);
  else if (Object.values(units).some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('Ungültige Einheitenmenge.');
  if (type === 'delivery' && (units.truck < 1 || units.scout || units.infantry)) throw new Error('Lieferung benötigt mindestens einen LKW und ausschließlich LKWs.');
  for (const [k,n] of Object.entries(units)) if (n > origin.military.units[k]) throw new Error('Nicht genügend stationierte Einheiten.');
  const generalIds = type === 'delivery' ? (command.generalId == null ? [] : [command.generalId]) : command.generalIds ?? [];
  if (!Array.isArray(generalIds) || generalIds.some(id => typeof id !== 'string') || new Set(generalIds).size !== generalIds.length) throw new Error('Ungültige oder doppelte General-IDs.');
  const generals = generalIds.map(id => {
    const g = requireGeneralLocation(player, id, origin.id);
    if (g.status !== 'idle') throw new Error('General muss vor der Reise ausdrücklich freigegeben werden.');
    return { id: g.id, version: g.version, name: g.name };
  });
  if (!amount && !generals.length) throw new Error('Mindestens eine Einheit oder ein General benötigt.');
  const cargo = validateCargo(command.cargo);
  if (type === 'delivery' && !cargoAmount(cargo)) throw new Error('Positive Ressourcenladung benötigt.');
  if (type === 'transfer' && cargoAmount(cargo)) throw new Error('Verlegung unterstützt keine Ressourcenfracht.');
  const distanceFields = Math.max(1, Math.ceil(Math.hypot(target.x - originEntity.x, target.y - originEntity.y)));
  const travelMs = Math.max(MILITARY_RULES.minimumTravelMs, distanceFields * MILITARY_RULES.scoutTravelMsPerField);
  const times = missionTimes(now, travelMs, 0), capacity = cargoCapacity(units, logistics.cargoPerUnit);
  let oneWayMilli, totalOil, fuelBudgets;
  if (!amount) {
    oneWayMilli = BigInt(distanceFields) * BigInt(generals.length) * BigInt(rules.generalOilMilliPerField);
    totalOil = ceilOil(oneWayMilli);
    if (totalOil > generals.length * rules.generalFuelCapacity) throw new Error('Diensttransport-Tanks reichen für diese Generalreise nicht.');
    fuelBudgets = { generals: totalOil, scouts: 0, normal: 0 };
  } else {
    oneWayMilli = oneWayFuelMilli(units, distanceFields, logistics.oilMilliPerField);
    if (type === 'delivery') {
      totalOil = fuelPlan(oneWayMilli, travelMs, 0).totalOil;
      if (cargoAmount(cargo) + totalOil > capacity) throw new Error('Ladung und Betriebsöl überschreiten die LKW-Traglast.');
      fuelBudgets = { normal: totalOil, scouts: 0, generals: 0 };
    } else {
      totalOil = ceilOil(oneWayMilli);
      const scoutMilli = oneWayFuelMilli({ scout: units.scout }, distanceFields, logistics.oilMilliPerField);
      const normalMilli = oneWayMilli - scoutMilli;
      // Preserve each group's exact milli-oil in its own space. Put the single
      // payment rounding remainder into normal space first, then scout tanks.
      const normalCapacity = capacity, scoutCapacity = units.scout * logistics.scoutFuelCapacity;
      if (scoutMilli > BigInt(scoutCapacity) * 1000n || normalMilli > BigInt(normalCapacity) * 1000n) throw new Error('Einwegöl überschreitet die zugehörigen Tanks oder den Frachtraum.');
      const roundingMilli = BigInt(totalOil)*1000n-oneWayMilli;
      const normalFreeMilli = BigInt(normalCapacity)*1000n-normalMilli;
      const normalRemainder = roundingMilli < normalFreeMilli ? roundingMilli : normalFreeMilli;
      const scoutBudget = scoutMilli+roundingMilli-normalRemainder, normalBudget = normalMilli+normalRemainder;
      if (scoutBudget > BigInt(scoutCapacity)*1000n) throw new Error('Betriebsöl einschließlich Rundungsrest überschreitet die Tanks.');
      fuelBudgets = { scouts: Number(scoutBudget)/1000, normal: Number(normalBudget)/1000, generals: 0 };
    }
  }
  if (!Number.isSafeInteger(totalOil) || totalOil <= 0) throw new Error('Ungültiger Ölpreis.');
  for (const key of RESOURCE_ORDER) if (origin.resources[key] < cargo[key] + (key === 'oil' ? totalOil : 0)) throw new Error('Nicht genügend Rohstoffe für Ladung und Betriebsöl.');
  const upkeepPerHour = Object.entries(units).reduce((sum,[k,n]) => sum + n * (view.supply?.rules.upkeepPerSecond[k] ?? 0) * 3600,0);
  return { type, ruleset: rules.version, cityId: origin.id, originCityId: origin.id, originName: origin.name,
    targetCityId: target.id, targetPlayerId: target.playerId, targetName: target.name, targetCommanderName: target.commanderName,
    instanceId: world.instanceId, units, generals, cargo, capacity, totalOil, oneWayMilli: oneWayMilli.toString(), fuelBudgets,
    distanceFields, travelMs, delayMinutes: 0, previewAt: now, arrivesAt: times.arrivesAt, returnsAt: type === 'delivery' ? times.returnsAt : null,
    upkeepPerHour, ...(target.playerId === player.playerId ? { targetSupply: (() => { const s = supplySummary(cityView(player,target.id)); return { food:ownedCity(player,target.id).resources.food, netPerHour:s.net*3600, netAfterPerHour:s.net*3600-(type==='transfer'?upkeepPerHour:0), inShortage:ownedCity(player,target.id).supply?.inShortage ?? false }; })() } : {}),
    logistics: structuredClone(logistics), transportRules: structuredClone(rules) };
}

export function startCityTransport(previous, command, world, logistics, rules, now) {
  const quote = cityTransportQuote(previous, command, world, logistics, rules, now);
  const binding = ({ previewAt, arrivesAt, returnsAt, targetSupply, ...rest }) => rest;
  if (!command.preview || stableJSON(binding(command.preview)) !== stableJSON(binding(quote))) throw new Error('Transportvorschau veraltet. Bitte erneut prüfen.');
  const player = canonicalJSON(previous), origin = ownedCity(player, quote.originCityId);
  for (const key of RESOURCE_ORDER) origin.resources[key] -= quote.cargo[key] + (key === 'oil' ? quote.totalOil : 0);
  for (const [key,n] of Object.entries(quote.units)) origin.military.units[key] -= n;
  for (const { id } of quote.generals) {
    const g = player.military.generals.find(g => g.id === id);
    g.status = quote.type === 'transfer' ? 'transit' : 'delivering'; g.transitMissionId = command.id; g.version++;
  }
  player.military.missions.push({ ...quote, cargo: undefined, load: { ...quote.cargo }, remainingCargo: { ...quote.cargo },
    paidOil: quote.totalOil, senderPlayerId:player.playerId, id: command.id, startedAt: now, status: 'outbound', coordinates: (() => { const t = world.map.entities.find(e => e.id === quote.targetCityId); return { x:t.x,y:t.y }; })() });
  return exposeCity(player, previous.cityId ?? quote.originCityId);
}

function store(resources, load, capacities, wholeUnits = true) {
  const stored = zero(), remaining = zero();
  for (const k of RESOURCE_ORDER) {
    const free = Math.max(0, capacities[k] - resources[k]);
    stored[k] = Math.min(load[k], wholeUnits ? Math.floor(free) : free);
    remaining[k] = load[k] - stored[k]; resources[k] += stored[k];
  }
  return { stored, remaining };
}
function report(player, mission, extra) {
  const id = player.playerId === mission.senderPlayerId ? `report-${mission.id}` : `delivery-report-${mission.senderPlayerId}-${mission.id}`;
  if (!player.military.reports.some(r => r.id === id)) player.military.reports.push({
    id, missionId: mission.id, type: mission.type, originCityId: mission.originCityId, originName: mission.originName,
    targetCityId: mission.targetCityId, targetName: mission.targetName, startedAt: mission.startedAt,
    arrivedAt: mission.arrivesAt, ...(player.playerId === mission.senderPlayerId ? { units: mission.units, generals: mission.generals, paidOil: mission.paidOil } : {}), ...extra
  });
}
// Both participants must already be advanced to the exact event time.
export function finishCityTransport(sender, recipient, missionId, phase, world, at) {
  const mission = sender.military.missions.find(m => m.id === missionId);
  if (phase === 'arrival' && mission.status === 'outbound') {
    const targetEntity = world.map.entities.find(e => e.id === mission.targetCityId && e.kind === 'player' && e.playerId === mission.targetPlayerId);
    const target = recipient?.cities.find(c => c.id === mission.targetCityId);
    if (mission.type === 'transfer') {
      if (!targetEntity || !target || recipient.playerId !== sender.playerId) throw new Error('Inkonsistentes Verlegeziel; Wiederherstellung erforderlich.');
      for (const [k,n] of Object.entries(mission.units)) target.military.units[k] += n;
      for (const {id} of mission.generals) {
        const g = sender.military.generals.find(g => g.id === id && g.transitMissionId === mission.id);
        if (!g) throw new Error('Inkonsistente Generalverlegung.');
        g.cityId = target.id; g.status = 'idle'; delete g.transitMissionId; g.version++;
      }
      mission.status = 'completed'; mission.stationedAt = at;
      report(sender, mission, { stationedAt: at, operatingFuel: { loaded: mission.paidOil, burned: mission.paidOil, remaining: 0 } });
    } else {
      const delivery = target && targetEntity ? store(target.resources, mission.remainingCargo, resourceCapacities({ ...target, research: recipient.research })) : { stored: zero(), remaining: { ...mission.remainingCargo } };
      mission.delivered = delivery.stored; mission.remainingCargo = delivery.remaining; mission.status = 'returning';
      mission.targetUnavailable = !target || !targetEntity;
      if (recipient && recipient.playerId !== sender.playerId && target && targetEntity) report(recipient, mission, { received: delivery.stored, senderName: sender.commanderName, receivedAt: at });
    }
  } else if (phase === 'return' && mission.type === 'delivery' && mission.status === 'returning') {
    const origin = ownedCity(sender, mission.originCityId);
    const result = store(origin.resources, mission.remainingCargo, resourceCapacities({ ...origin, research: sender.research }), false);
    for (const [k,n] of Object.entries(mission.units)) origin.military.units[k] += n;
    for (const {id} of mission.generals) {
      const g = sender.military.generals.find(g => g.id === id && g.transitMissionId === mission.id);
      if (!g) throw new Error('Inkonsistente Lieferbegleitung.');
      g.status = 'idle'; delete g.transitMissionId; g.version++;
    }
    mission.status = 'completed'; mission.returnedCargo = result.stored; mission.homeOverflow = result.remaining; mission.remainingCargo = zero();
    report(sender, mission, { loaded: mission.load, delivered: mission.delivered, returnedCargo: result.stored, homeOverflow: result.remaining,
      targetUnavailable: mission.targetUnavailable, returnedAt: at, operatingFuel: { loaded: mission.paidOil, burned: mission.paidOil, remaining: 0 } });
  }
}

export function incomingDeliveries(players, playerId) {
  return [...players.values()].flatMap(p => p.military.missions.filter(m => m.type === 'delivery' && m.status === 'outbound' && m.targetPlayerId === playerId && p.playerId !== playerId)
    .map(m => ({ id:m.id, type:m.type, originName:m.originName, targetCityId:m.targetCityId, targetName:m.targetName, senderName:p.commanderName, arrivesAt:m.arrivesAt, load:m.load })));
}

export function transportFuel(mission, now) {
  const loadedMilli = BigInt(mission.paidOil) * 1000n;
  const duration = BigInt(mission.travelMs);
  let remainingMilliNumerator;
  if (mission.status === 'completed') remainingMilliNumerator = 0n;
  else if (mission.status === 'returning') remainingMilliNumerator = BigInt(mission.oneWayMilli) * BigInt(Math.max(0,mission.returnsAt-now));
  else {
    const reserve = mission.type === 'delivery' ? BigInt(mission.oneWayMilli) : 0n;
    const elapsed = BigInt(Math.max(0, Math.min(mission.travelMs,now-mission.startedAt)));
    remainingMilliNumerator = loadedMilli * duration - (loadedMilli-reserve)*elapsed;
  }
  const denominator = duration * 1000n, burnedNumerator = loadedMilli * duration - remainingMilliNumerator;
  return { loaded:mission.paidOil, burned:Number(burnedNumerator)/Number(denominator), remaining:Number(remainingMilliNumerator)/Number(denominator),
    exact:{burnedNumerator:burnedNumerator.toString(),remainingNumerator:remainingMilliNumerator.toString(),denominator:denominator.toString()} };
}

export function validateCityTransport(player, mission) {
  if (!isCityTransport(mission)) return;
  if (!/^city-logistics-1-/.test(mission.ruleset) || !['outbound','returning','completed'].includes(mission.status) ||
      mission.type==='transfer' && (mission.status==='returning' || mission.returnsAt!==null || mission.targetPlayerId!==player.playerId)) throw new Error('Inkonsistente Transportversion oder Richtung.');
  ownedCity(player,mission.originCityId);
  if (mission.type==='transfer') ownedCity(player,mission.targetCityId);
  if (!Array.isArray(mission.generals) || new Set(mission.generals.map(g=>g.id)).size!==mission.generals.length) throw new Error('Inkonsistente Transportgeneräle.');
  if (!Object.values(mission.units).some(n=>n>0) && !mission.generals.length) throw new Error('Leere Transportmission.');
  for (const [key,n] of Object.entries(mission.units)) if (!['infantry','scout','truck'].includes(key) || !Number.isSafeInteger(n) || n<0) throw new Error('Inkonsistente Transporttruppen.');
  if (!Number.isSafeInteger(mission.paidOil) || mission.paidOil<=0 || !/^[0-9]{1,32}$/.test(mission.oneWayMilli) ||
      ![mission.startedAt,mission.arrivesAt,mission.travelMs].every(Number.isSafeInteger) || mission.travelMs<=0 || mission.arrivesAt!==mission.startedAt+mission.travelMs) throw new Error('Inkonsistente Transportzeit oder Ölbuchung.');
  if (mission.paidOil!==ceilOil(BigInt(mission.oneWayMilli)*(mission.type==='delivery'?2n:1n))) throw new Error('Inkonsistente Transportölbilanz.');
  if (mission.type==='delivery') {
    if (mission.units.truck<1 || mission.units.infantry || mission.units.scout || mission.generals.length>1 || mission.returnsAt!==mission.arrivesAt+mission.travelMs) throw new Error('Inkonsistente Lieferfahrt.');
    for (const load of [mission.load,mission.remainingCargo]) validateCargo(load);
    if (mission.status!=='outbound') for (const k of RESOURCE_ORDER) {
      if (mission.load[k] !== (mission.delivered?.[k]??0)+mission.remainingCargo[k]+(mission.returnedCargo?.[k]??0)+(mission.homeOverflow?.[k]??0)) throw new Error('Inkonsistente Lieferladungsbilanz.');
    }
  }
  if (mission.status!=='completed') for (const {id} of mission.generals) {
    const g=player.military.generals.find(g=>g.id===id);
    if (!g || g.transitMissionId!==mission.id || g.cityId!==mission.originCityId) throw new Error('Inkonsistente General-Reisereferenz.');
  }
}
