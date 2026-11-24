import { useEffect, useState } from "react";
import Sidebar, { NAV } from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import Overview from "./pages/Overview.jsx";
import NewPrediction from "./pages/NewPrediction.jsx";
import BatchAnalysis from "./pages/BatchAnalysis.jsx";
import HistoryPage from "./pages/History.jsx";
import ModelInsights from "./pages/ModelInsights.jsx";
import SettingsPage from "./pages/Settings.jsx";
import { HistoryProvider, SettingsProvider, ToastProvider, useSettings } from "./lib/store.jsx";
import { ModelProvider, useModel } from "./lib/model.jsx";

const PAGES = {
  overview: Overview,
  new: NewPrediction,
  batch: BatchAnalysis,
  history: HistoryPage,
  insights: ModelInsights,
  settings: SettingsPage,
};

const pageFromHash = () => {
  const id = window.location.hash.replace(/^#\//, "");
  return PAGES[id] ? id : "overview";
};

function Shell() {
  const [page, setPage] = useState(pageFromHash);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("medipredict.collapsed") === "1"; } catch { return false; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [subCrumb, setSubCrumb] = useState(null);
  const { health, loading } = useModel();
  const { displayName } = useSettings();

  useEffect(() => {
    const onHash = () => { setPage(pageFromHash()); setSubCrumb(null); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (id) => { setPage(id); setSubCrumb(null); setMenuOpen(false); };
  const toggleCollapse = () => {
    setCollapsed((c) => {
      try { localStorage.setItem("medipredict.collapsed", c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  };

  const Page = PAGES[page];
  const label = NAV.find((n) => n.id === page).label;
  const crumbs = subCrumb ? ["MediPredict", label, subCrumb] : ["MediPredict", label];

  return (
    <div className={`shell${collapsed ? " collapsed" : ""}`}>
      <Sidebar page={page} onNavigate={navigate} open={menuOpen} collapsed={collapsed} />
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="main">
        <Topbar
          crumbs={crumbs} health={health} loading={loading} name={displayName}
          collapsed={collapsed} onToggleCollapse={toggleCollapse} onOpenMenu={() => setMenuOpen(true)}
        />
        <main className="content" id="main">
          <Page navigate={navigate} setSubCrumb={setSubCrumb} />
          <p className="footnote">
            MediPredict is an educational decision-support prototype, not a clinical diagnosis. The model is trained
            on a dataset with synthetic admission dates and a derived readmission label, so scores demonstrate the
            pipeline rather than clinical performance.
          </p>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <HistoryProvider>
          <ModelProvider>
            <Shell />
          </ModelProvider>
        </HistoryProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
