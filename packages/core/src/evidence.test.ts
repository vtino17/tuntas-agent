import { describe, expect, it } from "vitest";
import { sealEvidence, verifyEvidence } from "./evidence.js";
import type {
  EvidenceDraft,
  OutcomeContract,
} from "./types.js";
import { sha256 } from "./canonical.js";

const contract: OutcomeContract = {
  contractVersion: "1.0",
  id: "release-ready",
  goal: "Ship a verified release",
  createdAt: "2026-07-29T00:00:00.000Z",
  claims: [
    {
      id: "manifest",
      statement: "Manifest exists",
      level: "required",
      probe: { type: "file.exists", path: "package.json", kind: "file" },
    },
    {
      id: "clean",
      statement: "Workspace is clean",
      level: "advisory",
      probe: { type: "git.clean" },
    },
  ],
};

async function draft(): Promise<EvidenceDraft> {
  return {
    evidenceVersion: "1.0",
    runId: "run-1",
    contractId: contract.id,
    goal: contract.goal,
    contractHash: await sha256(contract),
    startedAt: "2026-07-29T00:01:00.000Z",
    completedAt: "2026-07-29T00:01:01.000Z",
    workspace: {
      label: "demo",
      gitHead: null,
      beforeHash: "before",
      afterHash: "before",
      changedDuringVerification: false,
    },
    capabilities: { commandEnabled: false, networkEnabled: false },
    results: [
      {
        claimId: "manifest",
        statement: "Manifest exists",
        level: "required",
        probeType: "file.exists",
        status: "pass",
        durationMs: 2,
        observation: { summary: "File exists." },
      },
      {
        claimId: "clean",
        statement: "Workspace is clean",
        level: "advisory",
        probeType: "git.clean",
        status: "fail",
        durationMs: 4,
        observation: { summary: "Workspace has changes." },
      },
    ],
    previousEvidenceHash: null,
  };
}

describe("evidence receipts", () => {
  it("proves an outcome when every required claim passes", async () => {
    const evidence = await sealEvidence(await draft());
    const verification = await verifyEvidence({ evidence, contract });

    expect(evidence.outcome).toBe("proved");
    expect(evidence.score).toEqual({
      requiredPassed: 1,
      requiredTotal: 1,
      advisoryPassed: 0,
      advisoryTotal: 1,
    });
    expect(verification.valid).toBe(true);
  });

  it("marks a changed workspace as incomplete", async () => {
    const source = await draft();
    source.workspace.changedDuringVerification = true;
    source.workspace.afterHash = "after";
    const evidence = await sealEvidence(source);

    expect(evidence.outcome).toBe("incomplete");
  });

  it("detects receipt mutation", async () => {
    const evidence = await sealEvidence(await draft());
    const verification = await verifyEvidence({
      evidence: { ...evidence, outcome: "failed" },
      contract,
    });

    expect(verification.valid).toBe(false);
    expect(verification.checks.evidenceHash).toBe(false);
    expect(verification.checks.outcome).toBe(false);
  });
});
