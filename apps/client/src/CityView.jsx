import { useState } from "react";
import { BuildingCard } from "./BuildingCard.jsx";
export function CityView({
  state,
  transport,
  onPreview,
  onActivities,
  onResearch,
  initialBuilding,
}) {
  const matches = state.city.buildingSlots.filter(
    (s) => s.building === initialBuilding,
  );
  const empty = state.city.buildingSlots.find((s) => !s.building);
  const [selected, setSelected] = useState(
    matches.length === 1 ? matches[0].id : null,
  );
  return (
    <section className="map-panel">
      <h2>Siedlung · {state.city.name}</h2>
      {initialBuilding && matches.length > 1 && (
        <div>
          <p>{state.buildings[initialBuilding].label} auswählen:</p>
          {matches.map((s) => (
            <button key={s.id} onClick={() => setSelected(s.id)}>
              {s.id} · Stufe {s.level}
            </button>
          ))}
        </div>
      )}
      {initialBuilding && !matches.length && !empty && (
        <p>
          Kein freier Bauplatz für {state.buildings[initialBuilding].label}.
        </p>
      )}
      <div className="city-grid" aria-label="Bauplätze">
        {state.city.buildingSlots.map((slot) => (
          <BuildingCard
            key={slot.id}
            slot={slot}
            state={state}
            transport={transport}
            onPreview={onPreview}
            onActivities={onActivities}
            onResearch={onResearch}
            focus={slot.id === selected}
            initialCatalog={
              !!initialBuilding && !matches.length && empty?.id === slot.id
            }
          />
        ))}
      </div>
    </section>
  );
}
