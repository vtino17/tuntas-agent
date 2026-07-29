# Outcome Contract 1.0

An Outcome Contract describes what must be observably true before work can be
called complete. It is an executable definition of done, not an instruction
prompt.

## Structure

```json
{
  "contractVersion": "1.0",
  "id": "release-ready-v1",
  "goal": "Ship a verified release",
  "createdAt": "2026-07-29T00:00:00.000Z",
  "claims": []
}
```

Every claim has a stable ID, human-readable statement, level, and probe.
`required` claims determine the outcome. `advisory` claims are recorded without
blocking proof.

## Outcomes

| Outcome | Meaning |
| --- | --- |
| `proved` | Every required probe passed and the workspace stayed stable |
| `failed` | At least one required probe observed a real mismatch |
| `incomplete` | A required probe errored, was skipped, or the workspace changed |

Tuntas distinguishes failure from missing evidence. A disabled command probe is
not evidence that tests failed; it is an incomplete verification.

## Probe vocabulary

- `file.exists`: path exists and optionally has the expected kind.
- `file.contains`: bounded file contains a literal or regular expression.
- `json.assert`: JSON Pointer exists, equals, contains, or matches.
- `command.exit`: an explicitly declared executable returns an expected code.
- `git.clean`: Git porcelain status has no disallowed entries.
- `http.response`: an allowlisted host returns expected status/content.

Conditions are deterministic. There is no model or semantic judge in the proof
path.

## Permissions

Contracts declare commands and network hosts, but declarations do not grant
authority. The operator must separately pass `--allow-command` or
`--allow-network`. This two-key model prevents a contract supplied by an
untrusted agent from activating privileged probes by itself.

## Limits

`maxTotalMs`, `maxFileBytes`, and `maxOutputBytes` bound resource consumption.
Defaults are conservative and runner output is truncated before inclusion in
evidence.
