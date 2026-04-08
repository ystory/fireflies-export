import { describe, expect, it } from "vitest";
import { MISSING_API_KEY_MESSAGE, validateConfig } from "../src/config.js";

describe("validateConfig", () => {
  it("throws a helpful error when the API key is missing", () => {
    expect(() => validateConfig({ apiKey: "" })).toThrowError(
      MISSING_API_KEY_MESSAGE,
    );
  });

  it("accepts a present API key", () => {
    expect(() => validateConfig({ apiKey: "test-api-key" })).not.toThrow();
  });
});
