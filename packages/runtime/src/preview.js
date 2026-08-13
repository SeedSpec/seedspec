import { createServer } from "node:http";
import { checkPackage, formatCheck } from "./check.js";

function htmlPage(report, extra = {}) {
  const criteria = report.coverage.criteria.map((criterion) => {
    const result = report.verification?.criterion_results
      .find(({ id }) => id === criterion.id);
    const state = result
      ? result.passed ? "pass" : "fail"
      : criterion.enforceable ? "open" : "gap";
    return `<tr>
      <td><code>${escapeHtml(criterion.id)}</code></td>
      <td>${escapeHtml(criterion.description)}</td>
      <td>${criterion.anchored ? "anchored" : "unanchored"}</td>
      <td>${criterion.enforceable ? "yes" : "no"}</td>
      <td class="${state}">${state}</td>
    </tr>`;
  }).join("");
  const issues = report.issues.map((issue) => (
    `<li class="${issue.severity}"><strong>${escapeHtml(issue.code)}</strong> ${escapeHtml(issue.message)}</li>`
  )).join("");
  const survey = report.survey.map((item) => (
    `<li><p>${escapeHtml(item.prompt)}</p>${
      item.items?.length ? `<p class="muted">${escapeHtml(item.items.join(", "))}</p>` : ""
    }</li>`
  )).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SeedSpec check — ${escapeHtml(report.package.name)}</title>
  <style>
    :root { color-scheme: dark; --bg:#0f1115; --card:#171a21; --line:#2a3140; --text:#e8edf5; --muted:#93a0b5; --pass:#3dd68c; --fail:#ff6b7a; --review:#f5c14a; }
    body { margin:0; font:15px/1.45 ui-sans-serif, system-ui, sans-serif; background:var(--bg); color:var(--text); }
    main { max-width:960px; margin:0 auto; padding:32px 20px 64px; }
    h1 { font-size:1.4rem; margin:0 0 8px; }
    .muted { color:var(--muted); }
    .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px; margin:16px 0; }
    .status { display:inline-block; padding:2px 10px; border-radius:999px; font-weight:700; letter-spacing:.04em; }
    .status.pass { background:#123d2a; color:var(--pass); }
    .status.fail { background:#3d151b; color:var(--fail); }
    .status.review { background:#3d3212; color:var(--review); }
    table { width:100%; border-collapse:collapse; }
    th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--line); vertical-align:top; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.9em; }
    .pass { color:var(--pass); }
    .fail { color:var(--fail); }
    .gap, .open { color:var(--review); }
    ul { padding-left:1.2rem; }
    pre { overflow:auto; background:#0b0d12; padding:12px; border-radius:10px; }
  </style>
</head>
<body>
  <main>
    <p class="status ${report.status}">${report.status.toUpperCase()}</p>
    <h1>${escapeHtml(report.package.name)}</h1>
    <p class="muted">${escapeHtml(report.package.id)}@${escapeHtml(report.package.version)}${report.package.kind ? ` · ${escapeHtml(report.package.kind)}` : ""}</p>
    <p class="muted"><code>${escapeHtml(report.package.digest)}</code></p>
    <section class="card">
      <p>${report.coverage.criteria.length} criteria · ${report.coverage.criteria.length - report.coverage.unenforceable_criteria.length} enforceable · ${report.coverage.evaluation_modules.length} evaluation modules</p>
      ${report.verification ? `<p>Trusted evidence: ${report.verification.trusted ? "yes" : "no"} · ${report.verification.passed}/${report.verification.required} verified</p>` : "<p class=\"muted\">Coverage only. Supply --evaluate or --evidence to verify a realization.</p>"}
    </section>
    <section class="card">
      <h2>Criteria</h2>
      <table>
        <thead><tr><th>ID</th><th>Claim</th><th>Prose</th><th>Eval</th><th>State</th></tr></thead>
        <tbody>${criteria || `<tr><td colspan="5" class="muted">No success criteria</td></tr>`}</tbody>
      </table>
    </section>
    <section class="card">
      <h2>Authoring survey</h2>
      ${survey ? `<ul>${survey}</ul>` : "<p class=\"muted\">No survey prompts. Claims are anchored and enforceable.</p>"}
    </section>
    <section class="card">
      <h2>Issues</h2>
      ${issues ? `<ul>${issues}</ul>` : "<p class=\"muted\">No issues.</p>"}
    </section>
    ${extra.text ? `<section class="card"><h2>Workspace check</h2><pre>${escapeHtml(extra.text)}</pre></section>` : ""}
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

export async function startPreviewServer(inputPath, {
  port = 8787,
  evaluate,
  workspace,
  host = "127.0.0.1"
} = {}) {
  const report = () => checkPackage(inputPath, { evaluate, workspace });
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${host}:${port}`);
      const current = await report();
      if (url.pathname === "/api/check") {
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(`${JSON.stringify(current, null, 2)}\n`);
        return;
      }
      if (url.pathname === "/api/text") {
        response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
        response.end(`${formatCheck(current)}\n`);
        return;
      }
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(htmlPage(current, { text: formatCheck(current) }));
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(`${error.message}\n`);
    }
  });
  await new Promise((resolve) => {
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    url: `http://${host}:${actualPort}/`,
    port: actualPort,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}
