import path from "node:path";

export function assertSafeFileName(fileName: string): string {
  const trimmed = fileName.trim();

  if (!trimmed) {
    throw new Error("file name is required");
  }

  if (trimmed !== path.basename(trimmed)) {
    throw new Error(`invalid file name: ${fileName}`);
  }

  if (trimmed === "." || trimmed === "..") {
    throw new Error(`invalid file name: ${fileName}`);
  }

  return trimmed;
}

export function assertAllowedRelativePath(
  allowedPaths: readonly string[],
  relativePath: string,
): string {
  const normalized = relativePath.replace(/\\/g, "/");

  if (!allowedPaths.includes(normalized)) {
    throw new Error(`path not allowed: ${relativePath}`);
  }

  return normalized;
}

export function assertPathInsideRoot(rootDir: string, targetPath: string): string {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);

  if (resolvedTarget === resolvedRoot) {
    return resolvedTarget;
  }

  if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("path escapes allowed directory");
  }

  return resolvedTarget;
}
