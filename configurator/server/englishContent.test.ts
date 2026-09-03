import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = process.cwd();
const SOURCE_DIRECTORIES = ["client/src", "server", "shared", "scripts", "drizzle"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mjs", ".sql"]);
const CJK_CHARACTERS = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return SOURCE_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf("."))) ? [absolutePath] : [];
  });
}

describe("pilot English-only content", () => {
  it("contains no Chinese, Japanese, or Korean characters in application source or seed scripts", () => {
    const offenders = SOURCE_DIRECTORIES
      .flatMap((directory) => sourceFiles(join(PROJECT_ROOT, directory)))
      .filter((file) => CJK_CHARACTERS.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(`${PROJECT_ROOT}/`, ""));

    expect(offenders).toEqual([]);
  });
});
