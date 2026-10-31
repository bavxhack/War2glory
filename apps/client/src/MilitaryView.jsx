import { useDraft } from "./Drafts.jsx";
import { useRef, useState } from "react";
import { BuildingCard } from "./BuildingCard.jsx";
import { usePreview, previewVersion } from "./usePreview.js";
import { Dialog, GameArt, formatDuration } from "./ui.jsx";
import { forceSummary } from "../force-summary.js";

function TrainingForm({ state, transport, slot, onClose, initialUnit }) {
  const [slotId, setSlot] = useState(slot.id),
    [unit, setUnit] = useState(
      initialUnit ??
        Object.keys(state.units).find(
          (k) => state.units[k].building === slot.building,
        ),
    ),
    [amount, setAmount] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sending = useRef(false),
    barracks = state.city.militarySlots.find((s) => s.id === slotId);
  const command = { barracksSlotId: slotId, unit, amount };
  const { preview, status, invalidate } = usePreview(
    transport,
    "training.preview",
    command,
    previewVersion(state),
    Number.isSafeInteger(amount) &&
      amount > 0 &&
      amount <= state.militaryRules.maxTrainingAmount,
  );
  const initial = useRef({ unit, slotId });
  const dirty =
    amount !== 1 ||
    unit !== initial.current.unit ||
    slotId !== initial.current.slotId;
  useDraft(dirty);
  const start = async () => {
    if (sending.current || !preview) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await transport.request("training.enqueue", {
        ...command,
        researchEffect: preview.researchEffect,
      });
      onClose();
    } catch (e) {
      setError(e.message);
      invalidate();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  return (
    <Dialog
      dirty={dirty}
      open
      title={`Ausbildung · ${state.city.name}`}
      kicker="AUSBILDUNG"
      onClose={() => !busy && onClose()}
      actions={
        <button disabled={busy || !preview} onClick={start}>
          Ausbilden
        </button>
      }
    >
      <label>
        Ausbildungsgebäude
        <select
          aria-label="Ausbildungsgebäude"
          value={slotId}
          onChange={(e) => {
            const next = state.city.militarySlots.find(
              (s) => s.id === e.target.value,
            );
            setSlot(next.id);
            setUnit(
              Object.keys(state.units).find(
                (k) => state.units[k].building === next.building,
              ),
            );
          }}
        >
          {state.city.militarySlots
            .filter((s) => ["barracks", "vehicleFactory"].includes(s.building))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {state.buildings[s.building].label} · {s.id} · Stufe {s.level}
              </option>
            ))}
        </select>
      </label>
      <label>
        Einheit
        <select
          aria-label="Einheit"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        >
          {Object.entries(state.units)
            .filter(([, d]) => d.building === barracks.building)
            .map(([k, d]) => (
              <option key={k} value={k}>
                {d.label}
              </option>
            ))}
        </select>
      </label>
      <label>
        Anzahl
        <input
          type="number"
          min="1"
          max={state.militaryRules.maxTrainingAmount}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </label>
      <button onClick={() => setAmount(10)}>10</button>
      <button onClick={() => setAmount(50)}>50</button>
      <p role="status">{status}</p>
      {preview && (
        <p>
          {Object.entries(preview.cost)
            .map(
              ([k, n]) =>
                `${n} ${{ wood: "Holz", stone: "Stein", food: "Nahrung" }[k]}`,
            )
            .join(" · ")}{" "}
          · {formatDuration(preview.durationMs)} ·{" "}
          {
            state.military.trainingQueue.filter(
              (j) => (j.trainingSlotId ?? j.barracksSlotId) === slotId,
            ).length
          }
          /{state.militaryRules.trainingQueueLength} Plätze belegt.
          Forschungsbonus +
          {(preview.researchEffect.bonusBps * preview.researchEffect.level) /
            100}{" "}
          % Geschwindigkeit. Stationierte fertige Einheiten verbrauchen Nahrung.
        </p>
      )}
      {state.supply.inShortage && (
        <p>Hungerpause: Ausbildung kann derzeit nicht starten.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </Dialog>
  );
}
export function MilitaryView({
  state,
  transport,
  onPreview,
  initialUnit,
  onActivities,
}) {
  const [training, setTraining] = useState(() => {
      const slot =
        initialUnit &&
        state.city.militarySlots.find(
          (s) => s.building === state.units[initialUnit].building,
        );
      return slot ? { slot, unit: initialUnit } : null;
    }),
    forces = forceSummary(state.military, Object.keys(state.units));
  return (
    <section>
      <h2>Kasernen, Fabriken &amp; Truppen · {state.city.name}</h2>
      <div className="city-grid compact">
        {state.city.militarySlots.map((slot) => (
          <BuildingCard
            key={slot.id}
            slot={slot}
            state={state}
            transport={transport}
            onPreview={onPreview}
            onActivities={onActivities}
            onTrain={slot.building ? () => setTraining({ slot }) : null}
          />
        ))}
      </div>
      <section className="card">
        <h2>Streitkräfte</h2>
        <div className="unit-visuals">
          {Object.entries(state.units).map(([unit, d]) => {
            const slot = state.city.militarySlots.find(
              (s) => s.building === d.building,
            );
            return (
              <article className="unit-card" key={unit}>
                <GameArt type={unit} label={d.label} />
                <h3>{d.label}</h3>
                <p>
                  {forces[unit].stationed} stationiert · {forces[unit].deployed}{" "}
                  unterwegs · {forces[unit].training} in Ausbildung
                </p>
                <button
                  disabled={!slot}
                  onClick={() => setTraining({ slot, unit })}
                >
                  Ausbilden · {d.label}
                </button>
                {!slot && <p>Benötigt {state.buildings[d.building].label}</p>}
              </article>
            );
          })}
        </div>
      </section>
      {training && (
        <TrainingForm
          state={state}
          transport={transport}
          slot={training.slot}
          initialUnit={training.unit}
          onClose={() => setTraining(null)}
        />
      )}
    </section>
  );
}
