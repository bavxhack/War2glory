import { useRef, useState } from "react";
import { usePreview, previewVersion } from "./usePreview.js";
import { useDraft } from "./Drafts.jsx";
import { GeneralPortrait } from "./GeneralPortrait.jsx";
import { Dialog, formatDuration } from "./ui.jsx";
export function Recruitment({ state, transport, onSelect }) {
  const [candidate, setCandidate] = useState(null),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [recruited, setRecruited] = useState(null),
    sending = useRef(false);
  const pool = state.military.candidatePool,
    offer = state.recruitment;
  const { preview, status, invalidate } = usePreview(
    transport,
    "general.recruit.preview",
    { candidateId: candidate?.id },
    [
      previewVersion(state),
      pool?.id,
      pool?.state,
      state.military.acquiredCount,
    ],
    !!candidate,
  );
  useDraft(!!candidate && name !== candidate.name);
  async function confirm() {
    if (sending.current || !preview) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await transport.request("general.recruit", {
        ...preview,
        name,
      });
      setCandidate(null);
      setRecruited(result.generalId);
      setError("General wurde verpflichtet.");
    } catch (e) {
      setError(e.message);
      invalidate();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Rekrutierung · {state.city.name}</h2>
      <p>
        {state.military.generals.length}/{state.officerRules.maxCount} Generäle
        · Preisstufe {state.military.acquiredCount}: {offer.cost?.wood} Holz /{" "}
        {offer.cost?.stone} Stein. Nächster Erwerb {offer.nextCost?.wood} Holz /{" "}
        {offer.nextCost?.stone} Stein.
      </p>
      {offer.reason && <p>{offer.reason}</p>}
      {pool ? (
        <>
          <p>
            Neue Auswahl in {formatDuration(pool.expiresAt - state.serverTime)}
          </p>
          <div className="general-grid">
            {pool.candidates.map((c) => (
              <article className="card" key={c.id}>
                <GeneralPortrait portraitId={c.portraitId} name={c.name} />
                <h3>
                  {c.name} · {c.profile}
                </h3>
                <p>
                  Führung {c.attributes.leadership} · Angriff{" "}
                  {c.attributes.attack} · Verteidigung {c.attributes.defense}
                </p>
                <button
                  disabled={
                    !!offer.reason ||
                    pool.state !== "open" ||
                    state.serverTime >= pool.expiresAt
                  }
                  onClick={() => {
                    setCandidate(c);
                    setName(c.name);
                    setError("");
                  }}
                >
                  Verpflichten · {c.name}
                </button>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p>Eine fertige Kaserne eröffnet die Bewerberauswahl.</p>
      )}
      {error && <p role="status">{error}</p>}
      {recruited && (
        <button onClick={() => onSelect(recruited)}>General öffnen</button>
      )}
      {candidate && (
        <Dialog
          open
          title={`General verpflichten · ${state.city.name}`}
          kicker="REKRUTIERUNG"
          dirty={name !== candidate.name}
          onClose={() => !busy && setCandidate(null)}
          actions={
            <button
              disabled={busy || !preview || !name.trim()}
              onClick={confirm}
            >
              Für {preview?.cost.wood ?? "…"} Holz /{" "}
              {preview?.cost.stone ?? "…"} Stein verpflichten
            </button>
          }
        >
          <p role="status">{status}</p>
          <h3>
            {candidate.name} · {candidate.profile}
          </h3>
          <p>
            Führung {candidate.attributes.leadership} · Angriff{" "}
            {candidate.attributes.attack} · Verteidigung{" "}
            {candidate.attributes.defense}
          </p>
          <label>
            Name
            <input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p>
            Die übrigen Bewerber verfallen bis zum nächsten Wechsel. Neue
            Generäle beginnen auf Level 1 ohne XP oder gekaufte Skills.
          </p>
          {error && <p role="alert">{error}</p>}
        </Dialog>
      )}
    </section>
  );
}
