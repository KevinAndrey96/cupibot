import { useEffect, useState } from "react";
import type { ConversationListItem } from "../../../shared/ipc.js";

type DataTab = "conversations" | "instagrams" | "unmatches" | "runtime" | "analysis";

export function DataPage() {
  const [tab, setTab] = useState<DataTab>("conversations");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [messages, setMessages] = useState<Array<{ sender: string; content: string }>>([]);
  const [instagrams, setInstagrams] = useState<Array<Record<string, string>>>([]);
  const [unmatches, setUnmatches] = useState<Array<Record<string, unknown>>>([]);
  const [runtime, setRuntime] = useState<Array<Record<string, string>>>([]);
  const [analysisMarkdown, setAnalysisMarkdown] = useState<string | null>(null);
  const [analysisMetrics, setAnalysisMetrics] = useState<unknown>(null);

  const loadTab = async (nextTab: DataTab) => {
    setTab(nextTab);

    if (nextTab === "conversations") {
      const items = await window.cupibot.listConversations();
      setConversations(items);

      if (items[0]) {
        setSelectedFile(items[0].fileName);
        const data = await window.cupibot.readConversation(items[0].fileName);
        setMessages(data as Array<{ sender: string; content: string }>);
      }
    }

    if (nextTab === "instagrams") {
      setInstagrams(await window.cupibot.readInstagrams() as Array<Record<string, string>>);
    }

    if (nextTab === "unmatches") {
      setUnmatches(await window.cupibot.readUnmatches() as Array<Record<string, unknown>>);
    }

    if (nextTab === "runtime") {
      setRuntime(await window.cupibot.readRuntimeContext() as Array<Record<string, string>>);
    }

    if (nextTab === "analysis") {
      const report = await window.cupibot.readAnalysisReport();
      setAnalysisMarkdown(report.markdown);
      setAnalysisMetrics(report.metrics);
    }
  };

  useEffect(() => {
    loadTab("conversations");
  }, []);

  const openConversation = async (fileName: string) => {
    setSelectedFile(fileName);
    const data = await window.cupibot.readConversation(fileName);
    setMessages(data as Array<{ sender: string; content: string }>);
  };

  const tabs: Array<{ id: DataTab; label: string }> = [
    { id: "conversations", label: "Conversaciones" },
    { id: "instagrams", label: "Instagrams" },
    { id: "unmatches", label: "Unmatches" },
    { id: "runtime", label: "Preguntas pendientes" },
    { id: "analysis", label: "Informe" },
  ];

  return (
    <div>
      <h2 className="page-title">Datos de scraping</h2>
      <div className="tabs">
        {tabs.map((item) => (
          <div
            key={item.id}
            className={`tab ${tab === item.id ? "active" : ""}`}
            onClick={() => loadTab(item.id)}
          >
            {item.label}
          </div>
        ))}
      </div>

      {tab === "conversations" && (
        <div className="grid-2">
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Mensajes</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((item) => (
                  <tr
                    key={item.fileName}
                    style={{ cursor: "pointer", background: selectedFile === item.fileName ? "#222938" : undefined }}
                    onClick={() => openConversation(item.fileName)}
                  >
                    <td>{item.name}</td>
                    <td>{item.messageCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            {messages.map((message, index) => (
              <div key={index} className={`chat-bubble ${message.sender}`}>
                {message.content}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "instagrams" && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Handle</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {instagrams.map((item, index) => (
                <tr key={index}>
                  <td>{item.name}</td>
                  <td>@{item.handle}</td>
                  <td>{item.collectedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "unmatches" && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Último mensaje</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {unmatches.map((item, index) => (
                <tr key={index}>
                  <td>{String(item.name)}</td>
                  <td>{String(item.lastMessageContent ?? "")}</td>
                  <td>{String(item.totalMessages ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "runtime" && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Pregunta</th>
                <th>Respuesta</th>
                <th>Preguntó</th>
              </tr>
            </thead>
            <tbody>
              {runtime.map((item, index) => (
                <tr key={index}>
                  <td>{item.question}</td>
                  <td>{item.answer || "(pendiente)"}</td>
                  <td>{item.askedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "analysis" && (
        <div className="card">
          {analysisMetrics != null && (
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(analysisMetrics, null, 2)}</pre>
          )}
          <div className="markdown-body">{analysisMarkdown ?? "Sin informe generado aún"}</div>
        </div>
      )}
    </div>
  );
}
