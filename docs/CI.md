# CI integration

Run Tuntas after building and testing, or let the contract invoke a declared
test command:

```yaml
- name: Verify definition of done
  run: |
    pnpm tuntas verify examples/contracts/project-done.json \
      --workspace . \
      --allow-command \
      --output .tuntas/evidence.json
```

Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | Outcome proved or receipt valid |
| `1` | Usage, input, or unexpected runtime error |
| `2` | Required claim failed |
| `3` | Verification incomplete |
| `4` | Contract diff weakened controls |
| `5` | Evidence receipt invalid |

## Contract review

Keep contracts in version control and compare changes:

```bash
pnpm tuntas diff-contract old.contract.json new.contract.json
```

The command exits `4` when a required claim is removed/demoted or a command or
network permission is added. Probe changes are always shown as oracle drift even
when their strictness cannot be classified automatically.

## Recommended boundary

For meaningful assurance, the agent being evaluated should not be able to:

- modify the final contract;
- replace the Tuntas binary or runner;
- modify hidden test fixtures;
- overwrite stored evidence;
- control the identity used to sign receipts.
