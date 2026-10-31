import { useDraft } from "./Drafts.jsx";
import { usePreview, previewVersion } from "./usePreview.js";
import { useRef } from "react";
import { LoadingResearch } from "./LoadingResearch.jsx";
import { useState, useEffect } from "react";
import { resourceLabels, formatDuration } from "./ui.jsx";

export function LogisticsView({
  state,
  transport,
  connected,
  initialDraft,
  onSource,
}) {
  const [mode, setMode] = useState(initialDraft?.mode ?? "delivery"),
    [targetId, setTarget] = useState(initialDraft?.targetCityId ?? ""),
    [units, setUnits] = useState({
      infantry: 0,
      scout: 0,
      truck: initialDraft ? 0 : 1,
    });
  const [cargo, setCargo] = useState({ wood: 0, stone: 0, food: 0, oil: 0 }),
    [generalId, setGeneral] = useState(""),
    [generalIds, setGenerals] = useState(initialDraft?.generalIds ?? []);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [filter, setFilter] = useState("city"),
    [typeFilter, setTypeFilter] = useState("all"),
    [dirty, setDirty] = useState(false);
  const leave = useDraft(dirty);
  const edit = (action) => (value) => {
    action(value);
    invalidate();
    setDirty(true);
    setError("");
  };
  const targets = (state.logisticsTargets ?? []).filter(
    (t) => t.id !== state.cityId && (mode === "delivery" || t.own),
  );
  const target = targets.find((t) => t.id === targetId),
    generals = state.military.generals.filter(
      (g) => g.status === "idle" && g.cityId === state.cityId,
    );
  const command = {
    originCityId: state.cityId,
    targetCityId: targetId,
    instanceId: state.world.instanceId,
    units: mode === "delivery" ? { truck: units.truck } : units,
    ...(mode === "delivery"
      ? { cargo, generalId: generalId || null }
      : { generalIds }),
  };
  const { preview, status, invalidate } = usePreview(
    transport,
    `${mode}.preview`,
    command,
    previewVersion(state),
    Boolean(target) &&
      Object.values(units).every((n) => Number.isSafeInteger(n) && n >= 0) &&
      Object.values(cargo).every((n) => Number.isSafeInteger(n) && n >= 0),
  );
  const sending = useRef(false);
  async function perform() {
    if (sending.current || !preview) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await transport.request(`${mode}.start`, { ...command, preview });
      invalidate();
      setDirty(false);
      setError("Transport wurde gespeichert.");
    } catch (e) {
      setError(e.message);
      invalidate();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const modes = [
    ["delivery", "Ressourcen liefern"],
    ["transfer", "Truppen & Generäle verlegen"],
  ];
  const movements = [
    ...(state.transports ?? []).filter((m) => m.status !== "completed"),
    ...(state.incomingTransports ?? []),
  ].filter(
    (m) =>
      (filter === "all" ||
        m.originCityId === state.cityId ||
        m.targetCityId === state.cityId) &&
      (typeFilter === "all" || m.type === typeFilter),
  );
  return (
    <section className="logistics-view">
      <h2>Logistik · {state.city.name}</h2>
      <nav className="view-tabs" aria-label="Logistikmodus">
        {modes.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={mode === key}
            className={mode === key ? "active" : ""}
            onClick={() =>
              leave(() => {
                setMode(key);
                setTarget("");
                setUnits({
                  infantry: 0,
                  scout: 0,
                  truck: key === "delivery" ? 1 : 0,
                });
                invalidate();
                setDirty(false);
                setGenerals([]);
                setGeneral("");
              })
            }
          >
            {label}
          </button>
        ))}
      </nav>
      <form
        className="card logistics-form"
        data-draft
        onSubmit={(e) => {
          e.preventDefault();
          void perform();
        }}
      >
        <h3>1. Quelle und Ziel</h3>
        <label>
          Ausgangsstadt
          <select
            disabled={busy || !connected}
            aria-label="Ausgangsstadt"
            value={state.cityId}
            onChange={(e) =>
              onSource(e.target.value, { mode, targetCityId: targetId })
            }
          >
            {state.cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zielstadt
          <select
            aria-label="Zielstadt"
            required
            value={targetId}
            disabled={busy}
            onChange={(e) => edit(setTarget)(e.target.value)}
          >
            <option value="">Ziel auswählen</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.x}, {t.y}) ·{" "}
                {t.own ? "Eigene Stadt" : t.commanderName}
              </option>
            ))}
          </select>
        </label>
        <p>
          {mode === "delivery"
            ? `LKWs kehren nach der Lieferung nach ${state.city.name} zurück. General optional.`
            : `Die ausgewählten Einheiten und Generäle sind nach Ankunft in ${target?.name ?? "der Zielstadt"} stationiert. Keine Rückfahrt.`}
        </p>
        <h3>2. Auswahl</h3>
        <div className="logistics-inputs">
          {(mode === "delivery"
            ? ["truck"]
            : ["infantry", "scout", "truck"]
          ).map((k) => (
            <label key={k}>
              {state.units[k].label} ({state.military.units[k]} stationiert)
              <input
                type="number"
                min="0"
                max={state.military.units[k]}
                step="1"
                disabled={busy}
                value={units[k]}
                onChange={(e) =>
                  edit(setUnits)({ ...units, [k]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
        {mode === "delivery" ? (
          <>
            <div className="logistics-inputs">
              {Object.entries(resourceLabels).map(([k, label]) => (
                <label key={k}>
                  {label} laden
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={busy}
                    value={cargo[k]}
                    onChange={(e) =>
                      edit(setCargo)({ ...cargo, [k]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              General (optional)
              <select
                aria-label="General (optional)"
                value={generalId}
                disabled={busy}
                onChange={(e) => edit(setGeneral)(e.target.value)}
              >
                <option value="">Ohne General</option>
                {generals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <fieldset>
            <legend>Generäle verlegen (optional, Mehrfachwahl)</legend>
            {generals.map((g) => (
              <label className="check-label" key={g.id}>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={generalIds.includes(g.id)}
                  onChange={(e) =>
                    edit(setGenerals)(
                      e.target.checked
                        ? [...generalIds, g.id]
                        : generalIds.filter((id) => id !== g.id),
                    )
                  }
                />
                {g.name}
              </label>
            ))}
            {!generals.length && (
              <p>
                Keine freien Generäle in dieser Stadt. Eine Truppenverlegung
                bleibt möglich.
              </p>
            )}
          </fieldset>
        )}
        <h3>3. Vorschau und Start</h3>
        <p role="status">{status}</p>
        {preview && (
          <div className="notice" aria-live="polite">
            <p>
              {preview.originName} → {preview.targetName} · Hinreise{" "}
              {formatDuration(preview.travelMs)}
              {mode === "delivery" &&
                ` · Rückreise ${formatDuration(preview.travelMs)}`}
            </p>
            <LoadingResearch preview={preview} />
            <p>
              Eigene Ladung{" "}
              {Object.values(preview.cargo).reduce((a, b) => a + b, 0)} ·
              normaler Frachtraum {preview.capacity} · Betriebsöl im Frachtraum{" "}
              {preview.fuelBudgets.normal} · freie Plätze{" "}
              {preview.capacity -
                Object.values(preview.cargo).reduce((a, b) => a + b, 0) -
                preview.fuelBudgets.normal}
              . Spähertanköl {preview.fuelBudgets.scouts}, Diensttransportöl{" "}
              {preview.fuelBudgets.generals}.
            </p>
            <p>
              Betriebsöl: {preview.totalOil} · {preview.distanceFields} Felder ·
              Traglast {preview.capacity} · Unterhalt in Quelle −
              {preview.upkeepPerHour.toFixed(2)} Nahrung/h
            </p>
            {preview.targetSupply && (
              <p>
                Eigene Zielstadt: {Math.floor(preview.targetSupply.food)}{" "}
                Nahrung · Nettobilanz jetzt{" "}
                {preview.targetSupply.netPerHour.toFixed(2)}/h, nach Ankunft{" "}
                {preview.targetSupply.netAfterPerHour.toFixed(2)}/h
                {preview.targetSupply.netAfterPerHour < 0 &&
                  " · Achtung: negative Versorgung"}
              </p>
            )}
            {mode === "transfer" && (
              <p>
                Zielunterhalt steigt ab Ankunft. Prüfe die Zielversorgung; eine
                schlechte Bilanz verhindert die Stationierung nicht.
              </p>
            )}
            {mode === "delivery" && (
              <p>
                Freie Zielkapazität wird bei Ankunft geprüft. Nicht passende
                Güter fahren zurück.
              </p>
            )}
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="form-summary">
          <p>
            {state.city.name} → {target?.name ?? "Ziel auswählen"}
          </p>
          <button disabled={busy || !preview || !connected}>
            {mode === "delivery" ? "Lieferung starten" : "Verlegung starten"}
          </button>
        </div>
      </form>
      <section className="card">
        <h3>Laufende Transporte</h3>
        <div className="logistics-inputs">
          <label>
            Stadtfilter
            <select
              aria-label="Stadtfilter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="city">Gewählte Stadt</option>
              <option value="all">Alle Städte</option>
            </select>
          </label>
          <label>
            Typfilter
            <select
              aria-label="Typfilter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">Alle Reisen</option>
              <option value="delivery">Lieferungen</option>
              <option value="transfer">Verlegungen</option>
            </select>
          </label>
        </div>
        {movements.length ? (
          movements.map((m) => (
            <article key={m.id} className="transport-row">
              <strong>
                {m.type === "delivery" ? "Lieferung" : "Verlegung"} ·{" "}
                {m.originName} → {m.targetName}
              </strong>
              <p>
                {m.senderName && `Absender ${m.senderName} · `}
                {m.status === "returning" ? "Rückfahrt" : "Hinreise"} · noch{" "}
                {formatDuration(
                  (m.status === "returning" ? m.returnsAt : m.arrivesAt) -
                    state.serverTime,
                )}
              </p>
              {m.load && (
                <p>
                  Ladung:{" "}
                  {Object.entries(m.load)
                    .map(([k, n]) => `${n} ${resourceLabels[k]}`)
                    .join(" · ")}
                </p>
              )}
            </article>
          ))
        ) : (
          <p>Keine Transporte.</p>
        )}
      </section>
    </section>
  );
}
