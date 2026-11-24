import { pct } from "../lib/format";

const TIER_COLOR = { High: "var(--high)", Medium: "var(--warning)", Low: "var(--low)" };
export const tierColor = (t) => TIER_COLOR[t] || "var(--text-2)";

/* Circular risk indicator. The ring covers 0-50% so differences between typical scores stay visible. */
export function RiskGauge({ probability, tier, threshold, max = 0.5 }) {
  const size = 220;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.min(probability / max, 1);
  const angle = (v) => (Math.min(v / max, 1) * 360 - 90) * (Math.PI / 180);
  const cx = size / 2;
  const tx = cx + r * Math.cos(angle(threshold));
  const ty = cx + r * Math.sin(angle(threshold));
  const tx2 = cx + (r - stroke) * Math.cos(angle(threshold));
  const ty2 = cx + (r - stroke) * Math.sin(angle(threshold));
  const tx3 = cx + (r + stroke) * Math.cos(angle(threshold));
  const ty3 = cx + (r + stroke) * Math.sin(angle(threshold));

  return (
    <div className="gauge-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
        aria-label={`Predicted readmission risk ${pct(probability)}, ${tier} risk`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--bg)" strokeWidth={stroke} />
        <circle
          cx={cx} cy={cx} r={r} fill="none" stroke={tierColor(tier)} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`} transform={`rotate(-90 ${cx} ${cx})`}
        />
        <line x1={tx2} y1={ty2} x2={tx3} y2={ty3} stroke="var(--text)" strokeWidth="2" />
        <title>{`Decision threshold ${pct(threshold)}`}</title>
      </svg>
      <div className="gauge-center">
        <div className="gauge-value num">{pct(probability)}</div>
        <div className="gauge-label">30-day readmission risk</div>
      </div>
    </div>
  );
}

/* Horizontal bars with a label and a value. */
export function HBars({ rows, max, color = "var(--primary)", format = (v) => v }) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <div>
      {rows.map((r) => (
        <div className="bar-row" key={r.label}>
          <span>{r.label}</span>
          <div className="bar-track" role="img" aria-label={`${r.label}: ${format(r.value)}`}>
            <div className="bar-fill" style={{ width: `${Math.min(r.value / top, 1) * 100}%`, background: r.color || color }} />
          </div>
          <span className="num" style={{ textAlign: "right" }}>{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* Calibration (reliability) chart: predicted vs observed, diagonal = perfect. */
export function CalibrationChart({ predicted, observed }) {
  const W = 420, H = 300, P = { l: 46, r: 14, t: 14, b: 40 };
  const maxV = Math.max(0.6, ...predicted, ...observed);
  const x = (v) => P.l + (v / maxV) * (W - P.l - P.r);
  const y = (v) => H - P.b - (v / maxV) * (H - P.t - P.b);
  const ticks = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].filter((t) => t <= maxV + 0.001);
  const path = predicted.map((p, i) => `${i ? "L" : "M"}${x(p)},${y(observed[i])}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label="Calibration chart: predicted probability on the x axis, observed readmission rate on the y axis">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--border)" />
          <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-2)">{Math.round(t * 100)}%</text>
          <text x={x(t)} y={H - P.b + 16} textAnchor="middle" fontSize="11" fill="var(--text-2)">{Math.round(t * 100)}%</text>
        </g>
      ))}
      <line x1={x(0)} y1={y(0)} x2={x(maxV)} y2={y(maxV)} stroke="var(--text-2)" strokeDasharray="5 5" />
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
      {predicted.map((p, i) => (
        <circle key={i} cx={x(p)} cy={y(observed[i])} r="4.5" fill="var(--primary)" stroke="#fff" strokeWidth="1.5">
          <title>{`Predicted ${pct(p)}, observed ${pct(observed[i])}`}</title>
        </circle>
      ))}
      <text x={(W + P.l) / 2} y={H - 4} textAnchor="middle" fontSize="12" fill="var(--text-2)">Predicted probability</text>
      <text x="12" y={H / 2} textAnchor="middle" fontSize="12" fill="var(--text-2)" transform={`rotate(-90 12 ${H / 2})`}>Observed rate</text>
    </svg>
  );
}

/* Diverging SHAP bars: right = raises risk, left = lowers it. */
export function ShapBars({ factors }) {
  const maxAbs = Math.max(...factors.map((f) => Math.abs(f.shap_value)), 0.0001);
  return (
    <div>
      <div className="shap-list">
        {factors.map((f) => {
          const up = f.direction === "increases_risk";
          const width = `${(Math.abs(f.shap_value) / maxAbs) * 50}%`;
          return (
            <div className="shap-row" key={f.feature}>
              <span className="shap-name">{f.display_name}</span>
              <div className="shap-track" role="img"
                aria-label={`${f.display_name} ${up ? "raises" : "lowers"} risk`}>
                <div className={`shap-bar ${up ? "up" : "down"}`} style={{ width }} />
              </div>
              <span className={`shap-val ${up ? "up" : "down"}`}>
                {up ? "+" : "−"}{Math.abs(f.shap_value).toFixed(3)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="axis-note"><span>Lowers risk</span><span>Raises risk</span></div>
    </div>
  );
}

export function ConfusionMatrix({ cm }) {
  const total = cm.true_negatives + cm.false_positives + cm.false_negatives + cm.true_positives;
  const cell = (label, value, cls) => (
    <div className={`cm-cell ${cls}`}>
      <b className="num">{value.toLocaleString()}</b>
      <span>{label}</span>
      <small>{pct(value / total)} of patients</small>
    </div>
  );
  return (
    <div className="cm">
      {cell("Correctly cleared", cm.true_negatives, "good")}
      {cell("Flagged, not readmitted", cm.false_positives, "meh")}
      {cell("Missed readmission", cm.false_negatives, "bad")}
      {cell("Correctly flagged", cm.true_positives, "good")}
    </div>
  );
}
