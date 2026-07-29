import { canonicalJson } from "./canonical.js";
import type {
  ContractDiff,
  OutcomeClaim,
  OutcomeContract,
} from "./types.js";
import { assertContract } from "./validation.js";

function claimMap(contract: OutcomeContract): Map<string, OutcomeClaim> {
  return new Map(contract.claims.map((claim) => [claim.id, claim]));
}

export function diffContracts(
  fromValue: unknown,
  toValue: unknown,
): ContractDiff {
  assertContract(fromValue);
  assertContract(toValue);
  const from = fromValue;
  const to = toValue;
  const oldClaims = claimMap(from);
  const newClaims = claimMap(to);
  const added = [...newClaims.keys()].filter((id) => !oldClaims.has(id)).sort();
  const removed = [...oldClaims.keys()].filter((id) => !newClaims.has(id)).sort();
  const modified = [...oldClaims.keys()]
    .filter(
      (id) =>
        newClaims.has(id) &&
        canonicalJson(oldClaims.get(id)) !== canonicalJson(newClaims.get(id)),
    )
    .sort();
  const weakenedControls: string[] = [];
  const oracleChanges: string[] = [];

  for (const id of removed) {
    if (oldClaims.get(id)?.level === "required") {
      weakenedControls.push(`Required claim "${id}" was removed.`);
    }
  }
  for (const id of modified) {
    const previous = oldClaims.get(id);
    const next = newClaims.get(id);
    if (previous?.level === "required" && next?.level === "advisory") {
      weakenedControls.push(`Claim "${id}" changed from required to advisory.`);
    }
    if (
      previous &&
      next &&
      canonicalJson(previous.probe) !== canonicalJson(next.probe)
    ) {
      oracleChanges.push(`Probe for claim "${id}" changed.`);
    }
  }

  const oldCommands = new Set(
    (from.permissions?.commands ?? []).map((command) =>
      canonicalJson(command),
    ),
  );
  for (const command of to.permissions?.commands ?? []) {
    if (!oldCommands.has(canonicalJson(command))) {
      weakenedControls.push(
        `Command permission added: ${command.executable} ${(command.argsPrefix ?? []).join(" ")}`.trim(),
      );
    }
  }
  const oldHosts = new Set(from.permissions?.networkHosts ?? []);
  for (const host of to.permissions?.networkHosts ?? []) {
    if (!oldHosts.has(host)) {
      weakenedControls.push(`Network host permission added: ${host}.`);
    }
  }

  return {
    from: from.id,
    to: to.id,
    added,
    removed,
    modified,
    weakenedControls,
    oracleChanges,
  };
}
