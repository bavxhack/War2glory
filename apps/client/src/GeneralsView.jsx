import { useState } from "react";
import { GeneralPortrait } from "./GeneralPortrait.jsx";
import { Recruitment } from "./Recruitment.jsx";
import { GeneralDialog } from "./GeneralDialog.jsx";
export function GeneralsView({ state, transport, onTransfer, initialRole }) {
  const [selected, setSelected] = useState(
      initialRole
        ? {
            id: state.military.generals.find(
              (g) =>
                g.cityId === state.cityId &&
                ["idle", "mayor"].includes(g.status),
            )?.id,
            section: "role",
          }
        : null,
    ),
    [tab, setTab] = useState("mine"),
    [city, setCity] = useState("all"),
    [role, setRole] = useState("all");
  const g = state.military.generals.find((g) => g.id === selected?.id);
  return (
    <section>
      <h2>Generäle · Alle Städte</h2>
      <nav className="view-tabs">
        {[
          ["mine", "Meine Generäle"],
          ["recruit", "Rekrutieren"],
        ].map(([k, n]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {n}
          </button>
        ))}
      </nav>
      {tab === "recruit" ? (
        <Recruitment
          state={state}
          transport={transport}
          onSelect={(id) => setSelected({ id, section: "overview" })}
        />
      ) : (
        <>
          <label>
            Standortfilter
            <select
              aria-label="Standortfilter"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="all">Alle Städte</option>
              {state.cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rollenfilter
            <select
              aria-label="Rollenfilter"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="all">Alle Rollen</option>
              <option value="idle">Frei</option>
              <option value="mayor">Bürgermeister</option>
              <option value="researcher">Forschungsleitung</option>
            </select>
          </label>
          <div className="general-grid">
            {state.military.generals
              .filter(
                (g) =>
                  (city === "all" || g.cityId === city) &&
                  (role === "all" || g.status === role),
              )
              .map((g) => (
                <article className="card" key={g.id}>
                  <GeneralPortrait portraitId={g.portraitId} name={g.name} />
                  <h3>{g.name}</h3>
                  <p>
                    {state.cities.find((c) => c.id === g.cityId)?.name} ·{" "}
                    {{
                      idle: "Frei",
                      mayor: "Bürgermeister",
                      researcher: "Forschungsleitung",
                    }[g.status] ?? "Unterwegs"}
                  </p>
                  <p>
                    Level {g.level} · {g.experience - g.skills.experienceSpent}{" "}
                    XP ·{" "}
                    {g.skills.totalPoints -
                      Object.values(g.skills.allocations).reduce(
                        (a, b) => a + b,
                        0,
                      )}{" "}
                    freie Skills
                  </p>
                  <button
                    onClick={() =>
                      setSelected({ id: g.id, section: "development" })
                    }
                  >
                    Entwickeln · {g.name}
                  </button>
                  <button
                    onClick={() => setSelected({ id: g.id, section: "role" })}
                  >
                    Rolle ändern · {g.name}
                  </button>
                  <button
                    onClick={() =>
                      setSelected({ id: g.id, section: "overview" })
                    }
                  >
                    Details · {g.name}
                  </button>
                </article>
              ))}
          </div>
        </>
      )}
      {g && (
        <GeneralDialog
          key={g.id}
          general={g}
          rules={state.generalSkillRules}
          supply={g.cityId === state.cityId ? state.supply : null}
          roleVersion={state.military.roleVersion}
          isMayor={g.status === "mayor"}
          local={g.cityId === state.cityId}
          cityName={state.cities.find((c) => c.id === g.cityId)?.name}
          state={state}
          initialSection={selected.section}
          onTransfer={() => {
            setSelected(null);
            onTransfer({
              mode: "transfer",
              originCityId: g.cityId,
              generalIds: [g.id],
            });
          }}
          transport={transport}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
