import { describe, expect, it } from "vitest";
import { diffContracts } from "./diff.js";
import type { OutcomeContract } from "./types.js";

const base: OutcomeContract = {
  contractVersion: "1.0",
  id: "v1",
  goal: "Verify the project",
  createdAt: "2026-07-29T00:00:00.000Z",
  claims: [
    {
      id: "tests",
      statement: "Tests pass",
      level: "required",
      probe: {
        type: "command.exit",
        executable: "pnpm",
        args: ["test"],
      },
    },
    {
      id: "manifest",
      statement: "Manifest exists",
      level: "required",
      probe: {
        type: "file.exists",
        path: "package.json",
        kind: "file",
      },
    },
  ],
  permissions: {
    commands: [{ executable: "pnpm", argsPrefix: ["test"] }],
  },
};

describe("contract diff", () => {
  it("flags relaxed claims and expanded capabilities", () => {
    const result = diffContracts(base, {
      ...base,
      id: "v2",
      claims: [
        { ...base.claims[0]!, level: "advisory" },
        base.claims[1]!,
      ],
      permissions: {
        commands: [
          { executable: "pnpm", argsPrefix: ["test"] },
          { executable: "curl" },
        ],
        networkHosts: ["example.com"],
      },
    });

    expect(result.weakenedControls).toHaveLength(3);
    expect(result.modified).toEqual(["tests"]);
  });
});
