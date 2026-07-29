import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { basename } from "node:path";
import { sha256 } from "@tuntas/core";
import type {
  OutcomeContract,
  WorkspaceEvidence,
} from "@tuntas/core";
import { resolveWorkspacePath } from "./path.js";
import { runProcess } from "./process.js";

export interface Snapshot {
  label: string;
  gitHead: string | null;
  fingerprint: string;
}

async function gitValue(
  workspace: string,
  args: string[],
): Promise<string | null> {
  try {
    const result = await runProcess({
      executable: "git",
      args: ["-C", workspace, ...args],
      cwd: workspace,
      timeoutMs: 5_000,
      maxOutputBytes: 256_000,
    });
    return result.exitCode === 0 ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

async function describePath(
  workspace: string,
  path: string,
  maxBytes: number,
): Promise<unknown> {
  try {
    const absolute = await resolveWorkspacePath(workspace, path);
    const stats = await lstat(absolute);
    if (stats.isFile()) {
      if (stats.size > maxBytes) {
        return { path, kind: "file", size: stats.size, digest: "size-limit" };
      }
      return {
        path,
        kind: "file",
        size: stats.size,
        digest: await sha256(await readFile(absolute, "utf8")),
      };
    }
    if (stats.isDirectory()) {
      return {
        path,
        kind: "directory",
        entries: (await readdir(absolute)).sort(),
      };
    }
    return { path, kind: "other", size: stats.size };
  } catch (error) {
    return {
      path,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function referencedPaths(contract: OutcomeContract): string[] {
  return [
    ...new Set(
      contract.claims.flatMap((claim) => {
        if (
          claim.probe.type === "file.exists" ||
          claim.probe.type === "file.contains" ||
          claim.probe.type === "json.assert"
        ) {
          return [claim.probe.path];
        }
        return [];
      }),
    ),
  ].sort();
}

export async function captureSnapshot(
  workspace: string,
  contract: OutcomeContract,
  maxFileBytes: number,
): Promise<Snapshot> {
  const [gitHead, gitStatus, paths] = await Promise.all([
    gitValue(workspace, ["rev-parse", "HEAD"]),
    gitValue(workspace, ["status", "--porcelain=v1", "--untracked-files=all"]),
    Promise.all(
      referencedPaths(contract).map((path) =>
        describePath(workspace, path, maxFileBytes),
      ),
    ),
  ]);
  return {
    label: basename(await realpath(workspace)),
    gitHead,
    fingerprint: await sha256({ gitHead, gitStatus, paths }),
  };
}

export function workspaceEvidence(
  before: Snapshot,
  after: Snapshot,
): WorkspaceEvidence {
  return {
    label: before.label,
    gitHead: before.gitHead,
    beforeHash: before.fingerprint,
    afterHash: after.fingerprint,
    changedDuringVerification: before.fingerprint !== after.fingerprint,
  };
}
