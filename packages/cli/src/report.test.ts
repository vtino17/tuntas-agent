import { describe, expect, it } from "vitest";
import { renderEvidenceReport } from "./report.js";
import type { EvidenceReceipt } from "@tuntas/core";

describe("HTML evidence report", () => {
  it("escapes untrusted observation text", () => {
    const evidence = {
      evidenceVersion: "1.0",
      runId: "run",
      contractId: "contract",
      goal: "<script>alert(1)</script>",
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
      results: [],
      previousEvidenceHash: null,
      outcome: "proved",
      score: {
        requiredPassed: 0,
        requiredTotal: 0,
        advisoryPassed: 0,
        advisoryTotal: 0,
      },
      evidenceHash: "hash",
    } satisfies EvidenceReceipt;
    const html = renderEvidenceReport(evidence);

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
