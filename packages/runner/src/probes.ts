import { lstat, readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { canonicalJson, sha256 } from "@tuntas/core";
import type {
  ClaimResult,
  OutcomeClaim,
  OutcomeContract,
  ProbeStatus,
} from "@tuntas/core";
import { resolveWorkspacePath } from "./path.js";
import { runProcess } from "./process.js";

export interface ProbeContext {
  workspace: string;
  contract: OutcomeContract;
  allowCommands: boolean;
  allowNetwork: boolean;
  maxFileBytes: number;
  maxOutputBytes: number;
  remainingMs: number;
}

interface ProbeObservation {
  status: ProbeStatus;
  summary: string;
  expected?: unknown;
  actual?: unknown;
  digest?: string;
  preview?: string;
}

function preview(value: string, limit = 800): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}\n…[truncated]`;
}

async function readBounded(
  context: ProbeContext,
  path: string,
): Promise<{ content: string; digest: string }> {
  const absolute = await resolveWorkspacePath(context.workspace, path);
  const stats = await lstat(absolute);
  if (!stats.isFile()) {
    throw new Error("Target is not a regular file.");
  }
  if (stats.size > context.maxFileBytes) {
    throw new Error(
      `File is ${stats.size} bytes; limit is ${context.maxFileBytes}.`,
    );
  }
  const content = await readFile(absolute, "utf8");
  return { content, digest: await sha256(content) };
}

async function fileExists(
  claim: OutcomeClaim,
  context: ProbeContext,
): Promise<ProbeObservation> {
  const probe = claim.probe;
  if (probe.type !== "file.exists") throw new Error("Probe mismatch.");
  try {
    const absolute = await resolveWorkspacePath(context.workspace, probe.path);
    const stats = await lstat(absolute);
    const kind = stats.isFile()
      ? "file"
      : stats.isDirectory()
        ? "directory"
        : "other";
    const expectedKind = probe.kind ?? "any";
    const passed = expectedKind === "any" || expectedKind === kind;
    return {
      status: passed ? "pass" : "fail",
      summary: passed
        ? `${kind} exists at ${probe.path}.`
        : `Expected ${expectedKind}, found ${kind}.`,
      expected: expectedKind,
      actual: kind,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) {
      return {
        status: "fail",
        summary: `Path does not exist: ${probe.path}.`,
        expected: probe.kind ?? "any",
        actual: "missing",
      };
    }
    throw error;
  }
}

async function fileContains(
  claim: OutcomeClaim,
  context: ProbeContext,
): Promise<ProbeObservation> {
  const probe = claim.probe;
  if (probe.type !== "file.contains") throw new Error("Probe mismatch.");
  const { content, digest } = await readBounded(context, probe.path);
  const mode = probe.mode ?? "literal";
  const caseSensitive = probe.caseSensitive ?? true;
  let passed: boolean;
  if (mode === "regex") {
    passed = new RegExp(probe.pattern, caseSensitive ? "" : "i").test(content);
  } else {
    passed = caseSensitive
      ? content.includes(probe.pattern)
      : content.toLowerCase().includes(probe.pattern.toLowerCase());
  }
  return {
    status: passed ? "pass" : "fail",
    summary: passed
      ? `${probe.path} contains the expected ${mode}.`
      : `${probe.path} does not contain the expected ${mode}.`,
    expected: probe.pattern,
    actual: passed ? "matched" : "not matched",
    digest,
  };
}

function pointerValue(document: unknown, pointer: string): {
  exists: boolean;
  value: unknown;
} {
  const segments = pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  let current = document;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return { exists: false, value: undefined };
      }
      current = current[index];
    } else if (
      current !== null &&
      typeof current === "object" &&
      Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return { exists: false, value: undefined };
    }
  }
  return { exists: true, value: current };
}

async function jsonAssert(
  claim: OutcomeClaim,
  context: ProbeContext,
): Promise<ProbeObservation> {
  const probe = claim.probe;
  if (probe.type !== "json.assert") throw new Error("Probe mismatch.");
  const { content, digest } = await readBounded(context, probe.path);
  const document = JSON.parse(content) as unknown;
  const observed = pointerValue(document, probe.pointer);
  let passed = false;
  if (probe.operator === "exists") {
    passed = observed.exists;
  } else if (probe.operator === "equals") {
    passed =
      observed.exists &&
      canonicalJson(observed.value) === canonicalJson(probe.expected);
  } else if (probe.operator === "contains") {
    passed =
      observed.exists &&
      (typeof observed.value === "string"
        ? observed.value.includes(String(probe.expected))
        : Array.isArray(observed.value) &&
          observed.value.some(
            (entry) => canonicalJson(entry) === canonicalJson(probe.expected),
          ));
  } else if (probe.operator === "matches") {
    passed =
      observed.exists &&
      typeof observed.value === "string" &&
      new RegExp(String(probe.expected)).test(observed.value);
  }
  return {
    status: passed ? "pass" : "fail",
    summary: passed
      ? `${probe.path}${probe.pointer} satisfies ${probe.operator}.`
      : `${probe.path}${probe.pointer} does not satisfy ${probe.operator}.`,
    expected:
      probe.operator === "exists" ? "JSON Pointer exists" : probe.expected,
    actual: observed.exists ? observed.value : "missing",
    digest,
  };
}

function commandIsDeclared(
  contract: OutcomeContract,
  executable: string,
  args: string[],
): boolean {
  return (contract.permissions?.commands ?? []).some((declared) => {
    if (declared.executable !== executable) return false;
    const prefix = declared.argsPrefix ?? [];
    return prefix.every((value, index) => args[index] === value);
  });
}

async function commandExit(
  claim: OutcomeClaim,
  context: ProbeContext,
): Promise<ProbeObservation> {
  const probe = claim.probe;
  if (probe.type !== "command.exit") throw new Error("Probe mismatch.");
  const args = probe.args ?? [];
  if (!context.allowCommands) {
    return {
      status: "skipped",
      summary: "Command probe requires the CLI --allow-command flag.",
    };
  }
  if (!commandIsDeclared(context.contract, probe.executable, args)) {
    return {
      status: "error",
      summary: "Command is not declared in contract.permissions.commands.",
    };
  }
  const cwd = probe.cwd
    ? await resolveWorkspacePath(context.workspace, probe.cwd)
    : context.workspace;
  const timeoutMs = Math.min(
    probe.timeoutMs ?? 30_000,
    Math.max(100, context.remainingMs),
  );
  const result = await runProcess({
    executable: probe.executable,
    args,
    cwd,
    timeoutMs,
    maxOutputBytes: context.maxOutputBytes,
  });
  const expected = probe.expectedExitCode ?? 0;
  const passed = !result.timedOut && result.exitCode === expected;
  const combined = [result.stdout, result.stderr].filter(Boolean).join("\n");
  return {
    status: passed ? "pass" : "fail",
    summary: result.timedOut
      ? `Command exceeded ${timeoutMs}ms.`
      : `Command exited ${String(result.exitCode)}; expected ${expected}.${result.outputTruncated ? " Output truncated." : ""}`,
    expected,
    actual: result.timedOut ? "timeout" : result.exitCode,
    digest: await sha256(combined),
    ...(combined ? { preview: preview(combined) } : {}),
  };
}

async function gitClean(
  claim: OutcomeClaim,
  context: ProbeContext,
): Promise<ProbeObservation> {
  const probe = claim.probe;
  if (probe.type !== "git.clean") throw new Error("Probe mismatch.");
  const result = await runProcess({
    executable: "git",
    args: ["-C", context.workspace, "status", "--porcelain=v1"],
    cwd: context.workspace,
    timeoutMs: Math.min(5_000, Math.max(100, context.remainingMs)),
    maxOutputBytes: context.maxOutputBytes,
  });
  if (result.exitCode !== 0) {
    return {
      status: "error",
      summary: "Workspace is not a Git repository.",
      preview: preview(result.stderr),
    };
  }
  const entries = result.stdout
    .split("\n")
    .filter(Boolean)
    .filter((line) => !(probe.allowUntracked && line.startsWith("??")));
  return {
    status: entries.length === 0 ? "pass" : "fail",
    summary:
      entries.length === 0
        ? "Git workspace is clean."
        : `Git workspace has ${entries.length} change(s).`,
    actual: entries.length,
    digest: await sha256(entries),
    ...(entries.length > 0 ? { preview: preview(entries.join("\n")) } : {}),
  };
}

function hostAllowed(contract: OutcomeContract, hostname: string): boolean {
  return (contract.permissions?.networkHosts ?? []).some((allowed) =>
    allowed.startsWith("*.")
      ? hostname.endsWith(allowed.slice(1)) &&
        hostname !== allowed.slice(2)
      : hostname === allowed,
  );
}

async function readResponseBounded(
  response: Response,
  maxBytes: number,
): Promise<{ body: string; truncated: boolean }> {
  if (!response.body) {
    return { body: "", truncated: false };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maxBytes - total;
      if (remaining <= 0) {
        truncated = true;
        await reader.cancel();
        break;
      }
      const accepted = value.subarray(0, remaining);
      chunks.push(accepted);
      total += accepted.length;
      if (accepted.length < value.length) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return {
    body: new TextDecoder().decode(merged),
    truncated,
  };
}

async function httpResponse(
  claim: OutcomeClaim,
  context: ProbeContext,
): Promise<ProbeObservation> {
  const probe = claim.probe;
  if (probe.type !== "http.response") throw new Error("Probe mismatch.");
  if (!context.allowNetwork) {
    return {
      status: "skipped",
      summary: "HTTP probe requires the CLI --allow-network flag.",
    };
  }
  const url = new URL(probe.url);
  if (
    isIP(url.hostname) !== 0 ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost")
  ) {
    return {
      status: "error",
      summary: "IP literals and localhost are blocked.",
    };
  }
  if (!hostAllowed(context.contract, url.hostname)) {
    return {
      status: "error",
      summary: `${url.hostname} is not declared in contract.permissions.networkHosts.`,
    };
  }

  const controller = new AbortController();
  const timeoutMs = Math.min(
    probe.timeoutMs ?? 10_000,
    Math.max(100, context.remainingMs),
  );
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { "user-agent": "tuntas-agent/0.1" },
    });
    const { body, truncated } = await readResponseBounded(
      response,
      context.maxOutputBytes,
    );
    const statusMatch = response.status === probe.expectedStatus;
    const bodyMatch =
      probe.bodyContains === undefined || body.includes(probe.bodyContains);
    const passed = statusMatch && bodyMatch;
    return {
      status: passed ? "pass" : "fail",
      summary: passed
        ? `HTTP response matched status ${probe.expectedStatus}.${truncated ? " Body truncated at the output limit." : ""}`
        : `HTTP response did not match the contract.${truncated ? " Body truncated at the output limit." : ""}`,
      expected: {
        status: probe.expectedStatus,
        ...(probe.bodyContains ? { bodyContains: probe.bodyContains } : {}),
      },
      actual: {
        status: response.status,
        bodyMatched: bodyMatch,
      },
      digest: await sha256(body),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runClaim(
  claim: OutcomeClaim,
  context: ProbeContext,
): Promise<ClaimResult> {
  const started = performance.now();
  try {
    let observation: ProbeObservation;
    switch (claim.probe.type) {
      case "file.exists":
        observation = await fileExists(claim, context);
        break;
      case "file.contains":
        observation = await fileContains(claim, context);
        break;
      case "json.assert":
        observation = await jsonAssert(claim, context);
        break;
      case "command.exit":
        observation = await commandExit(claim, context);
        break;
      case "git.clean":
        observation = await gitClean(claim, context);
        break;
      case "http.response":
        observation = await httpResponse(claim, context);
        break;
    }
    const { status, ...details } = observation;
    return {
      claimId: claim.id,
      statement: claim.statement,
      level: claim.level,
      probeType: claim.probe.type,
      status,
      durationMs: Math.round(performance.now() - started),
      observation: details,
    };
  } catch (error) {
    return {
      claimId: claim.id,
      statement: claim.statement,
      level: claim.level,
      probeType: claim.probe.type,
      status: "error",
      durationMs: Math.round(performance.now() - started),
      observation: {
        summary: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
