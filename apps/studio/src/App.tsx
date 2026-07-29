import { useMemo, useState } from "react";
import {
  diffContracts,
  sealEvidence,
  sha256,
  validateContract,
} from "@tuntas/core";
import type {
  EvidenceReceipt,
  OutcomeContract,
  ProbeStatus,
} from "@tuntas/core";
import { sampleContract } from "./sample.js";

const stringify = (value: unknown) => JSON.stringify(value, null, 2);
const statuses: ProbeStatus[] = ["pass", "fail", "error", "skipped"];

function parseContract(text: string): {
  contract?: OutcomeContract;
  error?: string;
} {
  try {
    const value = JSON.parse(text) as unknown;
    const issues = validateContract(value);
    if (issues.length > 0) {
      return {
        error: issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("\n"),
      };
    }
    return { contract: value as OutcomeContract };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function StatusSelector({
  value,
  onChange,
}: {
  value: ProbeStatus;
  onChange: (status: ProbeStatus) => void;
}) {
  return (
    <div className="status-selector">
      {statuses.map((status) => (
        <button
          aria-label={`Set ${status}`}
          className={value === status ? `active ${status}` : ""}
          key={status}
          onClick={() => onChange(status)}
          title={status}
        >
          {status === "pass"
            ? "✓"
            : status === "fail"
              ? "×"
              : status === "error"
                ? "!"
                : "–"}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const [contractText, setContractText] = useState(stringify(sampleContract));
  const parsed = useMemo(() => parseContract(contractText), [contractText]);
  const [claimStatuses, setClaimStatuses] = useState<Record<string, ProbeStatus>>(
    Object.fromEntries(sampleContract.claims.map((claim) => [claim.id, "pass"])),
  );
  const [receipt, setReceipt] = useState<EvidenceReceipt>();
  const [sealError, setSealError] = useState("");

  const permissions = parsed.contract?.permissions;
  const weakened = useMemo(() => {
    if (!parsed.contract) return [];
    const candidate: OutcomeContract = {
      ...parsed.contract,
      id: `${parsed.contract.id}-candidate`,
      claims: parsed.contract.claims.map((claim, index) =>
        index === 0 ? { ...claim, level: "advisory" } : claim,
      ),
      permissions: {
        ...parsed.contract.permissions,
        networkHosts: [
          ...(parsed.contract.permissions?.networkHosts ?? []),
          "api.example.com",
        ],
      },
    };
    return diffContracts(parsed.contract, candidate).weakenedControls;
  }, [parsed.contract]);

  function setStatus(id: string, status: ProbeStatus) {
    setClaimStatuses((current) => ({ ...current, [id]: status }));
    setReceipt(undefined);
  }

  async function rehearse() {
    if (!parsed.contract) return;
    try {
      const now = new Date();
      const contractHash = await sha256(parsed.contract);
      const next = await sealEvidence({
        evidenceVersion: "1.0",
        runId: `rehearsal-${now.getTime().toString(36)}`,
        contractId: parsed.contract.id,
        goal: parsed.contract.goal,
        contractHash,
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        workspace: {
          label: "studio-rehearsal",
          gitHead: null,
          beforeHash: "not-executed",
          afterHash: "not-executed",
          changedDuringVerification: false,
        },
        capabilities: {
          commandEnabled: false,
          networkEnabled: false,
        },
        results: parsed.contract.claims.map((claim) => ({
          claimId: claim.id,
          statement: claim.statement,
          level: claim.level,
          probeType: claim.probe.type,
          status: claimStatuses[claim.id] ?? "skipped",
          durationMs: 0,
          observation: {
            summary: "Manual rehearsal status; execute with the CLI for real evidence.",
          },
        })),
        previousEvidenceHash: null,
      });
      setReceipt(next);
      setSealError("");
    } catch (error) {
      setSealError(error instanceof Error ? error.message : String(error));
    }
  }

  function downloadContract() {
    if (!parsed.contract) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([`${stringify(parsed.contract)}\n`], {
        type: "application/json",
      }),
    );
    link.download = "tuntas.contract.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main>
      <header className="site-header">
        <a href="#" className="brand">
          <span className="brand-glyph">T</span>
          <span>Tuntas</span>
          <small>Contract Studio</small>
        </a>
        <div className="local-status">
          <span />
          Local rehearsal
        </div>
      </header>

      <section className="hero">
        <div>
          <span className="overline">PROOF-OF-DONE / AGENTIC WORK</span>
          <h1>“Selesai” harus<br />punya bukti.</h1>
        </div>
        <div className="hero-copy">
          <p>
            Definisikan hasil yang harus benar. Tuntas mengubahnya menjadi
            probe deterministik dan evidence yang dapat diverifikasi.
          </p>
          <div className="hero-index">
            <span>01 CONTRACT</span>
            <span>02 PROBE</span>
            <span>03 EVIDENCE</span>
          </div>
        </div>
      </section>

      <section className="studio">
        <section className="editor-column">
          <div className="column-title">
            <div>
              <span className="index">01</span>
              <h2>Outcome contract</h2>
            </div>
            <button className="text-button" onClick={downloadContract} disabled={!parsed.contract}>
              Download
            </button>
          </div>
          <div className="editor-shell">
            <div className="file-tab">
              <span className="json-icon">{"{}"}</span>
              tuntas.contract.json
              <span>{contractText.split("\n").length} lines</span>
            </div>
            <textarea
              aria-label="Outcome contract JSON"
              value={contractText}
              onChange={(event) => {
                setContractText(event.target.value);
                setReceipt(undefined);
              }}
              spellCheck={false}
            />
          </div>
          {parsed.error && <pre className="error-box">{parsed.error}</pre>}
        </section>

        <section className="claims-column">
          <div className="column-title">
            <div>
              <span className="index">02</span>
              <h2>Probe rehearsal</h2>
            </div>
            <span className="counter">{parsed.contract?.claims.length ?? 0}</span>
          </div>
          <p className="column-note">
            Atur hasil manual untuk menguji logika kontrak. CLI tetap diperlukan
            untuk menjalankan probe sebenarnya.
          </p>
          <div className="claim-list">
            {parsed.contract?.claims.map((claim, index) => (
              <article className="claim-card" key={claim.id}>
                <div className="claim-top">
                  <span className="claim-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className={`level level-${claim.level}`}>{claim.level}</span>
                  <code>{claim.probe.type}</code>
                </div>
                <h3>{claim.statement}</h3>
                <div className="claim-bottom">
                  <span>{claim.id}</span>
                  <StatusSelector
                    value={claimStatuses[claim.id] ?? "skipped"}
                    onChange={(status) => setStatus(claim.id, status)}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="result-column">
          <div className="column-title">
            <div>
              <span className="index">03</span>
              <h2>Evidence</h2>
            </div>
          </div>
          <section className={`outcome-card outcome-${receipt?.outcome ?? "idle"}`}>
            <span className="eyebrow">REHEARSAL OUTCOME</span>
            <strong>{receipt?.outcome ?? "not sealed"}</strong>
            <div className="score-row">
              <div>
                <span>Required</span>
                <b>
                  {receipt
                    ? `${receipt.score.requiredPassed}/${receipt.score.requiredTotal}`
                    : "—"}
                </b>
              </div>
              <div>
                <span>Advisory</span>
                <b>
                  {receipt
                    ? `${receipt.score.advisoryPassed}/${receipt.score.advisoryTotal}`
                    : "—"}
                </b>
              </div>
            </div>
            <button className="seal-button" onClick={rehearse} disabled={!parsed.contract}>
              Seal rehearsal
            </button>
            {receipt && (
              <div className="hash">
                <span>EVIDENCE SHA-256</span>
                <code>{receipt.evidenceHash}</code>
              </div>
            )}
            {sealError && <p className="seal-error">{sealError}</p>}
          </section>

          <section className="side-card">
            <span className="eyebrow">CAPABILITY SURFACE</span>
            <div className="capability">
              <span>Commands</span>
              <strong>{permissions?.commands?.length ?? 0}</strong>
            </div>
            <div className="capability">
              <span>Network hosts</span>
              <strong>{permissions?.networkHosts?.length ?? 0}</strong>
            </div>
            <p>Kontrak mendeklarasikan izin; operator CLI tetap harus memberi consent.</p>
          </section>

          <section className="side-card drift-card">
            <span className="eyebrow">DRIFT CANARY</span>
            <h3>{weakened.length} pelemahan terdeteksi</h3>
            {weakened.map((entry) => (
              <p key={entry}>↘ {entry}</p>
            ))}
          </section>
        </aside>
      </section>

      <footer className="site-footer">
        <span>TUNTAS / VENDOR-NEUTRAL OUTCOME VERIFICATION</span>
        <span>Studio tidak menjalankan command atau network probe</span>
      </footer>
    </main>
  );
}
