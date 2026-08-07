import { describe, expect, it } from "vitest";
import { validateContract } from "./validation.js";

describe("contract validation", () => {
  it("reports duplicate ids, missing required claims, and malformed probes", () => {
    const issues = validateContract({
      contractVersion: "1.0",
      id: "broken",
      goal: "Broken contract",
      createdAt: "not-a-date",
      claims: [
        {
          id: "same",
          statement: "First",
          level: "advisory",
          probe: { type: "file.exists", path: "" },
        },
        {
          id: "same",
          statement: "Second",
          level: "advisory",
          probe: { type: "unknown" },
        },
      ],
    });

    expect(issues.map((issue) => issue.path)).toContain("createdAt");
    expect(issues.map((issue) => issue.path)).toContain("claims[1].id");
    expect(issues.map((issue) => issue.path)).toContain("claims");
  });

  it("rejects non-finite JSON expectations before contract hashing", () => {
    const issues = validateContract({
      contractVersion: "1.0",
      id: "json-contract",
      goal: "Validate a numeric limit",
      createdAt: "2026-08-07T00:00:00.000Z",
      claims: [{
        id: "limit",
        statement: "Limit is finite",
        level: "required",
        probe: {
          type: "json.assert",
          path: "config.json",
          pointer: "/limit",
          operator: "equals",
          expected: Number.NaN,
        },
      }],
    });

    expect(issues.map((issue) => issue.path)).toContain("claims[0].probe.expected");
  });
});
