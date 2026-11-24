import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Breadcrumbs } from "./ui";
import { initials } from "../lib/format";

export default function Topbar({ crumbs, health, loading, name, collapsed, onToggleCollapse, onOpenMenu }) {
  const up = health?.status === "ok" && health?.model_loaded;
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onOpenMenu} aria-label="Open navigation menu">
        <Menu size={20} />
      </button>
      <button
        className="icon-btn collapse-btn"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>
      <Breadcrumbs items={crumbs} />
      <div className="top-spacer" />
      <span className="status-chip" role="status">
        <span className={`dot ${loading ? "" : up ? "ok" : "down"}`} aria-hidden="true" />
        <span className="status-text">{loading ? "Checking API…" : up ? "Model online" : "API offline"}</span>
      </span>
      <div className="avatar" aria-label={name || "Care coordinator"} title={name || "Care coordinator"}>
        {initials(name)}
      </div>
    </header>
  );
}
