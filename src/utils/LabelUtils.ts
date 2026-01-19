import { getBasename } from "./PathUtils";

type TitleFrontmatter = { title?: unknown };

/**
 * Resolve a file label using frontmatter title when available.
 */
export const resolveFileLabel = (filePath: string, frontmatter?: TitleFrontmatter | null): string => {
  const rawTitle = typeof frontmatter?.title === "string" ? frontmatter.title.trim() : "";
  return rawTitle ? rawTitle : getBasename(filePath);
};
