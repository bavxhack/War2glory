import { useEffect, useRef, useState } from "react";
import {
  BuildingArt,
  Dialog,
  canAfford,
  quoteText,
  capacitySummary,
  resourceLabels,
} from "./ui.jsx";

export function BuildingCard({
  slot,
  state,
  transport,
  onPreview,
  onResearch,
  onTrain,
  onActivities,
  focus,
  initialCatalog = false,
}) {
  const [catalog, setCatalog] = useState(initialCatalog),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const sending = useRef(false),
    card = useRef(null);
  useEffect(() => {
    if (focus) {
      card.current?.scrollIntoView({ block: "nearest" });
      card.current?.focus();
    }
  }, [focus]);
  const job = state.city.constructionQueue.find((j) => j.slotId === slot.id);
  const training = state.military.trainingQueue.filter(
    (j) => (j.trainingSlotId ?? j.barracksSlotId) === slot.id,
  );
  const definition = state.buildings[slot.building],
    quote = state.offers.upgrade[slot.id];
  const online = transport.getSnapshot().status === "connected";
  const reason = (q) =>
    !online
      ? "Verbindung fehlt"
      : job
        ? "Bauauftrag bereits eingeplant"
        : training.length
          ? "Während der Ausbildung gesperrt"
          : state.city.constructionQueue.length >= state.maxQueueLength
            ? "Bauwarteschlange voll"
            : (q?.reason ??
              (!q
                ? "Maximale Stufe erreicht"
                : !canAfford(state, q)
                  ? Object.entries(q.cost)
                      .filter(([k, n]) => n > state.city.resources[k])
                      .map(
                        ([k, n]) =>
                          `${Math.ceil(n - state.city.resources[k])} ${resourceLabels[k]} fehlen`,
                      )
                      .join(" · ")
                  : null));
  async function build(building, offer) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage("Wird gespeichert …");
    try {
      await transport.request("construction.enqueue", {
        slotId: slot.id,
        building,
        researchEffect: offer.researchEffect,
      });
      setCatalog(false);
      setMessage(
        `${state.buildings[building].label} in ${state.city.name} eingeplant.`,
      );
    } catch (e) {
      setMessage(e.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <article
      ref={card}
      tabIndex={-1}
      className={`plot building-card ${slot.building ?? "empty"}${focus ? " selected" : ""}`}
      aria-label={
        definition
          ? `${definition.label}, Stufe ${slot.level}`
          : `Freies Grundstück ${slot.id}`
      }
    >
      {slot.building ? (
        <>
          <BuildingArt type={slot.building} level={slot.level} />
          <h3>
            {definition.label} · Stufe {slot.level}
          </h3>
          <p>
            {definition.resource
              ? `Ausbau erhöht ${resourceLabels[definition.resource]}-Produktion und Lagergrenze.`
              : slot.building === "university"
                ? "Höhere Stufen ermöglichen weitere Forschung."
                : slot.building === "warehouse"
                  ? "Ausbau erhöht alle Lagergrenzen."
                  : "Höhere Stufen verkürzen künftige Ausbildung."}
          </p>
          {job ? (
            <p role="status">Stufe {job.level ?? job.targetLevel} eingeplant</p>
          ) : (
            quote && (
              <p>
                {quoteText(quote)}
                {quote.capacityAfter && (
                  <small>
                    Lager danach: {capacitySummary(quote.capacityAfter)}
                  </small>
                )}
              </p>
            )
          )}
          {slot.building === "university" && (
            <button onClick={() => onResearch(slot.buildingId)}>
              Forschen
            </button>
          )}
          {onTrain && (
            <button onClick={onTrain}>
              {slot.building === "vehicleFactory"
                ? "LKWs herstellen"
                : "Ausbilden"}
            </button>
          )}
          <button
            disabled={busy || Boolean(reason(quote))}
            onClick={() => build(slot.building, quote)}
          >
            Ausbauen · Stufe {quote?.level ?? slot.level}
          </button>
          {reason(quote) && <p className="notice">{reason(quote)}</p>}
          {!!training.length && (
            <p>
              {training.length}/{state.militaryRules.trainingQueueLength}{" "}
              Ausbildungsaufträge · {training[0].amount}{" "}
              {state.units[training[0].unit].label}
            </p>
          )}
          {(job || training.length > 0) && (
            <button
              onClick={() =>
                onActivities?.({
                  cityId: state.cityId,
                  slotId: slot.id,
                  type: training.length ? "training" : "build",
                })
              }
            >
              Alle Aufträge
            </button>
          )}
          <details>
            <summary>Mehr</summary>
            <p>
              Grundstück {slot.id} · {state.city.name}.{" "}
              {definition.resource
                ? `Produziert ${resourceLabels[definition.resource]}; Forschung und Stadtrollen gelten zusätzlich.`
                : "Wirkung nach Fertigstellung."}
            </p>
            <button
              disabled={busy || !online || Boolean(job) || training.length > 0}
              onClick={() => onPreview(slot)}
            >
              Abreißen
            </button>
          </details>
        </>
      ) : (
        <>
          <span className="empty-mark">+</span>
          <h3>
            Freier {slot.area === "military" ? "Militärbauplatz" : "Bauplatz"}
          </h3>
          <button disabled={Boolean(job)} onClick={() => setCatalog(true)}>
            Bauen
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
      {catalog && (
        <Dialog
          open
          title={`Bauen · ${state.city.name} · ${slot.id}`}
          kicker="BAUKATALOG"
          onClose={() => !busy && setCatalog(false)}
        >
          {message && <p role="status">{message}</p>}
          {Object.entries(state.buildings)
            .filter(
              ([, d]) =>
                d.area ===
                (state.city.militarySlots.some((s) => s.id === slot.id)
                  ? "military"
                  : "civil"),
            )
            .map(([key, d]) => {
              const q = state.offers.build[key];
              return (
                <section className="building-option" key={key}>
                  <BuildingArt type={key} />
                  <h3>{d.label}</h3>
                  <p>{quoteText(q)}</p>
                  {reason(q) && <p>{reason(q)}</p>}
                  <button
                    disabled={busy || Boolean(reason(q))}
                    onClick={() => build(key, q)}
                  >
                    Bauen · {d.label} · {q.cost.wood} Holz / {q.cost.stone}{" "}
                    Stein
                  </button>
                </section>
              );
            })}
        </Dialog>
      )}
    </article>
  );
}
