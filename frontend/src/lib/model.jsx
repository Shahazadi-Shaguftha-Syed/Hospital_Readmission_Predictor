import { createContext, useContext, useEffect, useState } from "react";
import { getHealth, getModelInfo } from "../api";

// Fetched once for the whole app: API status plus the real model metadata and tier cutoffs.
const ModelContext = createContext({ health: null, info: null, loading: true });
export const useModel = () => useContext(ModelContext);

export function ModelProvider({ children }) {
  const [state, setState] = useState({ health: null, info: null, loading: true });

  useEffect(() => {
    let alive = true;
    Promise.allSettled([getHealth(), getModelInfo()]).then(([h, i]) => {
      if (!alive) return;
      setState({
        health: h.status === "fulfilled" ? h.value : { status: "down", model_loaded: false },
        info: i.status === "fulfilled" ? i.value : null,
        loading: false,
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  return <ModelContext.Provider value={state}>{children}</ModelContext.Provider>;
}
