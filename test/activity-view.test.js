import test from "node:test";
import assert from "node:assert/strict";
import { activityView } from "../apps/server/activity-view.js";
test("activity projection retains all five own cities and late entries without leaking private mission evidence", () => {
  const player = {
    cities: Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      name: `City ${i}`,
      constructionQueue: [{ id: `build${i}` }],
      military: {
        trainingQueue: Array.from({ length: 3 }, (_, j) => ({
          id: `training${i}-${j}`,
        })),
      },
    })),
    military: {
      missions: [
        "scout",
        "raid",
        "conquest",
        "field-scout",
        "delivery",
        "transfer",
      ].map((type, i) => ({
        id: `m${i}`,
        type,
        status: "outbound",
        originCityId: `c${i % 5}`,
        targetName: "Target",
        commandFingerprint: "secret",
        intelligence: { private: true },
      })),
    },
  };
  const original = JSON.stringify(player),
    view = activityView(player);
  assert.equal(view.cities.length, 5);
  assert.equal(view.cities.flatMap((c) => c.training).length, 15);
  assert.equal(view.cities[4].construction[0].id, "build4");
  assert.equal(view.missions.length, 6);
  assert.ok(
    view.missions.every(
      (m) => !("commandFingerprint" in m) && !("intelligence" in m),
    ),
  );
  assert.equal(JSON.stringify(player), original);
  player.military.missions[0].status = "completed";
  assert.equal(activityView(player).missions.length, 5);
});
