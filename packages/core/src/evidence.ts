import { sha256 } from "./canonical.js";
import type {
  EvidenceDraft,
  EvidenceReceipt,
  EvidenceVerification,
  Outcome,
  OutcomeContract,
  VerificationScore,
} from "./types.js";
import { assertContract } from "./validation.js";

export function scoreResults(
  results: EvidenceDraft["results"],
): VerificationScore {
  const required = results.filter((result) => result.level === "required");
  const advisory = results.filter((result) => result.level === "advisory");
  return {
    requiredPassed: required.filter((result) => result.status === "pass").length,
    requiredTotal: required.length,
    advisoryPassed: advisory.filter((result) => result.status === "pass").length,
    advisoryTotal: advisory.length,
  };
}

export function deriveOutcome(draft: EvidenceDraft): Outcome {
  const required = draft.results.filter((result) => result.level === "required");
  if (required.some((result) => result.status === "fail")) {
    return "failed";
  }
  if (
    draft.workspace.changedDuringVerification ||
    required.some((result) => ["error", "skipped"].includes(result.status))
  ) {
    return "incomplete";
  }
  return required.every((result) => result.status === "pass")
    ? "proved"
    : "incomplete";
}

export async function sealEvidence(
  draft: EvidenceDraft,
): Promise<EvidenceReceipt> {
  const payload = {
    ...draft,
    outcome: deriveOutcome(draft),
    score: scoreResults(draft.results),
  };
  return {
    ...payload,
    evidenceHash: await sha256(payload),
  };
}

export async function verifyEvidence(input: {
  evidence: EvidenceReceipt;
  contract?: OutcomeContract;
}): Promise<EvidenceVerification> {
  const { evidence } = input;
  const { evidenceHash, ...payload } = evidence;
  const expectedScore = scoreResults(evidence.results);
  const expectedOutcome = deriveOutcome(evidence);
  const contractHash = input.contract
    ? (assertContract(input.contract), await sha256(input.contract))
    : undefined;
  const contractClaimIds = input.contract
    ? input.contract.claims.map((claim) => claim.id).sort()
    : undefined;
  const evidenceClaimIds = evidence.results
    .map((result) => result.claimId)
    .sort();
  const resultById = new Map(
    evidence.results.map((result) => [result.claimId, result]),
  );
  const checks: EvidenceVerification["checks"] = {
    evidenceHash: (await sha256(payload)) === evidenceHash,
    contractHash: contractHash ? contractHash === evidence.contractHash : null,
    claimSet: contractClaimIds
      ? JSON.stringify(contractClaimIds) === JSON.stringify(evidenceClaimIds)
      : null,
    claimMetadata: input.contract
      ? input.contract.claims.every((claim) => {
          const result = resultById.get(claim.id);
          return (
            result?.statement === claim.statement &&
            result.level === claim.level &&
            result.probeType === claim.probe.type
          );
        })
      : null,
    outcome: expectedOutcome === evidence.outcome,
    score: JSON.stringify(expectedScore) === JSON.stringify(evidence.score),
  };
  const errors = Object.entries(checks)
    .filter(([, passed]) => passed === false)
    .map(([name]) => `${name} check failed`);

  return {
    valid: errors.length === 0,
    checks,
    errors,
  };
}
