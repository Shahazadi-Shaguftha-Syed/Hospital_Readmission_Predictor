import { downloadBlob } from "./format";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Builds a standalone HTML report the coordinator can save or print to PDF.
export function downloadReport({ record, result, inputs }) {
  const when = new Date(record.createdAt).toLocaleString();
  const rows = Object.entries(inputs || {})
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join("");
  const factors = (result.factor_details || [])
    .map(
      (f) =>
        `<tr><td>${esc(f.display_name)}</td><td>${f.direction === "increases_risk" ? "Raises risk" : "Lowers risk"}</td><td>${Math.abs(f.shap_value).toFixed(3)}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>MediPredict report ${esc(record.patientRef)}</title>
<style>
body{font-family:Inter,system-ui,sans-serif;color:#233b50;max-width:760px;margin:32px auto;padding:0 20px;line-height:1.5}
h1{font-size:22px;margin:0}h2{font-size:15px;margin:26px 0 8px}
.meta{color:#66788b;font-size:13px}.score{font-size:42px;font-weight:800;margin:8px 0 0}
table{border-collapse:collapse;width:100%;font-size:13.5px}td,th{border-bottom:1px solid #e5ebf0;padding:7px 10px;text-align:left}
.note{background:#fbf1d9;border-radius:8px;padding:10px 14px;margin:14px 0;font-size:13.5px}
.disc{margin-top:28px;font-size:12px;color:#66788b;border-top:1px solid #e5ebf0;padding-top:12px}
</style></head><body>
<h1>MediPredict readmission risk report</h1>
<p class="meta">Patient reference: ${esc(record.patientRef)} &middot; Generated ${esc(when)} &middot; Model version ${esc(result.model_version)}</p>
<div class="score">${(result.risk_probability * 100).toFixed(1)}%</div>
<p><strong>${esc(result.risk_tier)} risk</strong> &middot; decision threshold ${(result.decision_threshold * 100).toFixed(1)}%</p>
${result.needs_review ? `<div class="note"><strong>Needs review.</strong> ${esc(result.uncertainty_reason)}</div>` : ""}
<p>${esc(result.plain_language_summary)}</p>
<h2>Top contributing factors</h2><table><tr><th>Factor</th><th>Effect</th><th>SHAP size</th></tr>${factors}</table>
<h2>Inputs used</h2><table>${rows}</table>
<p class="disc">Educational decision-support prototype. Not a clinical diagnosis. The model was trained on a dataset with synthetic admission dates and a derived readmission label, so scores demonstrate the pipeline and are not clinical evidence.</p>
</body></html>`;
  const safe = String(record.patientRef).replace(/[^a-z0-9_-]+/gi, "-");
  downloadBlob(`medipredict-report-${safe}.html`, html, "text/html");
}
