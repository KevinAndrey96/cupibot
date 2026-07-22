import { useSessionResult } from "../context/SessionContext.js";
import { BRAND } from "../constants/branding";
import { PageShell } from "../components/PageShell";

export function SummaryPage() {
  const { lastResult } = useSessionResult();

  if (!lastResult) {
    return (
      <PageShell title="Resumen de ejecución" subtitle="Aquí verás el resultado de tu última sesión.">
        <div className="card empty-state">
          <img src={BRAND.main} alt={BRAND.name} />
          <div>
            <p><strong>Aún no hay una sesión completada.</strong></p>
            <p style={{ color: "var(--brand-text-muted)", marginBottom: 0 }}>
              Ejecuta {BRAND.name} desde la pestaña Ejecutar para ver estadísticas aquí.
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  const durationSec = Math.round(lastResult.durationMs / 1000);

  return (
    <PageShell
      title="Resumen de ejecución"
      subtitle={`Sesión ${lastResult.mode} · ${durationSec}s`}
    >
      <div className={`card result-hero ${lastResult.ok ? "success" : "error"}`}>
        <img src={BRAND.main} alt={BRAND.name} />
        <div>
          <p style={{ marginTop: 0 }}>
            Estado:{" "}
            <span className={`badge ${lastResult.ok ? "ok" : "bad"}`}>{lastResult.reason}</span>
          </p>
          <p style={{ color: "var(--brand-text-muted)" }}>
            {lastResult.ok
              ? "Sesión completada correctamente. Revisa las métricas abajo."
              : "La sesión terminó con un problema. Revisa el detalle del error."}
          </p>
          {lastResult.error && <p className="error-text">{lastResult.error.message}</p>}
        </div>
      </div>

      {lastResult.stats && (
        <div className="card">
          <h3>Swipe stats</h3>
          <div className="stats-grid">
            <div className="stat-box">
              <strong>{lastResult.stats.likes + lastResult.stats.passes}</strong>
              <span>swipes</span>
            </div>
            <div className="stat-box">
              <strong>{lastResult.stats.likes}</strong>
              <span>likes</span>
            </div>
            <div className="stat-box">
              <strong>{lastResult.stats.passes}</strong>
              <span>passes</span>
            </div>
            <div className="stat-box">
              <strong>{lastResult.stats.matches}</strong>
              <span>matches</span>
            </div>
            <div className="stat-box">
              <strong>{lastResult.stats.messagesSent}</strong>
              <span>mensajes</span>
            </div>
            <div className="stat-box">
              <strong>{lastResult.stats.filtered}</strong>
              <span>filtrados</span>
            </div>
          </div>
          <h4 style={{ marginTop: 16 }}>Breakdown filtros</h4>
          <table>
            <tbody>
              {Object.entries(lastResult.stats.filterBreakdown).map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastResult.chatSummary && (
        <div className="card">
          <h3>Chat</h3>
          <div className="stats-grid">
            <div className="stat-box">
              <strong>{lastResult.chatSummary.cyclesCompleted}</strong>
              <span>ciclos</span>
            </div>
            <div className="stat-box">
              <strong>{lastResult.chatSummary.repliesSent}</strong>
              <span>replies</span>
            </div>
          </div>
        </div>
      )}

      {lastResult.analysis && (
        <div className="card">
          <h3>Análisis</h3>
          <p>Conversaciones sincronizadas: {lastResult.conversationsSynced ?? 0}</p>
          <div className="stats-grid">
            <div className="stat-box">
              <strong>{lastResult.analysis.metrics.totalConversations}</strong>
              <span>conversaciones</span>
            </div>
            <div className="stat-box">
              <strong>{lastResult.analysis.metrics.replyRatePercent}%</strong>
              <span>reply rate</span>
            </div>
            <div className="stat-box">
              <strong>{lastResult.analysis.metrics.instagramCount}</strong>
              <span>instagrams</span>
            </div>
          </div>
          <div className="markdown-body" style={{ marginTop: 16 }}>
            {lastResult.analysis.reportMarkdown}
          </div>
        </div>
      )}
    </PageShell>
  );
}
