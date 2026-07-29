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
});
