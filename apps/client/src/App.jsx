import { Drafts } from "./Drafts.jsx";
import { Activities } from "./Activities.jsx";
import { TasksView, CitiesView } from "./TasksSupply.jsx";
import { CitySwitcher } from "./CitySwitcher.jsx";
import { LogisticsView } from "./LogisticsView.jsx";
import { GeneralsView } from "./GeneralsView.jsx";
import { SupplyStatus } from "./SidebarStatus.jsx";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Mailbox } from "./Mailbox.jsx";
import { ResearchView } from "./ResearchView.jsx";
import { CityView } from "./CityView.jsx";
import { MilitaryView } from "./MilitaryView.jsx";
import { WorldView } from "./WorldView.jsx";
import {
  Dialog,
  GameArt,
  BuildingArt,
  capacitySummary,
  resourceLabels,
} from "./ui.jsx";

function Login({ transport, message }) {
  const [values, setValues] = useState({
    username: "",
    password: "",
    cityName: "",
  });
  const [error, setError] = useState("");
  const submit = (register) => {
    setError("");
    try {
      transport.login(values, register);
    } catch (cause) {
      setError(cause.message);
    }
  };
  return (
    <div className="auth-shell">
      <form
        className="auth-card"
        onSubmit={(event) => {
          event.preventDefault();
          submit(event.nativeEvent.submitter?.value !== "login");
        }}
      >
        <GameArt type="town" className="login-art" />
        <span className="kicker">WILLKOMMEN, KOMMANDANT</span>
        <h1>Deine Stadt wartet.</h1>
        <p>
          Registriere dich oder melde dich an. Jede Identität besitzt eine
          getrennte Stadt.
        </p>
        <label>
          Kommandantenname
          <input
            autoComplete="username"
            minLength="3"
            maxLength="24"
            required
            value={values.username}
            onChange={(event) =>
              setValues({ ...values, username: event.target.value })
            }
          />
        </label>
        <label>
          Passwort
          <input
            type="password"
            autoComplete="current-password"
            minLength="10"
            maxLength="128"
            required
            value={values.password}
            onChange={(event) =>
              setValues({ ...values, password: event.target.value })
            }
          />
        </label>
        <label>
          Stadtname (nur Registrierung)
          <input
            minLength="3"
            maxLength="32"
            value={values.cityName}
            onChange={(event) =>
              setValues({ ...values, cityName: event.target.value })
            }
          />
        </label>
        <div className="auth-actions">
          <button value="register">Registrieren</button>
          <button value="login" className="secondary">
            Anmelden
          </button>
        </div>
        <p className="auth-message" role="alert">
          {error || message}
        </p>
      </form>
    </div>
  );
}
const hourly = (value) =>
  (value * 3600).toLocaleString("de-DE", { maximumFractionDigits: 2 });
function Resources({ state, embedded = false }) {
  const [detail, setDetail] = useState(embedded ? "food" : null),
    close = useCallback(() => setDetail(null), []);
  const icons = { wood: "▰", stone: "◆", food: "●", oil: "◉" };
  return (
    <>
      <section aria-label="Rohstoffe" className="resources">
        {Object.entries(state.city.resources).map(([key, amount]) => {
          const rate =
            key === "food" ? state.supply.net : state.productionRates[key];
          return (
            <button
              className="resource"
              key={key}
              onClick={() => setDetail(key)}
            >
              <span className="resource-icon">{icons[key]}</span>
              <span>
                <span>{resourceLabels[key]}</span>
                <strong>
                  {Math.floor(amount).toLocaleString("de-DE")} /{" "}
                  {state.capacities[key]}
                </strong>
                <small>
                  {rate >= 0 ? "+" : ""}
                  {hourly(rate)}/h
                </small>
              </span>
            </button>
          );
        })}
      </section>
      {detail &&
        (embedded ? (
          <section>
            <h3>{resourceLabels[detail]}</h3>
            <p>
              Vorrat {Math.floor(state.city.resources[detail])} /{" "}
              {state.capacities[detail]}
            </p>
            <p>
              Gebäude +{hourly(state.buildingProductionRates[detail])}/h ·
              Forschung +
              {hourly(
                state.productionRates[detail] -
                  state.buildingProductionRates[detail],
              )}
              /h
            </p>
            <p>
              Grundkapazität {state.capacityBreakdown[detail].base}
              {state.capacityBreakdown[detail].contributions
                .map(
                  (item) =>
                    ` · ${state.buildings[item.building].label} Stufe ${item.level}: +${item.amount}`,
                )
                .join("")}{" "}
              · Forschungsfaktor ×
              {state.capacityBreakdown[detail].researchFactor.toFixed(2)}
            </p>
            {detail === "food" && <SupplyStatus state={state} />}
          </section>
        ) : (
          <Dialog
            open
            title={resourceLabels[detail]}
            kicker="RESSOURCENDETAILS"
            onClose={close}
          >
            <p>
              Vorrat {Math.floor(state.city.resources[detail])} /{" "}
              {state.capacities[detail]}
            </p>
            <p>
              Gebäude +{hourly(state.buildingProductionRates[detail])}/h ·
              Forschung +
              {hourly(
                state.productionRates[detail] -
                  state.buildingProductionRates[detail],
              )}
              /h
            </p>
            <p>
              Grundkapazität {state.capacityBreakdown[detail].base}
              {state.capacityBreakdown[detail].contributions
                .map(
                  (item) =>
                    ` · ${state.buildings[item.building].label} Stufe ${item.level}: +${item.amount}`,
                )
                .join("")}{" "}
              · Forschungsfaktor ×
              {state.capacityBreakdown[detail].researchFactor.toFixed(2)}
            </p>
            {detail === "food" && <SupplyStatus state={state} />}
          </Dialog>
        ))}
    </>
  );
}
function DemolitionDialog({ preview, state, transport }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sending = useRef(false);
  const close = useCallback(() => transport.clearDemolition(), [transport]);
  if (!preview) return null;
  return (
    <Dialog
      open
      danger
      kicker="ABRISS PRÜFEN"
      title={`${state.buildings[preview.building].label} · Stufe ${preview.level} · ${state.city.name} abreißen?`}
      onClose={close}
      actions={
        <button
          className="danger"
          disabled={busy || transport.getSnapshot().status !== "connected"}
          onClick={async () => {
            if (sending.current) return;
            sending.current = true;
            setBusy(true);
            setError("");
            try {
              await transport.request("building.demolish", {
                slotId: preview.slotId,
                buildingId: preview.buildingId,
                version: preview.version,
              });
              close();
            } catch (e) {
              setError(e.message);
            } finally {
              sending.current = false;
              setBusy(false);
            }
          }}
        >
          Endgültig abreißen
        </button>
      }
    >
      <div className="demolition-preview">
        {error && <p role="alert">{error}</p>}
        <BuildingArt type={preview.building} level={preview.level} />
        <p>
          Das Gebäude wird sofort vollständig entfernt. Der Bauplatz wird frei.
        </p>
        <strong>
          Rückerstattung: {preview.refund.wood} Holz · {preview.refund.stone}{" "}
          Stein · {preview.refund.food} Nahrung · {preview.refund.oil ?? 0} Öl
        </strong>
        <p className={preview.investmentComplete ? "" : "notice"}>
          {preview.investmentComplete
            ? "Berechnet aus allen nachgewiesenen bezahlten Investitionen (10 %, abgerundet)."
            : "Frühere Baukosten sind nicht vollständig dokumentiert; erstattet werden nur nachgewiesene Investitionen."}
        </p>
        <p>
          Lager danach: {capacitySummary(preview.capacityAfter)}. Vorhandene
          Überbestände bleiben erhalten.
        </p>
        <p>
          {preview.productionLoss &&
            `Produktionsverlust: ${resourceLabels[preview.productionLoss.resource]} −${preview.productionLoss.amount}/s. `}
          Kommandantenpunkte: {preview.scoreBefore} → {preview.scoreAfter}.
        </p>
      </div>
    </Dialog>
  );
}
const pages = [
  ["city", "Stadt", "⌂"],
  ["world", "Weltkarte", "◎"],
  ["military", "Militär", "⚑"],
  ["logistics", "Logistik", "↗"],
  ["generals", "Generäle", "★"],
  ["research", "Forschung", "◇"],
  ["mail", "Postbox", "✉"],
];
export function App({ transport }) {
  const snapshot = useSyncExternalStore(
    transport.subscribe,
    transport.getSnapshot,
  );
  useEffect(() => {
    transport.start();
    return () => transport.stop();
  }, [transport]);
  return (
    <GameScreen
      key={snapshot.game?.player.id ?? "guest"}
      transport={transport}
      snapshot={snapshot}
    />
  );
}
function GameScreen({ transport, snapshot }) {
  const [cityTab, setCityTab] = useState("scene"),
    [source, setSource] = useState(""),
    [logisticsDraft, setLogisticsDraft] = useState(null),
    [, refreshIntroduction] = useState(0),
    [pendingNavigation, setPendingNavigation] = useState(null),
    [cityFocus, setCityFocus] = useState(null),
    [mapFocus, setMapFocus] = useState(null),
    [mailMemory, setMailMemory] = useState(null),
    [intent, setIntent] = useState(null),
    [activities, setActivities] = useState(false);
  const [view, setView] = useState("city");
  const [menu, setMenu] = useState(false),
    [resourcesOpen, setResourcesOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1280),
    [drafts, setDrafts] = useState({}),
    [pendingCity, setPendingCity] = useState(null);
  const closeMenu = useCallback(() => setMenu(false), []),
    closeResources = useCallback(() => setResourcesOpen(false), []),
    closeSwitch = useCallback(() => {
      setPendingCity(null);
      setPendingNavigation(null);
    }, []);
  const registerDraft = useCallback(
    (id, value) =>
      setDrafts((previous) =>
        previous[id] === value ? previous : { ...previous, [id]: value },
      ),
    [],
  );
  const dirty = Object.values(drafts).some(Boolean);
  useEffect(() => {
    const media = window.matchMedia("(max-width:1279px)");
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const guard = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  if (!snapshot.authenticated || !snapshot.game)
    return <Login transport={transport} message={snapshot.error} />;
  const state = snapshot.game,
    label = pages.find((p) => p[0] === view)[1];
  const navigate = (key) => {
    if (key === view) {
      setMenu(false);
      return;
    }
    if (dirty) {
      setIntent(() => () => {
        setDrafts({});
        setView(key);
        setMenu(false);
        if (key === "world" && !snapshot.map && snapshot.status === "connected")
          transport.requestMap({});
      });
      return;
    }
    setView(key);
    setMenu(false);
    if (key === "world" && !snapshot.map && snapshot.status === "connected")
      transport.requestMap({});
  };
  const selectCity = (id) => {
    if (dirty) {
      setPendingCity(id);
      return;
    }
    try {
      transport.selectCity(id);
    } catch (e) {
      transport.setMessage(e.message);
      return false;
    }
  };
  const openCityView = (id, key = "city") => {
    if (dirty && id !== state.cityId) {
      setPendingCity(id);
      setPendingNavigation(key);
      return;
    }
    if (id !== state.cityId && selectCity(id) === false) return;
    navigate(key);
    setCityTab("scene");
  };
  const prepareLogistics = (draft) => {
    const open = () => {
      if (draft.originCityId && draft.originCityId !== state.cityId)
        try {
          transport.selectCity(draft.originCityId);
        } catch (e) {
          transport.setMessage(e.message);
          return;
        }
      setDrafts({});
      setLogisticsDraft({ ...draft, key: Date.now() });
      setView("logistics");
      setMenu(false);
    };
    if (dirty) setIntent(() => open);
    else open();
  };
  const helpCity = (type, id) => {
    if (type === "delivery")
      prepareLogistics({
        mode: "delivery",
        targetCityId: id,
        originCityId:
          state.cityId === id
            ? state.cities.find((c) => c.id !== id)?.id
            : state.cityId,
      });
    else if (type === "transfer")
      prepareLogistics({ mode: "transfer", originCityId: id });
    else {
      if (type === "city") setCityFocus({ cityId: id, building: "farm" });
      openCityView(id, type);
    }
  };
  const preview = (slot) => {
    try {
      transport.previewBuilding(slot.id);
    } catch (e) {
      transport.setMessage(e.message);
    }
  };
  const navigation = (
    <nav aria-label="Hauptnavigation">
      {pages.map(([key, name, icon]) => (
        <button
          key={key}
          aria-label={
            key === "mail"
              ? `Postbox, ${state.mailbox.unreadCount} ungelesene Einträge`
              : name
          }
          aria-current={view === key ? "page" : undefined}
          className={view === key ? "active" : ""}
          onClick={() => navigate(key)}
        >
          <span aria-hidden="true">{icon}</span>
          {name}
          {key === "city" && state.tasks?.claimable > 0 && (
            <span className="mail-badge">{state.tasks.claimable}</span>
          )}
          {key === "mail" && state.mailbox.unreadCount > 0 && (
            <span className="mail-badge">{state.mailbox.unreadCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
  const warn = state.cities.filter((c) => c.inShortage),
    global = ["generals", "research", "mail"].includes(view);
  return (
    <Drafts.Provider
      value={{
        register: registerDraft,
        leave: (action) => setIntent(() => action),
      }}
    >
      <div className="game-shell">
        {!narrow && (
          <aside className="main-navigation">
            <div>
              <span className="kicker">FEDERATED STRATEGY</span>
              <h2>Navigation</h2>
            </div>
            {navigation}
            <div className="account-status">
              <strong>{state.player.commanderName}</strong>
              <span>{state.score.total} Kommandantenpunkte</span>
              <span>
                {snapshot.status === "connected"
                  ? "● Verbunden"
                  : "Verbindung unterbrochen"}
              </span>
              <button
                onClick={() => {
                  if (dirty)
                    setIntent(() => () => {
                      transport.logout();
                    });
                  else transport.logout();
                }}
              >
                Abmelden
              </button>
            </div>
          </aside>
        )}
        <main className="game-main">
          <header className="city-header">
            <div className="city-header-title">
              {narrow && (
                <button className="menu-toggle" onClick={() => setMenu(true)}>
                  Menü · {label}
                </button>
              )}
              <h1 className="visually-hidden">{state.city.name}</h1>
              <CitySwitcher
                state={state}
                transport={transport}
                onSelect={selectCity}
              />
              <button
                className="mobile-resource-button"
                onClick={() => setResourcesOpen(true)}
              >
                Ressourcen
              </button>
            </div>
            <div className="header-resources">
              <Resources state={state} />
            </div>
            {snapshot.status !== "connected" && (
              <p className="notice" role="status">
                Stand veraltet vom{" "}
                {new Date(state.serverTime).toLocaleString("de-DE")} ·
                Verbindung unterbrochen.
              </p>
            )}
            {state.supply.inShortage && (
              <p className="compact-warning" role="alert">
                {state.city.name}: Nahrungsmangel · Ausbildung pausiert ·
                Hungerwelle in{" "}
                {Math.max(
                  0,
                  Math.ceil(
                    (state.supply.nextLossAt - state.serverTime) / 60000,
                  ),
                )}{" "}
                Minuten.
              </p>
            )}
            {warn.some((c) => c.id !== state.cityId) && (
              <details className="compact-warning">
                <summary>
                  {warn.filter((c) => c.id !== state.cityId).length} weitere
                  Städte mit Nahrungsmangel
                </summary>
                {warn
                  .filter((c) => c.id !== state.cityId)
                  .map((c) => (
                    <button key={c.id} onClick={() => selectCity(c.id)}>
                      {c.name}
                    </button>
                  ))}
              </details>
            )}
          </header>
          <div className="workspace-heading">
            <span>
              {label} · {global ? "Alle Städte" : state.city.name}
            </span>
            <button onClick={() => setActivities(true)}>Aktivitäten</button>
          </div>
          {state.migrationNotices.map((text, i) => (
            <p key={i} className="notice">
              {text}
            </p>
          ))}
          <div className="workspace-layout">
            <div
              className={`workspace-content${view === "world" ? " map-workspace" : ""}`}
            >
              {snapshot.switching ? (
                <p role="status">Stadt wird geladen …</p>
              ) : (
                <>
                  {view === "city" && (
                    <>
                      <nav className="view-tabs" aria-label="Stadtansichten">
                        {[
                          ["scene", "Stadtansicht"],
                          ["all", "Alle Städte"],
                          ["tasks", "Aufgaben"],
                        ].map(([id, name]) => (
                          <button
                            key={id}
                            aria-label={name}
                            aria-pressed={cityTab === id}
                            onClick={() => setCityTab(id)}
                          >
                            {name}
                            {id === "tasks" && state.tasks.claimable > 0
                              ? ` (${state.tasks.claimable})`
                              : ""}
                          </button>
                        ))}
                      </nav>
                      {cityTab === "all" && (
                        <CitiesView
                          state={state}
                          onOpen={(id) => openCityView(id)}
                          onHelp={helpCity}
                        />
                      )}{" "}
                      {cityTab === "tasks" && (
                        <TasksView
                          state={state}
                          transport={transport}
                          connected={snapshot.status === "connected"}
                          onAction={(task) => {
                            const missing = task.prerequisites
                              .map((id) =>
                                state.tasks.list.find((t) => t.id === id),
                              )
                              .find(
                                (t) =>
                                  !["completed", "claimed"].includes(t.status),
                              );
                            const goal = missing ?? task;
                            const buildings = {
                              "intro.farm": "farm",
                              "intro.storage": "warehouse",
                              "intro.university": "university",
                              "intro.oil": "refinery",
                            };
                            setCityFocus({
                              cityId: state.cityId,
                              building: buildings[goal.id],
                              technology:
                                goal.id === "intro.oil"
                                  ? "oilProcessing"
                                  : undefined,
                              unit:
                                goal.id === "intro.training"
                                  ? "infantry"
                                  : undefined,
                              role:
                                goal.id === "intro.mayor" ? "mayor" : undefined,
                            });
                            navigate(goal.action);
                            setCityTab("scene");
                          }}
                        />
                      )}
                      {cityTab === "scene" &&
                        state.tasks.showIntroduction &&
                        !state.tasks.introComplete &&
                        !localStorage.getItem(
                          `intro.hidden.${state.player.id}`,
                        ) && (
                          <section className="card">
                            <h2>
                              Nächstes Ziel:{" "}
                              {state.tasks.list.find(
                                (t) => t.status === "available",
                              )?.title ?? "Belohnungen abholen"}
                            </h2>
                            <button onClick={() => setCityTab("tasks")}>
                              Zur Aufgabe
                            </button>
                            <button
                              onClick={() => {
                                localStorage.setItem(
                                  `intro.hidden.${state.player.id}`,
                                  "1",
                                );
                                refreshIntroduction((n) => n + 1);
                              }}
                            >
                              Einführung ausblenden
                            </button>
                          </section>
                        )}
                      {cityTab === "scene" && (
                        <CityView
                          initialBuilding={
                            cityFocus?.cityId === state.cityId
                              ? cityFocus.building
                              : null
                          }
                          key={`${state.cityId}-${cityFocus?.cityId === state.cityId ? cityFocus.building : ""}`}
                          state={state}
                          transport={transport}
                          onPreview={preview}
                          onActivities={setActivities}
                          onResearch={(id) => {
                            setCityFocus({
                              cityId: state.cityId,
                              universityId: id,
                            });
                            navigate("research");
                          }}
                        />
                      )}
                    </>
                  )}
                  {view === "world" && (
                    <WorldView
                      key={state.cityId}
                      state={state}
                      map={snapshot.map}
                      details={snapshot.mapDetails}
                      focusCoordinates={mapFocus}
                      transport={transport}
                      onCity={openCityView}
                      onLogistics={prepareLogistics}
                      onMessage={(recipient) => {
                        setSource(recipient);
                        navigate("mail");
                      }}
                    />
                  )}
                  {view === "military" && (
                    <MilitaryView
                      key={state.cityId}
                      state={state}
                      transport={transport}
                      onPreview={preview}
                      onActivities={setActivities}
                      initialUnit={cityFocus?.unit}
                    />
                  )}
                  {view === "logistics" && (
                    <LogisticsView
                      initialDraft={logisticsDraft}
                      key={`${state.cityId}-${logisticsDraft?.key ?? ""}`}
                      state={state}
                      transport={transport}
                      connected={snapshot.status === "connected"}
                      onSource={(id, draft) =>
                        prepareLogistics({ ...draft, originCityId: id })
                      }
                    />
                  )}
                  {view === "generals" && (
                    <GeneralsView
                      state={state}
                      transport={transport}
                      onTransfer={prepareLogistics}
                      initialRole={cityFocus?.role}
                    />
                  )}
                  {view === "research" && (
                    <ResearchView
                      key={state.cityId}
                      state={state}
                      transport={transport}
                      initialUniversity={cityFocus?.universityId}
                      initialTechnology={cityFocus?.technology}
                    />
                  )}
                  {view === "mail" && (
                    <Mailbox
                      key={state.player.id}
                      state={state}
                      transport={transport}
                      initialRecipient={source}
                      onRecipientConsumed={setSource}
                      initialView={
                        mailMemory?.playerId === state.player.id
                          ? mailMemory
                          : null
                      }
                      onViewChange={setMailMemory}
                      onMap={(report) => {
                        setMapFocus(
                          report.coordinates
                            ? { ...report.coordinates, key: Date.now() }
                            : null,
                        );
                        navigate("world");
                        if (!report.coordinates && report.targetId)
                          transport.details(report.targetId);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </div>
          <p className="message" role="status">
            {snapshot.error || snapshot.message}
          </p>

          {activities && (
            <Activities
              context={activities}
              state={state}
              transport={transport}
              onClose={() => setActivities(false)}
            />
          )}
          {intent && (
            <Dialog
              open
              title="Ungesendeten Entwurf verwerfen?"
              kicker="ENTWURF"
              onClose={() => setIntent(null)}
              actions={
                <button
                  onClick={() => {
                    setDrafts({});
                    intent();
                    setIntent(null);
                  }}
                >
                  Entwurf verwerfen und wechseln
                </button>
              }
            >
              <p>Deine ungesendeten Eingaben bleiben beim Bleiben erhalten.</p>
              <button onClick={() => setIntent(null)}>Bleiben</button>
            </Dialog>
          )}
          <DemolitionDialog
            preview={snapshot.demolition}
            state={state}
            transport={transport}
          />
          {menu && (
            <Dialog open title="Navigation" kicker="MENÜ" onClose={closeMenu}>
              {navigation}
              <p>
                {state.player.commanderName} · {state.score.total} Punkte ·{" "}
                {snapshot.status === "connected" ? "Verbunden" : "Unterbrochen"}
              </p>
              <button
                onClick={() => {
                  if (dirty)
                    setIntent(() => () => {
                      transport.logout();
                    });
                  else transport.logout();
                }}
              >
                Abmelden
              </button>
            </Dialog>
          )}
          {resourcesOpen && (
            <Dialog
              open
              title={`Ressourcen · ${state.city.name}`}
              kicker="RESSOURCEN"
              onClose={closeResources}
            >
              <Resources state={state} embedded />
            </Dialog>
          )}
          {pendingCity && (
            <Dialog
              open
              title="Stadt wechseln?"
              kicker="ENTWURF"
              onClose={closeSwitch}
              actions={
                <button
                  onClick={() => {
                    transport.selectCity(pendingCity);
                    setPendingCity(null);
                    if (pendingNavigation) {
                      setView(pendingNavigation);
                      setMenu(false);
                      setCityTab("scene");
                      setPendingNavigation(null);
                    }
                    setDrafts({});
                  }}
                >
                  Entwurf verwerfen und Stadt wechseln
                </button>
              }
            >
              <p>
                Die ungesendete Auswahl gehört zu {state.city.name}. Sie wird
                beim Wechsel verworfen.
              </p>
            </Dialog>
          )}
          <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
            {[
              ["city", "Stadt"],
              ["world", "Welt"],
              ["logistics", "Logistik"],
            ].map(([key, name]) => (
              <button
                key={key}
                aria-current={view === key ? "page" : undefined}
                onClick={() => navigate(key)}
              >
                {name}
              </button>
            ))}
            <button onClick={() => setMenu(true)}>Mehr</button>
          </nav>
        </main>
      </div>
    </Drafts.Provider>
  );
}
