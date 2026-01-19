/**
 * Normalize a vault path to use forward slashes and no leading slash.
 *
 * @param path - Raw path input.
 * @returns Normalized path string.
 */
export function normalizePath(path: string): string {
  let normalized = path.replace(/\\/g, "/");
  normalized = normalized.replace(/\/+/g, "/");
  normalized = normalized.replace(/^\.\//, "");
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

/**
 * Return the directory portion of a path, or an empty string when none exists.
 *
 * @param path - Raw path input.
 * @returns Directory path without the filename.
 */
export function getDirname(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) {
    return "";
  }
  return normalized.slice(0, lastSlash);
}

/**
 * Return the basename of a file path without the .md extension.
 *
 * @param path - Raw path input.
 * @returns Filename without extension.
 */
export function getBasename(path: string): string {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf("/");
  const filename = lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);
  return filename.endsWith(".md") ? filename.slice(0, -3) : filename;
}
