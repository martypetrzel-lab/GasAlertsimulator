"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Flame,
  History,
  LogOut,
  Pause,
  Play,
  Plus,
  QrCode,
  Radio,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Square,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import Image from "next/image";
import Brand from "./Brand";
import { api, statusLabel, timeLabel, useRealtime } from "@/lib/client";
import {
  defaultProfile,
  Gas,
  gases,
  gasInfo,
  InstructorSnapshot,
  ProfileConfig,
  ScenarioConfig,
  scenarios,
} from "@/lib/domain";
import { Command } from "@/lib/validation";
type ExerciseRow = {
  id: string;
  name: string;
  code: string;
  status: InstructorSnapshot["status"];
  createdAt: string;
};
type Saved<T> = { id: string; name: string; config: T };
export default function Instructor() {
  const [auth, setAuth] = useState<"loading" | "out" | "in">("loading"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [list, setList] = useState<ExerciseRow[]>([]),
    [id, setId] = useState(""),
    [tab, setTab] = useState("cviceni"),
    [historyId, setHistoryId] = useState("");
  const [profiles, setProfiles] = useState<Saved<ProfileConfig>[]>([]),
    [profileId, setProfileId] = useState(""),
    [name, setName] = useState("Odborná příprava jednotky"),
    [mode, setMode] = useState<"activation" | "cycle">("activation");
  const [newOpen, setNewOpen] = useState(false);
  async function reload() {
    const [rows, p] = await Promise.all([
      api<ExerciseRow[]>("/exercises"),
      api<{ saved: Saved<ProfileConfig>[] }>("/profiles"),
    ]);
    setList(rows);
    setProfiles(p.saved);
  }
  useEffect(() => {
    api<{ email: string }>("/me")
      .then((u) => {
        setEmail(u.email);
        setAuth("in");
      })
      .catch(() => setAuth("out"));
  }, []);
  useEffect(() => {
    if (auth === "in") void reload().catch((e) => setError(e.message));
  }, [auth]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/login", { email, password });
      setPassword("");
      setAuth("in");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (auth === "loading")
    return <div className="loading">Načítám instruktorské pracoviště…</div>;
  if (auth === "out")
    return (
      <div className="login-page">
        <header className="topbar">
          <Brand />
          <a className="text-link" href="/">
            Zpět na úvod <ArrowRight size={16} />
          </a>
        </header>
        <main className="login-card">
          <span className="role-icon">
            <ShieldCheck size={28} />
          </span>
          <div className="eyebrow">INSTRUKTORSKÉ PRACOVIŠTĚ</div>
          <h1>
            Připravte jednotku.
            <br />
            <span>Na každou situaci.</span>
          </h1>
          <p>Přihlaste se a převezměte řízení výcviku.</p>
          <form onSubmit={login}>
            <label>
              E-mail
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Heslo
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Přihlašuji…" : "Přihlásit se"}
              <ArrowRight size={18} />
            </button>
          </form>
          <small>Účty zakládá správce systému. Hasiči účet nepotřebují.</small>
        </main>
        <div className="safety-footer">SIMULACE – NEMĚŘÍ SKUTEČNÉ PLYNY</div>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">PRACOVIŠTĚ INSTRUKTORA</div>
        <nav>
          {[
            { id: "cviceni", label: "Cvičení", icon: Activity },
            { id: "profily", label: "Alarmové profily", icon: Settings2 },
            { id: "scenare", label: "Scénáře", icon: ClipboardList },
            { id: "reference", label: "Odborné podklady", icon: ShieldCheck },
          ].map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "nav-active" : ""}
              onClick={() => {
                setTab(t.id);
                setHistoryId("");
              }}
            >
              <t.icon size={19} />
              {t.label}
              {tab === t.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="training-note">
            <Radio size={18} />
            <b>Výcvikový systém</b>
            <small>Neměří skutečné plyny.</small>
          </div>
          <div className="account">
            <span className="avatar">IN</span>
            <span>
              Instruktor<small>{email}</small>
            </span>
            <button
              aria-label="Odhlásit"
              onClick={() =>
                void api("/logout", {}).then(() => {
                  setAuth("out");
                  setId("");
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="workspace-header">
          <span>
            <span className="muted">Pracoviště</span>
            <span className="slash">/</span>
            {tab === "cviceni"
              ? "Cvičení"
              : tab === "profily"
                ? "Alarmové profily"
                : tab === "scenare"
                  ? "Scénáře"
                  : "Odborné podklady"}
          </span>
          <span className="header-label">
            <span className="dot green" /> VÝCVIKOVÁ SIMULACE
          </span>
        </header>
        <main className="workspace-main">
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Zavřít chybu">
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "profily" ? (
            <ProfileEditor onSaved={reload} />
          ) : tab === "scenare" ? (
            <ScenarioLibrary />
          ) : tab === "reference" ? (
            <References />
          ) : historyId ? (
            <HistoryView id={historyId} onBack={() => setHistoryId("")} />
          ) : id ? (
            <LiveExercise
              id={id}
              onBack={() => {
                setId("");
                void reload();
              }}
              onHistory={() => {
                setHistoryId(id);
                void reload();
              }}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">PŘEHLED VÝCVIKU</div>
                  <h1>
                    Vaše cvičení<span className="accent">.</span>
                  </h1>
                  <p>Připravte prostředí. Připojte hasiče. Začněte výcvik.</p>
                </div>
                <button className="primary" onClick={() => setNewOpen(true)}>
                  <Plus size={19} /> Nové cvičení
                </button>
              </div>
              {newOpen && (
                <section className="panel create-panel">
                  <div className="section-heading">
                    <h2>Nové cvičení</h2>
                    <button
                      aria-label="Zavřít"
                      onClick={() => setNewOpen(false)}
                    >
                      <X />
                    </button>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setBusy(true);
                      void api<InstructorSnapshot>("/exercises", {
                        name,
                        profileId: profileId || undefined,
                        exposureMode: mode,
                      })
                        .then((r) => {
                          setId(r.id);
                          setNewOpen(false);
                        })
                        .catch((e) => setError(e.message))
                        .finally(() => setBusy(false));
                    }}
                  >
                    <label>
                      Název cvičení
                      <input
                        value={name}
                        required
                        maxLength={100}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <label>
                      Alarmový profil
                      <select
                        value={profileId}
                        onChange={(e) => setProfileId(e.target.value)}
                      >
                        <option value="">Ukázkový výcvikový profil</option>
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Historie expozice
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value as typeof mode)}
                      >
                        <option value="activation">
                          Nová historie při aktivaci detektoru
                        </option>
                        <option value="cycle">
                          Zachovat do nového výcvikového cyklu
                        </option>
                      </select>
                    </label>
                    <button className="primary" disabled={busy}>
                      Vytvořit cvičení <ArrowRight size={18} />
                    </button>
                  </form>
                </section>
              )}
              <div className="overview-stats">
                <div>
                  <span className="stat-icon">
                    <Activity />
                  </span>
                  <span>
                    <b>{list.filter((e) => e.status === "running").length}</b>
                    <small>Probíhající cvičení</small>
                  </span>
                </div>
                <div>
                  <span className="stat-icon">
                    <History />
                  </span>
                  <span>
                    <b>{list.filter((e) => e.status === "ended").length}</b>
                    <small>Ukončená cvičení</small>
                  </span>
                </div>
                <div>
                  <span className="stat-icon">
                    <Settings2 />
                  </span>
                  <span>
                    <b>{profiles.length + 1}</b>
                    <small>Alarmové profily</small>
                  </span>
                </div>
              </div>
              <div className="section-heading">
                <h2>Historie a aktivní cvičení</h2>
                <span className="muted">{list.length} cvičení</span>
              </div>
              <div className="exercise-list">
                {!list.length ? (
                  <div className="empty">
                    <Radio size={36} />
                    <h2>První cvičení začíná tady</h2>
                    <p>Vytvořte cvičení a sdílejte jeho kód s jednotkou.</p>
                    <button
                      className="secondary-button"
                      onClick={() => setNewOpen(true)}
                    >
                      Připravit cvičení <Plus size={16} />
                    </button>
                  </div>
                ) : (
                  list.map((e) => (
                    <button
                      className="exercise-row"
                      key={e.id}
                      onClick={() =>
                        e.status === "ended" ? setHistoryId(e.id) : setId(e.id)
                      }
                    >
                      <span className="exercise-icon">
                        <Flame size={21} />
                      </span>
                      <span className="exercise-title">
                        <b>{e.name}</b>
                        <small>
                          {new Date(e.createdAt).toLocaleDateString("cs-CZ")} ·
                          Kód {e.code}
                        </small>
                      </span>
                      <span className={`status status-${e.status}`}>
                        <span className="dot" />
                        {statusLabel[e.status]}
                      </span>
                      <ArrowRight size={19} />
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </main>
        <footer className="workspace-footer">
          SIMULACE – NEMĚŘÍ SKUTEČNÉ PLYNY
          <span>GasAlert Training Simulator</span>
        </footer>
      </div>
    </div>
  );
}

function LiveExercise({
  id,
  onBack,
  onHistory,
}: {
  id: string;
  onBack: () => void;
  onHistory: () => void;
}) {
  const {
      state: s,
      connected,
      error,
      send,
    } = useRealtime<InstructorSnapshot>("instructor", id),
    [localError, setLocalError] = useState(""),
    [qr, setQr] = useState(false),
    [qrImage, setQrImage] = useState(""),
    [url, setUrl] = useState(""),
    [copied, setCopied] = useState(false),
    [scenarioList, setScenarioList] = useState<ScenarioConfig[]>(scenarios),
    [scenarioIndex, setScenarioIndex] = useState("0"),
    [duration, setDuration] = useState(60),
    [endPrompt, setEndPrompt] = useState(false),
    [cyclePrompt, setCyclePrompt] = useState(false);
  useEffect(() => {
    api<{ defaults: ScenarioConfig[]; saved: Saved<ScenarioConfig>[] }>(
      "/scenarios",
    )
      .then((r) =>
        setScenarioList([...r.defaults, ...r.saved.map((s) => s.config)]),
      )
      .catch((e) => setLocalError(e.message));
  }, []);
  useEffect(() => {
    if (s?.code) {
      const link = `${location.origin}/detektor?kod=${s.code}`;
      setUrl(link);
      QRCode.toDataURL(link, {
        width: 320,
        margin: 2,
        color: { dark: "#111820", light: "#ffffff" },
      }).then(setQrImage);
    }
  }, [s?.code]);
  const command = (c: Command) =>
    send("instructor:command", { id, command: c }).catch((e) =>
      setLocalError(e.message),
    );
  if (!s)
    return (
      <div className="panel empty">
        {error || "Připojuji instruktorské pracoviště…"}
        <button onClick={onBack}>Zpět</button>
      </div>
    );
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Všechna cvičení
      </button>
      <div className="page-heading live-heading">
        <div>
          <div className="eyebrow">ŽIVÉ ŘÍZENÍ PROSTŘEDÍ</div>
          <h1>{s.name}</h1>
          <p>
            <span className={`status status-${s.status}`}>
              <span className="dot" />
              {statusLabel[s.status]}
            </span>
            <span className={`connection ${connected ? "" : "danger-text"}`}>
              {connected ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
              {connected ? "Server připojen" : "Spojení přerušeno"}
            </span>
          </p>
        </div>
        <button className="secondary-button" onClick={() => setQr(true)}>
          <QrCode size={19} /> Připojit hasiče{" "}
          <span className="code-mini">{s.code}</span>
        </button>
      </div>
      {(error || localError) && (
        <div className="error" role="alert">
          {localError || error}
        </div>
      )}
      <section className="control-bar">
        <div className="clock">
          <span className="muted">SIMULAČNÍ ČAS</span>
          <b>{timeLabel(s.simTime)}</b>
        </div>
        <div className="clock-speed">
          <span className="muted">Rychlost času</span>
          <select
            aria-label="Rychlost simulačního času"
            disabled={!connected || s.status === "ended"}
            value={s.speed}
            onChange={(e) =>
              void command({
                type: "speed",
                value: Number(e.target.value) as 1 | 5 | 10 | 60,
              })
            }
          >
            {[1, 5, 10, 60].map((n) => (
              <option key={n} value={n}>
                {n}× {n === 1 ? "(1:1)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="exercise-actions">
          {s.status === "ready" ? (
            <button
              className="primary"
              disabled={!connected}
              onClick={() => void command({ type: "start" })}
            >
              <Play size={17} /> Zahájit cvičení
            </button>
          ) : s.status === "ended" ? (
            <button className="primary" onClick={onHistory}>
              <History size={18} /> Zobrazit historii
            </button>
          ) : (
            <>
              <button
                className="secondary-button"
                disabled={!connected}
                onClick={() =>
                  void command({
                    type: s.status === "running" ? "pause" : "resume",
                  })
                }
              >
                {s.status === "running" ? (
                  <Pause size={17} />
                ) : (
                  <Play size={17} />
                )}{" "}
                {s.status === "running" ? "Pozastavit" : "Pokračovat"}
              </button>
              <button
                className="danger-button"
                disabled={!connected}
                onClick={() => setEndPrompt(true)}
              >
                <Square size={15} /> Ukončit
              </button>
            </>
          )}
        </div>
      </section>
      {s.speed !== 1 && (
        <div className="notice">
          Zrychlený výcvik {s.speed}×. Koncentrace i expozice používají
          simulační čas; čas událostí se ukládá také ve skutečném čase.
        </div>
      )}
      {endPrompt && (
        <div className="notice prompt">
          <b>Ukončit cvičení pro všechny detektory?</b>
          <span>Historie se zachová.</span>
          <button
            className="danger-button"
            onClick={() => {
              void command({ type: "end" });
              setEndPrompt(false);
            }}
          >
            Ukončit cvičení
          </button>
          <button onClick={() => setEndPrompt(false)}>Zrušit</button>
        </div>
      )}
      <div className="live-grid">
        <div>
          <div className="section-heading">
            <h2>
              <span className="dot amber" /> Společné prostředí
            </h2>
            <label className="inline-label">
              Doba změny
              <select
                aria-label="Doba změny"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                <option value={0}>Okamžitě</option>
                {[10, 30, 60, 120, 300].map((n) => (
                  <option key={n} value={n}>
                    {n} sekund
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="gas-grid">
            {gases.map((g) => (
              <GasControl
                key={g}
                gas={g}
                state={s}
                duration={duration}
                disabled={!connected || s.status === "ended"}
                command={command}
              />
            ))}
          </div>
          <div className="environment-tools">
            <button
              disabled={!connected || s.status === "ended"}
              onClick={() => void command({ type: "reset" })}
            >
              <RotateCcw size={16} /> Reset koncentrací
            </button>
            <button
              disabled={!connected || s.status === "ended"}
              onClick={() => void command({ type: "hold" })}
            >
              <Pause size={16} /> Zastavit všechny změny
            </button>
            <button
              disabled={!connected || s.status === "ended"}
              onClick={() => setCyclePrompt(true)}
            >
              Nový výcvikový cyklus
            </button>
          </div>
          <p className="helper">
            Reset prostředí zachovává expozici. Nový cyklus ji výslovně vymaže
            pro všechny detektory.
          </p>
          {cyclePrompt && (
            <div className="notice prompt">
              Vymazat expozici všech účastníků a začít nový cyklus?
              <button
                className="danger-button"
                onClick={() => {
                  void command({ type: "cycle" });
                  setCyclePrompt(false);
                }}
              >
                Vymazat a začít
              </button>
              <button onClick={() => setCyclePrompt(false)}>Zrušit</button>
            </div>
          )}
          <section className="panel scenario-quick">
            <div className="section-heading">
              <h2>
                <ClipboardList size={18} /> Rychlý scénář
              </h2>
              <span className="small-tag">VÝCVIKOVÁ APROXIMACE</span>
            </div>
            <div className="form-row">
              <select
                aria-label="Výběr scénáře"
                value={scenarioIndex}
                onChange={(e) => setScenarioIndex(e.target.value)}
              >
                {scenarioList.map((c, i) => (
                  <option key={i} value={i}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                className="secondary-button"
                disabled={!connected || s.status === "ended"}
                onClick={() =>
                  void command({
                    type: "scenario",
                    scenario: scenarioList[Number(scenarioIndex)],
                  })
                }
              >
                Použít <ArrowRight size={16} />
              </button>
            </div>
            <p className="helper">
              {scenarioList[Number(scenarioIndex)]?.description} Doba:{" "}
              {scenarioList[Number(scenarioIndex)]?.duration} s.
            </p>
          </section>
          <details className="panel technical">
            <summary>
              Poruchy a stav baterie <ChevronDown size={16} />
            </summary>
            <div className="fault-grid">
              {gases.map((g) => (
                <label key={g} className="checkbox-label">
                  <input
                    type="checkbox"
                    disabled={!connected || s.status === "ended"}
                    checked={s.faults.includes(g)}
                    onChange={(e) =>
                      void command({
                        type: "fault",
                        gas: g,
                        enabled: e.target.checked,
                      })
                    }
                  />
                  Porucha {gasInfo[g].symbol}
                </label>
              ))}
            </div>
            <label>
              Simulovaná baterie: {s.battery} %
              <input
                type="range"
                min={0}
                max={100}
                value={s.battery}
                disabled={!connected || s.status === "ended"}
                onChange={(e) =>
                  void command({
                    type: "battery",
                    value: Number(e.target.value),
                  })
                }
              />
            </label>
          </details>
        </div>
        <aside className="live-side">
          <section className="panel participants">
            <div className="section-heading">
              <h2>
                <Users size={18} /> Detektory
              </h2>
              <span className="count">
                {s.participants.filter((p) => p.online).length}/
                {s.participants.length}
              </span>
            </div>
            {!s.participants.length ? (
              <div className="small-empty">
                <Radio size={28} />
                <p>Čekáme na jednotku</p>
                <small>
                  Sdílejte kód <b>{s.code}</b>
                  <br />
                  nebo zobrazte QR kód.
                </small>
              </div>
            ) : (
              s.participants.map((p) => (
                <div className="participant" key={p.id}>
                  <span
                    className={`dot ${p.online && p.foreground ? "green" : "amber"}`}
                  />
                  <div>
                    <b>{p.label}</b>
                    <small>
                      {!p.online
                        ? "Odpojen"
                        : !p.foreground
                          ? "Aplikace na pozadí"
                          : p.active
                            ? "Detektor aktivní"
                            : "Čeká na aktivaci"}
                    </small>
                    {p.alarms.display.length > 0 && (
                      <span className="participant-alarm">
                        {p.alarms.display
                          .map((a) => `${a.gas} ${a.kind}`)
                          .join(" · ")}
                      </span>
                    )}
                    {p.incomplete && (
                      <small className="danger-text">Neúplná expozice</small>
                    )}
                  </div>
                </div>
              ))
            )}
          </section>
          <section className="panel profile-note">
            <div className="eyebrow">ALARMOVÝ PROFIL</div>
            <h3>{s.profile.name}</h3>
            <p>{s.profile.description}</p>
            <div className="profile-flags">
              <span>
                {s.profile.latching
                  ? "Ruční reset alarmů"
                  : "Automatické odeznění"}
              </span>
              <span>STEL {s.profile.stelMinutes} min</span>
              <span>TWA 8 h</span>
            </div>
            <small>Prahy přístroje nejsou hygienické limity PEL / NPK-P.</small>
          </section>
          <div className="side-note">
            <ShieldCheck size={18} />
            <p>
              Všichni hasiči sdílí stejné prostředí. Každý detektor vede vlastní
              expozici.
            </p>
          </div>
        </aside>
      </div>
      {qr && (
        <div className="modal-backdrop" onClick={() => setQr(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Připojení hasičů"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Zavřít"
              onClick={() => setQr(false)}
            >
              <X />
            </button>
            <div className="eyebrow">PŘIPOJENÍ DETEKTORU</div>
            <h2>Naskenujte. Aktivujte. Cvičte.</h2>
            {qrImage && (
              <Image
                unoptimized
                src={qrImage}
                alt="QR kód připojení ke cvičení"
                width={256}
                height={256}
              />
            )}
            <div className="join-code">{s.code}</div>
            <p>Hasič nepotřebuje účet ani registraci.</p>
            <button
              className="secondary-button"
              onClick={() =>
                void navigator.clipboard
                  .writeText(url)
                  .then(() => setCopied(true))
                  .catch(() =>
                    setLocalError("Odkaz zkopírujte z textového pole."),
                  )
              }
            >
              {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
              {copied ? "Odkaz zkopírován" : "Kopírovat odkaz"}
            </button>
            <input
              aria-label="Přímý odkaz"
              readOnly
              value={url}
              onFocus={(e) => e.target.select()}
            />
          </section>
        </div>
      )}
    </>
  );
}

function GasControl({
  gas: g,
  state: s,
  duration,
  disabled,
  command,
}: {
  gas: Gas;
  state: InstructorSnapshot;
  duration: number;
  disabled: boolean;
  command: (c: Command) => Promise<void>;
}) {
  const info = gasInfo[g],
    [target, setTarget] = useState<string | null>(null),
    [seconds, setSeconds] = useState<string | null>(null),
    [feedback, setFeedback] = useState("");
  const ramp = s.ramps[g],
    value = target ?? String(Number((ramp?.target ?? s.values[g]).toFixed(1))),
    time = seconds === null ? duration : Number(seconds);
  const alarm = s.faults.includes(g)
    ? "SENSOR ERROR"
    : s.values[g] > info.max
      ? "OL"
      : g === "O2"
        ? s.values[g] < s.profile.thresholds[g].low
          ? "LOW"
          : s.values[g] > s.profile.thresholds[g].high
            ? "HIGH"
            : "V normálu"
        : s.values[g] > s.profile.thresholds[g].high
          ? "HIGH"
          : s.values[g] > s.profile.thresholds[g].low
            ? "LOW"
            : "V normálu";
  return (
    <section
      className={`gas-card gas-${g} ${alarm !== "V normálu" ? "gas-alarm" : ""}`}
    >
      <div className="gas-card-top">
        <span className="gas-symbol">{info.symbol}</span>
        <span className={`gas-status ${alarm === "V normálu" ? "normal" : ""}`}>
          {alarm}
        </span>
      </div>
      <div className="gas-name">{info.label}</div>
      <div className="gas-reading">
        <b data-testid={`instructor-${g}`}>
          {s.values[g].toFixed(g === "O2" ? 1 : 0).replace(".", ",")}
        </b>
        <span>{info.unit}</span>
      </div>
      <div className="ramp-state">
        {ramp ? (
          <>
            <span className="dot amber" />
            {ramp.target > s.values[g] ? "Roste" : "Klesá"} → {ramp.target} ·
            zbývá{" "}
            {Math.max(0, Math.ceil(ramp.start + ramp.duration - s.simTime))} s
          </>
        ) : (
          <>
            <span className="dot" /> Koncentrace se nemění
          </>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void command({
            type: "target",
            gas: g,
            target: Number(value),
            duration: time,
          }).then(() => {
            setTarget(null);
            setFeedback("Nastaveno");
            setTimeout(() => setFeedback(""), 2000);
          });
        }}
      >
        <div className="gas-target-row">
          <label>
            Cílová hodnota
            <div className="unit-input">
              <input
                aria-label={`${info.symbol} cílová hodnota`}
                type="number"
                min={0}
                max={g === "O2" ? 40 : info.max * 2}
                step={info.step}
                value={value}
                disabled={disabled}
                onChange={(e) => setTarget(e.target.value)}
                required
              />
              <span>{info.unit}</span>
            </div>
          </label>
          <label>
            Doba (s)
            <input
              aria-label={`${info.symbol} doba změny`}
              type="number"
              min={0}
              max={86400}
              value={seconds ?? duration}
              onChange={(e) => setSeconds(e.target.value)}
              disabled={disabled}
            />
          </label>
        </div>
        <input
          className="gas-slider"
          aria-label={`${info.symbol} posuvník cíle`}
          type="range"
          min={0}
          max={info.max}
          step={info.step}
          value={value}
          disabled={disabled}
          onChange={(e) => setTarget(e.target.value)}
        />
        <div className="range-labels">
          <span>0 {info.unit}</span>
          <span>
            {info.max} {info.unit}
          </span>
        </div>
        <div className="gas-buttons">
          <button type="submit" className="apply-button" disabled={disabled}>
            {feedback || "Nastavit"}
            <ArrowRight size={15} />
          </button>
          <button
            type="button"
            className="hold-button"
            disabled={disabled || !ramp}
            onClick={() => void command({ type: "holdGas", gas: g })}
            title="Pozastavit změnu a udržovat aktuální koncentraci"
          >
            <Pause size={16} /> Udržet
          </button>
        </div>
      </form>
      <div className="threshold-foot">
        LOW {s.profile.thresholds[g].low} <span>/</span> HIGH{" "}
        {s.profile.thresholds[g].high} {info.unit}
      </div>
    </section>
  );
}

function ProfileEditor({ onSaved }: { onSaved: () => Promise<void> }) {
  const [p, setP] = useState<ProfileConfig>(structuredClone(defaultProfile)),
    [saved, setSaved] = useState<Saved<ProfileConfig>[]>([]),
    [message, setMessage] = useState("");
  const load = () =>
    api<{ saved: Saved<ProfileConfig>[] }>("/profiles").then((r) =>
      setSaved(r.saved),
    );
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KONFIGURACE DETEKTORU</div>
          <h1>
            Alarmové profily<span className="accent">.</span>
          </h1>
          <p>Prahy a chování přístroje pro konkrétní výcvik.</p>
        </div>
      </div>
      <div className="notice">
        Výchozí hodnoty jsou ukázkové. Profil se při založení cvičení kopíruje;
        úprava nepřepíše probíhající výcvik.
      </div>
      <section className="panel editor-panel">
        <label>
          Načíst profil
          <select
            aria-label="Načíst profil"
            onChange={(e) =>
              setP(
                structuredClone(
                  e.target.value
                    ? saved.find((s) => s.id === e.target.value)!.config
                    : defaultProfile,
                ),
              )
            }
          >
            <option value="">Ukázkový profil</option>
            {saved.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void api("/profiles", p)
              .then(async () => {
                setMessage("Nová verze profilu byla uložena.");
                await load();
                await onSaved();
              })
              .catch((e) => setMessage(e.message));
          }}
        >
          <div className="form-grid">
            <label>
              Název
              <input
                required
                value={p.name}
                onChange={(e) => setP({ ...p, name: e.target.value })}
              />
            </label>
            <label>
              Model
              <input
                required
                value={p.model}
                onChange={(e) => setP({ ...p, model: e.target.value })}
              />
            </label>
          </div>
          <label>
            Popis
            <textarea
              value={p.description}
              onChange={(e) => setP({ ...p, description: e.target.value })}
            />
          </label>
          <div className="table-scroll">
            <table className="threshold-table">
              <thead>
                <tr>
                  <th>Plyn / jednotka</th>
                  <th>LOW</th>
                  <th>HIGH</th>
                  <th>TWA</th>
                  <th>STEL</th>
                </tr>
              </thead>
              <tbody>
                {gases.map((g) => (
                  <tr key={g}>
                    <th>
                      {gasInfo[g].symbol}
                      <small>{gasInfo[g].unit}</small>
                    </th>
                    {(["low", "high", "twa", "stel"] as const).map((key) => (
                      <td key={key}>
                        {(key === "twa" || key === "stel") &&
                        (g === "O2" || g === "LEL") ? (
                          "—"
                        ) : (
                          <input
                            aria-label={`${gasInfo[g].symbol} ${key.toUpperCase()}`}
                            type="number"
                            min={0.1}
                            max={1000}
                            step={0.1}
                            required
                            value={p.thresholds[g][key] ?? ""}
                            onChange={(e) =>
                              setP({
                                ...p,
                                thresholds: {
                                  ...p.thresholds,
                                  [g]: {
                                    ...p.thresholds[g],
                                    [key]: Number(e.target.value),
                                  },
                                },
                              })
                            }
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-grid">
            <label>
              STEL interval (min)
              <input
                type="number"
                min={5}
                max={15}
                required
                value={p.stelMinutes}
                onChange={(e) =>
                  setP({ ...p, stelMinutes: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Datum ověření (pokud ověřeno)
              <input
                type="date"
                value={p.verifiedAt ?? ""}
                onChange={(e) =>
                  setP({
                    ...p,
                    verifiedAt: e.target.value || null,
                    thresholds: Object.fromEntries(
                      gases.map((g) => [
                        g,
                        {
                          ...p.thresholds[g],
                          verifiedAt: e.target.value || null,
                        },
                      ]),
                    ) as ProfileConfig["thresholds"],
                  })
                }
              />
            </label>
          </div>
          <label>
            Zdroj všech prahů
            <input
              required
              value={p.source}
              onChange={(e) =>
                setP({
                  ...p,
                  source: e.target.value,
                  thresholds: Object.fromEntries(
                    gases.map((g) => [
                      g,
                      { ...p.thresholds[g], source: e.target.value },
                    ]),
                  ) as ProfileConfig["thresholds"],
                })
              }
            />
          </label>
          <div className="fault-grid">
            {(
              [
                { key: "latching", label: "Latching Alarms – ruční reset" },
                { key: "lowAcknowledge", label: "Potvrzení zvuku LOW" },
                { key: "intelliFlash", label: "IntelliFlash" },
              ] as const
            ).map((o) => (
              <label className="checkbox-label" key={o.key}>
                <input
                  type="checkbox"
                  checked={p[o.key]}
                  onChange={(e) => setP({ ...p, [o.key]: e.target.checked })}
                />
                {o.label}
              </label>
            ))}
          </div>
          <p className="helper">
            TWA: klouzavá expozice / 8 hodin. STEL: klouzavá expozice / celý
            interval, před aktivací nulová expozice. Chybějící senzor znamená
            neúplný výpočet. LOW O₂ je dolní mez, HIGH horní mez.
          </p>
          {message && (
            <p role="status" className="notice">
              {message}
            </p>
          )}
          <button className="primary">
            Uložit novou verzi profilu <Plus size={17} />
          </button>
        </form>
      </section>
    </>
  );
}

function ScenarioLibrary() {
  const [items, setItems] = useState<ScenarioConfig[]>(scenarios),
    [s, setS] = useState<ScenarioConfig>(structuredClone(scenarios[1])),
    [msg, setMsg] = useState(""),
    [query, setQuery] = useState("");
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("cs-CZ");
  const filtered = items.filter((item) =>
    normalize(`${item.name} ${item.description}`).includes(normalize(query)),
  );
  const load = () =>
    api<{ defaults: ScenarioConfig[]; saved: Saved<ScenarioConfig>[] }>(
      "/scenarios",
    ).then((r) => setItems([...r.defaults, ...r.saved.map((c) => c.config)]));
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PŘÍPRAVA VÝCVIKU</div>
          <h1>
            Knihovna scénářů<span className="accent">.</span>
          </h1>
          <p>
            {scenarios.length} přednastavených scénářů a vaše vlastní výcvikové
            průběhy.
          </p>
        </div>
      </div>
      <div className="scenario-search">
        <label>
          Hledat scénář
          <input
            type="search"
            placeholder="Např. garáž, kyslík, odvětrání…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="muted" role="status">
          {filtered.length} z {items.length} scénářů
        </span>
      </div>
      {!filtered.length && (
        <p className="notice">
          Žádný scénář neodpovídá hledání. Zkuste jiné slovo.
        </p>
      )}
      <div className="scenario-library">
        {filtered.map((item, i) => (
          <button
            className="panel scenario-tile"
            key={i}
            onClick={() => {
              setS(structuredClone(item));
              setMsg("");
            }}
          >
            <ClipboardList size={21} />
            <h3>{item.name}</h3>
            <p>{item.description}</p>
            <span>
              {item.duration} s <ArrowRight size={16} />
            </span>
          </button>
        ))}
      </div>
      <section className="panel editor-panel">
        <h2>Upravit a uložit scénář</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void api("/scenarios", s)
              .then(() => {
                setMsg("Nová verze scénáře uložena.");
                void load();
              })
              .catch((e) => setMsg(e.message));
          }}
        >
          <label>
            Název
            <input
              value={s.name}
              required
              onChange={(e) => setS({ ...s, name: e.target.value })}
            />
          </label>
          <label>
            Popis
            <textarea
              value={s.description}
              onChange={(e) => setS({ ...s, description: e.target.value })}
            />
          </label>
          <div className="form-grid">
            {gases.map((g) => (
              <label key={g}>
                {gasInfo[g].symbol} – cíl ({gasInfo[g].unit})
                <input
                  required
                  type="number"
                  step={gasInfo[g].step}
                  min={0}
                  max={g === "O2" ? 40 : gasInfo[g].max * 2}
                  value={s.targets[g]}
                  onChange={(e) =>
                    setS({
                      ...s,
                      targets: { ...s.targets, [g]: Number(e.target.value) },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label>
            Délka lineární změny (s)
            <input
              type="number"
              required
              min={0}
              max={86400}
              value={s.duration}
              onChange={(e) => setS({ ...s, duration: Number(e.target.value) })}
            />
          </label>
          <div className="fault-grid">
            {gases.map((g) => (
              <label key={g} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={s.faults.includes(g)}
                  onChange={(e) =>
                    setS({
                      ...s,
                      faults: e.target.checked
                        ? [...s.faults, g]
                        : s.faults.filter((x) => x !== g),
                    })
                  }
                />{" "}
                Porucha {g}
              </label>
            ))}
          </div>
          <p className="helper">
            Scénáře jsou výcvikové simulace. Zvolené koncentrace nejsou
            fyzikální model skutečné havárie.
          </p>
          {msg && (
            <p className="notice" role="status">
              {msg}
            </p>
          )}
          <button className="primary">
            Uložit scénář <Plus size={17} />
          </button>
        </form>
      </section>
    </>
  );
}

type HistoryData = {
  exercise: {
    name: string;
    state: InstructorSnapshot;
    createdAt: string;
    endedAt: string | null;
  };
  samples: {
    id: string;
    simTime: number;
    values: Record<Gas, number>;
    createdAt: string;
  }[];
  events: {
    id: string;
    simTime: number;
    kind: string;
    participantId: string | null;
    payload: unknown;
    createdAt: string;
  }[];
  participants: { id: string; label: string; state: unknown }[];
};
function HistoryView({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<HistoryData | null>(null),
    [error, setError] = useState(""),
    [gas, setGas] = useState<Gas>("CO");
  useEffect(() => {
    api<HistoryData>(`/exercises/${id}/history`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);
  if (!data) return <div>{error || "Načítám časovou osu…"}</div>;
  const max = Math.max(
      gasInfo[gas].max,
      ...data.samples.map((s) => s.values[gas]),
    ),
    end = Math.max(1, ...data.samples.map((s) => s.simTime));
  const points = data.samples
    .map(
      (s) =>
        `${45 + (s.simTime / end) * 900},${235 - (s.values[gas] / max) * 200}`,
    )
    .join(" ");
  const labels: Record<string, string> = {
    CREATED: "Vytvoření cvičení",
    COMMAND: "Instruktorský příkaz",
    ALARM: "Změna alarmu",
    JOIN: "Připojení účastníka",
    CONNECTED: "Spojení obnoveno",
    DISCONNECTED: "Ztráta spojení",
    ACTIVATE: "Aktivace detektoru",
    DEACTIVATE: "Vypnutí detektoru",
    ACK: "Potvrzení alarmu",
    RESETEXPOSURE: "Reset expozice",
    FOREGROUND: "Změna popředí aplikace",
    SERVER_RESTART: "Restart serveru",
    SERVER_STOP: "Zastavení serveru",
    TIMING_GAP: "Prodleva simulace",
  };
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} /> Zpět na cvičení
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ZÁZNAM ODBORNÉ PŘÍPRAVY</div>
          <h1>{data.exercise.name}</h1>
          <p>
            {new Date(data.exercise.createdAt).toLocaleString("cs-CZ")} ·{" "}
            {data.participants.length} účastníků
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(
              new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              }),
            );
            a.download = `gasalert-${id}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          }}
        >
          Exportovat záznam
        </button>
      </div>
      <section className="panel history-chart">
        <div className="section-heading">
          <h2>Vývoj simulovaných koncentrací</h2>
          <select
            aria-label="Plyn v historii"
            value={gas}
            onChange={(e) => setGas(e.target.value as Gas)}
          >
            {gases.map((g) => (
              <option key={g} value={g}>
                {gasInfo[g].symbol} ({gasInfo[g].unit})
              </option>
            ))}
          </select>
        </div>
        <svg
          role="img"
          aria-label={`Průběh ${gasInfo[gas].symbol} v simulačním čase`}
          viewBox="0 0 980 280"
        >
          <line x1="45" y1="235" x2="950" y2="235" stroke="#48505b" />
          <line
            x1="45"
            y1="35"
            x2="950"
            y2="35"
            stroke="#303741"
            strokeDasharray="4 8"
          />
          <text x="5" y="40">
            {max}
          </text>
          <text x="15" y="238">
            0
          </text>
          <text x="45" y="270">
            00:00:00
          </text>
          <text x="850" y="270">
            {timeLabel(end)}
          </text>
          <polyline
            points={points}
            fill="none"
            stroke="#eebd52"
            strokeWidth="3"
          />
        </svg>
        <small>
          Osa X: simulační čas · Osa Y: {gasInfo[gas].unit}. Úplná data a
          expozice jednotlivých detektorů jsou v exportu.
        </small>
      </section>
      <section className="panel timeline">
        <h2>Časová osa událostí</h2>
        {data.events.map((e) => (
          <details key={e.id}>
            <summary>
              <time>{timeLabel(e.simTime)}</time>
              <span>
                {labels[e.kind] || e.kind}
                <small>
                  {e.participantId
                    ? data.participants.find((p) => p.id === e.participantId)
                        ?.label
                    : ""}{" "}
                  · {new Date(e.createdAt).toLocaleTimeString("cs-CZ")}
                </small>
              </span>
              <ChevronDown size={16} />
            </summary>
            <pre>{JSON.stringify(e.payload, null, 2)}</pre>
          </details>
        ))}
      </section>
    </>
  );
}

type Reference = {
  id: string;
  substance: string;
  version: string;
  pel: number;
  npkp: number;
  unit: string;
  source: string;
  verifiedAt: string;
  note: string;
};
function References() {
  const [rows, setRows] = useState<Reference[]>([]),
    [msg, setMsg] = useState("");
  const load = () => api<Reference[]>("/references").then(setRows);
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ODDĚLENÉ ZDROJE INFORMACÍ</div>
          <h1>
            Odborné podklady<span className="accent">.</span>
          </h1>
          <p>Přístroj, hygienické limity a taktika mají různé účely.</p>
        </div>
      </div>
      <section className="panel editor-panel">
        <h2>Dokumentace a metodika</h2>
        <ul className="source-list">
          <li>
            <a
              href="https://www.vyzbrojna.cz/upload/ObchodZbozi/4119/micro-clip-uzivatelske-prirucka-cz.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Česká příručka GasAlertMicroClip XT / XL / X3 ↗
            </a>
            <p>
              Funkce tlačítka, alarmy, IntelliFlash, nastavení STEL. Kontrola
              15. 10. 2026.
            </p>
          </li>
          <li>
            <a
              href="https://www.gasedo.cz/GasAlert-Micro-Clip-X3-detektor-plynu-d29.htm"
              target="_blank"
              rel="noreferrer"
            >
              Produktové informace X3 ↗
            </a>
          </li>
          <li>
            <a
              href="https://www.hasici-vzdelavani.cz/content/souhrn-metodickych-predpisu"
              target="_blank"
              rel="noreferrer"
            >
              Metodické předpisy HZS ↗
            </a>
            <p>
              Taktické vyhodnocení provádí instruktor. Aplikace nedává pokyny k
              zásahu.
            </p>
          </li>
          <li>
            <a
              href="https://e-sbirka.gov.cz/sb/2007/361"
              target="_blank"
              rel="noreferrer"
            >
              Nařízení vlády č. 361/2007 Sb. – e-Sbírka ↗
            </a>
            <p>
              Aktuální tabulka nebyla automaticky ověřena; aplikace
              nepředvyplňuje právní hodnoty.
            </p>
          </li>
        </ul>
      </section>
      <section className="panel editor-panel">
        <h2>Verzovaná reference PEL / NPK-P</h2>
        <p>
          Hodnoty se ukládají odděleně a nikdy se nepřenášejí do alarmových
          profilů. Doplňte je po kontrole konkrétního účinného znění.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Látka</th>
                <th>Verze</th>
                <th>PEL</th>
                <th>NPK-P</th>
                <th>Zdroj a ověření</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.substance}</td>
                  <td>{r.version}</td>
                  <td>
                    {r.pel} {r.unit}
                  </td>
                  <td>
                    {r.npkp} {r.unit}
                  </td>
                  <td>
                    <a href={r.source} target="_blank" rel="noreferrer">
                      Zdroj ↗
                    </a>
                    <small>
                      {new Date(r.verifiedAt).toLocaleDateString("cs-CZ")}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="notice">
            Žádná ověřená legislativní hodnota zatím nebyla vložena.
          </p>
        )}
        <details>
          <summary>Přidat ověřenou verzi</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void api("/references", {
                substance: f.get("substance"),
                version: f.get("version"),
                pel: Number(f.get("pel")),
                npkp: Number(f.get("npkp")),
                unit: "mg/m³",
                source: f.get("source"),
                verifiedAt: new Date(String(f.get("date"))).toISOString(),
                note: f.get("note"),
              })
                .then(() => {
                  setMsg("Ověřená verze uložena.");
                  void load();
                })
                .catch((e) => setMsg(e.message));
            }}
          >
            <div className="form-grid">
              <label>
                Látka
                <select name="substance">
                  <option>CO</option>
                  <option>H2S</option>
                </select>
              </label>
              <label>
                Účinné znění / verze
                <input name="version" required />
              </label>
              <label>
                PEL (mg/m³)
                <input
                  name="pel"
                  type="number"
                  min={0.001}
                  step="any"
                  required
                />
              </label>
              <label>
                NPK-P (mg/m³)
                <input
                  name="npkp"
                  type="number"
                  min={0.001}
                  step="any"
                  required
                />
              </label>
              <label>
                Zdroj (HTTPS)
                <input name="source" type="url" required />
              </label>
              <label>
                Datum ověření
                <input name="date" type="date" required />
              </label>
            </div>
            <label>
              Poznámka k ověření
              <textarea name="note" defaultValue="" />
            </label>
            <button className="primary">Uložit ověřenou verzi</button>
          </form>
        </details>
        {msg && <p role="status">{msg}</p>}
      </section>
    </>
  );
}
