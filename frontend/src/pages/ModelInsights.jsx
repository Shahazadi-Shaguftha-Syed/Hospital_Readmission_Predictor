import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { Banner, Skeleton, Term } from "../components/ui";
import { CalibrationChart, ConfusionMatrix } from "../components/charts";
import { PageHeader } from "../components/ui";
import { getErrorCases, getFairness, getMetrics } from "../api";
import { useModel } from "../lib/model.jsx";
import { pct } from "../lib/format";

const HINTS = {
  auc: "AUC-ROC: how well the model ranks patients who were readmitted above those who were not. 0.5 is a coin flip, 1.0 is perfect.",
  pr: "PR-AUC: ranking quality when readmissions are rare. Compare it with the readmission rate, not with 0.5.",
  brier: "Brier score: how close the predicted probabilities are to what happened. Lower is better.",
  recall: "Recall: of the patients who were readmitted, the share the model flagged.",
  precision: "Precision: of the patients the model flagged, the share who were readmitted.",
};

function KpiRow({ m }) {
  const items = [
    ["AUC-ROC", m.auc_roc.toFixed(3), HINTS.auc], ["PR-AUC", m.pr_auc.toFixed(3), HINTS.pr],
    ["Brier score", m.brier_score.toFixed(3), HINTS.brier], ["Recall", pct(m.recall), HINTS.recall],
    ["Precision", pct(m.precision), HINTS.precision],
  ];
  return (
    <div className="kpi-row">
      {items.map(([label, value, hint]) => (
        <div className="card kpi" key={label}>
          <span><Term hint={hint}>{label}</Term></span>
          <b className="num">{value}</b>
        </div>
      ))}
    </div>
  );
}

function RecallCell({ value }) {
  return (
    <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
      <span className="num" style={{ width: 48 }}>{pct(value)}</span>
      <div className="bar-track" style={{ width: 70, height: 8 }}><div className="bar-fill" style={{ width: `${Math.min(value / 0.5, 1) * 100}%`, background: "var(--primary)" }} /></div>
    </div>
  );
}

function SubgroupTable({ title, rows }) {
  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 8 }}>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Group</th><th>Patients</th><th>Readmit rate</th><th>AUC</th><th>Recall</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.subgroup}>
                <td>{r.subgroup}</td><td className="num">{r.count.toLocaleString()}</td>
                <td className="num">{pct(r.readmission_rate)}</td><td className="num">{r.auc_roc?.toFixed(3) ?? "–"}</td>
                <td><RecallCell value={r.recall} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErrorCases({ data }) {
  const [type, setType] = useState("All");
  const [openId, setOpenId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const all = data.cases.filter((c) => type === "All" || c.error_type === type);
  const rows = showAll ? all : all.slice(0, 8);
  return (
    <>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Filter error cases">
          {["All", "False Positive", "False Negative"].map((t) => (
            <button key={t} aria-pressed={type === t} onClick={() => { setType(t); setOpenId(null); }}>{t === "All" ? "All cases" : t + "s"}</button>
          ))}
        </div>
        <span className="small muted">{all.length} cases from the test set</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th><span className="sr-only">Expand</span></th><th>Case</th><th>Error</th><th>Predicted</th><th>Age</th><th>Severity</th><th>Department</th><th>Prior visits</th><th>Stay (days)</th></tr></thead>
          <tbody>
            {rows.map((c) => {
              const open = openId === c.case_id;
              return (
                <Fragment key={c.case_id}>
                  <tr>
                    <td>
                      <button className="icon-btn" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} factors for case ${c.case_id}`}
                        onClick={() => setOpenId(open ? null : c.case_id)}>
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </td>
                    <td className="num">{c.case_id}</td>
                    <td><span className={`badge ${c.error_type === "False Positive" ? "medium" : "high"}`}>{c.error_type}</span></td>
                    <td className="num">{pct(c.predicted_prob)}</td><td>{c.age}</td><td>{c.severity}</td><td>{c.department}</td>
                    <td className="num">{c.previous_encounters}</td><td className="num">{c.length_of_stay_days}</td>
                  </tr>
                  {open && (
                    <tr>
                      <td />
                      <td colSpan={8} className="wrap" style={{ background: "var(--bg)" }}>
                        <div className="small muted" style={{ marginBottom: 6 }}>Top SHAP factors for this case</div>
                        <div className="row">
                          {c.top_factors.map((f) => (
                            <span key={f.feature} className={`badge ${f.direction === "increases_risk" ? "high" : "low"}`}>
                              {f.feature.replace(/_/g, " ")} {f.direction === "increases_risk" ? "raises" : "lowers"} risk
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {all.length > 8 && (
        <button className="btn sm" style={{ marginTop: 12 }} onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show fewer" : `Show all ${all.length}`}
        </button>
      )}
    </>
  );
}

export default function ModelInsights() {
  const { info } = useModel();
  const [state, setState] = useState({ loading: true, error: "", metrics: null, fairness: null, errors: null });

  useEffect(() => {
    let alive = true;
    Promise.all([getMetrics(), getFairness(), getErrorCases()])
      .then(([metrics, fairness, errors]) => alive && setState({ loading: false, error: "", metrics, fairness, errors }))
      .catch((e) => alive && setState({ loading: false, error: e.message, metrics: null, fairness: null, errors: null }));
    return () => { alive = false; };
  }, []);

  const { loading, error, metrics, fairness, errors } = state;
  const deployed = info?.test_metrics?.model_name;
  const t = metrics?.thresholds;

  return (
    <>
      <PageHeader
        title="Model insights"
        subtitle={`How the deployed model performs on a held-out test set${info ? ` (${info.test_samples.toLocaleString()} patients, model ${info.model_version})` : ""}.`}
      />
      {error && <Banner kind="error" icon={TriangleAlert}>{error}</Banner>}
      {loading && (
        <div className="stack">
          <div className="kpi-row">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={72} />)}</div>
          <Skeleton height={200} /><Skeleton height={260} />
        </div>
      )}
      {metrics && (
        <div className="stack">
          <Banner kind="warn" icon={TriangleAlert}>
            The AUC is close to 0.5 because the readmission label comes from synthetic dates, so there is little real pattern to learn.
            Read this page as a demonstration of how the model is evaluated, not as clinical accuracy.
          </Banner>

          {info?.test_metrics && <KpiRow m={info.test_metrics} />}

          <section className="card card-pad">
            <div className="card-head">
              <div><h2>Model comparison</h2><p className="card-sub">All three models, same held-out test set, same decision threshold.</p></div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Model</th><th><Term hint={HINTS.auc}>AUC</Term></th><th><Term hint={HINTS.pr}>PR-AUC</Term></th>
                  <th><Term hint={HINTS.brier}>Brier</Term></th><th><Term hint={HINTS.recall}>Recall</Term></th>
                  <th><Term hint={HINTS.precision}>Precision</Term></th><th>Speed (ms per 1k)</th>
                </tr></thead>
                <tbody>
                  {metrics.comparison.map((m) => (
                    <tr key={m.model_name} className={m.model_name === deployed ? "best" : ""}>
                      <td>{m.model_name}{m.model_name === deployed ? " (deployed)" : ""}</td>
                      <td className="num">{m.auc_roc.toFixed(3)}</td><td className="num">{m.pr_auc.toFixed(3)}</td>
                      <td className="num">{m.brier_score.toFixed(3)}</td><td className="num">{pct(m.recall)}</td>
                      <td className="num">{pct(m.precision)}</td><td className="num">{m.latency_ms_per_1k}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              The three models have almost the same AUC. XGBoost was chosen for its much lower Brier score, meaning its probabilities are more
              trustworthy. Logistic Regression and Random Forest reach about 99% recall only because they flag nearly every patient.
            </p>
          </section>

          <div className="grid g2">
            <section className="card card-pad">
              <div className="card-head"><div><h2>Confusion matrix</h2><p className="card-sub">At decision threshold {pct(t.decision_threshold)}</p></div></div>
              <ConfusionMatrix cm={metrics.confusion_matrix} />
            </section>
            <section className="card card-pad">
              <div className="card-head"><div><h2>Calibration</h2><p className="card-sub">Closer to the dashed line means the probabilities can be trusted</p></div></div>
              <CalibrationChart predicted={metrics.calibration.mean_predicted_value} observed={metrics.calibration.fraction_of_positives} />
            </section>
          </div>

          <section className="card card-pad">
            <div className="card-head"><h2>Risk levels and review band</h2></div>
            <div className="grid g3">
              <div><span className="badge low">Low</span><p className="muted" style={{ marginTop: 6 }}>Below {pct(t.low_upper)}</p></div>
              <div><span className="badge medium">Medium</span><p className="muted" style={{ marginTop: 6 }}>{pct(t.low_upper)} to {pct(t.high_lower)}</p></div>
              <div><span className="badge high">High</span><p className="muted" style={{ marginTop: 6 }}>{pct(t.high_lower)} and above</p></div>
            </div>
            <p className="small muted" style={{ marginTop: 12 }}>
              Scores between {pct(t.uncertainty_band[0])} and {pct(t.uncertainty_band[1])} are marked "needs review". The decision
              threshold of {pct(t.decision_threshold)} was chosen by treating a missed readmission as 4 times as costly as an unnecessary follow-up.
            </p>
          </section>

          <section className="card card-pad">
            <div className="card-head"><div><h2>Fairness by subgroup</h2><p className="card-sub">Does the model perform similarly across patient groups?</p></div></div>
            <div className="grid g2">
              {fairness.age && <SubgroupTable title="By age group" rows={fairness.age} />}
              {fairness.severity && <SubgroupTable title="By severity of illness" rows={fairness.severity} />}
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>The dataset has no gender column, so gender cannot be audited.</p>
          </section>

          {errors && (
            <section className="card card-pad">
              <div className="card-head"><div><h2>Error cases</h2><p className="card-sub">Sample of patients the model got wrong, with the factors behind each score</p></div></div>
              <ErrorCases data={errors} />
            </section>
          )}
        </div>
      )}
    </>
  );
}
