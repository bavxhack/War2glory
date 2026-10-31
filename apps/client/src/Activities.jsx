import { useState } from "react";
import { Dialog, formatDuration } from "./ui.jsx";
export function Activities({ state, transport, onClose, context }) {
  const [filter, setFilter] = useState(context?.type ?? "all"),
    [city, setCity] = useState(context?.cityId ?? "all"),
    [slot, setSlot] = useState(context?.slotId ?? "all");
  const cities = state.activities?.cities ?? [
    {
      id: state.cityId,
      name: state.city.name,
      construction: state.city.constructionQueue,
      training: state.military.trainingQueue,
    },
  ];
  const ownMissions = state.activities?.missions ?? state.military.missions;
  const missions = [
    ...ownMissions,
    ...(state.incomingTransports ?? []).filter(
      (m) => !ownMissions.some((o) => o.id === m.id),
    ),
  ];
  const records = [
    ...cities.flatMap((c) => [
      ...c.construction.map((j) => ({
        ...j,
        cityId: c.id,
        kind: "build",
        label: `${state.buildings[j.building]?.label ?? "Bau"} Stufe ${j.level}`,
      })),
      ...c.training.map((j) => ({
        ...j,
        cityId: c.id,
        kind: "training",
        label: `${j.amount} ${state.units[j.unit].label}`,
      })),
    ]),
    ...(state.city.research.active
      ? [
          {
            ...state.city.research.active,
            kind: "research",
            label:
              state.technologies[state.city.research.active.technology].label,
          },
        ]
      : []),
    ...missions
      .filter((j) => j.status !== "completed")
      .map((j) => ({
        ...j,
        cityId: state.cities.some((c) => c.id === j.originCityId)
          ? j.originCityId
          : j.targetCityId,
        kind: "travel",
        label: `${{ raid: "Farmzug", scout: "Aufklärung", conquest: "Eroberung", "field-scout": "Feldaufklärung", delivery: "Lieferung", transfer: "Verlegung" }[j.type] ?? "Einsatz"} · ${j.targetName ?? `${j.coordinates?.x}, ${j.coordinates?.y}`}`,
      })),
  ];
  return (
    <Dialog
      open
      title="Alle Aktivitäten"
      kicker="AKTIVITÄTEN"
      onClose={onClose}
    >
      <label>
        Stadtfilter
        <select
          aria-label="Stadtfilter"
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setSlot("all");
          }}
        >
          <option value="all">Alle eigenen Städte</option>
          {state.cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Aktivitätsfilter
        <select
          aria-label="Aktivitätsfilter"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setSlot("all");
          }}
        >
          {[
            ["all", "Alle"],
            ["build", "Bau"],
            ["training", "Ausbildung"],
            ["research", "Forschung"],
            ["travel", "Alle Bewegungen"],
          ].map(([k, n]) => (
            <option key={k} value={k}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Gebäudefilter
        <select
          aria-label="Gebäudefilter"
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
        >
          <option value="all">Alle Gebäude</option>
          {[
            ...new Set(
              records
                .map((j) => j.slotId ?? j.trainingSlotId ?? j.barracksSlotId)
                .filter(Boolean),
            ),
          ].map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      {records
        .filter(
          (j) =>
            (filter === "all" || j.kind === filter) &&
            (city === "all" || j.cityId === city) &&
            (slot === "all" ||
              (j.slotId ?? j.trainingSlotId ?? j.barracksSlotId) === slot),
        )
        .map((j, i) => (
          <article className="card" key={`${j.kind}-${j.id ?? i}`}>
            <strong>{j.label}</strong>
            <p>
              {j.originName ??
                state.cities.find((c) => c.id === j.cityId)?.name ??
                "Historische Stadt"}{" "}
              · {j.status ?? "eingeplant"} ·{" "}
              {formatDuration(
                (j.finishesAt ??
                  (j.status === "returning" ? j.returnsAt : j.arrivesAt)) -
                  state.serverTime,
              )}
            </p>
          </article>
        ))}
    </Dialog>
  );
}
