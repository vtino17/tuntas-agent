import { describe, expect, it } from "vitest";
import { formatEvidence, formatVerification } from "./format.js";
import type { EvidenceReceipt } from "@tuntas/core";

const evidence: EvidenceReceipt = {
  evidenceVersion: "1.0",
  runId: "run-1",
  contractId: "contract-1",
  goal: "Verify release",
  contractHash: "contract",
  startedAt: "2026-07-29T00:00:00.000Z",
  completedAt: "2026-07-29T00:00:01.000Z",
  workspace: {
    label: "demo",
    gitHead: null,
    beforeHash: "same",
    afterHash: "same",
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
      durationMs: 1,
      observation: { summary: "File exists." },
    },
  ],
  previousEvidenceHash: null,
  outcome: "proved",
  score: {
    requiredPassed: 1,
    requiredTotal: 1,
    advisoryPassed: 0,
    advisoryTotal: 0,
  },
  evidenceHash: "hash",
};

describe("CLI formatting", () => {
  it("shows proof status and claim details", () => {
    const output = formatEvidence(evidence);
    expect(output).toContain("✓ PROVED");
    expect(output).toContain("manifest");
    expect(output).toContain("1/1 required");
  });

  it("shows invalid receipt checks", () => {
    const output = formatVerification({
      valid: false,
      checks: {
        evidenceHash: false,
        contractHash: true,
        claimSet: null,
        claimMetadata: null,
        outcome: true,
        score: true,
      },
      errors: ["evidenceHash check failed"],
    });
    expect(output).toContain("✕ INVALID");
    expect(output).toContain("FAIL  evidenceHash");
  });
});
