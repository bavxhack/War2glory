import { canonicalJSON, cityView } from './multicity.js';
import { resourceCapacities } from './index.js';
import { supplySummary } from './supply.js';
export function cityOverview(previous, entities, asOf) {
  const p = canonicalJSON(previous);
  return {
    asOf,
    cities: p.cities.map((c) => {
      const v = cityView(p, c.id),
        s = supplySummary(v),
        supply = c.supply ?? {},
        rules = supply.cycleRules ?? supply.rules,
        entity = entities.find((e) => e.id === c.id);
      const secondsUntilEmpty = s.net < 0 ? c.resources.food / -s.net : null;
      const status = supply.inShortage
        ? supply.shortageMs >= (rules?.graceMs ?? Infinity)
          ? 'losses'
          : 'grace'
        : supply.shortageMs > 0
          ? 'recovery'
          : s.net < 0
            ? 'declining'
            : 'balanced';
      return {
        id: c.id,
        name: c.name,
        x: entity?.x,
        y: entity?.y,
        resources: { ...c.resources },
        capacities: resourceCapacities(v.city),
        productionPerHour: s.production * 3600,
        upkeepPerHour: s.upkeep * 3600,
        netPerHour: s.net * 3600,
        secondsUntilEmpty: Number.isFinite(secondsUntilEmpty)
          ? secondsUntilEmpty
          : null,
        status,
        nextLossAt: supply.nextLossAt ?? null,
        graceRemainingMs:
          status === 'grace'
            ? Math.max(0, rules.graceMs - supply.shortageMs)
            : null,
        recoveryEndsAt:
          supply.recoveryStartedAt != null
            ? supply.recoveryStartedAt + rules.recoveryMs
            : null,
        stationedUnits: Object.values(c.military.units).reduce(
          (a, b) => a + b,
          0,
        ),
        deployedUnits: s.deployedUnits,
        trainingPaused: !!supply.inShortage,
      };
    }),
  };
}
