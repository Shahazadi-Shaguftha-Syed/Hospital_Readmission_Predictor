import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

/* ---------- small localStorage helpers (never throw) ---------- */
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the app still works without it */
  }
}

/* ---------- toasts ---------- */
const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const TOAST_ICON = { success: CheckCircle2, error: TriangleAlert, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (message, kind = "info") => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m) => push(m, "success"),
      error: (m) => push(m, "error"),
      info: (m) => push(m, "info"),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.kind];
          return (
            <div key={t.id} className={`toast ${t.kind}`}>
              <Icon size={18} aria-hidden="true" />
              <span>{t.message}</span>
              <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- settings (display name) ---------- */
const SettingsContext = createContext(null);
export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }) {
  const [displayName, setDisplayNameState] = useState(() => readJson("medipredict.name", ""));
  const setDisplayName = (name) => {
    setDisplayNameState(name);
    writeJson("medipredict.name", name);
  };
  return (
    <SettingsContext.Provider value={{ displayName, setDisplayName }}>{children}</SettingsContext.Provider>
  );
}

/* ---------- prediction history: kept in this browser only ----------
   The backend does not store predictions, so this history lives in
   localStorage. It is per browser and is lost if site data is cleared. */
const HistoryContext = createContext(null);
export const useHistoryStore = () => useContext(HistoryContext);

const HISTORY_KEY = "medipredict.history.v1";
const HISTORY_LIMIT = 300;

export function HistoryProvider({ children }) {
  const [records, setRecords] = useState(() => readJson(HISTORY_KEY, []));

  useEffect(() => {
    writeJson(HISTORY_KEY, records);
  }, [records]);

  const add = useCallback((newRecords) => {
    setRecords((prev) => [...newRecords, ...prev].slice(0, HISTORY_LIMIT));
  }, []);
  const clear = useCallback(() => setRecords([]), []);

  return <HistoryContext.Provider value={{ records, add, clear }}>{children}</HistoryContext.Provider>;
}

export const newRecordId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
