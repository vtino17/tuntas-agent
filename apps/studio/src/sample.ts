import type { OutcomeContract } from "@tuntas/core";

export const sampleContract: OutcomeContract = {
  contractVersion: "1.0",
  id: "release-ready-v1",
  goal: "Ship a release that is documented, tested, and reproducible",
  createdAt: "2026-07-29T00:00:00.000Z",
  claims: [
    {
      id: "readme-quickstart",
      statement: "README contains a runnable quick-start",
      level: "required",
      probe: {
        type: "file.contains",
        path: "README.md",
        pattern: "Quick start",
        caseSensitive: false,
      },
    },
    {
      id: "package-test-script",
      statement: "The package declares an automated test command",
      level: "required",
      probe: {
        type: "json.assert",
        path: "package.json",
        pointer: "/scripts/test",
        operator: "exists",
      },
    },
    {
      id: "tests-pass",
      statement: "The complete test suite exits successfully",
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
      id: "license-present",
      statement: "An open-source license is present",
      level: "required",
      probe: {
        type: "file.exists",
        path: "LICENSE",
        kind: "file",
      },
    },
    {
      id: "git-clean",
      statement: "The workspace has no uncommitted changes",
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
