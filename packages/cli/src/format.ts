import type {
  ContractDiff,
  EvidenceReceipt,
  EvidenceVerification,
} from "@tuntas/core";

const outcomeLabel = {
  proved: "✓ PROVED",
  failed: "✕ FAILED",
  incomplete: "◇ INCOMPLETE",
};

const statusIcon = {
  pass: "✓",
  fail: "✕",
  error: "!",
  skipped: "–",
};

export function formatEvidence(evidence: EvidenceReceipt): string {
  const score = `${evidence.score.requiredPassed}/${evidence.score.requiredTotal} required`;
  const results = evidence.results.map(
    (result) =>
      `${statusIcon[result.status]} ${result.claimId.padEnd(22)} ${result.observation.summary}`,
  );
  return [
    `${outcomeLabel[evidence.outcome]}  ${evidence.goal}`,
    `Run        ${evidence.runId}`,
    `Score      ${score}`,
    `Workspace  ${evidence.workspace.label}${evidence.workspace.changedDuringVerification ? " · CHANGED DURING RUN" : ""}`,
    "",
    ...results,
    "",
    `Evidence   ${evidence.evidenceHash}`,
  ].join("\n");
}

export function formatVerification(
  verification: EvidenceVerification,
): string {
  const checks = Object.entries(verification.checks).map(([name, value]) => {
    const label = value === null ? "SKIP" : value ? "PASS" : "FAIL";
    return `${label.padEnd(4)}  ${name}`;
  });
  return [
    verification.valid ? "✓ VALID evidence receipt" : "✕ INVALID evidence receipt",
    ...checks,
  ].join("\n");
}

export function formatDiff(diff: ContractDiff): string {
  return [
    `Contract diff  ${diff.from} → ${diff.to}`,
    `Added          ${diff.added.join(", ") || "none"}`,
    `Removed        ${diff.removed.join(", ") || "none"}`,
    `Modified       ${diff.modified.join(", ") || "none"}`,
    `Weakened       ${diff.weakenedControls.length}`,
    ...diff.weakenedControls.map((entry) => `! ${entry}`),
    `Oracle drift   ${diff.oracleChanges.length}`,
    ...diff.oracleChanges.map((entry) => `~ ${entry}`),
  ].join("\n");
}
