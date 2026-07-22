import { useEffect, useState } from "react";
import type { EnvVariable } from "../../../shared/ipc.js";

export function EnvConfigPage() {
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    window.cupibot.readEnv().then(setVariables);
  }, []);

  const updateVariable = (index: number, field: "key" | "value", value: string) => {
    setVariables((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const save = async () => {
    await window.cupibot.writeEnv(variables);
    const validation = await window.cupibot.validateConfig();
    setErrors(validation.errors);
    setMessage(validation.ok ? "Guardado y validado correctamente" : "Guardado con errores de validación");
  };

  return (
    <div>
      <h2 className="page-title">Variables de entorno</h2>
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
        {variables.map((variable, index) => (
          <div key={`${variable.key}-${index}`} className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Key</label>
              <input value={variable.key} onChange={(e) => updateVariable(index, "key", e.target.value)} />
            </div>
            <div className="field">
              <label>Value</label>
              <input value={variable.value} onChange={(e) => updateVariable(index, "value", e.target.value)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
