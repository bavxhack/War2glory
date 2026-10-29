import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// A preview is usable only for the exact draft and connection that requested it.
export function usePreview(transport, type, payload, version, enabled = true) {
  const snapshot = useSyncExternalStore(
    transport.subscribe,
    transport.getSnapshot,
  );
  const connection = `${snapshot.status}:${Boolean(snapshot.reconciling)}:${Boolean(snapshot.switching)}`;
  const key = JSON.stringify([type, payload, version, connection]);
  const current = useRef(key);
  current.current = key;
  const [result, setResult] = useState(null),
    [revision, retry] = useState(0);
  const online =
    snapshot.status === "connected" &&
    !snapshot.reconciling &&
    !snapshot.switching;
  useEffect(() => {
    let alive = true;
    setResult(null);
    if (!enabled || !online) return;
    const timer = setTimeout(async () => {
      setResult({ key, status: "loading" });
      try {
        const value = await transport.request(type, payload);
        if (alive && current.current === key)
          setResult({ key, status: "valid", value });
      } catch (error) {
        if (alive && current.current === key)
          setResult({ key, status: "invalid", error: error.message });
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [key, enabled, revision, transport]);
  const matching = result?.key === key;
  return {
    preview: enabled && online && matching ? (result.value ?? null) : null,
    status: !online
      ? "Verbindung fehlt · Stand veraltet"
      : !enabled
        ? "Eingaben unvollständig"
        : !matching || !result
          ? "Vorschau wird berechnet …"
          : result.status === "loading"
            ? "Vorschau wird berechnet …"
            : (result.error ?? "Aktuelle Servervorschau"),
    invalidate: () => {
      setResult(null);
      retry((n) => n + 1);
    },
  };
}

export const previewVersion = (state) =>
  JSON.stringify({
    player: state.player.id,
    city: state.cityId,
    slots: [...state.city.buildingSlots, ...state.city.militarySlots],
    construction: state.city.constructionQueue.map((j) => j.id),
    training: state.military.trainingQueue.map((j) => j.id),
    units: state.military.units,
    generals: state.military.generals.map((g) => [
      g.id,
      g.version,
      g.cityId,
      g.status,
    ]),
    roles: state.military.roleVersion,
    shortage: state.supply.inShortage,
    research: state.city.research,
    rules: [state.researchRules, state.logisticsRules, state.generalSkillRules],
  });
