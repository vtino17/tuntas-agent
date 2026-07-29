import { realpath } from "node:fs/promises";
import {
  assertContract,
  sealEvidence,
  sha256,
} from "@tuntas/core";
import type {
  ClaimResult,
  EvidenceReceipt,
} from "@tuntas/core";
import { runClaim } from "./probes.js";
import { captureSnapshot, workspaceEvidence } from "./snapshot.js";

export interface RunOptions {
  workspace: string;
  allowCommands?: boolean;
  allowNetwork?: boolean;
  previousEvidenceHash?: string;
  now?: () => Date;
}

const defaults = {
  maxTotalMs: 120_000,
  maxFileBytes: 1_000_000,
  maxOutputBytes: 64_000,
};

export async function runContract(
  contractValue: unknown,
  options: RunOptions,
): Promise<EvidenceReceipt> {
  assertContract(contractValue);
  const contract = contractValue;
  const workspace = await realpath(options.workspace);
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const maxTotalMs = contract.limits?.maxTotalMs ?? defaults.maxTotalMs;
  const maxFileBytes =
    contract.limits?.maxFileBytes ?? defaults.maxFileBytes;
  const maxOutputBytes =
    contract.limits?.maxOutputBytes ?? defaults.maxOutputBytes;
  const before = await captureSnapshot(workspace, contract, maxFileBytes);
  const contractHash = await sha256(contract);
  const results: ClaimResult[] = [];

  for (const claim of contract.claims) {
    const elapsed = now().getTime() - startedAt.getTime();
    const remainingMs = maxTotalMs - elapsed;
    if (remainingMs < 100) {
      results.push({
        claimId: claim.id,
        statement: claim.statement,
        level: claim.level,
        probeType: claim.probe.type,
        status: "skipped",
        durationMs: 0,
        observation: {
          summary: `Total verification budget of ${maxTotalMs}ms was exhausted.`,
        },
      });
      continue;
    }
    results.push(
      await runClaim(claim, {
        workspace,
        contract,
        allowCommands: options.allowCommands ?? false,
        allowNetwork: options.allowNetwork ?? false,
        maxFileBytes,
        maxOutputBytes,
        remainingMs,
      }),
    );
  }

  const after = await captureSnapshot(workspace, contract, maxFileBytes);
  const completedAt = now();
  const runSeed = `${contractHash}:${before.fingerprint}:${startedAt.toISOString()}`;
  return sealEvidence({
    evidenceVersion: "1.0",
    runId: (await sha256(runSeed)).slice(0, 24),
    contractId: contract.id,
    goal: contract.goal,
    contractHash,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    workspace: workspaceEvidence(before, after),
    capabilities: {
      commandEnabled: options.allowCommands ?? false,
      networkEnabled: options.allowNetwork ?? false,
    },
    results,
    previousEvidenceHash: options.previousEvidenceHash ?? null,
  });
}
