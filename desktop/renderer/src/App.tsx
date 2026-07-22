import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import type { BootstrapProgress } from "../../shared/bootstrap-progress.js";
import { BRAND, NAV_ITEMS } from "./constants/branding";
import { SessionProvider } from "./context/SessionContext";
import { SoundProvider, useSound } from "./context/SoundContext";
import { BootstrapProgressBar } from "./components/BootstrapProgressBar";
import { SoundToggle } from "./components/SoundToggle";
import { GitHubStarCard } from "./components/GitHubStarCard";
import { DashboardPage } from "./pages/DashboardPage";
import { SummaryPage } from "./pages/SummaryPage";
import { EnvConfigPage } from "./pages/EnvConfigPage";
import { JsonConfigPage } from "./pages/JsonConfigPage";
import { DataPage } from "./pages/DataPage";
import { SetupPage } from "./pages/SetupPage";

function AppShell() {
  const [bootstrapProgress, setBootstrapProgress] = useState<BootstrapProgress | null>(null);
  const [preloadMissing, setPreloadMissing] = useState(false);
  const { play } = useSound();

  useEffect(() => {
    if (!window.cupibot?.onBootstrapProgress) {
      setPreloadMissing(true);

      return;
    }

    play("open");

    const unsubscribe = window.cupibot.onBootstrapProgress((progress) => {
      setBootstrapProgress(progress.step === "complete" ? null : progress);

      if (progress.step === "complete") {
        play("complete");
      }
    });

    return unsubscribe;
  }, [play]);

  if (preloadMissing) {
    return (
      <div className="card" style={{ margin: 24 }}>
        <h2 className="page-title">{BRAND.name} no pudo iniciar la interfaz</h2>
        <p className="error-text">
          No se cargó el puente de Electron (preload). Cierra la app y vuelve a ejecutar
          {" "}
          <code>npm run desktop:dev</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <img src={BRAND.icon} alt={BRAND.name} />
          <div>
            <strong>{BRAND.name}</strong>
            <span>{BRAND.tagline}</span>
          </div>
        </div>
        <nav>
          {NAV_ITEMS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              end={link.to === "/"}
              onClick={() => play("click")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <SoundToggle />
        <GitHubStarCard />
        <p className="sidebar-footer">
          Automatización inteligente para Tinder y Bumble con IA local.
        </p>
      </aside>
      <main className="content">
        <SessionProvider>
          <BootstrapProgressBar progress={bootstrapProgress} />
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/summary" element={<SummaryPage />} />
            <Route path="/env" element={<EnvConfigPage />} />
            <Route path="/configs" element={<JsonConfigPage />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="/setup" element={<SetupPage />} />
          </Routes>
        </SessionProvider>
      </main>
    </div>
  );
}

export function App() {
  return (
    <SoundProvider>
      <AppShell />
    </SoundProvider>
  );
}
