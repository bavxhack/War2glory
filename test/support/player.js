// Construct a real pre-multicity fixture, rather than relabeling schema 16 JSON.
export function legacyPlayer(player) {
  delete player.cities; delete player.research; delete player.cityId;
  delete player.city.id; delete player.city.military; delete player.city.supply;
  for (const mission of player.military.missions) delete mission.originCityId;
  return player;
}
