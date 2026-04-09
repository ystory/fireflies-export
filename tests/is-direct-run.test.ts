import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { isDirectRun } from "../src/is-direct-run.js";

describe("isDirectRun", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("returns true when the current file matches argv[1]", () => {
    const filePath = resolve("/tmp/example-script.ts");

    expect(isDirectRun(pathToFileURL(filePath).href, filePath)).toBe(true);
  });

  it("returns true when argv[1] is a symlink to the current file", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "fireflies-export-"));
    const targetPath = join(tempDir, "dist", "cli.js");
    const linkPath = join(tempDir, ".bin", "fireflies-export");

    tempDirs.push(tempDir);
    mkdirSync(join(tempDir, "dist"), { recursive: true });
    mkdirSync(join(tempDir, ".bin"), { recursive: true });
    writeFileSync(targetPath, "console.log('ok');", { encoding: "utf8" });
    symlinkSync(targetPath, linkPath);

    expect(isDirectRun(pathToFileURL(targetPath).href, linkPath)).toBe(true);
  });

  it("returns false when a similarly named wrapper imports another file", () => {
    const sourcePath = resolve("/repo/src/collect-list.ts");
    const wrapperPath = resolve("/repo/scripts/collect-list.ts");

    expect(isDirectRun(pathToFileURL(sourcePath).href, wrapperPath)).toBe(
      false,
    );
  });
});
