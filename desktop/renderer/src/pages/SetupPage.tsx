import { useEffect, useState } from "react";
import { BRAND } from "../constants/branding";
import { PageShell } from "../components/PageShell";
import { useSound } from "../context/SoundContext";

export function SetupPage() {
  const { play } = useSound();
  const [dataDir, setDataDir] = useState("");
  const [bootstrap, setBootstrap] = useState<{ chromium: boolean; ollama: boolean } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    setDataDir(await window.cupibot.getDataDir());
    setBootstrap(await window.cupibot.checkBootstrap());
  };

  useEffect(() => {
    refresh();

    const unsubscribe = window.cupibot.onBootstrapProgress((progress) => {
      if (progress.step === "complete") {
        setInstalling(false);
        void refresh();
      } else {
        setInstalling(true);
      }
    });

    return unsubscribe;
  }, []);

  const setupConfig = async () => {
    play("click");
    await window.cupibot.setupConfig();
    setMessage("Configs de ejemplo copiadas si faltaban");
    play("success");
    await refresh();
  };

  const runBootstrap = async () => {
    setInstalling(true);
    setMessage("");
    play("start");

    try {
      await window.cupibot.runBootstrap();
      setMessage("Bootstrap completado");
      play("complete");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      play("error");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <PageShell
      title="Setup inicial"
      subtitle="Prepara dependencias, configs y tu entorno local en un solo lugar."
      hero={BRAND.banner1}
      heroClassName="page-hero page-hero--setup"
    >
      <div className="card">
        <h3>Directorio de datos</h3>
        <p><code>{dataDir}</code></p>
        <div className="status-row" style={{ marginTop: 14 }}>
          <span className={`status-pill ${bootstrap?.chromium ? "ok" : "bad"}`}>
            <span className="status-dot" />
            Chromium {bootstrap?.chromium ? "listo" : "pendiente"}
          </span>
          <span className={`status-pill ${bootstrap?.ollama ? "ok" : "bad"}`}>
            <span className="status-dot" />
            Ollama {bootstrap?.ollama ? "listo" : "pendiente"}
          </span>
        </div>
      </div>
      <div className="actions">
        <button onClick={setupConfig}>Copiar configs ejemplo</button>
        <button className="secondary" onClick={runBootstrap} disabled={installing}>
          {installing ? "Instalando..." : "Instalar dependencias"}
        </button>
        <button className="secondary" onClick={() => { play("click"); void refresh(); }}>
          Verificar
        </button>
      </div>
      {message && <p className="success-text">{message}</p>}
      <div className="card">
        <h3>Dependencias automáticas</h3>
        <ul>
          <li>Ollama se instala y arranca automáticamente la primera vez</li>
          <li>Chromium de Playwright se descarga desde aquí o al iniciar una sesión</li>
          <li>Los modelos de IA se descargan solos al primer uso</li>
          <li>Tus gustos y .env viven en el directorio de datos mostrado arriba</li>
        </ul>
      </div>
    </PageShell>
  );
}
