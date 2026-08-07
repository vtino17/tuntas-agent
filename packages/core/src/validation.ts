import type {
  OutcomeContract,
  Probe,
  ValidationIssue,
} from "./types.js";

const probeTypes = [
  "file.exists",
  "file.contains",
  "json.assert",
  "command.exit",
  "git.clean",
  "http.response",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string" && record[key].trim().length > 0;
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((entry) => isJsonValue(entry, ancestors))
    : Object.values(value).every((entry) => isJsonValue(entry, ancestors));
  ancestors.delete(value);
  return valid;
}

function add(
  issues: ValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push({ path, message });
}

function validateProbe(
  probe: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isRecord(probe)) {
    add(issues, path, "Must be an object.");
    return;
  }
  if (!probeTypes.includes(probe.type as (typeof probeTypes)[number])) {
    add(issues, `${path}.type`, `Must be one of: ${probeTypes.join(", ")}.`);
    return;
  }

  const typed = probe as unknown as Probe;
  if (
    ["file.exists", "file.contains", "json.assert"].includes(typed.type) &&
    !hasText(probe, "path")
  ) {
    add(issues, `${path}.path`, "Must be a non-empty relative path.");
  }
  if (
    ["file.exists", "file.contains", "json.assert"].includes(typed.type) &&
    typeof probe.path === "string" &&
    (probe.path.startsWith("/") || probe.path.startsWith("\\"))
  ) {
    add(issues, `${path}.path`, "Must be relative to the workspace.");
  }
  if (
    typed.type === "file.exists" &&
    probe.kind !== undefined &&
    !["file", "directory", "any"].includes(String(probe.kind))
  ) {
    add(issues, `${path}.kind`, "Must be file, directory, or any.");
  }
  if (typed.type === "file.contains" && !hasText(probe, "pattern")) {
    add(issues, `${path}.pattern`, "Must be a non-empty string.");
  }
  if (
    typed.type === "file.contains" &&
    probe.mode !== undefined &&
    !["literal", "regex"].includes(String(probe.mode))
  ) {
    add(issues, `${path}.mode`, "Must be literal or regex.");
  }
  if (typed.type === "json.assert") {
    if (typeof probe.pointer !== "string" || !String(probe.pointer).startsWith("/")) {
      add(issues, `${path}.pointer`, 'Must be a JSON Pointer beginning with "/".');
    }
    if (!["exists", "equals", "contains", "matches"].includes(String(probe.operator))) {
      add(issues, `${path}.operator`, "Must be exists, equals, contains, or matches.");
    }
    if (probe.operator !== "exists" && probe.expected === undefined) {
      add(issues, `${path}.expected`, `Is required for ${String(probe.operator)}.`);
    } else if (probe.expected !== undefined && !isJsonValue(probe.expected)) {
      add(issues, `${path}.expected`, "Must be a JSON-compatible finite value.");
    }
  }
  if (typed.type === "command.exit") {
    if (!hasText(probe, "executable")) {
      add(issues, `${path}.executable`, "Must be a non-empty executable name.");
    }
    if (probe.args !== undefined && (!Array.isArray(probe.args) || probe.args.some((arg) => typeof arg !== "string"))) {
      add(issues, `${path}.args`, "Must be an array of strings.");
    }
    if (
      probe.expectedExitCode !== undefined &&
      !Number.isInteger(probe.expectedExitCode)
    ) {
      add(issues, `${path}.expectedExitCode`, "Must be an integer.");
    }
    if (probe.timeoutMs !== undefined && (!Number.isInteger(probe.timeoutMs) || Number(probe.timeoutMs) < 100)) {
      add(issues, `${path}.timeoutMs`, "Must be an integer of at least 100.");
    }
  }
  if (typed.type === "http.response") {
    if (!hasText(probe, "url")) {
      add(issues, `${path}.url`, "Must be a non-empty URL.");
    } else {
      try {
        const url = new URL(String(probe.url));
        if (!["http:", "https:"].includes(url.protocol)) {
          add(issues, `${path}.url`, "Only HTTP and HTTPS are supported.");
        }
      } catch {
        add(issues, `${path}.url`, "Must be a valid URL.");
      }
    }
    if (
      !Number.isInteger(probe.expectedStatus) ||
      Number(probe.expectedStatus) < 100 ||
      Number(probe.expectedStatus) > 599
    ) {
      add(issues, `${path}.expectedStatus`, "Must be an HTTP status from 100 to 599.");
    }
  }
}

export function validateContract(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: "$", message: "Contract must be a JSON object." }];
  }

  const issues: ValidationIssue[] = [];
  if (value.contractVersion !== "1.0") {
    add(issues, "contractVersion", 'Must equal "1.0".');
  }
  for (const key of ["id", "goal", "createdAt"]) {
    if (!hasText(value, key)) {
      add(issues, key, "Must be a non-empty string.");
    }
  }
  if (
    typeof value.createdAt === "string" &&
    Number.isNaN(Date.parse(value.createdAt))
  ) {
    add(issues, "createdAt", "Must be a valid ISO-8601 timestamp.");
  }
  if (!Array.isArray(value.claims) || value.claims.length === 0) {
    add(issues, "claims", "Must contain at least one claim.");
    return issues;
  }

  const ids = new Set<string>();
  let requiredCount = 0;
  value.claims.forEach((claim, index) => {
    const path = `claims[${index}]`;
    if (!isRecord(claim)) {
      add(issues, path, "Must be an object.");
      return;
    }
    if (!hasText(claim, "id")) {
      add(issues, `${path}.id`, "Must be a non-empty string.");
    } else if (ids.has(String(claim.id))) {
      add(issues, `${path}.id`, "Claim id must be unique.");
    } else {
      ids.add(String(claim.id));
    }
    if (!hasText(claim, "statement")) {
      add(issues, `${path}.statement`, "Must be a non-empty string.");
    }
    if (!["required", "advisory"].includes(String(claim.level))) {
      add(issues, `${path}.level`, "Must be required or advisory.");
    } else if (claim.level === "required") {
      requiredCount += 1;
    }
    validateProbe(claim.probe, `${path}.probe`, issues);
  });

  if (requiredCount === 0) {
    add(issues, "claims", "At least one claim must be required.");
  }

  if (value.permissions !== undefined) {
    if (!isRecord(value.permissions)) {
      add(issues, "permissions", "Must be an object.");
    } else {
      const commands = value.permissions.commands;
      if (
        commands !== undefined &&
        (!Array.isArray(commands) ||
          commands.some((entry) => !isRecord(entry) || !hasText(entry, "executable")))
      ) {
        add(issues, "permissions.commands", "Must contain declared command objects.");
      } else if (Array.isArray(commands)) {
        commands.forEach((entry, index) => {
          if (
            isRecord(entry) &&
            entry.argsPrefix !== undefined &&
            (!Array.isArray(entry.argsPrefix) ||
              entry.argsPrefix.some((arg) => typeof arg !== "string"))
          ) {
            add(
              issues,
              `permissions.commands[${index}].argsPrefix`,
              "Must be an array of strings.",
            );
          }
        });
      }
      const hosts = value.permissions.networkHosts;
      if (
        hosts !== undefined &&
        (!Array.isArray(hosts) ||
          hosts.some((entry) => typeof entry !== "string" || entry.trim().length === 0))
      ) {
        add(issues, "permissions.networkHosts", "Must be an array of hostnames.");
      } else if (
        Array.isArray(hosts) &&
        hosts.some(
          (entry) =>
            typeof entry === "string" &&
            !/^(\*\.)?[a-z0-9.-]+$/i.test(entry),
        )
      ) {
        add(
          issues,
          "permissions.networkHosts",
          "Entries must be hostnames or wildcard subdomains, without a scheme or path.",
        );
      }
    }
  }

  if (value.limits !== undefined) {
    if (!isRecord(value.limits)) {
      add(issues, "limits", "Must be an object.");
    } else {
      for (const key of ["maxTotalMs", "maxFileBytes", "maxOutputBytes"]) {
        const limit = value.limits[key];
        if (
          limit !== undefined &&
          (!Number.isInteger(limit) || Number(limit) < 1)
        ) {
          add(issues, `limits.${key}`, "Must be a positive integer.");
        }
      }
    }
  }

  if (value.metadata !== undefined && !isRecord(value.metadata)) {
    add(issues, "metadata", "Must be a JSON object.");
  } else if (value.metadata !== undefined && !isJsonValue(value.metadata)) {
    add(issues, "metadata", "Must contain only JSON-compatible finite values.");
  }

  return issues;
}

export function assertContract(
  value: unknown,
): asserts value is OutcomeContract {
  const issues = validateContract(value);
  if (issues.length > 0) {
    throw new Error(
      `Invalid outcome contract:\n${issues
        .map((issue) => `- ${issue.path}: ${issue.message}`)
        .join("\n")}`,
    );
  }
}
