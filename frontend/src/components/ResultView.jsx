import { ClipboardCheck, Download, RotateCcw, TriangleAlert } from "lucide-react";
import { Badge, Banner } from "./ui";
import { RiskGauge, ShapBars } from "./charts";
import { useModel } from "../lib/model.jsx";
import { pct } from "../lib/format";

// Shows one real model response. Used on the results page and inside the history drawer.
export default function ResultView({ result, onDownload, onAnother }) {
  const { info } = useModel();
  const t = info?.thresholds;

  return (
    <div className="stack">
      <div className="result-grid">
        <section className="card card-pad gauge-card" aria-labelledby="risk-h">
          <h2 id="risk-h" className="card-title" style={{ textAlign: "left" }}>Predicted risk</h2>
          <RiskGauge probability={result.risk_probability} tier={result.risk_tier} threshold={result.decision_threshold} />
          <Badge tier={result.risk_tier} />
          <p className="small muted" style={{ marginTop: 10 }}>
            Ring covers 0–50%. The tick marks the decision threshold ({pct(result.decision_threshold)}).
          </p>
          {t && (
            <div className="tier-legend">
              <span><i style={{ background: "var(--low)" }} />Low below {pct(t.low_upper)}</span>
              <span><i style={{ background: "var(--warning)" }} />Medium to {pct(t.high_lower)}</span>
              <span><i style={{ background: "var(--high)" }} />High above</span>
            </div>
          )}
        </section>

        <div className="stack">
          {result.needs_review && (
            <Banner kind="warn" icon={TriangleAlert}>
              <strong>Needs review.</strong> {result.uncertainty_reason}
            </Banner>
          )}
          <section className="card card-pad">
            <div className="card-head"><h2>In plain language</h2></div>
            <p>{result.plain_language_summary}</p>
          </section>
          <section className="card card-pad">
            <div className="card-head">
              <div>
                <h2>Top contributing factors</h2>
                <p className="card-sub">SHAP values from the model for this patient</p>
              </div>
            </div>
            <ShapBars factors={result.factor_details} />
          </section>
        </div>
      </div>

      {(onDownload || onAnother) && (
        <div className="result-actions">
          {onDownload && (
            <button className="btn primary" onClick={onDownload}><Download size={17} aria-hidden="true" />Download report</button>
          )}
          {onAnother && (
            <button className="btn" onClick={onAnother}><RotateCcw size={17} aria-hidden="true" />Predict another patient</button>
          )}
        </div>
      )}
      <p className="small muted" style={{ display: "flex", gap: 8 }}>
        <ClipboardCheck size={15} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />
        Educational decision-support prototype, not a clinical diagnosis. Model version {result.model_version}.
      </p>
    </div>
  );
}
