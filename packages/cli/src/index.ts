#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  diffContracts,
  verifyEvidence,
} from "@tuntas/core";
import type {
  EvidenceReceipt,
  OutcomeContract,
} from "@tuntas/core";
import { runContract } from "@tuntas/runner";
import {
  formatDiff,
  formatEvidence,
  formatVerification,
} from "./format.js";
import { renderEvidenceReport } from "./report.js";
import { starterContract } from "./template.js";

const help = `Tuntas — deterministic proof-of-done for AI agents

Usage:
  tuntas verify <contract.json> [--workspace <dir>] [--output <evidence.json>]
                [--previous <evidence.json>] [--allow-command] [--allow-network]
                [--json]
  tuntas verify-evidence <evidence.json> [--contract <contract.json>] [--json]
  tuntas diff-contract <old.json> <new.json> [--json]
  tuntas report <evidence.json> --output <report.html>
  tuntas init [contract.json]

Command and network probes are denied unless explicitly enabled.`;

interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  flags: Map<string, string[]>;
}

function parseArgs(args: string[]): ParsedArgs {
  const [command, ...rest] = args;
  const positionals: string[] = [];
  const flags = new Map<string, string[]>();
  for (let index = 0; index < rest.length; index += 1) {
    const entry = rest[index]!;
    if (!entry.startsWith("--")) {
      positionals.push(entry);
      continue;
    }
    const key = entry.slice(2);
    const next = rest[index + 1];
    const value = next && !next.startsWith("--") ? next : "true";
    flags.set(key, [...(flags.get(key) ?? []), value]);
    if (value !== "true") index += 1;
  }
  return { command, positionals, flags };
}

async function readJson<T>(path: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    throw new Error(
      `Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function requirePositionals(parsed: ParsedArgs, count: number): string[] {
  if (parsed.positionals.length < count) {
    throw new Error(`Expected ${count} file argument(s).\n\n${help}`);
  }
  return parsed.positionals;
}

function print(value: unknown, formatted: string, json: boolean): void {
  process.stdout.write(
    json ? `${JSON.stringify(value, null, 2)}\n` : `${formatted}\n`,
  );
}

async function verifyCommand(parsed: ParsedArgs): Promise<number> {
  const [contractPath] = requirePositionals(parsed, 1) as [string];
  const contract = await readJson<OutcomeContract>(contractPath);
  const workspace = parsed.flags.get("workspace")?.at(-1) ?? process.cwd();
  const previousPath = parsed.flags.get("previous")?.at(-1);
  let previousEvidenceHash: string | undefined;
  if (previousPath && previousPath !== "true") {
    const previous = await readJson<EvidenceReceipt>(previousPath);
    const verification = await verifyEvidence({ evidence: previous });
    if (!verification.valid) {
      throw new Error("Previous evidence receipt is invalid.");
    }
    previousEvidenceHash = previous.evidenceHash;
  }
  const evidence = await runContract(contract, {
    workspace,
    allowCommands: parsed.flags.has("allow-command"),
    allowNetwork: parsed.flags.has("allow-network"),
    ...(previousEvidenceHash ? { previousEvidenceHash } : {}),
  });
  const outputPath = parsed.flags.get("output")?.at(-1);
  if (outputPath && outputPath !== "true") {
    const absolute = resolve(outputPath);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  }
  print(evidence, formatEvidence(evidence), parsed.flags.has("json"));
  if (outputPath && outputPath !== "true") {
    process.stdout.write(`Saved       ${outputPath}\n`);
  }
  return evidence.outcome === "proved"
    ? 0
    : evidence.outcome === "failed"
      ? 2
      : 3;
}

async function verifyEvidenceCommand(parsed: ParsedArgs): Promise<number> {
  const [evidencePath] = requirePositionals(parsed, 1) as [string];
  const contractPath = parsed.flags.get("contract")?.at(-1);
  const [evidence, contract] = await Promise.all([
    readJson<EvidenceReceipt>(evidencePath),
    contractPath && contractPath !== "true"
      ? readJson<OutcomeContract>(contractPath)
      : Promise.resolve(undefined),
  ]);
  const verification = await verifyEvidence({
    evidence,
    ...(contract ? { contract } : {}),
  });
  print(
    verification,
    formatVerification(verification),
    parsed.flags.has("json"),
  );
  return verification.valid ? 0 : 5;
}

async function diffCommand(parsed: ParsedArgs): Promise<number> {
  const [oldPath, newPath] = requirePositionals(parsed, 2) as [string, string];
  const [oldContract, newContract] = await Promise.all([
    readJson<OutcomeContract>(oldPath),
    readJson<OutcomeContract>(newPath),
  ]);
  const diff = diffContracts(oldContract, newContract);
  print(diff, formatDiff(diff), parsed.flags.has("json"));
  return diff.weakenedControls.length > 0 ? 4 : 0;
}

async function reportCommand(parsed: ParsedArgs): Promise<number> {
  const [evidencePath] = requirePositionals(parsed, 1) as [string];
  const outputPath = parsed.flags.get("output")?.at(-1);
  if (!outputPath || outputPath === "true") {
    throw new Error("report requires --output <report.html>.");
  }
  const evidence = await readJson<EvidenceReceipt>(evidencePath);
  const verification = await verifyEvidence({ evidence });
  if (!verification.valid) {
    throw new Error("Refusing to render an invalid evidence receipt.");
  }
  await writeFile(outputPath, renderEvidenceReport(evidence), {
    encoding: "utf8",
    flag: "wx",
  });
  process.stdout.write(`✓ Report written to ${outputPath}\n`);
  return 0;
}

async function initCommand(parsed: ParsedArgs): Promise<number> {
  const path = parsed.positionals[0] ?? "tuntas.contract.json";
  await writeFile(path, `${JSON.stringify(starterContract, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  process.stdout.write(`✓ Starter contract written to ${path}\n`);
  return 0;
}

export async function run(args = process.argv.slice(2)): Promise<number> {
  const parsed = parseArgs(args);
  if (!parsed.command || parsed.command === "help" || parsed.flags.has("help")) {
    process.stdout.write(`${help}\n`);
    return 0;
  }
  if (parsed.command === "verify") return verifyCommand(parsed);
  if (parsed.command === "verify-evidence")
    return verifyEvidenceCommand(parsed);
  if (parsed.command === "diff-contract") return diffCommand(parsed);
  if (parsed.command === "report") return reportCommand(parsed);
  if (parsed.command === "init") return initCommand(parsed);
  throw new Error(`Unknown command: ${parsed.command}\n\n${help}`);
}

const entrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (entrypoint) {
  run()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `Error: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
