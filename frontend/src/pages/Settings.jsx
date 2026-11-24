import { useState } from "react";
import { Database, Info, Server, Trash2, User } from "lucide-react";
import { Banner, PageHeader } from "../components/ui";
import { useHistoryStore, useSettings, useToast } from "../lib/store.jsx";
import { useModel } from "../lib/model.jsx";

export default function SettingsPage() {
  const { displayName, setDisplayName } = useSettings();
  const { records, clear } = useHistoryStore();
  const { health, info, loading } = useModel();
  const toast = useToast();
  const [name, setName] = useState(displayName);

  const save = (e) => {
    e.preventDefault();
    setDisplayName(name.trim());
    toast.success("Display name saved.");
  };
  const onClear = () => {
    if (window.confirm(`Delete all ${records.length} saved predictions from this browser?`)) {
      clear();
      toast.success("History cleared.");
    }
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Personalise the dashboard and check what the app is connected to." />
      <div className="stack" style={{ maxWidth: 760 }}>
        <form className="card card-pad" onSubmit={save}>
          <div className="section-head">
            <div className="section-icon"><User size={19} aria-hidden="true" /></div>
            <div><h2>Profile</h2><p className="card-sub">Used for the greeting on the overview page. Saved in this browser only.</p></div>
          </div>
          <div className="field" style={{ maxWidth: 360 }}>
            <label htmlFor="display-name">Display name <span className="opt">(optional)</span></label>
            <input id="display-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="For example Shahazadi" />
          </div>
          <button className="btn primary" type="submit" style={{ marginTop: 16 }}>Save</button>
        </form>

        <section className="card card-pad">
          <div className="section-head">
            <div className="section-icon"><Server size={19} aria-hidden="true" /></div>
            <div><h2>Connection</h2><p className="card-sub">Status of the FastAPI backend and the loaded model.</p></div>
          </div>
          {loading ? <p className="muted">Checking…</p> : (
            <div className="table-wrap"><table><tbody>
              <tr><td className="muted">API status</td><td>{health?.status === "ok" ? "Online" : "Offline"}</td></tr>
              <tr><td className="muted">Model loaded</td><td>{health?.model_loaded ? "Yes" : "No"}</td></tr>
              <tr><td className="muted">Algorithm</td><td>{info?.algorithm ?? "–"}</td></tr>
              <tr><td className="muted">Model version</td><td>{info?.model_version ?? "–"}</td></tr>
              <tr><td className="muted">Trained</td><td>{info?.training_timestamp ?? "–"}</td></tr>
              <tr><td className="muted">Training / validation / test rows</td><td className="num">{info ? `${info.train_samples.toLocaleString()} / ${info.val_samples.toLocaleString()} / ${info.test_samples.toLocaleString()}` : "–"}</td></tr>
            </tbody></table></div>
          )}
        </section>

        <section className="card card-pad">
          <div className="section-head">
            <div className="section-icon"><Database size={19} aria-hidden="true" /></div>
            <div><h2>Your data</h2><p className="card-sub">Prediction history is stored in this browser only, never on the server.</p></div>
          </div>
          <p style={{ marginBottom: 14 }}>{records.length} saved prediction{records.length === 1 ? "" : "s"}.</p>
          <button className="btn danger" onClick={onClear} disabled={!records.length}><Trash2 size={16} aria-hidden="true" />Clear history</button>
        </section>

        <Banner kind="info" icon={Info}>
          <strong>About this data.</strong> The model was trained on the Analytics Vidhya Healthcare Analytics II dataset with synthetic admission
          dates and a derived 30-day readmission label. Scores show how the pipeline works, not clinical performance. Do not enter real patient names.
        </Banner>
      </div>
    </>
  );
}
