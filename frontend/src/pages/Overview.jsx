import { useState } from "react";
import { Activity, ArrowRight, BarChart3, FileSpreadsheet, FlaskConical, Gauge, Loader2, ShieldAlert, UserPlus, Users } from "lucide-react";
import { Badge, EmptyState, PageHeader, Skeleton, SourceBadge, StatCard } from "../components/ui";
import { HBars } from "../components/charts";
import { scoreBatchJson } from "../api";
import { newRecordId, useHistoryStore, useSettings, useToast } from "../lib/store.jsx";
import { useModel } from "../lib/model.jsx";
import { greeting, pct, timeAgo } from "../lib/format";

// Made-up example inputs. They are scored by the real model, and saved with a "Sample inputs" label.
const SAMPLE_PATIENTS = [
  { ref: "Sample A (frequent returner)", body: { age: "71-80", severity_of_illness: "Extreme", type_of_admission: "Emergency", length_of_stay: 9, num_prior_admissions: 5, previous_emergency_count: 4, previous_readmission_count: 3, previous_hospital_days: 38, previous_avg_los: 7.6, previous_max_los: 14, days_since_previous_discharge: 12, previous_30d_encounters: 1, previous_90d_encounters: 2, previous_365d_encounters: 5 } },
  { ref: "Sample B (first visit)", body: { age: "31-40", severity_of_illness: "Minor", type_of_admission: "Urgent", length_of_stay: 3, visitors_with_patient: 4 } },
  { ref: "Sample C (one prior stay)", body: { age: "51-60", severity_of_illness: "Moderate", type_of_admission: "Trauma", department: "surgery", length_of_stay: 6, num_prior_admissions: 1, previous_emergency_count: 1, previous_hospital_days: 5, previous_avg_los: 5, previous_max_los: 5, days_since_previous_discharge: 40, previous_90d_encounters: 0, previous_365d_encounters: 1 } },
];

export default function Overview({ navigate }) {
  const { records, add } = useHistoryStore();
  const { displayName } = useSettings();
  const { info, loading } = useModel();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const total = records.length;
  const high = records.filter((r) => r.tier === "High").length;
  const avg = total ? records.reduce((s, r) => s + r.probability, 0) / total : null;
  const recent = records.filter((r) => Date.now() - new Date(r.createdAt).getTime() < 86400000).length;
  const tierRows = ["High", "Medium", "Low"].map((t) => ({
    label: t, value: records.filter((r) => r.tier === t).length,
    color: t === "High" ? "var(--high)" : t === "Medium" ? "var(--warning)" : "var(--low)",
  }));

  const scoreSamples = async () => {
    setBusy(true);
    try {
      const res = await scoreBatchJson(SAMPLE_PATIENTS.map((s) => s.body));
      const now = new Date().toISOString();
      add(res.patients.filter((p) => p.status === "OK").map((p) => ({
        id: newRecordId(), createdAt: now, patientRef: SAMPLE_PATIENTS[p.row_index].ref, source: "sample",
        probability: p.risk_probability, tier: p.risk_tier, needsReview: p.needs_review,
        summary: p.plain_language_summary, topFactors: p.top_factors,
      })));
      toast.success("Scored 3 sample inputs with the real model.");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const tm = info?.test_metrics;
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${displayName.trim() || "care team"}`}
        subtitle="Readmission risk at a glance. The numbers below come from predictions run in this browser."
      />
      <div className="stack">
        <div className="grid g4">
          <StatCard icon={Users} label="Total predictions" value={total} foot="Saved in this browser" />
          <StatCard icon={ShieldAlert} label="High-risk patients" value={high} foot={total ? `${pct(high / total, 0)} of predictions` : "None yet"} />
          <StatCard icon={Gauge} label="Average predicted risk" value={avg === null ? "–" : pct(avg)} foot="Mean 30-day probability" />
          <StatCard icon={Activity} label="Last 24 hours" value={recent} foot="Recent assessments" />
        </div>

        <div className="grid g-main-side">
          <section className="card card-pad">
            <div className="card-head">
              <div><h2>Recent activity</h2><p className="card-sub">Latest predictions saved in this browser</p></div>
              {total > 0 && <a className="btn sm" href="#/history" onClick={() => navigate("history")}>View all</a>}
            </div>
            {total === 0 ? (
              <EmptyState
                icon={UserPlus} title="No predictions yet"
                text="Score a patient, upload a ward CSV, or try three example inputs to see how the dashboard fills in."
                action={
                  <div className="row" style={{ justifyContent: "center" }}>
                    <a className="btn primary" href="#/new" onClick={() => navigate("new")}>New prediction</a>
                    <button className="btn" onClick={scoreSamples} disabled={busy}>
                      {busy ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <FlaskConical size={16} aria-hidden="true" />}
                      Score 3 sample inputs
                    </button>
                  </div>
                }
              />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Patient</th><th>Risk</th><th>Level</th><th>Source</th><th>When</th></tr></thead>
                  <tbody>
                    {records.slice(0, 6).map((r) => (
                      <tr key={r.id}>
                        <td>{r.patientRef}</td><td className="num">{pct(r.probability)}</td>
                        <td><Badge tier={r.tier} /></td><td><SourceBadge source={r.source} /></td>
                        <td className="muted">{timeAgo(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="stack">
            <section className="card card-pad">
              <div className="card-head"><h2>Risk distribution</h2></div>
              {total === 0 ? <p className="muted">Appears after your first prediction.</p> : <HBars rows={tierRows} max={total} />}
            </section>
            <section className="card card-pad">
              <div className="card-head"><h2>Quick actions</h2></div>
              <div className="stack" style={{ gap: 10 }}>
                <a className="btn" href="#/new" onClick={() => navigate("new")} style={{ justifyContent: "space-between" }}>
                  <span className="row" style={{ gap: 8 }}><UserPlus size={17} aria-hidden="true" />Score a single patient</span><ArrowRight size={16} aria-hidden="true" />
                </a>
                <a className="btn" href="#/batch" onClick={() => navigate("batch")} style={{ justifyContent: "space-between" }}>
                  <span className="row" style={{ gap: 8 }}><FileSpreadsheet size={17} aria-hidden="true" />Upload a ward CSV</span><ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
            </section>
          </div>
        </div>

        <section className="card card-pad">
          <div className="card-head">
            <div><h2>Model snapshot</h2><p className="card-sub">Read from the running backend</p></div>
            <a className="btn sm" href="#/insights" onClick={() => navigate("insights")}><BarChart3 size={15} aria-hidden="true" />Model insights</a>
          </div>
          {loading ? (
            <div className="grid g4"><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /><Skeleton height={44} /></div>
          ) : !info ? (
            <p className="muted">Model details are unavailable. Check that the backend is running.</p>
          ) : (
            <div className="grid g4">
              <div><div className="small muted">Algorithm</div><b>{info.algorithm}</b></div>
              <div><div className="small muted">Model version</div><b>{info.model_version}</b></div>
              <div><div className="small muted">Test AUC</div><b className="num">{tm?.auc_roc?.toFixed(3)}</b></div>
              <div><div className="small muted">Decision threshold</div><b className="num">{pct(info.thresholds.decision_threshold)}</b></div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
