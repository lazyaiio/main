import { describe, expect, it } from "vitest";
import { buildMediaPath, parseMediaPath } from "./paths";

const WS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OBJ = "22222222-2222-4222-8222-222222222222";

describe("media paths", () => {
  it("builds and parses a valid path", () => {
    const path = buildMediaPath(WS, OBJ, "png");
    expect(path).toBe(`${WS}/${OBJ}.png`);
    expect(parseMediaPath(path)).toEqual({ workspaceId: WS, objectId: OBJ, ext: "png" });
  });

  it("refuses anything that is not workspace/random-id.extension", () => {
    expect(parseMediaPath(`${WS}/evil.png`)).toBeNull();
    expect(parseMediaPath(`${WS}/${OBJ}.svg`)).toBeNull();
    expect(parseMediaPath(`${WS}/sub/${OBJ}.png`)).toBeNull();
    expect(parseMediaPath(`../${WS}/${OBJ}.png`)).toBeNull();
    expect(parseMediaPath(`${WS.toUpperCase()}/${OBJ}.png`)).toBeNull();
    expect(parseMediaPath(`${OBJ}.png`)).toBeNull();
  });

  it("refuses to build a path from a bad id", () => {
    expect(() => buildMediaPath("not-a-uuid", OBJ, "png")).toThrow();
  });
});
