import { ChevronRight } from "lucide-react";

export function Badge({ tier }) {
  const key = (tier || "").toLowerCase();
  const cls = ["high", "medium", "low"].includes(key) ? key : "neutral";
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" aria-hidden="true" />
      {tier} risk
    </span>
  );
}

export function SourceBadge({ source }) {
  if (source === "sample") return <span className="badge sample">Sample inputs</span>;
  if (source === "batch") return <span className="badge neutral">Batch</span>;
  return <span className="badge neutral">Single</span>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, foot }) {
  return (
    <div className="card stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon"><Icon size={17} aria-hidden="true" /></span>
      </div>
      <div className="stat-value num">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon size={22} aria-hidden="true" /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Banner({ kind = "info", icon: Icon, children }) {
  return (
    <div className={`banner ${kind}`} role={kind === "error" ? "alert" : undefined}>
      {Icon && <Icon size={17} aria-hidden="true" />}
      <div>{children}</div>
    </div>
  );
}

export function Skeleton({ height = 16, width = "100%", style }) {
  return <div className="skeleton" style={{ height, width, ...style }} aria-hidden="true" />;
}

export function Breadcrumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={item} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          {i > 0 && <ChevronRight size={14} aria-hidden="true" />}
          {i === items.length - 1 ? <strong aria-current="page">{item}</strong> : <span>{item}</span>}
        </span>
      ))}
    </nav>
  );
}

// Dotted-underline hint for metric names; the title attribute is a keyboard-free fallback.
export function Term({ children, hint }) {
  return (
    <span className="term" title={hint}>
      {children}
    </span>
  );
}
