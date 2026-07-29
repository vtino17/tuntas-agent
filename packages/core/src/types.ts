export type ClaimLevel = "required" | "advisory";
export type ProbeStatus = "pass" | "fail" | "error" | "skipped";
export type Outcome = "proved" | "failed" | "incomplete";

export interface FileExistsProbe {
  type: "file.exists";
  path: string;
  kind?: "file" | "directory" | "any";
}

export interface FileContainsProbe {
  type: "file.contains";
  path: string;
  pattern: string;
  mode?: "literal" | "regex";
  caseSensitive?: boolean;
}

export interface JsonAssertProbe {
  type: "json.assert";
  path: string;
  pointer: string;
  operator: "exists" | "equals" | "contains" | "matches";
  expected?: unknown;
}

export interface CommandExitProbe {
  type: "command.exit";
  executable: string;
  args?: string[];
  cwd?: string;
  expectedExitCode?: number;
  timeoutMs?: number;
}

export interface GitCleanProbe {
  type: "git.clean";
  allowUntracked?: boolean;
}

export interface HttpResponseProbe {
  type: "http.response";
  url: string;
  expectedStatus: number;
  bodyContains?: string;
  timeoutMs?: number;
}

export type Probe =
  | FileExistsProbe
  | FileContainsProbe
  | JsonAssertProbe
  | CommandExitProbe
  | GitCleanProbe
  | HttpResponseProbe;

export interface OutcomeClaim {
  id: string;
  statement: string;
  level: ClaimLevel;
  probe: Probe;
}

export interface DeclaredCommand {
  executable: string;
  argsPrefix?: string[];
}

export interface ContractPermissions {
  commands?: DeclaredCommand[];
  networkHosts?: string[];
}

export interface ContractLimits {
  maxTotalMs?: number;
  maxFileBytes?: number;
  maxOutputBytes?: number;
}

export interface OutcomeContract {
  contractVersion: "1.0";
  id: string;
  goal: string;
  createdAt: string;
  claims: OutcomeClaim[];
  permissions?: ContractPermissions;
  limits?: ContractLimits;
  metadata?: Record<string, unknown>;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface Observation {
  summary: string;
  expected?: unknown;
  actual?: unknown;
  digest?: string;
  preview?: string;
}

export interface ClaimResult {
  claimId: string;
  statement: string;
  level: ClaimLevel;
  probeType: Probe["type"];
  status: ProbeStatus;
  durationMs: number;
  observation: Observation;
}

export interface WorkspaceEvidence {
  label: string;
  gitHead: string | null;
  beforeHash: string;
  afterHash: string;
  changedDuringVerification: boolean;
}

export interface VerificationScore {
  requiredPassed: number;
  requiredTotal: number;
  advisoryPassed: number;
  advisoryTotal: number;
}

export interface EvidenceDraft {
  evidenceVersion: "1.0";
  runId: string;
  contractId: string;
  goal: string;
  contractHash: string;
  startedAt: string;
  completedAt: string;
  workspace: WorkspaceEvidence;
  capabilities: {
    commandEnabled: boolean;
    networkEnabled: boolean;
  };
  results: ClaimResult[];
  previousEvidenceHash: string | null;
}

export interface EvidenceReceipt extends EvidenceDraft {
  outcome: Outcome;
  score: VerificationScore;
  evidenceHash: string;
}

export interface EvidenceVerification {
  valid: boolean;
  checks: {
    evidenceHash: boolean;
    contractHash: boolean | null;
    claimSet: boolean | null;
    claimMetadata: boolean | null;
    outcome: boolean;
    score: boolean;
  };
  errors: string[];
}

export interface ContractDiff {
  from: string;
  to: string;
  added: string[];
  removed: string[];
  modified: string[];
  weakenedControls: string[];
  oracleChanges: string[];
}
