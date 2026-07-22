export function assetUrl(relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, "");

  return `${import.meta.env.BASE_URL}${normalized}`;
}
