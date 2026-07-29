# Contributing

Contributions are welcome, especially new deterministic probes and adversarial
fixtures.

1. Describe the observable outcome a change should verify.
2. Keep model calls out of the proof path.
3. Preserve default-deny behavior for command and network capabilities.
4. Add pass, fail, error, and boundary tests where applicable.
5. Update the security model when a trust boundary changes.
6. Run `pnpm check`.

Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).
