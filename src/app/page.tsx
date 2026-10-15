"use client";
import { useState } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Radio,
  Users,
  Signal,
  ScanLine,
} from "lucide-react";
import Brand from "@/components/Brand";
import { useRouter } from "next/navigation";
export default function Home() {
  const [code, setCode] = useState(""),
    router = useRouter();
  return (
    <div className="landing">
      <header className="topbar">
        <Brand />
        <span className="training-tag">
          <span className="dot amber" /> ODBORNÁ PŘÍPRAVA JEDNOTEK PO
        </span>
      </header>
      <main className="landing-main">
        <div className="intro">
          <div className="eyebrow">
            <span className="line" /> PŘIPRAVENI NA SKUTEČNOST
          </div>
          <h1>
            Bezpečný výcvik.
            <br />
            <span>Skutečné rozhodování.</span>
          </h1>
          <p>
            Prostředí řídí instruktor. Situaci vyhodnocuje hasič.
            <br />
            Čtyři plyny, společné cvičení a detektor v každé ruce.
          </p>
          <div className="intro-features">
            <span>
              <Signal size={17} /> Živá synchronizace
            </span>
            <span>
              <Users size={17} /> Společný výcvik
            </span>
          </div>
          <div className="visual-strip">
            <span>
              O₂ <b>20.9</b>
              <small>% obj.</small>
            </span>
            <span>
              CO <b>0</b>
              <small>ppm</small>
            </span>
            <span>
              H₂S <b>0</b>
              <small>ppm</small>
            </span>
            <span>
              LEL <b>0</b>
              <small>% LEL</small>
            </span>
          </div>
        </div>
        <div className="role-stack">
          <a href="/instruktor" className="role-card instructor-role">
            <span className="role-icon">
              <ShieldCheck size={26} />
            </span>
            <span className="eyebrow">01 / INSTRUKTOR</span>
            <h2>Veďte cvičení</h2>
            <p>
              Nastavte prostředí, připojte jednotku
              <br />a mějte průběh pod kontrolou.
            </p>
            <span className="role-link">
              Přihlásit se <ArrowRight size={19} />
            </span>
          </a>
          <form
            className="role-card"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/detektor?kod=${code}`);
            }}
          >
            <div className="card-heading">
              <span className="role-icon secondary">
                <ScanLine size={24} />
              </span>
              <span className="eyebrow">02 / HASIČ</span>
            </div>
            <h2>Připojte detektor</h2>
            <p>
              Naskenujte QR kód instruktora
              <br />
              nebo zadejte šestimístný kód cvičení.
            </p>
            <div className="join-inline">
              <input
                required
                aria-label="Kód cvičení"
                placeholder="000000"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              <button
                className="primary square"
                aria-label="Připojit k cvičení"
              >
                <ArrowRight />
              </button>
            </div>
          </form>
        </div>
      </main>
      <footer className="landing-footer">
        <span>
          <Radio size={16} /> SIMULACE – NEMĚŘÍ SKUTEČNÉ PLYNY
        </span>
        <span>
          Výhradně pro odbornou přípravu. Nenahrazuje skutečný detektor.
        </span>
      </footer>
    </div>
  );
}
