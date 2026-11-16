/**
 * Screenshots shown in the docs and articles. A line like [[screenshot: connect-facebook | The Facebook Pages screen]]
 * shows the picture ONLY when its name is listed here, so a missing picture never appears as a broken image.
 *
 * To add one: save the picture as public/docs/screenshots/<name>.png (about 1440 px wide, no personal data in it),
 * then add <name> to the list below. docs/SCREENSHOT_GUIDE.md lists the pictures the docs ask for.
 */
export const SCREENSHOT_NAMES: string[] = [];

export const SCREENSHOT_SIZE = { width: 1440, height: 900 };

export function screenshotFor(name: string): { src: string; width: number; height: number } | null {
  return SCREENSHOT_NAMES.includes(name) ? { src: `/docs/screenshots/${name}.png`, ...SCREENSHOT_SIZE } : null;
}
