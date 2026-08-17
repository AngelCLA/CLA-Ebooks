import { describe, expect, test } from "vitest";
import { formatBytes, suggestTitle } from "./ebook";

describe("suggestTitle", () => {
  test("removes the PDF extension and normalizes separators", () => {
    expect(suggestTitle("memoria_anual-2026.pdf")).toBe("Memoria Anual 2026");
  });
});

describe("formatBytes", () => {
  test("formats kilobytes and megabytes", () => {
    expect(formatBytes(1)).toBe("1 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
