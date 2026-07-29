import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { OutcomeContract } from "@tuntas/core";
import { runContract } from "./runner.js";

function contract(
  claims: OutcomeContract["claims"],
  permissions?: OutcomeContract["permissions"],
): OutcomeContract {
  return {
    contractVersion: "1.0",
    id: "fixture",
    goal: "Verify a fixture",
    createdAt: "2026-07-29T00:00:00.000Z",
    claims,
    ...(permissions ? { permissions } : {}),
  };
}

describe("runContract", () => {
  it("checks files and JSON without privileged capabilities", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "tuntas-runner-"));
    await mkdir(join(workspace, "src"));
    await writeFile(join(workspace, "src", "status.txt"), "READY\n", "utf8");
    await writeFile(
      join(workspace, "package.json"),
      JSON.stringify({ scripts: { test: "vitest run" } }),
      "utf8",
    );
    const evidence = await runContract(
      contract([
        {
          id: "ready",
          statement: "Status is ready",
          level: "required",
          probe: {
            type: "file.contains",
            path: "src/status.txt",
            pattern: "READY",
          },
        },
        {
          id: "test-script",
          statement: "Test script is declared",
          level: "required",
          probe: {
            type: "json.assert",
            path: "package.json",
            pointer: "/scripts/test",
            operator: "contains",
            expected: "vitest",
          },
        },
      ]),
      { workspace },
    );

    expect(evidence.outcome).toBe("proved");
    expect(evidence.results.every((result) => result.status === "pass")).toBe(true);
  });

  it("blocks workspace traversal", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "tuntas-traversal-"));
    const evidence = await runContract(
      contract([
        {
          id: "escape",
          statement: "Read outside",
          level: "required",
          probe: { type: "file.exists", path: "../secret.txt" },
        },
      ]),
      { workspace },
    );

    expect(evidence.outcome).toBe("incomplete");
    expect(evidence.results[0]?.status).toBe("error");
    expect(evidence.results[0]?.observation.summary).toContain("escapes");
  });

  it("requires both declaration and explicit CLI consent for commands", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "tuntas-command-"));
    const commandContract = contract(
      [
        {
          id: "node",
          statement: "Node can execute",
          level: "required",
          probe: {
            type: "command.exit",
            executable: process.execPath,
            args: ["--version"],
          },
        },
      ],
      {
        commands: [{ executable: process.execPath, argsPrefix: ["--version"] }],
      },
    );

    const denied = await runContract(commandContract, { workspace });
    const allowed = await runContract(commandContract, {
      workspace,
      allowCommands: true,
    });

    expect(denied.outcome).toBe("incomplete");
    expect(denied.results[0]?.status).toBe("skipped");
    expect(allowed.outcome).toBe("proved");
  });
});
