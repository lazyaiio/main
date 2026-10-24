import type { ImageExt } from "./image-inspect";

/** Storage paths are always  <workspace id>/<random id>.<ext>  (same rule as the database policy). */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH_RE = new RegExp(`^(${UUID})/(${UUID})\\.(jpg|png|webp|gif)$`);

export function buildMediaPath(workspaceId: string, objectId: string, ext: ImageExt): string {
  const path = `${workspaceId}/${objectId}.${ext}`;
  if (!PATH_RE.test(path)) throw new Error("Invalid media path");
  return path;
}

export function parseMediaPath(path: string): { workspaceId: string; objectId: string; ext: ImageExt } | null {
  const match = PATH_RE.exec(path);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  return { workspaceId: match[1], objectId: match[2], ext: match[3] as ImageExt };
}
