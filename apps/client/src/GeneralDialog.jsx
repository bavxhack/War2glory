import { useDraft } from "./Drafts.jsx";
import { usePreview } from "./usePreview.js";
import { useRef } from "react";
import { GeneralPortrait } from "./GeneralPortrait.jsx";
import { useState } from "react";
import { Dialog } from "./ui.jsx";

const emptyDraft = () => ({ leadership: 0, attack: 0, defense: 0 });
const labels = {
  leadership: "Führung",
  attack: "Angriff",
  defense: "Verteidigung",
};

export function GeneralDialog({
  general,
  rules,
  supply,
  roleVersion,
  isMayor,
  local = true,
  cityName,
  transport,
  onClose,
  state,
  initialSection,
  onTransfer,
}) {
  const [section, setSection] = useState(initialSection ?? "overview");
  const sending = useRef(false);
  const [name, setName] = useState(general.name);
  const [draft, setDraft] = useState(emptyDraft);
  const [points, setPoints] = useState(1);
  const [baseVersion, setBaseVersion] = useState(general.version);

  const [pending, setBusy] = useState(false);
  const busy = pending || transport.getSnapshot().status !== "connected";
  const [error, setError] = useState("");
  const allocations = general.skills.allocations;
  const allocated = Object.values(allocations).reduce(
    (sum, value) => sum + value,
    0,
  );
  const free = general.skills.totalPoints - allocated;
  const proposedCount = Object.values(draft).reduce(
    (sum, value) => sum + value,
    0,
  );
  const availableExperience =
    general.experience - general.skills.experienceSpent;
  const exhausted = Object.keys(labels).every((key) =>
    key === "leadership"
      ? general.attributes.leadership + allocations.leadership >=
        rules.maxEffectiveLeadership
      : general.attributes[key] + allocations[key] >= rules.maxMilitaryPoints,
  );
  const stale = general.version !== baseVersion;
  const validName =
    [...name.trim()].length >= 1 &&
    [...name.trim()].length <= 40 &&
    !/\p{Cc}/u.test(name);
  const command = {
    generalId: general.id,
    expectedVersion: baseVersion,
    rulesetVersion: rules.version,
  };
  const nextCost = rules.xpPerPointIndex * (general.skills.totalPoints + 1);

  const conversion = usePreview(
    transport,
    "general.preview",
    { ...command, points },
    [general.version, rules.version],
    section === "development" &&
      !stale &&
      Number.isSafeInteger(points) &&
      points > 0,
  );
  const distribution = usePreview(
    transport,
    "general.preview",
    { ...command, changes: draft },
    [general.version, rules.version],
    section === "development" &&
      !stale &&
      proposedCount > 0 &&
      proposedCount <= free,
  );
  const preview = distribution.preview
    ? { ...distribution.preview, kind: "distribute" }
    : conversion.preview
      ? { ...conversion.preview, kind: "convert" }
      : null;
  const setPreview = () => {
    conversion.invalidate();
    distribution.invalidate();
  };
  async function perform(action) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(failure.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  function save(kind) {
    const preview =
      kind === "convert"
        ? { ...conversion.preview, kind }
        : { ...distribution.preview, kind };
    return perform(async () => {
      await transport.request(`general.${preview.kind}`, {
        ...command,
        ...(preview.kind === "convert"
          ? { points: conversion.preview.conversion.points }
          : { changes: draft }),
      });
      setBaseVersion(baseVersion + 1);
      setPreview(null);
      setDraft(emptyDraft());
    });
  }
  function acceptCurrent() {
    setBaseVersion(general.version);
    setPreview(null);
    setDraft(emptyDraft());
    setError("");
  }
  useDraft(name.trim() !== general.name || proposedCount > 0);
  return (
    <Dialog
      open
      title={general.name}
      kicker="GENERAL-EIGENSCHAFTEN"
      dirty={name.trim() !== general.name || proposedCount > 0}
      onClose={() => !busy && onClose()}
    >
      {error && <p role="alert">{error}</p>}
      <nav className="view-tabs">
        {[
          ["overview", "Übersicht"],
          ["development", "Entwicklung"],
          ["role", "Rolle / Standort"],
        ].map(([k, n]) => (
          <button
            key={k}
            aria-pressed={section === k}
            onClick={() => setSection(k)}
          >
            {n}
          </button>
        ))}
      </nav>
      <p>
        Standort: {cityName ?? general.cityId} ·{" "}
        {
          {
            idle: "verfügbar",
            mayor: "Bürgermeister",
            researcher: "Forschungsleitung",
            scouting: "Aufklärung",
            raiding: "Angriff",
            transit: "Verlegung",
            delivering: "Lieferbegleitung",
          }[general.status]
        }
        {general.transitMissionId && " · unterwegs"}
      </p>
      {general.status === "researcher" && (
        <button
          disabled={busy}
          onClick={() =>
            perform(() =>
              transport.request("general.researcher", {
                cityId: general.cityId,
                generalId: null,
                expectedRoleVersion: roleVersion,
              }),
            )
          }
        >
          Forschungsleitung freigeben
        </button>
      )}
      <GeneralPortrait portraitId={general.portraitId} name={general.name} />
      <section hidden={section !== "overview"} data-draft>
        <label>
          Name
          <input
            maxLength="80"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy || !validName || name.trim() === general.name}
          onClick={() =>
            perform(async () => {
              await transport.request("general.rename", {
                generalId: general.id,
                name,
                expectedVersion: general.version,
              });
              setBaseVersion(general.version + 1);
              setName(name.trim());
              setPreview(null);
            })
          }
        >
          Namen speichern
        </button>
      </section>
      <section hidden={section !== "role"}>
        <h3>Rolle · {cityName}</h3>
        <p>
          Aktuelle Nahrungsproduktion in {cityName}:{" "}
          {state.cityOverview.cities
            .find((c) => c.id === general.cityId)
            ?.productionPerHour.toLocaleString("de-DE")}{" "}
          pro Stunde.
        </p>
        {isMayor && supply && (
          <p>
            Aktueller Bürgermeisterbonus:{" "}
            {(supply.mayorBonus * 100).toLocaleString("de-DE")} %.
          </p>
        )}
        <p>
          Aktueller Bürgermeister:{" "}
          {state.military.generals.find(
            (g) => g.cityId === general.cityId && g.status === "mayor",
          )?.name ?? "Unbesetzt"}
          . Eine Ernennung ersetzt diese Besetzung.
        </p>
        <button
          type="button"
          className="secondary"
          disabled={busy || (!isMayor && general.status !== "idle")}
          onClick={() =>
            perform(async () => {
              await transport.request("general.mayor", {
                cityId: general.cityId,
                generalId: isMayor ? null : general.id,
                expectedRoleVersion: roleVersion,
              });
              setBaseVersion(general.version + 1);
              setPreview(null);
            })
          }
        >
          {isMayor
            ? "Als Bürgermeister abberufen"
            : "Zum Bürgermeister ernennen"}
        </button>
        <button
          disabled={busy || general.status !== "idle"}
          onClick={onTransfer}
        >
          General verlegen
        </button>
        <button
          disabled={busy || general.status !== "idle"}
          onClick={() =>
            perform(() =>
              transport.request("general.researcher", {
                cityId: general.cityId,
                generalId: general.id,
                expectedRoleVersion: roleVersion,
              }),
            )
          }
        >
          Als Forschungsleitung einsetzen · {cityName}
        </button>
      </section>
      <section hidden={section !== "development"} data-draft>
        <div className="general-facts">
          <span>
            Level <strong>{general.level}</strong>
          </span>
          <span>
            Gesamt-XP <strong>{general.experience}</strong>
          </span>
          <span>
            Verfügbare XP <strong>{availableExperience}</strong>
          </span>
          <span>
            Verwendete XP <strong>{general.skills.experienceSpent}</strong>
          </span>
          <span>
            Erworbene Punkte <strong>{general.skills.totalPoints}</strong>
          </span>
          <span>
            Freie Skillpunkte <strong>{free}</strong>
          </span>
        </div>
        <p className="notice">
          Vorläufige Regeln: Punkt n kostet 10 × n XP. Gesamt-XP und Level
          bleiben erhalten. Ein Punkt erhöht eine Eigenschaft um eins.
          Gespeicherte Zuweisungen können nicht zurückgenommen werden.
        </p>
        {["scouting", "raiding"].includes(general.status) && (
          <p className="notice">
            Dieser General ist unterwegs. Neue Kampfpunkte wirken erst ab der
            nächsten Entsendung; der laufende Einsatz bleibt unverändert.
          </p>
        )}
        {exhausted && (
          <p role="status">
            Alle Eigenschaften sind ausgeschöpft. Gekaufte Punkte bleiben frei,
            können derzeit aber nicht eingesetzt werden.
          </p>
        )}
        {stale && (
          <p role="alert">
            Der General wurde inzwischen geändert. Dein Entwurf bleibt erhalten.
            Prüfe den aktuellen Stand und beginne die Vorschau erneut.{" "}
            <button type="button" disabled={busy} onClick={acceptCurrent}>
              Aktuellen Stand übernehmen und Entwurf verwerfen
            </button>
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {busy && <p role="status">Server prüft und speichert …</p>}
        <section aria-label="XP umwandeln">
          <h3>1. Skillpunkte kaufen</h3>
          <p>
            Nächster Punkt: {nextCost} XP. Bereits verteilte Punkte zählen beim
            Preis weiter.
          </p>
          <label>
            Neue Skillpunkte
            <input
              type="number"
              min="1"
              step="1"
              value={points}
              disabled={busy}
              onChange={(event) => {
                setPoints(Number(event.target.value));
                setPreview(null);
              }}
            />
          </label>
          <p role="status">{conversion.status}</p>
          {conversion.preview && (
            <div className="notice">
              <p>
                {conversion.preview.conversion.points} neue Punkte kosten
                zusammen {conversion.preview.conversion.cost} XP. Danach bleiben{" "}
                {conversion.preview.conversion.remainingExperience} XP
                verfügbar.
              </p>
              <button
                type="button"
                disabled={busy || stale}
                onClick={() => save("convert")}
              >
                Für {conversion.preview.conversion.cost} XP kaufen
              </button>
            </div>
          )}
        </section>
        <section aria-label="Skillpunkte verteilen">
          <h3>2. Freie Punkte verteilen</h3>
          <div className="attribute-list">
            {Object.entries(labels).map(([key, label]) => {
              const base = general.attributes[key];
              const effective = base + allocations[key] + draft[key];
              const limit =
                key === "leadership"
                  ? Math.max(0, rules.maxEffectiveLeadership - base)
                  : Math.max(0, rules.maxMilitaryPoints - base);
              const full = allocations[key] + draft[key] >= limit;
              return (
                <div key={key}>
                  <span>
                    <strong>{label}</strong> · Grundwert {base} · zugewiesen{" "}
                    {allocations[key]} · Entwurf +{draft[key]} · effektiv{" "}
                    {effective}
                    <small>
                      {key === "leadership"
                        ? "Wirkung bei Ernennung in der betreffenden Stadt."
                        : `${key === "attack" ? "Angriff +" : "Verluste −"}${Math.min(50, effective * rules.militaryPercentPerPoint)} %`}
                      {full && " · ausgeschöpft"}
                    </small>
                  </span>
                  <span className="stepper">
                    <button
                      type="button"
                      aria-label={`${label} im Entwurf verringern`}
                      disabled={busy || draft[key] === 0}
                      onClick={() => {
                        setDraft({ ...draft, [key]: draft[key] - 1 });
                        setPreview(null);
                      }}
                    >
                      −
                    </button>
                    <input
                      aria-label={`${label} verteilen`}
                      type="number"
                      min="0"
                      max={free}
                      value={draft[key]}
                      onChange={(e) => {
                        setDraft({ ...draft, [key]: Number(e.target.value) });
                        setPreview(null);
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`${label} im Entwurf erhöhen`}
                      disabled={busy || stale || full || proposedCount >= free}
                      onClick={() => {
                        setDraft({ ...draft, [key]: draft[key] + 1 });
                        setPreview(null);
                      }}
                    >
                      +
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
          <p>
            Entwurf: {proposedCount} Punkte; danach {free - proposedCount} frei.
            Kleine Boni retten wegen der Rundung nicht in jedem Kampf eine
            weitere Einheit. Niederlagen bleiben ohne Beute; Verteidigung kann
            Überlebende retten.
          </p>

          {!isMayor && (
            <p>
              Führung erhöht die Stadtproduktion erst bei Ernennung zum
              Bürgermeister.
            </p>
          )}
          <p role="status">{distribution.status}</p>
          <button
            type="button"
            className="secondary"
            disabled={busy || proposedCount === 0}
            onClick={() => {
              setDraft(emptyDraft());
              setPreview(null);
            }}
          >
            Entwurf verwerfen
          </button>
          {distribution.preview && (
            <div className="notice">
              <p>
                Bestätigte Vorschau: Führung{" "}
                {distribution.preview.effectiveAttributes.leadership}, Angriff +
                {distribution.preview.combatBonuses.attackPercent} %,
                Verteidigung −
                {distribution.preview.combatBonuses.defensePercent} %.{" "}
                {proposedCount} freie Punkte werden dauerhaft zugewiesen.
              </p>
              <button
                type="button"
                disabled={busy || stale}
                onClick={() => save("distribute")}
              >
                Unwiderruflich verteilen
              </button>
            </div>
          )}
        </section>
      </section>
    </Dialog>
  );
}
