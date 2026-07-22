import { assetUrl } from "../utils/asset-url";

export const BRAND = {
  name: "CupiBot",
  icon: assetUrl("branding/icon.png"),
  banner1: assetUrl("branding/banner1.png"),
  banner2: assetUrl("branding/banner2.png"),
  main: assetUrl("branding/main.png"),
  tagline: "Tu match inteligente",
} as const;

export const REPO = {
  url: "https://github.com/KevinAndrey96/cupibot",
  title: "CupiBot en GitHub",
  lead: "CupiBot es gratis. Sin suscripciones, sin trucos.",
  cta: "Si te ahorró tiempo o te dio una buena risa con un match raro, una estrellita en GitHub es el mejor \"gracias\" que podemos recibir.",
  button: "Dejar una estrella",
} as const;

export const NAV_ITEMS = [
  { to: "/", label: "Ejecutar" },
  { to: "/summary", label: "Resumen" },
  { to: "/env", label: "Variables .env" },
  { to: "/configs", label: "Gustos / prompts" },
  { to: "/data", label: "Datos" },
  { to: "/setup", label: "Setup" },
] as const;
