import { useDraft } from "./Drafts.jsx";
import { usePreview, previewVersion } from "./usePreview.js";
import { useRef } from "react";
import { LoadingResearch } from "./LoadingResearch.jsx";
import { useCallback, useState } from "react";
import { ActionButton, GameArt, Dialog } from "./ui.jsx";
import { IsometricMap } from "./IsometricMap.jsx";

const terrainLabels = {
  plains: "Ebene",
  forest: "Wald",
  hills: "Hügel",
  water: "Wasser",
};
export function WorldView({
  state,
  map,
  details,
  transport,
  onCity,
  onLogistics,
  onMessage,
  focusCoordinates,
}) {
  const [scouting, setScouting] = useState(null),
    [raiding, setRaiding] = useState(null);
  return (
    <section
      className="world-view iso-world-view"
      aria-labelledby="world-heading"
    >
      <IsometricMap
        map={map}
        cityId={state.cityId}
        transport={transport}
        selection={details}
        focusCoordinates={focusCoordinates}
      />
      {details && (
        <div className="map-sidebar" aria-label="Ausgewähltes Feld">
          <button onClick={() => transport.setMapDetails(null)}>
            Feldauswahl schließen
          </button>
          <MapDetails
            selection={details}
            state={state}
            onScout={setScouting}
            onRaid={setRaiding}
            onCity={onCity}
            onLogistics={onLogistics}
            onMessage={onMessage}
          />
          <FieldActions
            key={`${state.cityId}-${details?.terrain?.x}-${details?.terrain?.y}`}
            selection={details}
            state={state}
            transport={transport}
          />
          <section className="card legend">
            <h3>Legende</h3>
            <span>★ Eigene befestigte Stadt</span>
            <span>◆ Spielerstadt / Handelsort</span>
            <span>⬟ NPC-Festung</span>
            <span>⚑ Reserviertes Feld</span>
            <small>
              Windrose: kurz klicken oder gedrückt halten. Maßstab und Auswahl
              bleiben erhalten.
            </small>
          </section>
        </div>
      )}
      <ScoutingDialog
        key={scouting?.id ?? "scout-closed"}
        target={scouting}
        state={state}
        transport={transport}
        onClose={() => setScouting(null)}
      />
      <RaidDialog
        key={raiding?.id ?? "raid-closed"}
        target={raiding}
        state={state}
        transport={transport}
        onClose={() => setRaiding(null)}
      />
    </section>
  );
}
function MapDetails({
  selection,
  state,
  onScout,
  onRaid,
  onCity,
  onLogistics,
  onMessage,
}) {
  if (!selection)
    return (
      <section className="card">
        <p>Wähle ein Feld oder eine Stadt.</p>
      </section>
    );
  const { entity, terrain } = selection;
  const distance = Number.isFinite(entity?.distance) ? entity.distance : 0;
  const general = state.military.generals.find(
    (item) => item.status === "idle" && item.cityId === state.cityId,
  );
  const scouts = state.military.units.scout;
  return (
    <section className="card has-selection" tabIndex="-1" aria-live="polite">
      <span className="kicker">
        KOORDINATE {terrain.x}, {terrain.y}
      </span>
      {entity && <GameArt type="town" label={entity.name} />}
      <h2>{entity?.name ?? "Unbebautes Feld"}</h2>
      <p>Gelände: {terrainLabels[terrain.type]}</p>
      {entity && (
        <>
          {
            <p>
              {entity.type === "claim"
                ? "Reserviertes Feld"
                : entity.type === "npc"
                  ? `NPC-Stadt · Schwierigkeit ${entity.difficulty}`
                  : `${entity.type === "own-city" ? "Eigene Stadt" : "Spielerstadt"} · ${entity.commanderName}`}
            </p>
          }
          <p>Entfernung: {distance.toFixed(2)} Felder Luftlinie</p>
          {entity.type !== "own-city" && (
            <p className="notice">
              Ressourcen, Garnison und Verteidigung: Aufklärung erforderlich.
            </p>
          )}
          {entity.type === "npc" && (
            <ActionButton
              label="Stadt ausspähen"
              detail={
                !general
                  ? "Kein freier General"
                  : scouts < 1
                    ? "Zuerst Späher ausbilden"
                    : `Hinweg ca. ${Math.max(5, Math.ceil(distance) * 5)} s`
              }
              disabled={!general || scouts < 1}
              onClick={() => onScout(entity)}
            />
          )}{" "}
          {entity.type === "npc" && (
            <ActionButton
              label="NPC angreifen"
              detail={
                !general
                  ? "Kein freier General"
                  : state.military.units.infantry < 1
                    ? "Zuerst Infanterie ausbilden"
                    : "Vorläufige PvE-Regeln · Verluste möglich"
              }
              disabled={!general || state.military.units.infantry < 1}
              onClick={() => onRaid(entity)}
            />
          )}{" "}
          {["own-city", "player-city"].includes(entity.type) && (
            <div className="map-city-actions">
              {entity.type === "own-city" && (
                <button onClick={() => onCity(entity.id)}>Stadt öffnen</button>
              )}
              <button
                disabled={entity.id === state.cityId}
                onClick={() =>
                  onLogistics({
                    mode: "delivery",
                    targetCityId: entity.id,
                    originCityId: state.cityId,
                  })
                }
              >
                Lieferung planen
              </button>
              {entity.type === "own-city" && (
                <button
                  disabled={entity.id === state.cityId}
                  onClick={() =>
                    onLogistics({
                      mode: "transfer",
                      targetCityId: entity.id,
                      originCityId: state.cityId,
                    })
                  }
                >
                  Verlegung planen
                </button>
              )}
              {entity.type === "player-city" && (
                <button onClick={() => onMessage(entity.commanderName)}>
                  Nachricht schreiben
                </button>
              )}
            </div>
          )}
          {entity.type === "player-city" && (
            <p className="notice">
              Spielerstädte können noch nicht ausgespäht werden.
            </p>
          )}
        </>
      )}
    </section>
  );
}
function ScoutingDialog(props) {
  return <MissionDialog {...props} type="scout" />;
}
function RaidDialog(props) {
  return <MissionDialog {...props} type="raid" />;
}
function MissionDialog({ target, state, transport, onClose, type }) {
  const [generalId, setGeneralId] = useState(
    state.military.generals.find(
      (g) => g.status === "idle" && g.cityId === state.cityId,
    )?.id ?? "",
  );
  const [infantry, setInfantry] = useState(1);
  const [trucks, setTrucks] = useState(0);
  const [delayMinutes, setDelayMinutes] = useState(0);
  const [scouts, setScouts] = useState(1);
  const [cargo, setCargo] = useState({ wood: 0, stone: 0, food: 0, oil: 0 });
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const payload = {
    targetId: target?.id,
    generalId,
    ...(type === "raid"
      ? { units: { infantry, truck: trucks }, delayMinutes, cargo }
      : { scouts }),
  };
  const { preview, status, invalidate } = usePreview(
    transport,
    type === "raid" ? "raid.preview" : "scouting.preview",
    payload,
    previewVersion(state),
    !!target && !!generalId && (type === "raid" ? infantry > 0 : scouts > 0),
  );
  const confirm = async () => {
    if (sending.current || !preview) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await transport.request(
        type === "raid" ? "raid.start" : "scouting.start",
        { ...payload, preview },
      );
      onClose();
    } catch (cause) {
      invalidate();
      setError(`${cause.message} Bitte erneut prüfen.`);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const edit = (setter) => (event) => {
    setter(
      event.target.type === "number"
        ? Number(event.target.value)
        : event.target.value,
    );
    invalidate();
  };
  const initial = useRef({ generalId, infantry, scouts, trucks, delayMinutes });
  const dirty =
    Object.entries({ generalId, infantry, scouts, trucks, delayMinutes }).some(
      ([k, v]) => v !== initial.current[k],
    ) || Object.values(cargo).some(Boolean);
  useDraft(!!target && dirty);
  if (!target) return null;
  return (
    <Dialog
      open
      title={
        type === "raid" ? "Gemischten Farmzug planen" : "Aufklärung planen"
      }
      kicker="EINSATZ"
      dirty={dirty}
      onClose={() => {
        if (!busy) onClose();
      }}
      actions={
        <>
          <button disabled={busy || !preview} onClick={confirm}>
            Öl bezahlen und starten
          </button>
        </>
      }
    >
      <div data-draft>
        <p>Ausgangsstadt: {state.city.name}</p>
        <p role="status">{status}</p>
        <p>
          {target.name} · Koordinate {target.x}, {target.y}
        </p>
        <label>
          General
          <select
            aria-label="General"
            disabled={busy}
            value={generalId}
            onChange={edit(setGeneralId)}
          >
            {state.military.generals.map((g) => (
              <option
                key={g.id}
                value={g.id}
                disabled={g.status !== "idle" || g.cityId !== state.cityId}
              >
                {g.name} ·{" "}
                {g.status === "idle" && g.cityId === state.cityId
                  ? "frei"
                  : "gebunden"}
              </option>
            ))}
          </select>
        </label>
        {type === "raid" ? (
          <>
            <label>
              Infanterie
              <input
                disabled={busy}
                type="number"
                min="1"
                max={state.military.units.infantry}
                value={infantry}
                onChange={edit(setInfantry)}
              />
            </label>
            <label>
              LKW
              <input
                disabled={busy}
                type="number"
                min="0"
                max={state.military.units.truck}
                value={trucks}
                onChange={edit(setTrucks)}
              />
            </label>
            <label>
              Zusätzliche Ankunftsverzögerung (Minuten)
              <input
                disabled={busy}
                type="number"
                min="0"
                max={state.logisticsRules.maxAttackDelayMinutes}
                step="1"
                value={delayMinutes}
                onChange={edit(setDelayMinutes)}
              />
            </label>
            <p>
              LKWs erhöhen die Traglast, geben keine Kampfkraft und können im
              Kampf verloren gehen. Starttraglast ist keine garantierte Beute.
              Infanterie begleitet den Angriff.
            </p>
          </>
        ) : (
          <label>
            Späher
            <input
              disabled={busy}
              type="number"
              min="1"
              max={state.military.units.scout}
              value={scouts}
              onChange={edit(setScouts)}
            />
          </label>
        )}
        {type === "raid" && (
          <fieldset className="cargo-inputs">
            <legend>Eigene Ressourcenladung</legend>
            {Object.entries({
              wood: "Holz",
              stone: "Stein",
              food: "Nahrung",
              oil: "Öl (freiwillige Ladung)",
            }).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  disabled={busy}
                  type="number"
                  min="0"
                  step="1"
                  max={Math.floor(state.city.resources[key])}
                  value={cargo[key]}
                  onChange={(event) => {
                    setCargo({ ...cargo, [key]: Number(event.target.value) });
                    invalidate();
                  }}
                />
              </label>
            ))}
            <p>
              Alle Güter wiegen je einen Platz. Eigene Ladung kehrt zurück;
              mitgenommene Nahrung wird unterwegs nicht verbraucht. Betriebsöl
              benötigt zusätzlich Platz und wird verbrannt.
            </p>
          </fieldset>
        )}
        {type === "scout" && (
          <p>
            Späher tragen keine Güter oder Beute. Ihre separaten Tanks fassen{" "}
            {state.logisticsRules.scoutFuelCapacity} Betriebsöl je Späher.
          </p>
        )}
        <p>
          Maximal {state.militaryRules.maxMissionUnits} Einheiten insgesamt.
          Kein Führungslimit. Unterwegs verbrauchen Truppen keine Nahrung aus
          der Stadt. Sie verlassen die Stadt sofort, auch bei zusätzlicher
          Verzögerung. Öl für Hin- und Rückweg wird beim Start einmalig bezahlt.
          Bei Ölmangel zuerst Ölverarbeitung erforschen und eine Raffinerie
          bauen.
        </p>
        {preview && (
          <div className="mission-preview">
            <LoadingResearch preview={preview} />
            <strong>
              {type === "raid"
                ? `Gemeinsame Traglast vor Verlusten: ${preview.capacity}`
                : `Tankkapazität: ${preview.tankCapacity}`}
            </strong>
            <span>
              Eigene Ladung: {preview.ownCargoAmount} · Betriebsöl geladen:{" "}
              {preview.totalOil} · Startbelegung: {preview.startOccupancy} ·
              freie Startplätze: {preview.freeStartCapacity}
            </span>
            <span>
              Hinwegverbrauch einschließlich Rundungsrest:{" "}
              {preview.outboundConsumption} · Rückwegreserve:{" "}
              {preview.returnReserve}
            </span>
            {type === "raid" && (
              <span>
                Prognose ohne Kampfverluste: maximal{" "}
                {preview.projectedLootCapacity} zusätzliche Nahrung am Ziel.
                Eigene Ladung und Rückwegöl haben Vorrang; tatsächliche Beute
                hängt auch vom NPC-Bestand ab.
              </span>
            )}
            <span>
              {preview.travelMs / 1000} s Grundhinreise + {preview.delayMinutes}{" "}
              zusätzliche Minuten = {preview.outboundTravelMs / 1000} s gesamte
              Hinreise · {preview.travelMs / 1000} s Rückweg ·{" "}
              {preview.distanceFields} Felder
            </span>
            <span>
              Öl: {preview.baseOil} Grundbedarf ({preview.normalOneWayOil} je
              Richtung) + {preview.delayOil} Verzögerungszuschlag · verlängerter
              Hinweg {preview.outboundOil}, Rückweg {preview.returnOil} ·
              einmalig aufgerundet {preview.totalOil}
            </span>
            <span>
              Stadtunterhalt:{" "}
              {preview.upkeepBeforePerHour.toLocaleString("de-DE")} →{" "}
              {preview.upkeepAfterPerHour.toLocaleString("de-DE")} Nahrung/h
            </span>
            <span>
              Voraussichtliche Ankunft:{" "}
              {new Date(preview.arrivesAt).toLocaleString("de-DE")} · Rückkehr:{" "}
              {new Date(preview.returnsAt).toLocaleString("de-DE")}. Termine
              verschieben sich mit dem tatsächlichen Start.
            </span>
            {type === "raid" && (
              <span>
                Gespeicherte Boni aus Grundwerten und Skills: Angriff +
                {preview.combatBonuses.attackPercent} % · Verteidigung −
                {preview.combatBonuses.defensePercent} %
              </span>
            )}
          </div>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}

function FieldActions({ selection, state, transport }) {
  const [dialog, setDialog] = useState(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const terrain = selection?.terrain;
  if (!terrain || terrain.type === "water") return null;
  const sameField = (item) =>
    item.coordinates?.x === terrain.x && item.coordinates?.y === terrain.y;
  const claim = state.claims?.find(
    (c) => c.x === terrain.x && c.y === terrain.y,
  );
  if (selection.entity && !claim) return null;
  const report = [...state.military.reports]
    .reverse()
    .find((r) => r.type === "field-scout" && sameField(r) && r.intelligence);
  const mission = state.fieldMissions?.find(sameField);
  const reservation =
    state.claims?.length ||
    state.fieldMissions?.some(
      (m) => m.type === "conquest" && m.status === "outbound",
    );
  const general = state.military.generals.some(
    (g) => g.status === "idle" && g.cityId === state.cityId,
  );
  const stale = report?.fieldCurrent === false;
  const limit = (state.cities?.length ?? 1) >= 5;
  const scoutReason = !general
    ? "Kein freier General in deinem Generalstab."
    : state.military.units.scout < 1
      ? "In der Ausgangsstadt fehlen Späher."
      : null;
  const conquestReason = limit
    ? "Du besitzt bereits fünf Städte."
    : reservation && !claim
      ? "Ein Eroberungszug oder Anspruch reserviert bereits deinen Stadtplatz."
      : !report
        ? "Zuerst aufklären und die Rückkehr des Berichts abwarten."
        : stale
          ? "Das Feld hat sich verändert. Erneut aufklären."
          : !general
            ? "Kein freier General verfügbar."
            : state.military.units.infantry < 1
              ? "In der Ausgangsstadt fehlt Infanterie."
              : null;
  return (
    <section className="card field-actions" aria-label="Feldaktionen">
      <ol className="field-steps" aria-label="Weg zur neuen Stadt">
        <li className={report ? "done" : "active"}>1 · Aufklären</li>
        <li className={claim ? "done" : report ? "active" : ""}>2 · Erobern</li>
        <li className={claim ? "active" : ""}>3 · Gründen</li>
      </ol>
      {claim ? (
        <>
          <h3>Das Feld gehört dir</h3>
          <p>
            Gründe hier deine nächste Stadt. Bezahlt wird aus{" "}
            <strong>
              {state.cities.find((c) => c.id === claim.originCityId)?.name}
            </strong>
            .
          </p>
          <p className="field-status">
            Noch{" "}
            {Math.max(
              0,
              Math.ceil((claim.expiresAt - state.serverTime) / 60000),
            )}{" "}
            Minuten Zeit.
          </p>
          <ActionButton
            label="Stadt gründen"
            detail="Name wählen und Gründungsgebühr prüfen"
            onClick={() => setDialog("found")}
          />
        </>
      ) : (
        <>
          <h3>{report ? "Aufgeklärtes Feld" : "Unbekannte Verteidigung"}</h3>
          {report ? (
            <div className={`field-intelligence${stale ? " stale" : ""}`}>
              <strong>
                {report.intelligence.defenders} Infanterie-Verteidiger
              </strong>
              <span>
                Beobachtung vom{" "}
                {new Date(
                  report.intelligence.capturedAt ?? report.returnedAt,
                ).toLocaleString("de-DE")}
              </span>
              <small>
                {stale
                  ? "Bericht veraltet · neue Aufklärung erforderlich"
                  : "Aufklärung abgeschlossen · bereit zur Einsatzplanung"}
              </small>
            </div>
          ) : (
            <p>
              Schicke Späher. Nach ihrer Rückkehr kennst du die Verteidigung und
              kannst deine Armee planen.
            </p>
          )}
          {mission && (
            <div className="field-status" role="status">
              <strong>
                {mission.type === "conquest" ? "Eroberungszug" : "Aufklärung"} ·{" "}
                {mission.status === "outbound" ? "Hinreise" : "Rückreise"}
              </strong>
              <span>
                {mission.status === "outbound" ? "Ankunft" : "Rückkehr"} in{" "}
                {Math.max(
                  0,
                  Math.ceil(
                    ((mission.status === "outbound"
                      ? mission.arrivesAt
                      : mission.returnsAt) -
                      state.serverTime) /
                      1000,
                  ),
                )}{" "}
                s
              </span>
              {mission.type === "field-scout" && (
                <small>Der Bericht wird erst bei Rückkehr freigegeben.</small>
              )}
              {mission.result && (
                <small>
                  {mission.result.cancelled
                    ? mission.result.reason
                    : mission.result.victory
                      ? "Sieg · dein Anspruch ist bereit zur Gründung."
                      : "Niederlage · Armee kehrt zurück. Erkunde die verbliebene Verteidigung erneut."}
                </small>
              )}
            </div>
          )}
          <ActionButton
            label={stale ? "Erneut aufklären" : "Feld aufklären"}
            detail={
              scoutReason ??
              "Späher und General wählen · Öl und Reisezeit prüfen"
            }
            disabled={Boolean(scoutReason)}
            onClick={() => setDialog("scout")}
          />
          <ActionButton
            label="Feld erobern"
            detail={
              conquestReason ?? "Armee zusammenstellen und Kampfprognose prüfen"
            }
            disabled={Boolean(conquestReason)}
            onClick={() => setDialog("conquest")}
          />
        </>
      )}
      <p className="field-footnote">
        {state.cities?.length ?? 1}/5 Städte · Die Armee kehrt zur Ausgangsstadt
        zurück.
      </p>
      {dialog && (dialog !== "found" || claim) && (
        <FieldDialog
          key={`${dialog}-${terrain.x}-${terrain.y}`}
          kind={dialog}
          terrain={terrain}
          report={report}
          claim={claim}
          state={state}
          transport={transport}
          onClose={closeDialog}
        />
      )}
    </section>
  );
}

function FieldDialog({
  kind,
  terrain,
  report,
  claim,
  state,
  transport,
  onClose,
}) {
  const conquest = kind === "conquest",
    founding = kind === "found";
  const [generalId, setGeneralId] = useState(
    state.military.generals.find(
      (g) => g.status === "idle" && g.cityId === state.cityId,
    )?.id ?? "",
  );
  const [infantry, setInfantry] = useState(
    Math.min(
      state.military.units.infantry,
      Math.max(1, (report?.intelligence.defenders ?? 0) + 1),
    ),
  );
  const [trucks, setTrucks] = useState(0),
    [scouts, setScouts] = useState(1),
    [delayMinutes, setDelayMinutes] = useState(0);
  const [cargo, setCargo] = useState({ wood: 0, stone: 0, food: 0, oil: 0 }),
    [name, setName] = useState("Neue Stadt");
  const sending = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const close = () => {
    if (!busy) onClose();
  };
  const payload = founding
    ? { claimId: claim?.id, name }
    : {
        x: terrain.x,
        y: terrain.y,
        generalId,
        ...(conquest
          ? {
              units: { infantry, truck: trucks },
              delayMinutes,
              cargo,
              reportId: report?.id,
            }
          : { scouts }),
      };
  const { preview, status, invalidate } = usePreview(
    transport,
    founding ? "city.found.preview" : `field.${kind}.preview`,
    payload,
    previewVersion(state),
    founding
      ? !!name.trim()
      : !!generalId && (conquest ? infantry > 0 : scouts > 0),
  );
  const confirm = async () => {
    if (sending.current || !preview) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await transport.request(founding ? "city.found" : `field.${kind}.start`, {
        ...payload,
        preview,
      });
      onClose();
    } catch (cause) {
      invalidate();
      setError(`${cause.message} Bitte erneut prüfen.`);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const edit = (setter) => (event) => {
    setter(
      event.target.type === "number"
        ? Number(event.target.value)
        : event.target.value,
    );
    invalidate();
  };
  const origin = state.cities?.find(
    (c) => c.id === (founding ? claim?.originCityId : state.cityId),
  );
  const title = founding
    ? "Neue Stadt gründen"
    : conquest
      ? "Feld erobern"
      : "Feld aufklären";
  const valid = founding
    ? Boolean(name.trim())
    : Boolean(generalId) &&
      (conquest
        ? Number.isSafeInteger(infantry) &&
          infantry > 0 &&
          infantry <= state.military.units.infantry &&
          Number.isSafeInteger(trucks) &&
          trucks >= 0 &&
          trucks <= state.military.units.truck
        : Number.isSafeInteger(scouts) &&
          scouts > 0 &&
          scouts <= state.military.units.scout);
  const initial = useRef({
    generalId,
    infantry,
    scouts,
    trucks,
    delayMinutes,
    name,
  });
  const dirty =
    Object.entries({
      generalId,
      infantry,
      scouts,
      trucks,
      delayMinutes,
      name,
    }).some(([k, v]) => v !== initial.current[k]) ||
    Object.values(cargo).some(Boolean);
  useDraft(dirty);
  const feeAvailable =
    !founding ||
    !preview ||
    Object.entries(preview.cost).every(
      ([key, amount]) => origin?.resources[key] >= amount,
    );
  return (
    <Dialog
      open
      className="field-dialog"
      kicker={founding ? "STADTGRÜNDUNG" : "FELDEINSATZ"}
      title={title}
      dirty={dirty}
      onClose={close}
      actions={
        <>
          <button
            disabled={busy || !preview || !feeAvailable}
            onClick={confirm}
          >
            {founding
              ? "Gebühr bezahlen und gründen"
              : conquest
                ? preview?.combatForecast?.victory === false
                  ? "Trotz Risiko angreifen"
                  : "Eroberung starten"
                : "Aufklärung starten"}
          </button>
        </>
      }
    >
      <div data-draft>
        <p role="status">{status}</p>
        <div className="field-dialog-target">
          <GameArt type={founding ? "town" : conquest ? "infantry" : "scout"} />
          <div>
            <strong>
              Feld {terrain.x}, {terrain.y}
            </strong>
            <span>
              {terrainLabels[terrain.type]} · Ausgangsstadt{" "}
              {origin?.name ?? state.city.name}
            </span>
            {conquest && (
              <span>
                {report.intelligence.defenders} beobachtete Verteidiger
              </span>
            )}
          </div>
        </div>
        {founding ? (
          <>
            <label>
              Stadtname
              <input disabled={busy} value={name} onChange={edit(setName)} />
            </label>
            <p>
              Die neue Stadt beginnt mit Sägewerk, Steinbruch und Bauernhof.
              Deine Armee kehrt weiterhin zur Ausgangsstadt zurück.
            </p>
          </>
        ) : (
          <>
            <label>
              General
              <select
                aria-label="General"
                disabled={busy}
                value={generalId}
                onChange={edit(setGeneralId)}
              >
                <option value="" disabled>
                  Freien General auswählen
                </option>
                {state.military.generals.map((g) => (
                  <option
                    key={g.id}
                    value={g.id}
                    disabled={g.status !== "idle" || g.cityId !== state.cityId}
                  >
                    {g.name} ·{" "}
                    {g.status === "idle" && g.cityId === state.cityId
                      ? "frei"
                      : "gebunden"}
                  </option>
                ))}
              </select>
            </label>
            {conquest ? (
              <>
                <div className="field-unit-inputs">
                  <label>
                    Infanterie · {state.military.units.infantry} verfügbar
                    <input
                      type="number"
                      disabled={busy}
                      min="1"
                      max={state.military.units.infantry}
                      step="1"
                      value={infantry}
                      onChange={edit(setInfantry)}
                    />
                  </label>
                  <label>
                    LKW · {state.military.units.truck} verfügbar
                    <input
                      type="number"
                      disabled={busy}
                      min="0"
                      max={state.military.units.truck}
                      step="1"
                      value={trucks}
                      onChange={edit(setTrucks)}
                    />
                  </label>
                </div>
                <p>
                  Infanterie kämpft, LKWs transportieren. Keine Ressourcenbeute.
                </p>
                <details className="field-options">
                  <summary>Zusätzliche Verzögerung und eigene Ladung</summary>
                  <label>
                    Zusätzliche Verzögerung (Minuten)
                    <input
                      disabled={busy}
                      type="number"
                      min="0"
                      max={state.logisticsRules.maxAttackDelayMinutes}
                      step="1"
                      value={delayMinutes}
                      onChange={edit(setDelayMinutes)}
                    />
                  </label>
                  <fieldset className="cargo-inputs">
                    <legend>Eigene Ressourcenladung · kehrt zurück</legend>
                    {Object.entries({
                      wood: "Holz",
                      stone: "Stein",
                      food: "Nahrung",
                      oil: "Freiwilliges Öl",
                    }).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          disabled={busy}
                          type="number"
                          min="0"
                          max={Math.floor(state.city.resources[key])}
                          step="1"
                          value={cargo[key]}
                          onChange={(e) => {
                            setCargo({
                              ...cargo,
                              [key]: Number(e.target.value),
                            });
                            invalidate();
                          }}
                        />
                      </label>
                    ))}
                  </fieldset>
                </details>
              </>
            ) : (
              <>
                <label>
                  Späher · {state.military.units.scout} verfügbar
                  <input
                    disabled={busy}
                    type="number"
                    min="1"
                    max={state.military.units.scout}
                    step="1"
                    value={scouts}
                    onChange={edit(setScouts)}
                  />
                </label>
                <p>
                  Der Bericht erscheint nach der Rückkehr. Späher benötigen
                  Betriebsöl und tragen keine Ressourcen.
                </p>
              </>
            )}
          </>
        )}
        {preview && (
          <section
            className="field-preview"
            aria-label="Verbindliche Einsatzvorschau"
          >
            {founding ? (
              <>
                <h3>Gründungsgebühr</h3>
                <div className="field-preview-facts">
                  {Object.entries(preview.cost).map(([key, amount]) => (
                    <div key={key}>
                      <span>
                        {{ wood: "Holz", stone: "Stein", food: "Nahrung" }[key]}
                      </span>
                      <strong>{amount}</strong>
                    </div>
                  ))}
                </div>
                <p>
                  Zahlung aus {origin?.name}. Dein Anspruch bleibt bei fehlenden
                  Rohstoffen bestehen.
                </p>
                {!feeAvailable && (
                  <p className="notice" role="alert">
                    In der Ausgangsstadt fehlen Rohstoffe für die Gebühr.
                  </p>
                )}
              </>
            ) : (
              <>
                {preview.combatForecast && (
                  <div
                    className={`field-combat ${preview.combatForecast.victory ? "victory" : "defeat"}`}
                    role="status"
                  >
                    <strong>
                      {preview.combatForecast.victory
                        ? "Sieg erwartet"
                        : "Niederlage erwartet"}
                    </strong>
                    <span>
                      Voraussichtlich {preview.combatForecast.survivors}{" "}
                      überlebende Infanteristen ·{" "}
                      {preview.combatForecast.attackerLosses}{" "}
                      Infanterieverluste.
                    </span>
                    <small>
                      Prognose aus deiner Aufklärung. Andere Spieler können das
                      Feld bis zur Ankunft verändern.
                    </small>
                  </div>
                )}
                <div className="field-preview-facts">
                  <div>
                    <span>Betriebsöl · einmalig</span>
                    <strong>{preview.totalOil}</strong>
                  </div>
                  <div>
                    <span>Hinreise</span>
                    <strong>
                      {Math.ceil(preview.outboundTravelMs / 1000)} s
                    </strong>
                  </div>
                  <div>
                    <span>Rückreise</span>
                    <strong>{Math.ceil(preview.travelMs / 1000)} s</strong>
                  </div>
                </div>
                <p>
                  Hinwegverbrauch {preview.outboundConsumption} Öl ·
                  Rückwegreserve {preview.returnReserve} Öl.
                </p>
                {conquest ? (
                  <>
                    <LoadingResearch preview={preview} />
                    <progress
                      aria-label="Transportbelegung"
                      max={preview.capacity}
                      value={preview.startOccupancy}
                    />
                    <p>
                      Belegung {preview.startOccupancy}/{preview.capacity} ·
                      eigene Ladung {preview.ownCargoAmount} · freier Platz{" "}
                      {preview.freeStartCapacity}.
                    </p>
                    <p>
                      Bei einem Sieg reservierst du das Feld. Danach gründest du
                      gegen Gebühr eine Stadt.
                    </p>
                  </>
                ) : (
                  <p>
                    Betriebsöltanks: {preview.totalOil}/{preview.tankCapacity}{" "}
                    belegt.
                  </p>
                )}
              </>
            )}
          </section>
        )}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
