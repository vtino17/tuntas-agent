import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

export async function resolveWorkspacePath(
  workspace: string,
  requestedPath: string,
  requireExisting = true,
): Promise<string> {
  if (isAbsolute(requestedPath)) {
    throw new Error("Absolute paths are not allowed.");
  }
  const root = await realpath(workspace);
  const candidate = resolve(root, requestedPath);
  if (!isWithin(root, candidate)) {
    throw new Error("Path escapes the workspace.");
  }
  if (!requireExisting) {
    return candidate;
  }

  await lstat(candidate);
  const resolvedCandidate = await realpath(candidate);
  if (!isWithin(root, resolvedCandidate)) {
    throw new Error("Symlink resolves outside the workspace.");
  }
  return resolvedCandidate;
}
