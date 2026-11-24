import { useEffect, useMemo, useState } from "react";
import { Eye, History as HistoryIcon, Info, Search, Trash2, X } from "lucide-react";
import { Badge, Banner, EmptyState, PageHeader, SourceBadge } from "../components/ui";
import ResultView from "../components/ResultView.jsx";
import { useHistoryStore, useToast } from "../lib/store.jsx";
import { downloadReport } from "../lib/report";
import { formatDateTime, pct } from "../lib/format";

const TIERS = ["All", "High", "Medium", "Low"];

function Details({ record, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Details for ${record.patientRef}`}>
        <div className="drawer-head">
          <div>
            <h2 style={{ fontSize: 18 }}>{record.patientRef}</h2>
            <p className="small muted">{formatDateTime(record.createdAt)} · <SourceBadge source={record.source} /></p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close details" autoFocus><X size={20} /></button>
        </div>
        {record.result ? (
          <>
            <ResultView result={record.result} onDownload={() => downloadReport({ record, result: record.result, inputs: record.inputs })} />
            <section className="card card-pad">
              <div className="card-head"><h2>Inputs used</h2></div>
              <div className="table-wrap">
                <table><tbody>
                  {Object.entries(record.inputs || {}).map(([k, v]) => (
                    <tr key={k}><td className="muted">{k}</td><td>{String(v)}</td></tr>
                  ))}
                </tbody></table>
              </div>
            </section>
          </>
        ) : (
          <section className="card card-pad stack">
            <div className="row"><b className="num" style={{ fontSize: 26 }}>{pct(record.probability)}</b><Badge tier={record.tier} /></div>
            {record.needsReview && <span className="badge medium" style={{ width: "fit-content" }}>Needs review</span>}
            <p>{record.summary}</p>
            <div><div className="small muted">Top factors</div><p>{(record.topFactors || []).join(", ")}</p></div>
            <Banner kind="info" icon={Info}>
              Only single predictions keep the full SHAP chart. Batch and sample rows keep the score, tier and top factors.
            </Banner>
          </section>
        )}
      </aside>
    </>
  );
}

export default function HistoryPage({ navigate }) {
  const { records, clear } = useHistoryStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("All");
  const [source, setSource] = useState("all");
  const [openId, setOpenId] = useState(null);

  const rows = useMemo(() => {
    let r = records;
    if (query.trim()) r = r.filter((x) => x.patientRef.toLowerCase().includes(query.trim().toLowerCase()));
    if (tier !== "All") r = r.filter((x) => x.tier === tier);
    if (source !== "all") r = r.filter((x) => x.source === source);
    return r;
  }, [records, query, tier, source]);
  const open = records.find((r) => r.id === openId);

  const onClear = () => {
    if (window.confirm(`Delete all ${records.length} saved predictions from this browser? This cannot be undone.`)) {
      clear();
      toast.success("History cleared.");
    }
  };

  return (
    <>
      <PageHeader
        title="Prediction history"
        subtitle="Predictions you have run in this browser."
        actions={records.length > 0 && (
          <button className="btn danger" onClick={onClear}><Trash2 size={16} aria-hidden="true" />Clear history</button>
        )}
      />
      <div className="stack">
        <Banner kind="info" icon={Info}>
          History is saved only in this browser. The backend does not store predictions, so clearing site data removes it, and other devices will not see it.
        </Banner>
        {records.length === 0 ? (
          <section className="card card-pad">
            <EmptyState
              icon={HistoryIcon} title="No predictions yet"
              text="Score a patient or upload a ward CSV and the results will show up here."
              action={<a className="btn primary" href="#/new" onClick={() => navigate("new")}>New prediction</a>}
            />
          </section>
        ) : (
          <section className="card card-pad">
            <div className="toolbar">
              <div className="search">
                <Search size={16} aria-hidden="true" />
                <input className="input" type="search" placeholder="Search patient reference" aria-label="Search patient reference"
                  value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="seg" role="group" aria-label="Filter by risk level">
                {TIERS.map((t) => <button key={t} aria-pressed={tier === t} onClick={() => setTier(t)}>{t}</button>)}
              </div>
              <div className="seg" role="group" aria-label="Filter by source">
                {[["all", "All sources"], ["single", "Single"], ["batch", "Batch"], ["sample", "Sample"]].map(([v, l]) => (
                  <button key={v} aria-pressed={source === v} onClick={() => setSource(v)}>{l}</button>
                ))}
              </div>
            </div>
            {rows.length === 0 ? (
              <EmptyState icon={Search} title="No matches" text="Try a different search or filter." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Patient</th><th>Risk</th><th>Level</th><th>Source</th><th>Date</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.patientRef}</td>
                        <td className="num">{pct(r.probability)}</td>
                        <td><Badge tier={r.tier} /></td>
                        <td><SourceBadge source={r.source} /></td>
                        <td className="muted">{formatDateTime(r.createdAt)}</td>
                        <td><button className="btn sm" onClick={() => setOpenId(r.id)}><Eye size={15} aria-hidden="true" />View details</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="small muted" style={{ marginTop: 10 }}>
              Showing {rows.length} of {records.length} saved predictions (the newest 300 are kept).
            </p>
          </section>
        )}
      </div>
      {open && <Details record={open} onClose={() => setOpenId(null)} />}
    </>
  );
}
