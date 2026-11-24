import {
  Activity, BarChart3, FileSpreadsheet, HeartPulse, History, LayoutDashboard, Settings, UserPlus,
} from "lucide-react";

export const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "new", label: "New Prediction", icon: UserPlus },
  { id: "batch", label: "Batch Analysis", icon: FileSpreadsheet },
  { id: "history", label: "Prediction History", icon: History },
  { id: "insights", label: "Model Insights", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ page, onNavigate, open, collapsed }) {
  return (
    <aside className={`sidebar${open ? " open" : ""}`} aria-label="Main navigation">
      <div className="sb-brand">
        <div className="logo-tile"><HeartPulse size={20} aria-hidden="true" /></div>
        <div className="brand-text">
          MediPredict
          <small>Readmission risk</small>
        </div>
      </div>
      <nav className="sb-nav">
        {NAV.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#/${id}`}
            className={`sb-link${page === id ? " active" : ""}`}
            aria-current={page === id ? "page" : undefined}
            title={collapsed ? label : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="sb-spacer" />
      <div className="sb-note">
        <Activity size={14} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 6 }} />
        Educational prototype trained on synthetic dates. Not for clinical use.
      </div>
    </aside>
  );
}
