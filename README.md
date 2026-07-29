# Tuntas

**Deterministic proof-of-done for AI agent work.**

AI agents often report that a task is complete. Tuntas asks a stricter question:
*what independent evidence makes that statement true?*

An Outcome Contract turns “done” into required and advisory claims. A
security-conscious runner executes deterministic probes, detects workspace
mutation, and seals the result in a tamper-evident evidence receipt.

> **Bahasa Indonesia:** Tuntas memverifikasi hasil kerja agent secara independen.
> Agent tidak cukup berkata “selesai”; file, konfigurasi, test, Git, atau endpoint
> yang dijanjikan harus memenuhi kontrak hasil.

## Why now

Agent evaluation is moving from model output scoring toward workflow probes and
machine-readable audit trails. NIST's 2026 agentic evaluation project describes
automated probes acting as adversarial verifiers, while NIST AI 800-2 notes that
agentic evaluations require explicit stopping conditions.

Tuntas brings that principle to everyday repositories. It is not a benchmark,
LLM judge, coding agent, or test framework. It is a portable definition-of-done
layer that composes existing evidence.

| Capability | Tuntas | Test runner | Agent self-report | LLM judge |
| --- | --- | --- | --- | --- |
| Cross-tool outcome contract | Yes | No | No | Rubric only |
| File, JSON, Git, command, HTTP probes | Yes | Usually code only | Unverified | Indirect |
| Required vs missing evidence | Yes | Limited | No | Probabilistic |
| Workspace mutation guard | Yes | No | No | No |
| Contract weakening detection | Yes | No | No | No |
| Content-bound evidence chain | Yes | Varies | No | Varies |
| Model in verdict path | No | No | Yes | Yes |

No search can prove that nobody has ever built a similar tool. Tuntas is
deliberately differentiated by combining repository-level outcome contracts,
capability-gated probes, oracle-drift review, mutation detection, and portable
evidence receipts.

## Included

- `@tuntas/core`: contract validation, outcome aggregation, SHA-256 receipts,
  verification, and drift detection;
- `@tuntas/runner`: six deterministic probes with path, permission, timeout, and
  output controls;
- `tuntas` CLI: verify, verify-evidence, diff-contract, report, and init;
- Tuntas Studio: local contract editor and outcome rehearsal interface;
- self-contained HTML evidence reports;
- runnable fixtures, production-oriented documentation, tests, and CI.

## Quick start

Requirements: Node.js 20+ and pnpm 10.

```bash
git clone https://github.com/vtino17/tuntas-agent.git
cd tuntas-agent
corepack enable
pnpm install
pnpm check
```

Verify the safe fixture without command or network permissions:

```bash
pnpm tuntas verify examples/contracts/fixture-done.json \
  --workspace examples/fixture \
  --output .tuntas/fixture.json
```

Verify the receipt and generate a portable report:

```bash
pnpm tuntas verify-evidence .tuntas/fixture.json \
  --contract examples/contracts/fixture-done.json

pnpm tuntas report .tuntas/fixture.json \
  --output .tuntas/fixture.html
```

Launch the local Contract Studio:

```bash
pnpm dev
```

The Studio designs and rehearses contracts but intentionally does not execute
commands or make network requests.

## Real repository verification

Command probes need two independent permissions:

1. the contract must declare the exact executable and argument prefix;
2. the operator must pass `--allow-command`.

```bash
pnpm tuntas verify examples/contracts/project-done.json \
  --workspace . \
  --allow-command \
  --output .tuntas/project.json
```

Network probes similarly require a contract hostname allowlist and the
`--allow-network` flag.

## Probe types

| Probe | Checks |
| --- | --- |
| `file.exists` | Contained path exists as file/directory/any |
| `file.contains` | Bounded content matches literal or regex |
| `json.assert` | JSON Pointer exists/equals/contains/matches |
| `command.exit` | Declared no-shell process exits as expected |
| `git.clean` | Porcelain status has no disallowed changes |
| `http.response` | Allowlisted host returns expected response |

The runner reports `proved`, `failed`, or `incomplete`. Disabled probes and
runtime errors never masquerade as successful evidence.

## Contract drift

```bash
pnpm tuntas diff-contract \
  examples/contracts/project-done.json \
  examples/contracts/project-weakened.json
```

Tuntas flags removed/demoted requirements, new command/network capabilities, and
all changed probes. This makes the verifier itself reviewable.

## Security posture

Tuntas uses path containment, realpath checks for existing symlinks, process
spawning without a shell, permission declarations plus operator consent, strict
runtime/file/output limits, redirect rejection, and before/after workspace
fingerprints.

It is still not a sandbox. An allowed command inherits the user's OS authority.
Read the [security model](docs/SECURITY-MODEL.md) before evaluating untrusted
contracts.

## Documentation

- [Outcome Contract specification](docs/CONTRACT.md)
- [Evidence Receipt specification](docs/EVIDENCE.md)
- [Security model](docs/SECURITY-MODEL.md)
- [CI integration](docs/CI.md)

## Design references

- [NIST: Building Evaluation Probes into Agentic AI](https://www.nist.gov/programs-projects/building-evaluation-probes-agentic-ai)
- [NIST AI 800-2: Practices for Automated Benchmark Evaluations](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.800-2.ipd.pdf)
- [Building to the Test: Coding Agents Deliver What You Check, Not What You Requested](https://arxiv.org/abs/2606.28430)

These sources motivate independent verification; they do not certify or endorse
Tuntas.

## Repository layout

```text
apps/studio/       Local contract workbench
packages/core/     Contract, evidence, hashing, drift
packages/runner/   Sandboxed-by-policy local probes
packages/cli/      Automation and HTML reports
examples/          Safe fixtures and contracts
docs/              Protocol and security guidance
```

## Status

Tuntas is an experimental reference implementation. A strong receipt only shows
that its contract was satisfied under the recorded runner conditions. It does
not prove that the contract captured every human expectation.

## License

[MIT](LICENSE)
