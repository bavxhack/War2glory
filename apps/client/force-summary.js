// Stationed units exclude deployed forces. Returning raids carry only survivors.
export function missionForces(mission) {
  if (!['outbound', 'returning'].includes(mission.status)) return { scout: 0, infantry: 0 };
  if (mission.type === 'raid') return {
    scout: 0,
    infantry: mission.status === 'returning' ? (mission.result?.survivors ?? mission.infantry ?? 0) : (mission.infantry ?? 0),
  };
  return { scout: mission.scouts ?? 0, infantry: 0 };
}

export function forceSummary(military, unitTypes) {
  return Object.fromEntries(unitTypes.map(unit => {
    const stationed = military.units[unit] ?? 0;
    const deployed = military.missions.reduce((sum, mission) => sum + (missionForces(mission)[unit] ?? 0), 0);
    const training = military.trainingQueue.filter(job => job.unit === unit).reduce((sum, job) => sum + job.amount, 0);
    return [unit, { stationed, deployed, training, total: stationed + deployed }];
  }));
}
