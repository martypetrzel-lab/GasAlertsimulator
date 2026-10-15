"use client";
import { useEffect, useRef, useState } from "react";
import {
  BatteryMedium,
  Radio,
  ShieldAlert,
  Volume2,
  WifiOff,
} from "lucide-react";
import Brand from "./Brand";
import { api, useRealtime } from "@/lib/client";
import { AlarmAudio } from "@/lib/audio";
import { DetectorSnapshot, Gas, gasInfo } from "@/lib/domain";
export default function Detector() {
  const [code, setCode] = useState(""),
    [label, setLabel] = useState(""),
    [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("kod") || "";
    setCode(c);
    if (/^\d{6}$/.test(c)) {
      const saved = localStorage.getItem(`gasalert-detector-${c}`);
      if (saved) setToken(saved);
    }
  }, []);
  if (token)
    return (
      <Device
        token={token}
        onLeave={() => {
          localStorage.removeItem(`gasalert-detector-${code}`);
          setToken("");
        }}
      />
    );
  return (
    <div className="join-page">
      <header className="topbar">
        <Brand />
        <span className="training-tag">MOBILNÍ DETEKTOR</span>
      </header>
      <main className="login-card">
        <span className="role-icon">
          <Radio size={28} />
        </span>
        <div className="eyebrow">PŘIPOJENÍ K VÝCVIKU</div>
        <h1>
          Váš detektor.
          <br />
          <span>Vaše rozhodnutí.</span>
        </h1>
        <p>Zadejte kód cvičení od instruktora.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            void api<{ token: string }>("/join", { code, label })
              .then((r) => {
                localStorage.setItem(`gasalert-detector-${code}`, r.token);
                setToken(r.token);
              })
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        >
          <label>
            Kód cvičení
            <input
              className="code-input"
              aria-label="Kód cvičení"
              required
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label>
            Vaše označení <span className="muted">(nepovinné)</span>
            <input
              placeholder="Např. Hasič 1"
              maxLength={50}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Připojuji…" : "Připojit detektor"} <Radio size={18} />
          </button>
        </form>
        <div className="join-safety">
          <ShieldAlert size={20} />
          <span>
            SIMULACE – NEMĚŘÍ SKUTEČNÉ PLYNY
            <small>
              Pro skutečné zásahy používejte certifikovaný detektor.
            </small>
          </span>
        </div>
      </main>
    </div>
  );
}

function Device({ token, onLeave }: { token: string; onLeave: () => void }) {
  const {
      state: s,
      connected,
      error,
      send,
    } = useRealtime<DetectorSnapshot>("detector", undefined, token),
    [activated, setActivated] = useState(false),
    [visible, setVisible] = useState(true),
    [backlit, setBacklit] = useState(false),
    [screen, setScreen] = useState<"live" | "TWA" | "STEL" | "MAX" | "RESET">(
      "live",
    ),
    [audioIssue, setAudioIssue] = useState(false),
    [message, setMessage] = useState(""),
    [countdown, setCountdown] = useState<number | null>(null);
  const audio = useRef<AlarmAudio | null>(null),
    hold = useRef<ReturnType<typeof setTimeout> | null>(null),
    held = useRef(false),
    lastClick = useRef(0),
    sequence = useRef<ReturnType<typeof setTimeout>[]>([]),
    wake = useRef<WakeLockSentinel | null>(null),
    cycle = useRef<number | null>(null);
  const action = (action: string, visible?: boolean) =>
    send("detector:action", { action, visible }).catch((e) =>
      setMessage(e.message),
    );
  useEffect(() => {
    audio.current = new AlarmAudio();
    return () => {
      audio.current?.stop();
      sequence.current.forEach(clearTimeout);
      if (hold.current) clearTimeout(hold.current);
      void wake.current?.release();
    };
  }, []);
  useEffect(() => {
    const fn = () => {
      setVisible(!document.hidden);
      if (document.hidden) {
        audio.current?.stop();
        setActivated(false);
      }
      void send("detector:action", {
        action: "foreground",
        visible: !document.hidden,
      }).catch(() => {});
    };
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  }, [send]);
  useEffect(() => {
    if (s && cycle.current !== null && cycle.current !== s.cycle)
      setScreen("live");
    if (s) cycle.current = s.cycle;
  }, [s]);
  useEffect(() => {
    if (!s) return;
    audio.current?.update(
      s.alarms,
      activated && connected && visible && s.active && s.status !== "ended",
    );
  }, [s, activated, connected, visible]);
  useEffect(() => {
    if (!connected) audio.current?.stop();
  }, [connected]);
  async function activate() {
    setMessage("");
    try {
      await audio.current?.activate();
      await send("detector:action", { action: "activate" });
      await send("detector:action", { action: "foreground", visible: true });
      setActivated(true);
      setAudioIssue(audio.current?.context?.state !== "running");
      setBacklit(true);
      if ("wakeLock" in navigator)
        try {
          wake.current = await navigator.wakeLock.request("screen");
        } catch {
          /* Prohlížeč může Wake Lock odmítnout. */
        }
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function press() {
    if (held.current) return;
    setBacklit(true);
    setTimeout(() => setBacklit(false), 8000);
    if (screen === "RESET") {
      void action("resetExposure");
      sequence.current.forEach(clearTimeout);
      setScreen("live");
      return;
    }
    void action("ack");
    const now = Date.now();
    if (now - lastClick.current < 400) {
      sequence.current.forEach(clearTimeout);
      setScreen("TWA");
      sequence.current = [
        setTimeout(() => setScreen("STEL"), 2500),
        setTimeout(() => setScreen("MAX"), 5000),
        setTimeout(() => setScreen("RESET"), 7500),
        setTimeout(() => setScreen("live"), 10500),
      ];
    }
    lastClick.current = now;
  }
  function startHold() {
    held.current = false;
    setCountdown(3);
    hold.current = setTimeout(() => {
      held.current = true;
      setCountdown(null);
      void action("deactivate");
      audio.current?.stop();
      setActivated(false);
    }, 3000);
  }
  function endHold() {
    if (hold.current) clearTimeout(hold.current);
    setCountdown(null);
  }
  const unavailable = !connected || !s;
  if (!activated && s?.status !== "ended")
    return (
      <div className="activation-screen">
        <div className="activation-emblem">
          <Radio size={56} />
        </div>
        <span className="eyebrow">VÝCVIKOVÝ DETEKTOR X3</span>
        <h1>Aktivovat detektor</h1>
        <p>
          Dotyk spustí simulaci a povolí zvuk.
          <br />
          Telefon ponechte odemčený a aplikaci v popředí.
        </p>
        <button
          className="primary"
          disabled={unavailable}
          onClick={() => void activate()}
        >
          <Volume2 size={21} />{" "}
          {unavailable ? "Čekám na spojení…" : "Aktivovat detektor"}
        </button>
        {(message || error) && (
          <p role="alert" className="error">
            {message || error}
          </p>
        )}
        <small>Tichý režim a nastavení telefonu mohou zvuk omezit.</small>
        <div className="activation-warning">
          SIMULACE – NEMĚŘÍ SKUTEČNÉ PLYNY
        </div>
        <button className="text-link" onClick={onLeave}>
          Zpět na připojení
        </button>
      </div>
    );
  const alarm = s?.alarms,
    alarmOn = !!alarm?.display.length && !unavailable && s?.status !== "ended",
    cadence = alarm?.cadence || "none";
  const value = (g: Gas) => {
    if (unavailable || !s) return "—";
    if (s.faults.includes(g)) return "Err";
    if (s.values[g] > gasInfo[g].max) return "OL";
    if (screen === "TWA" || screen === "STEL") {
      if (g !== "CO" && g !== "H2S") return "—";
      return (
        screen === "TWA" ? s.exposure.twa[g] : s.exposure.stel[g]
      ).toFixed(1);
    }
    if (screen === "MAX") return s.exposure.max[g].toFixed(g === "O2" ? 1 : 0);
    return s.values[g].toFixed(g === "O2" ? 1 : 0);
  };
  return (
    <main className={`detector-stage ${alarmOn ? "alarm-stage" : ""}`}>
      <div
        className={`device-body ${alarmOn ? `alarming cadence-${cadence}` : ""}`}
      >
        <div className="device-top">
          <span className="device-screw" />
          <div className="sensor-grille">
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <span className="device-screw" />
        </div>
        <div className="device-leds">
          <span className="alarm-led left-led" />
          <span
            className={`intelliflash ${!alarmOn && s?.intelliFlash && connected && s?.status === "running" ? "flashing" : ""}`}
          />
          <span className="alarm-led right-led" />
        </div>
        <div className="device-model">
          GASALERT <span>TRAINING X3</span>
        </div>
        <div className={`lcd ${backlit || alarmOn ? "backlit" : ""}`}>
          <div className="lcd-top">
            <span>
              {s?.status === "ended"
                ? "OFF"
                : countdown !== null
                  ? "OFF 3"
                  : screen === "live"
                    ? ""
                    : screen}
            </span>
            <span>{alarm?.muted.length ? "♪̸" : ""}</span>
            <BatteryMedium size={26} />
            <span className="lcd-bat">{s?.battery ?? 0}%</span>
          </div>
          {unavailable ? (
            <div className="lcd-connection" role="alert">
              <WifiOff size={38} />
              <b>PORUCHA SPOJENÍ</b>
              <span>SIMULACE</span>
            </div>
          ) : s?.status === "ended" ? (
            <div className="lcd-connection">
              <b>OFF</b>
              <span>CVIČENÍ UKONČENO</span>
            </div>
          ) : (
            <>
              <div className="lcd-readings">
                {(["H2S", "CO", "LEL", "O2"] as Gas[]).map((g) => (
                  <div
                    key={g}
                    className={`lcd-cell ${alarm?.display.some((a) => a.gas === g) ? "channel-alarm" : ""}`}
                  >
                    <div className="lcd-cell-head">
                      <span>{gasInfo[g].symbol}</span>
                      <small>{gasInfo[g].unit}</small>
                    </div>
                    <strong data-testid={`detector-${g}`}>{value(g)}</strong>
                    <div className="channel-state">
                      {alarm?.display
                        .filter((a) => a.gas === g)
                        .map((a) => a.kind)
                        .join(" ") || " "}
                    </div>
                  </div>
                ))}
              </div>
              <div className="lcd-status" role="status">
                {s?.status === "paused"
                  ? "POZASTAVENO"
                  : s?.status === "ready"
                    ? "ČEKÁNÍ NA START"
                    : alarm?.multi
                      ? "MULTIGAS ALARM"
                      : alarmOn
                        ? alarm?.display
                            .map((a) => a.kind)
                            .filter((k, i, arr) => arr.indexOf(k) === i)
                            .join(" · ")
                        : "●"}
                {s?.exposure.incomplete && <span> EXP ?</span>}
              </div>
            </>
          )}
        </div>
        <div className="device-lower">
          <div className="speaker-grille">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <button
            className="c-button"
            aria-label="Tlačítko C"
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onPointerLeave={endHold}
            onClick={press}
          >
            C
          </button>
          <div className="lower-grille">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        </div>
        <div className="device-bottom">
          <span className="device-screw" />
          <span>4 GAS · VÝCVIK</span>
          <span className="device-screw" />
        </div>
        <div className="device-warning">SIMULACE – NEMĚŘÍ SKUTEČNÉ PLYNY</div>
      </div>
      {(!visible || audioIssue || message) && (
        <div className="detector-notice" role="alert">
          {message ||
            (!visible
              ? "SIMULACE NENÍ AKTIVNÍ V POPŘEDÍ"
              : "Zvuk není aktivní. Dotykem obnovte zvuk.")}
          <button onClick={() => void activate()}>Obnovit</button>
        </div>
      )}
      {s?.status === "ended" && (
        <button className="detector-exit" onClick={onLeave}>
          Zpět na připojení
        </button>
      )}
    </main>
  );
}
