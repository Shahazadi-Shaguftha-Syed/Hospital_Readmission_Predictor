// Thin wrapper around fetch/XHR so every page handles API errors the same way.

// FastAPI sends validation errors as a list; turn them into one readable line.
function readableError(data, fallback) {
  if (!data || !data.detail) return fallback;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((e) => `${(e.loc || []).slice(1).join(".")}: ${e.msg}`)
      .join("; ");
  }
  return fallback;
}

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new Error("Cannot reach the API. Check that the backend is running on port 8000.");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) throw new Error(readableError(data, `Request failed (${res.status})`));
  return data;
}

export const scorePatient = (patient) =>
  request("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patient),
  });

export const scoreBatchJson = (patients) =>
  request("/predict/batch-json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patients),
  });

// XHR (not fetch) so the upload bar can show real progress.
export function scoreBatchCsv(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/predict/batch");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () =>
      reject(new Error("Cannot reach the API. Check that the backend is running on port 8000."));
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON body */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(readableError(data, `Upload failed (${xhr.status})`)));
    };
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export const getMetrics = () => request("/model/metrics");
export const getFairness = () => request("/model/fairness");
export const getModelInfo = () => request("/model/info");
export const getErrorCases = () => request("/model/error-cases");
export const getHealth = () => request("/health");
