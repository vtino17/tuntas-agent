# Evidence Receipt 1.0

Tuntas turns a verification run into canonical JSON and computes a SHA-256
content hash. The receipt binds:

- the exact Outcome Contract hash;
- every claim verdict and observation;
- required/advisory scores;
- the workspace fingerprint before and after verification;
- enabled runtime capabilities;
- timestamps and optional previous receipt hash.

`verify-evidence` recomputes the receipt hash, outcome, score, and—when given the
contract—the contract hash and claim set.

## Chains

Pass `--previous previous.json` to link a run to an earlier receipt. The new
receipt stores the previous evidence hash, enabling append-only histories.

## What a hash proves

A valid hash detects accidental or malicious mutation after sealing. It does
not prove who ran Tuntas. Anyone who can rewrite the receipt can recompute an
unsigned hash.

For non-repudiation, sign `evidenceHash` with a separately controlled KMS,
Sigstore, or organizational signing service and store receipts outside the
agent's write boundary.

## Portable HTML

`tuntas report` creates a self-contained HTML summary with escaped observation
text and no remote JavaScript. It refuses to render a receipt whose internal
checks fail.
