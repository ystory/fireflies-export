import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isDirectRun } from "../src/is-direct-run.js";

describe("isDirectRun", () => {
  it("returns true when the current file matches argv[1]", () => {
    const filePath = resolve("/tmp/example-script.ts");

    expect(isDirectRun(pathToFileURL(filePath).href, filePath)).toBe(true);
  });

  it("returns false when a similarly named wrapper imports another file", () => {
    const sourcePath = resolve("/repo/src/collect-list.ts");
    const wrapperPath = resolve("/repo/scripts/collect-list.ts");

    expect(isDirectRun(pathToFileURL(sourcePath).href, wrapperPath)).toBe(
      false,
    );
  });
});
