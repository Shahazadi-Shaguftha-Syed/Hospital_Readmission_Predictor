import { useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, CircleAlert, Download, FileSpreadsheet, FileText, Loader2, Search, UploadCloud, X,
} from "lucide-react";
import { Badge, Banner, EmptyState, PageHeader } from "../components/ui";
import { HBars } from "../components/charts";
import { scoreBatchCsv } from "../api";
import { newRecordId, useHistoryStore, useToast } from "../lib/store.jsx";
import { downloadBlob, pct, toCsv } from "../lib/format";

const MAX_BYTES = 10 * 1024 * 1024;
const TIER_ORDER = { High: 3, Medium: 2, Low: 1 };
const FILTERS = ["All", "High", "Medium", "Low", "Needs review", "Failed"];

export default function BatchAnalysis() {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState("idle"); // idle | uploading | scoring | done | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState({ key: "rank", dir: "asc" });
  const inputRef = useRef(null);
  const history = useHistoryStore();
  const toast = useToast();

  const choose = (f) => {
    setFileError("");
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return setFileError("This file is not a .csv. Export your sheet as CSV and try again.");
    if (f.size > MAX_BYTES) return setFileError("This file is larger than 10 MB. Split it into smaller files.");
    if (f.size === 0) return setFileError("This file is empty.");
    setFile(f);
    setData(null);
    setError("");
    setStage("idle");
  };

  const run = async () => {
    setStage("uploading");
    setProgress(0);
    setError("");
    try {
      const res = await scoreBatchCsv(file, (p) => {
        setProgress(p);
        if (p >= 1) setStage("scoring");
      });
      const ranked = res.patients.map((p, i) => ({ ...p, rank: i + 1 }));
      setData({ ...res, patients: ranked });
      setStage("done");
      const now = new Date().toISOString();
      const saved = ranked
        .filter((p) => p.status === "OK")
        .map((p) => ({
          id: newRecordId(), createdAt: now, patientRef: String(p.patient_ref), source: "batch",
          probability: p.risk_probability, tier: p.risk_tier, needsReview: p.needs_review,
          summary: p.plain_language_summary, topFactors: p.top_factors,
        }));
      history.add(saved);
      toast.success(`Scored ${res.successful_predictions} patients${res.failed_predictions ? `, ${res.failed_predictions} failed` : ""}.`);
    } catch (e) {
      setError(e.message);
      setStage("error");
      toast.error("Batch scoring failed.");
    }
  };

  const reset = () => {
    setFile(null); setData(null); setStage("idle"); setError(""); setFileError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const rows = useMemo(() => {
    if (!data) return [];
    let r = data.patients;
    if (query.trim()) r = r.filter((p) => String(p.patient_ref).toLowerCase().includes(query.trim().toLowerCase()));
    if (filter === "Needs review") r = r.filter((p) => p.status === "OK" && p.needs_review);
    else if (filter === "Failed") r = r.filter((p) => p.status !== "OK");
    else if (filter !== "All") r = r.filter((p) => p.risk_tier === filter);
    const dir = sort.dir === "asc" ? 1 : -1;
    const val = (p) =>
      sort.key === "patient" ? String(p.patient_ref).toLowerCase()
      : sort.key === "risk" ? (p.risk_probability ?? -1)
      : sort.key === "tier" ? (TIER_ORDER[p.risk_tier] ?? 0)
      : p.rank;
    return [...r].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * dir);
  }, [data, query, filter, sort]);

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "patient" ? "asc" : "desc" }));
  const SortHead = ({ k, children }) => (
    <th aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button onClick={() => toggleSort(k)}>
        {children}
        {sort.key === k && (sort.dir === "asc" ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />)}
      </button>
    </th>
  );

  const exportCsv = () => {
    const csv = toCsv(rows, [
      { label: "rank", value: (p) => p.rank },
      { label: "patient_ref", value: (p) => p.patient_ref },
      { label: "status", value: (p) => p.status },
      { label: "risk_probability", value: (p) => p.risk_probability ?? "" },
      { label: "risk_tier", value: (p) => p.risk_tier ?? "" },
      { label: "needs_review", value: (p) => (p.needs_review === undefined ? "" : p.needs_review) },
      { label: "top_factors", value: (p) => (p.top_factors || []).join(" | ") },
      { label: "error", value: (p) => p.error ?? "" },
    ]);
    downloadBlob("medipredict-ward-scores.csv", csv, "text/csv");
    toast.success(`Exported ${rows.length} rows.`);
  };

  const busy = stage === "uploading" || stage === "scoring";
  const tierRows = data
    ? ["High", "Medium", "Low"].map((t) => ({
        label: t, value: data.tier_counts[t],
        color: t === "High" ? "var(--high)" : t === "Medium" ? "var(--warning)" : "var(--low)",
      }))
    : [];

  return (
    <>
      <PageHeader
        title="Batch analysis"
        subtitle="Score a whole ward from one CSV. Patients come back ranked highest risk first, and one bad row never blocks the others."
        actions={
          <a className="btn" href="/predict/batch/template" download>
            <FileText size={17} aria-hidden="true" />Download CSV template
          </a>
        }
      />

      <div className="stack">
        {!file && (
          <div
            className={`dropzone${dragging ? " drag" : ""}`}
            role="button" tabIndex={0}
            aria-label="Upload a CSV file. Press Enter to browse files, or drop a file here."
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), inputRef.current?.click())}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files[0]); }}
          >
            <div className="empty-icon"><UploadCloud size={22} aria-hidden="true" /></div>
            <h3 style={{ fontSize: 16 }}>Drag a CSV here, or browse</h3>
            <p className="muted">One patient per row, up to 5,000 rows and 10 MB. Columns you leave out use defaults.</p>
            <span className="btn sm" aria-hidden="true">Browse files</span>
          </div>
        )}
        <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => choose(e.target.files[0])} />
        {fileError && <Banner kind="error" icon={CircleAlert}>{fileError}</Banner>}

        {file && (
          <div className="card card-pad stack">
            <div className="file-pill">
              <FileSpreadsheet size={22} aria-hidden="true" style={{ color: "var(--primary-strong)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
                <div className="small muted">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button className="icon-btn" onClick={reset} disabled={busy} aria-label="Remove file"><X size={18} /></button>
            </div>
            {busy && (
              <div>
                <div className={`progress${stage === "scoring" ? " indeterminate" : ""}`} role="progressbar"
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={stage === "scoring" ? undefined : Math.round(progress * 100)}>
                  <div style={{ width: `${progress * 100}%` }} />
                </div>
                <p className="small muted" style={{ marginTop: 6 }}>
                  {stage === "uploading" ? `Uploading ${Math.round(progress * 100)}%` : "Scoring patients with the model…"}
                </p>
              </div>
            )}
            {!data && (
              <div>
                <button className="btn primary" onClick={run} disabled={busy}>
                  {busy ? (<><Loader2 size={17} className="spin" aria-hidden="true" />Working…</>) : "Score this file"}
                </button>
              </div>
            )}
            {stage === "error" && <Banner kind="error" icon={CircleAlert}>{error}</Banner>}
          </div>
        )}

        {data && (
          <>
            <div className="grid g-main-side">
              <section className="card card-pad">
                <div className="card-head"><h2>Prediction summary</h2></div>
                <div className="kpi-row" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
                  <div className="kpi card"><span>Submitted</span><b className="num">{data.total_submitted}</b></div>
                  <div className="kpi card"><span>Scored</span><b className="num">{data.successful_predictions}</b></div>
                  <div className="kpi card"><span>Failed</span><b className="num">{data.failed_predictions}</b></div>
                  <div className="kpi card"><span>Needs review</span><b className="num">{data.patients.filter((p) => p.needs_review).length}</b></div>
                </div>
                <p className="small muted" style={{ marginTop: 12 }}>Scored rows were added to Prediction History on this browser.</p>
              </section>
              <section className="card card-pad">
                <div className="card-head"><h2>Risk levels</h2></div>
                <HBars rows={tierRows} max={Math.max(data.successful_predictions, 1)} />
              </section>
            </div>

            <section className="card card-pad">
              <div className="card-head">
                <div><h2>Patients</h2><p className="card-sub">{rows.length} of {data.patients.length} shown</p></div>
                <div className="row">
                  <button className="btn sm" onClick={exportCsv} disabled={!rows.length}><Download size={15} aria-hidden="true" />Export CSV</button>
                  <button className="btn sm" onClick={reset}>Score another file</button>
                </div>
              </div>
              <div className="toolbar">
                <div className="search">
                  <Search size={16} aria-hidden="true" />
                  <input className="input" type="search" placeholder="Search patient reference" aria-label="Search patient reference"
                    value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <div className="seg" role="group" aria-label="Filter by risk level">
                  {FILTERS.map((f) => (
                    <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
                  ))}
                </div>
              </div>
              {rows.length === 0 ? (
                <EmptyState icon={Search} title="No patients match" text="Try a different search or filter." />
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <SortHead k="rank">#</SortHead><SortHead k="patient">Patient</SortHead>
                        <SortHead k="risk">Risk</SortHead><SortHead k="tier">Level</SortHead>
                        <th>Top factors</th><th>Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.row_index} className={p.status === "OK" ? "" : "row-failed"}>
                          <td className="num">{p.rank}</td>
                          <td>{p.patient_ref}</td>
                          {p.status === "OK" ? (
                            <>
                              <td className="num">{pct(p.risk_probability)}</td>
                              <td><Badge tier={p.risk_tier} /></td>
                              <td className="wrap">{p.top_factors.join(", ")}</td>
                              <td>{p.needs_review ? <span className="badge medium">Needs review</span> : ""}</td>
                            </>
                          ) : (
                            <td colSpan={4} className="wrap">Could not score: {p.error}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
