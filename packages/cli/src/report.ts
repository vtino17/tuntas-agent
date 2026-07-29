import type { EvidenceReceipt } from "@tuntas/core";

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderEvidenceReport(evidence: EvidenceReceipt): string {
  const rows = evidence.results
    .map(
      (result) => `
        <article class="claim claim-${result.status}">
          <div class="claim-head">
            <span class="status">${escapeHtml(result.status)}</span>
            <span class="level">${escapeHtml(result.level)}</span>
            <code>${escapeHtml(result.probeType)}</code>
          </div>
          <h3>${escapeHtml(result.statement)}</h3>
          <p>${escapeHtml(result.observation.summary)}</p>
          ${
            result.observation.preview
              ? `<pre>${escapeHtml(result.observation.preview)}</pre>`
              : ""
          }
          <footer>
            <span>${escapeHtml(result.claimId)}</span>
            <span>${result.durationMs}ms</span>
          </footer>
        </article>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Tuntas evidence — ${escapeHtml(evidence.runId)}</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#edf1ed;background:#0a0d0b;--line:#29302b;--muted:#909a93;--green:#b9f65a;--amber:#f7c65f;--red:#ff746a}
    *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 80% 0,rgba(89,224,211,.08),transparent 32rem),#0a0d0b}main{width:min(1080px,calc(100% - 32px));margin:auto;padding:52px 0}
    .brand{font:700 12px ui-monospace,monospace;letter-spacing:.18em;color:var(--green)}h1{max-width:800px;margin:24px 0 14px;font-size:clamp(36px,7vw,72px);line-height:.98;letter-spacing:-.055em}
    .meta{display:flex;gap:8px;flex-wrap:wrap;margin:28px 0}.pill{padding:8px 11px;border:1px solid var(--line);color:var(--muted);font:12px ui-monospace,monospace}.outcome{color:#0b0f0c;background:var(--green);border-color:var(--green);font-weight:700}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);margin:28px 0}.metric{padding:20px;border-right:1px solid var(--line)}.metric:last-child{border:0}.metric span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase}.metric strong{display:block;margin-top:8px;font:500 24px ui-monospace,monospace}
    .claims{display:grid;gap:12px}.claim{padding:22px;border:1px solid var(--line);background:#111512}.claim-pass{border-left:3px solid var(--green)}.claim-fail{border-left:3px solid var(--red)}.claim-error,.claim-skipped{border-left:3px solid var(--amber)}
    .claim-head{display:flex;align-items:center;gap:8px}.status,.level{padding:4px 7px;text-transform:uppercase;font:700 9px ui-monospace,monospace}.status{color:#0b0f0c;background:var(--green)}.claim-fail .status{background:var(--red)}.claim-error .status,.claim-skipped .status{background:var(--amber)}.level{color:var(--muted);border:1px solid var(--line)}code{color:#67ddd6;font:11px ui-monospace,monospace}
    h3{margin:18px 0 7px;font-size:17px}.claim p{margin:0;color:#b4bdb7;line-height:1.6}.claim footer{display:flex;justify-content:space-between;margin-top:18px;padding-top:12px;border-top:1px solid var(--line);color:var(--muted);font:10px ui-monospace,monospace}pre{overflow:auto;padding:14px;background:#090b0a;color:#cdd5d0;font:11px/1.6 ui-monospace,monospace}
    .hash{margin-top:32px;padding:18px;border:1px solid var(--line);overflow-wrap:anywhere}.hash span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase}.hash code{display:block;margin-top:8px}
    .warning{color:var(--amber)}@media(max-width:650px){.summary{grid-template-columns:1fr}.metric{border-right:0;border-bottom:1px solid var(--line)}}
  </style>
</head>
<body>
  <main>
    <span class="brand">TUNTAS / PROOF-OF-DONE</span>
    <h1>${escapeHtml(evidence.goal)}</h1>
    <div class="meta">
      <span class="pill outcome">${escapeHtml(evidence.outcome)}</span>
      <span class="pill">${escapeHtml(evidence.workspace.label)}</span>
      <span class="pill">${escapeHtml(evidence.completedAt)}</span>
      ${evidence.workspace.changedDuringVerification ? '<span class="pill warning">workspace changed during verification</span>' : ""}
    </div>
    <section class="summary">
      <div class="metric"><span>Required</span><strong>${evidence.score.requiredPassed}/${evidence.score.requiredTotal}</strong></div>
      <div class="metric"><span>Advisory</span><strong>${evidence.score.advisoryPassed}/${evidence.score.advisoryTotal}</strong></div>
      <div class="metric"><span>Claims</span><strong>${evidence.results.length}</strong></div>
    </section>
    <section class="claims">${rows}</section>
    <div class="hash"><span>Evidence SHA-256</span><code>${escapeHtml(evidence.evidenceHash)}</code></div>
  </main>
</body>
</html>`;
}
