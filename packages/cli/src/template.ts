import type { OutcomeContract } from "@tuntas/core";

export const starterContract: OutcomeContract = {
  contractVersion: "1.0",
  id: "project-done-v1",
  goal: "Verify that the project is genuinely complete",
  createdAt: "2026-07-29T00:00:00.000Z",
  claims: [
    {
      id: "readme-exists",
      statement: "The project has user-facing documentation",
      level: "required",
      probe: {
        type: "file.exists",
        path: "README.md",
        kind: "file",
      },
    },
    {
      id: "tests-pass",
      statement: "The automated test suite passes",
      level: "required",
      probe: {
        type: "command.exit",
        executable: "pnpm",
        args: ["test"],
        expectedExitCode: 0,
        timeoutMs: 60000,
      },
    },
    {
      id: "workspace-clean",
      statement: "No unexpected Git changes remain",
      level: "advisory",
      probe: {
        type: "git.clean",
        allowUntracked: false,
      },
    },
  ],
  permissions: {
    commands: [
      {
        executable: "pnpm",
        argsPrefix: ["test"],
      },
    ],
  },
  limits: {
    maxTotalMs: 120000,
    maxFileBytes: 1000000,
    maxOutputBytes: 64000,
  },
};
