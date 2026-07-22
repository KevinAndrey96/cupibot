import { useEffect, useState } from "react";
import type { ConfigJsonFile } from "../../../shared/ipc.js";

export function JsonConfigPage() {
  const [configs, setConfigs] = useState<ConfigJsonFile[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    window.cupibot.listJsonConfigs().then((items) => {
      setConfigs(items);

      if (items[0]) {
        setSelected(items[0].relativePath);
      }
    });
  }, []);

  useEffect(() => {
    if (!selected) {
      return;
    }

    window.cupibot.readJson(selected).then(setContent);
  }, [selected]);

  const save = async () => {
    try {
      JSON.parse(content);
      await window.cupibot.writeJson(selected, content);
      const validation = await window.cupibot.validateConfig();
      setErrors(validation.errors);
      setMessage(validation.ok ? "Config guardada" : "Guardada con errores");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div>
      <h2 className="page-title">Gustos y prompts</h2>
      <div className="tabs">
        {configs.map((config) => (
          <div
            key={config.relativePath}
            className={`tab ${selected === config.relativePath ? "active" : ""}`}
            onClick={() => setSelected(config.relativePath)}
          >
            {config.label}
          </div>
        ))}
      </div>
      <div className="actions">
        <button onClick={save}>Guardar</button>
      </div>
      {message && <p className="success-text">{message}</p>}
      {errors.length > 0 && (
        <div className="card error-text">
          {errors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      )}
      <div className="card">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} />
      </div>
    </div>
  );
}
