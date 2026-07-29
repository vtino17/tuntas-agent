# Security model

## Threats in scope

- an agent claims completion without satisfying the requested outcome;
- a contract silently drops or relaxes required claims;
- an agent-supplied contract attempts to run commands or access the network;
- a file probe escapes the intended workspace using traversal or symlinks;
- a verifier command produces unbounded output or never exits;
- the workspace changes while claims are being checked;
- an evidence file is altered after creation.

## Controls

- deterministic probes and explicit stopping conditions;
- required versus advisory claims;
- contract drift detection;
- path containment and existing-path symlink resolution;
- `spawn` without a shell and exact executable/argument-prefix declarations;
- separate operator consent for command and network capabilities;
- IP literal, localhost, and redirect rejection for HTTP probes;
- total runtime, individual timeout, file, and output limits;
- before/after Git and referenced-artifact fingerprints;
- canonical content hashing and optional evidence chaining.

## Important limitations

Tuntas is a verifier, not a sandbox. An allowed command runs with the user's OS
permissions and could still be harmful. Run untrusted contracts inside a
container or restricted CI job.

Hostname allowlists do not fully prevent DNS rebinding. Sensitive networks need
an egress proxy with DNS and IP enforcement.

Workspace mutation detection covers Git state and artifacts referenced by the
contract. In a non-Git directory, unrelated files not referenced by probes are
outside the fingerprint.

A weak contract can be satisfied perfectly. Contract authors must choose probes
that represent the user's real outcome rather than superficial implementation
details.
