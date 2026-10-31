// Authorized own activity projection only; never expose command fingerprints,
// private intelligence, or another player's queues.
export function activityView(player) {
  return {
    cities: player.cities.map((city) => ({
      id: city.id,
      name: city.name,
      construction: city.constructionQueue,
      training: city.military.trainingQueue,
    })),
    missions: player.military.missions
      .filter((m) => m.status !== "completed")
      .map((m) => ({
        id: m.id,
        type: m.type ?? "scout",
        status: m.status,
        originCityId: m.originCityId,
        originName: m.originName,
        targetCityId: m.targetCityId,
        targetName: m.targetName,
        coordinates: m.coordinates,
        startedAt: m.startedAt,
        arrivesAt: m.arrivesAt,
        returnsAt: m.returnsAt,
      })),
  };
}
