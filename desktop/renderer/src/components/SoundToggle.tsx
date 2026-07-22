import { useSound } from "../context/SoundContext";

export function SoundToggle() {
  const { enabled, toggle } = useSound();

  return (
    <button
      type="button"
      className="sound-toggle"
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? "Silenciar sonidos" : "Activar sonidos"}
    >
      {enabled ? "Sonido ON" : "Sonido OFF"}
    </button>
  );
}
