import { usePreview, previewVersion } from "./usePreview.js";
import { useRef } from "react";
import { ResearchArt } from "./ResearchArt.jsx";
import { Fragment, useCallback, useState } from "react";
import {
  ActionButton,
  BuildingArt,
  Dialog,
  formatDuration,
  quoteText,
} from "./ui.jsx";

export function ResearchView({
  state,
  transport,
  initialUniversity,
  initialTechnology,
}) {
  const [universityId, setUniversityId] = useState(initialUniversity ?? "");
  const [technology, setTechnology] = useState(initialTechnology ?? null);
  const [planning, setPlanning] = useState(false);
  const sending = useRef(false);
  const [pending, setLoading] = useState(false);
  const loading = pending || transport.getSnapshot().status !== "connected";
  const [error, setError] = useState("");
  const universities = state.city.buildingSlots.filter(
    (slot) => slot.building === "university" && slot.level > 0,
  );
  const selected =
    universities.find((slot) => slot.buildingId === universityId) ??
    universities[0];
  const active = state.city.research.active;
  const chosen = state.researchOffers.find(
    (offer) => offer.technology === technology,
  );
  const chosenUniversity = chosen?.universities.find(
    (u) => u.universityId === selected?.buildingId,
  );
  const chosenReason =
    chosen?.nextLevel == null
      ? "Maximale Stufe erreicht."
      : (chosenUniversity?.reason ?? chosen?.reason);
  const { preview, status, invalidate } = usePreview(
    transport,
    "research.preview",
    {
      universityId: selected?.buildingId,
      technology,
      targetLevel: chosen?.nextLevel,
      rulesetVersion: state.researchRules.version,
    },
    previewVersion(state),
    planning && !!selected && !!chosen && !chosenReason,
  );
  const close = useCallback(() => {
    if (!loading) setPlanning(false);
  }, [loading]);
  const confirm = async () => {
    if (sending.current || !preview) return;
    sending.current = true;
    setLoading(true);
    setError("");
    try {
      await transport.request("research.start", {
        universityId: preview.universityId,
        technology: preview.technology,
        targetLevel: preview.targetLevel,
        expectedUniversityLevel: preview.expectedUniversityLevel,
        rulesetVersion: preview.rulesetVersion,
        researcher: preview.researcher,
        effectRules: preview.effectRules,
      });
      setPlanning(false);
      invalidate();
    } catch (cause) {
      invalidate();
      setError(`${cause.message} Bitte das aktuelle Angebot erneut prüfen.`);
    } finally {
      sending.current = false;
      setLoading(false);
    }
  };
  return (
    <section className="research-view" aria-labelledby="research-heading">
      <h2 id="research-heading" className="research-title">
        Forschung · Spielerweites Wissen
      </h2>
      <p>
        Zahlende Stadt und Forschungsort: {state.city.name}. Eine gemeinsame
        Forschung für alle Städte.
      </p>
      {active && (
        <p role="status">
          Läuft: {state.technologies[active.technology].label} Stufe{" "}
          {active.targetLevel} ·{" "}
          {state.cities.find((c) => c.id === active.cityId)?.name} ·{" "}
          {formatDuration(Math.max(0, active.finishesAt - state.serverTime))}{" "}
          verbleibend. Abschluss durch den Server.
        </p>
      )}
      <section className="card">
        <h3>Forschungsleitung</h3>
        <p>
          {state.researcher.generalName ?? "Keine Forschungsleitung"} · Führung{" "}
          {state.researcher.leadership} · Geschwindigkeit +
          {state.researcher.bonusPercent} %
        </p>
        <label>
          General
          <select
            aria-label="General"
            value={state.military.researcherGeneralId ?? ""}
            disabled={Boolean(active) || loading || !universities.length}
            onChange={async (e) => {
              const generalId = e.target.value || null;
              setLoading(true);
              setError("");
              try {
                await transport.request("general.researcher", {
                  generalId,
                  expectedRoleVersion: state.military.roleVersion,
                });
                invalidate();
              } catch (cause) {
                setError(cause.message);
              } finally {
                setLoading(false);
              }
            }}
          >
            <option value="">Ohne Forschungsleitung</option>
            {state.military.generals
              .filter(
                (g) =>
                  (g.status === "idle" && g.cityId === state.cityId) ||
                  g.id === state.military.researcherGeneralId,
              )
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </select>
        </label>
        {active && (
          <p>
            Während der Forschung ist das Amt gesperrt. Gespeichert:{" "}
            {active.researcher?.generalName ?? "ohne General"} · Geschwindigkeit
            +{active.researcher?.bonusPercent ?? 0} %. Nach Abschluss bleibt die
            Leitung im Amt.
          </p>
        )}
      </section>
      <section className="card research-controls">
        <BuildingArt type="university" level={selected?.level ?? 1} />
        <div className="research-university">
          {universities.length ? (
            <label>
              Universität
              <select
                aria-label="Universität"
                value={selected.buildingId}
                onChange={(event) => {
                  setUniversityId(event.target.value);
                  invalidate();
                }}
              >
                {universities.map((slot) => (
                  <option key={slot.buildingId} value={slot.buildingId}>
                    Grundstück {slot.id.split("-").at(-1)} · Universität Stufe{" "}
                    {slot.level}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="notice">
              Errichte zuerst eine Universität auf einem freien Stadtgrundstück.
            </p>
          )}
        </div>
        <details className="research-help">
          <summary>Forschungsregeln</summary>
          <p>
            Abgeschlossene Erkenntnisse wirken dauerhaft in allen eigenen
            Städten, auch nach einem Universitätsabriss. Wirtschafts- und
            Lagerforschung geben je Stufe +5 %. Ölverarbeitung und Motorisierung
            schalten Inhalte frei. Eine Forschung gleichzeitig; keine
            Warteschlange und kein Abbruch.
          </p>
        </details>
      </section>
      <div className="research-grid">
        {state.researchOffers
          .toSorted((a, b) => a.category.localeCompare(b.category))
          .map((offer, index, offers) => {
            const university = offer.universities.find(
              (item) => item.universityId === selected?.buildingId,
            );
            const reason =
              offer.nextLevel == null
                ? "Maximale Stufe erreicht."
                : (university?.reason ?? offer.reason);
            return (
              <Fragment key={offer.technology}>
                {offers[index - 1]?.category !== offer.category && (
                  <h3 className="research-group">{offer.category}</h3>
                )}
                <section
                  className={`card research-card${technology === offer.technology ? " selected-technology" : ""}`}
                  key={offer.technology}
                >
                  <div className="research-card-heading">
                    <ResearchArt
                      technology={offer.technology}
                      label={offer.label}
                    />
                    <div>
                      <span className="kicker">
                        {offer.kind === "unlock"
                          ? "FREISCHALTUNG"
                          : offer.kind === "capacity"
                            ? "LAGERKAPAZITÄT"
                            : offer.kind === "production"
                              ? "PRODUKTION"
                              : offer.kind === "cargo"
                                ? "TRAGLAST"
                                : "GESCHWINDIGKEIT"}
                      </span>
                      <h3>{offer.label}</h3>
                      <strong>
                        Stufe {offer.level} / {offer.maxLevel}
                        {offer.kind !== "unlock" &&
                          ` · +${Math.round(offer.level * offer.bonusPerLevel * 100)} %`}
                      </strong>
                      <p>
                        {active?.technology === offer.technology
                          ? "Läuft"
                          : offer.nextLevel == null
                            ? "Maximal"
                            : reason
                              ? "Gesperrt"
                              : "Verfügbar"}
                      </p>
                    </div>
                  </div>
                  <div className="research-card-content">
                    {offer.nextLevel != null && (
                      <p>
                        Nächste Stufe {offer.nextLevel}:{" "}
                        {offer.kind === "unlock"
                          ? `schaltet ${offer.unlocks.map((k) => state.buildings[k]?.label ?? state.units[k]?.label).join(", ")} frei`
                          : `+${Math.round(offer.nextLevel * offer.bonusPerLevel * 100)} % insgesamt`}
                        . Benötigt Universität Stufe{" "}
                        {offer.requiredUniversity ?? offer.universityLevel}.
                      </p>
                    )}
                    <details className="research-details">
                      <summary>
                        <span>Beschreibung &amp; Voraussetzungen</span>
                        <svg
                          className="research-caret"
                          viewBox="0 0 24 24"
                          width="20"
                          height="20"
                          aria-hidden="true"
                        >
                          <path
                            d="m9 5 7 7-7 7"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </summary>
                      <div className="research-details-content">
                        {offer.nextLevel != null && (
                          <>
                            <p>
                              {offer.kind === "unlock"
                                ? `Schaltet ${offer.unlocks.map((key) => state.buildings[key]?.label ?? state.units[key]?.label).join(", ")} frei. Universität ${offer.universityLevel}; ${Object.entries(
                                    offer.prerequisites,
                                  )
                                    .map(
                                      ([key, value]) =>
                                        `${state.technologies[key].label} ${value}`,
                                    )
                                    .join(", ")}`
                                : `Nächste Stufe ${offer.nextLevel}: +${Math.round(offer.nextLevel * offer.bonusPerLevel * 100)} % insgesamt · Universität mindestens Stufe ${offer.requiredUniversity}.`}
                            </p>
                            <p>
                              {offer.nextCost.wood} Holz ·{" "}
                              {offer.nextCost.stone} Stein
                              {university?.quote &&
                                ` · ${formatDuration(university.quote.durationMs)}`}
                            </p>
                          </>
                        )}
                        {Object.keys(offer.prerequisites).length > 0 && (
                          <p>
                            Voraussetzungen:{" "}
                            {Object.entries(offer.prerequisites)
                              .map(
                                ([id, l]) =>
                                  `${state.technologies[id].label} ${l}`,
                              )
                              .join(", ")}
                          </p>
                        )}
                        {offer.reasons.map((r, i) => (
                          <p key={i}>{r.message}</p>
                        ))}
                        {["constructionSpeed", "trainingSpeed"].includes(
                          offer.kind,
                        ) && (
                          <p>
                            Geschwindigkeit jetzt +
                            {Math.round((offer.factor - 1) * 100)} %;
                            Zeitersparnis{" "}
                            {Math.round((1 - 1 / offer.factor) * 1000) / 10} %.
                          </p>
                        )}
                      </div>
                    </details>
                    <ActionButton
                      label="Forschen"
                      detail={
                        reason ??
                        `${offer.nextCost?.wood} Holz · ${offer.nextCost?.stone} Stein · ${university?.quote ? formatDuration(university.quote.durationMs) : "Universität fehlt"}`
                      }
                      disabled={loading || Boolean(reason) || !selected}
                      onClick={() => {
                        setTechnology(offer.technology);
                        setPlanning(true);
                        invalidate();
                      }}
                    />
                  </div>
                </section>
              </Fragment>
            );
          })}
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {planning && (
        <Dialog
          open
          kicker="FORSCHUNG BESTÄTIGEN"
          title={`${chosen.label} · ${state.city.name}`}
          onClose={close}
          actions={
            <button disabled={loading || !preview} onClick={confirm}>
              {loading ? "Wird gespeichert …" : "Kosten bezahlen und starten"}
            </button>
          }
        >
          <p role="status">{status}</p>
          {error && <p role="alert">{error}</p>}
          {preview && (
            <>
              <p>
                {quoteText(preview)} · Universität Stufe{" "}
                {preview.expectedUniversityLevel}
              </p>
              <p>
                {state.technologies[preview.technology].kind === "unlock"
                  ? "Neue Gebäude/Einheiten ab Abschluss freigeschaltet."
                  : "Wirkung ab Abschluss in allen eigenen Städten; neue Aufträge nutzen die gespeicherten Regeln."}
              </p>
              {state.technologies[preview.technology].kind !== "unlock" && (
                <p>
                  Bonus: +{Math.round((preview.factorBefore - 1) * 100)} % → +
                  {Math.round((preview.factorAfter - 1) * 100)} %.
                </p>
              )}
              <p>
                Forschung füllt keine Vorräte auf. Kein Abbruch oder
                Rückerstattung.
              </p>
              <p>
                {preview.researcher.generalName ?? "Ohne General"} · Führung{" "}
                {preview.researcher.leadership} · Geschwindigkeit +
                {preview.researcher.bonusPercent} %. Ohne General{" "}
                {formatDuration(preview.durationWithoutGeneralMs)}, tatsächlich{" "}
                {formatDuration(preview.durationMs)}.
              </p>
            </>
          )}
        </Dialog>
      )}
    </section>
  );
}
