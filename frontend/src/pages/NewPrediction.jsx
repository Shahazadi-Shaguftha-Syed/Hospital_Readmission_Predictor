import { useMemo, useRef, useState } from "react";
import { Activity, CalendarClock, Hospital, Loader2, Sparkles, Upload, UserRound } from "lucide-react";
import { PageHeader, Banner } from "../components/ui";
import ResultView from "../components/ResultView.jsx";
import { scorePatient } from "../api";
import { newRecordId, useHistoryStore, useToast } from "../lib/store.jsx";
import { downloadReport } from "../lib/report";
import { pct } from "../lib/format";

const AGES = ["0-10", "11-20", "21-30", "31-40", "41-50", "51-60", "61-70", "71-80", "81-90", "91-100"];

// One spec per input. Names are exactly the API field names; nothing is renamed or added.
const int = { type: "number", step: 1, integer: true, min: 0, max: 100 };
const SECTIONS = [
  {
    id: "patient", title: "Patient information", icon: UserRound,
    text: "Who you are scoring. The reference is only used on this screen and in your history, it is not sent to the model.",
    fields: [
      { name: "patient_ref", label: "Patient reference", optional: true, type: "text", clientOnly: true, help: "For example a ward bed or case number. Avoid real names." },
      { name: "age", label: "Age group", type: "select", options: AGES },
    ],
  },
  {
    id: "admission", title: "Hospital admission details", icon: Hospital,
    text: "Details of the current stay and the hospital it is in.",
    fields: [
      { name: "severity_of_illness", label: "Severity of illness", type: "select", options: ["Minor", "Moderate", "Extreme"] },
      { name: "type_of_admission", label: "Type of admission", type: "select", options: ["Emergency", "Trauma", "Urgent"] },
      { name: "department", label: "Department", type: "select", options: ["gynecology", "anesthesia", "radiotherapy", "surgery", "TB & Chest disease"] },
      { name: "length_of_stay", label: "Length of stay (days)", type: "number", step: "any", min: 0, max: 365, help: "Days in hospital for the current admission." },
      { name: "bed_grade", label: "Bed grade", type: "number", step: "any", min: 1, max: 4, help: "From 1 to 4." },
      { name: "ward_type", label: "Ward type", type: "select", options: ["P", "Q", "R", "S", "T", "U"] },
      { name: "ward_facility_code", label: "Ward facility", type: "select", options: ["A", "B", "C", "D", "E", "F"] },
      { name: "hospital_type_code", label: "Hospital type", type: "select", options: ["a", "b", "c", "d", "e", "f", "g"] },
      { name: "hospital_region_code", label: "Hospital region", type: "select", options: ["X", "Y", "Z"] },
      { name: "available_extra_rooms", label: "Available extra rooms", ...int },
      { name: "visitors_with_patient", label: "Visitors with patient", ...int },
      { name: "admission_deposit", label: "Admission deposit ($)", type: "number", step: "any", min: 0, max: 1000000 },
    ],
  },
  {
    id: "history", title: "Medical history", icon: CalendarClock,
    text: "How often this patient has been in hospital before. Counts inside shorter windows must not exceed longer ones.",
    fields: [
      { name: "num_prior_admissions", label: "Prior admissions", ...int, help: "All previous hospital encounters." },
      { name: "previous_emergency_count", label: "Prior emergency visits", ...int },
      { name: "previous_urgent_count", label: "Prior urgent visits", ...int },
      { name: "previous_readmission_count", label: "Prior 30-day readmissions", ...int },
      { name: "previous_30d_encounters", label: "Admissions in last 30 days", ...int },
      { name: "previous_90d_encounters", label: "Admissions in last 90 days", ...int },
      { name: "previous_365d_encounters", label: "Admissions in last 365 days", ...int },
      { name: "days_since_previous_discharge", label: "Days since last discharge", optional: true, type: "number", step: "any", min: 0, max: 5000, help: "Leave blank for a first visit." },
    ],
  },
  {
    id: "stays", title: "Previous stay lengths", icon: Activity,
    text: "Length of earlier stays. The model has no medication or lab inputs, so there is no section for them.",
    fields: [
      { name: "previous_hospital_days", label: "Total prior hospital days", type: "number", step: "any", min: 0, max: 5000 },
      { name: "previous_avg_los", label: "Prior average stay (days)", type: "number", step: "any", min: 0, max: 365 },
      { name: "previous_max_los", label: "Prior longest stay (days)", type: "number", step: "any", min: 0, max: 365 },
    ],
  },
];

const FIELDS = SECTIONS.flatMap((s) => s.fields);
const DEFAULTS = {
  patient_ref: "", age: "51-60", severity_of_illness: "Moderate", type_of_admission: "Emergency",
  department: "gynecology", ward_type: "R", ward_facility_code: "F", bed_grade: 2, length_of_stay: 5,
  num_prior_admissions: 0, previous_emergency_count: 0, previous_urgent_count: 0, previous_readmission_count: 0,
  previous_hospital_days: 0, previous_avg_los: 0, previous_max_los: 0, days_since_previous_discharge: "",
  previous_30d_encounters: 0, previous_90d_encounters: 0, previous_365d_encounters: 0,
  available_extra_rooms: 2, visitors_with_patient: 2, admission_deposit: 4500, hospital_type_code: "c", hospital_region_code: "X",
};

// Example inputs to try the form. These are made-up values, not patient data.
const SAMPLES = {
  "Frequent returner": {
    age: "71-80", severity_of_illness: "Extreme", length_of_stay: 9, num_prior_admissions: 5, previous_emergency_count: 4,
    previous_readmission_count: 3, previous_hospital_days: 38, previous_avg_los: 7.6, previous_max_los: 14,
    days_since_previous_discharge: 12, previous_30d_encounters: 1, previous_90d_encounters: 2, previous_365d_encounters: 5,
  },
  "First visit, minor": {
    age: "31-40", severity_of_illness: "Minor", type_of_admission: "Urgent", length_of_stay: 3, visitors_with_patient: 4,
  },
};

// ---- Upload a patient file (CSV or JSON) to prefill the form. Parsed in the browser only. ----
function splitCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function parsePatientFile(text, filename) {
  let row;
  let rowCount = 1;
  if (filename.toLowerCase().endsWith(".json")) {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : [data];
    rowCount = list.length;
    row = list[0];
    if (!row || typeof row !== "object") throw new Error("JSON must be an object (or a list of objects) with patient fields.");
  } else {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error("The CSV needs a header row and one patient row.");
    const head = splitCsvLine(lines[0]);
    const vals = splitCsvLine(lines[1]);
    rowCount = lines.length - 1;
    row = Object.fromEntries(head.map((h, i) => [h, vals[i] ?? ""]));
  }
  const values = {};
  const skipped = [];
  const known = new Set(FIELDS.map((f) => f.name));
  for (const f of FIELDS) {
    const raw = row[f.name];
    if (raw === undefined || raw === null || String(raw).trim() === "") continue;
    if (f.type === "select") {
      const hit = f.options.find((o) => String(o).toLowerCase() === String(raw).trim().toLowerCase());
      if (hit === undefined) skipped.push(`${f.name} ("${raw}" is not an allowed value)`);
      else values[f.name] = hit;
    } else {
      values[f.name] = String(raw).trim();
    }
  }
  const unknown = Object.keys(row).filter((k) => !known.has(k));
  return { values, skipped, unknown, rowCount };
}

function validate(form) {
  const errors = {};
  for (const f of FIELDS) {
    if (f.type !== "number") continue;
    const raw = form[f.name];
    if (raw === "" || raw === null) {
      if (!f.optional) errors[f.name] = "Enter a value";
      continue;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) errors[f.name] = "Enter a number";
    else if (f.integer && !Number.isInteger(n)) errors[f.name] = "Use a whole number";
    else if (n < f.min) errors[f.name] = `Must be at least ${f.min}`;
    else if (n > f.max) errors[f.name] = `Must be at most ${f.max}`;
  }
  const n = (k) => Number(form[k]);
  if (!errors.previous_30d_encounters && !errors.previous_90d_encounters && n("previous_30d_encounters") > n("previous_90d_encounters"))
    errors.previous_30d_encounters = "Cannot exceed the last 90 days";
  if (!errors.previous_90d_encounters && !errors.previous_365d_encounters && n("previous_90d_encounters") > n("previous_365d_encounters"))
    errors.previous_90d_encounters = "Cannot exceed the last 365 days";
  if (!errors.previous_365d_encounters && !errors.num_prior_admissions && n("previous_365d_encounters") > n("num_prior_admissions"))
    errors.previous_365d_encounters = "Cannot exceed total prior admissions";
  if (!errors.previous_max_los && !errors.previous_avg_los && n("previous_max_los") < n("previous_avg_los"))
    errors.previous_max_los = "Longest stay cannot be below the average";
  return errors;
}

function Field({ spec, value, error, onChange }) {
  const id = `f-${spec.name}`;
  const describedBy = [spec.help ? `${id}-h` : null, error ? `${id}-e` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{spec.label}{spec.optional && <span className="opt"> (optional)</span>}</label>
      {spec.type === "select" ? (
        <select id={id} className="select" value={value} onChange={(e) => onChange(spec.name, e.target.value)} aria-describedby={describedBy}>
          {spec.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          id={id} className="input" type={spec.type} value={value} aria-invalid={error ? "true" : undefined}
          inputMode={spec.type === "number" ? "decimal" : undefined} step={spec.step}
          onChange={(e) => onChange(spec.name, e.target.value)} aria-describedby={describedBy}
          maxLength={spec.type === "text" ? 40 : undefined}
        />
      )}
      {spec.help && !error && <span className="help" id={`${id}-h`}>{spec.help}</span>}
      {error && <span className="field-error" id={`${id}-e`}>{error}</span>}
    </div>
  );
}

export default function NewPrediction({ setSubCrumb }) {
  const [form, setForm] = useState(DEFAULTS);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [done, setDone] = useState(null); // { result, record, inputs }
  const history = useHistoryStore();
  const toast = useToast();
  const fileRef = useRef(null);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.(csv|json)$/i.test(file.name)) { toast.error("Upload a .csv or .json file."); return; }
    if (file.size > 1024 * 1024) { toast.error("File is too large for a single patient."); return; }
    try {
      const { values, skipped, unknown, rowCount } = parsePatientFile(await file.text(), file.name);
      const n = Object.keys(values).length;
      if (n === 0) { toast.error("No known patient fields found in this file."); return; }
      const next = { ...DEFAULTS, ...values };
      setForm(next);
      setErrors(validate(next));
      let msg = `Filled ${n} fields from ${file.name}.`;
      if (rowCount > 1) msg += ` Used the first of ${rowCount} rows. Use Batch Analysis for all.`;
      if (skipped.length) msg += ` Skipped: ${skipped.join("; ")}.`;
      else if (unknown.length) msg += ` Ignored ${unknown.length} unknown column(s).`;
      toast.success(msg + " Check the values, then predict.");
    } catch (err) {
      toast.error(err.message || "Could not read this file.");
    }
  };

  const set = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const reviewItems = useMemo(
    () => [
      ["Age group", form.age], ["Severity", form.severity_of_illness], ["Admission", form.type_of_admission],
      ["Stay", `${form.length_of_stay || 0} days`], ["Prior admissions", form.num_prior_admissions],
    ],
    [form]
  );

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Please fix the highlighted fields.");
      const first = Object.keys(found)[0];
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    // Same payload the API has always received: field names unchanged, numbers as numbers.
    const payload = {};
    const display = {};
    for (const f of FIELDS) {
      if (f.clientOnly) continue;
      const v = form[f.name];
      if (f.type === "number") payload[f.name] = v === "" ? null : Number(v);
      else payload[f.name] = v;
      if (payload[f.name] !== null) display[f.label] = payload[f.name];
    }
    setLoading(true);
    setApiError("");
    try {
      const result = await scorePatient(payload);
      const ref = form.patient_ref.trim() || `Patient ${new Date().toTimeString().slice(0, 5)}`;
      const record = {
        id: newRecordId(), createdAt: new Date().toISOString(), patientRef: ref, source: "single",
        probability: result.risk_probability, tier: result.risk_tier, needsReview: result.needs_review,
        summary: result.plain_language_summary, topFactors: result.factor_details.map((f) => f.display_name),
        result, inputs: display,
      };
      history.add([record]);
      setDone({ result, record, inputs: display });
      setSubCrumb("Results");
      toast.success(`Scored ${ref}: ${pct(result.risk_probability)} (${result.risk_tier})`);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setApiError(err.message);
      toast.error("Could not score this patient.");
    } finally {
      setLoading(false);
    }
  };

  const another = () => {
    setDone(null);
    setSubCrumb(null);
    setForm(DEFAULTS);
    window.scrollTo({ top: 0 });
  };

  if (done) {
    return (
      <>
        <PageHeader title="Prediction result" subtitle={`${done.record.patientRef}, scored just now`} />
        <ResultView
          result={done.result}
          onAnother={another}
          onDownload={() => downloadReport(done)}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="New prediction"
        subtitle="Enter a patient's record to estimate their 30-day readmission risk. Every field uses the same inputs the model was trained on."
        actions={
          <div className="chips" aria-label="Fill with example inputs">
            <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" onChange={onFile} hidden />
            <button type="button" className="chip" onClick={() => fileRef.current?.click()}>
              <Upload size={13} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 5 }} />Upload patient file
            </button>
            <span className="small muted" style={{ alignSelf: "center" }}>or try:</span>
            {Object.keys(SAMPLES).map((name) => (
              <button type="button" key={name} className="chip" onClick={() => { setForm({ ...DEFAULTS, ...SAMPLES[name] }); setErrors({}); }}>
                <Sparkles size={13} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 5 }} />{name}
              </button>
            ))}
          </div>
        }
      />
      <form className="stack" onSubmit={submit} noValidate>
        {SECTIONS.map(({ id, title, text, icon: Icon, fields }) => (
          <section key={id} className="card form-section" aria-labelledby={`s-${id}`}>
            <div className="section-head">
              <div className="section-icon"><Icon size={19} aria-hidden="true" /></div>
              <div>
                <h2 id={`s-${id}`}>{title}</h2>
                <p className="card-sub">{text}</p>
              </div>
            </div>
            <div className="fields">
              {fields.map((spec) => (
                <Field key={spec.name} spec={spec} value={form[spec.name]} error={errors[spec.name]} onChange={set} />
              ))}
            </div>
          </section>
        ))}

        <section className="card form-section" aria-labelledby="s-review">
          <div className="section-head">
            <div className="section-icon"><Sparkles size={19} aria-hidden="true" /></div>
            <div>
              <h2 id="s-review">Review and predict</h2>
              <p className="card-sub">Check the key inputs, then run the model.</p>
            </div>
          </div>
          <div className="review-list">
            {reviewItems.map(([k, v]) => (
              <div className="review-item" key={k}><span>{k}</span><b>{String(v)}</b></div>
            ))}
          </div>
          {apiError && <div style={{ marginBottom: 14 }}><Banner kind="error">{apiError}</Banner></div>}
          <button className="btn primary" type="submit" disabled={loading} style={{ minWidth: 200 }}>
            {loading ? (<><Loader2 size={17} className="spin" aria-hidden="true" />Scoring…</>) : "Predict readmission risk"}
          </button>
        </section>
      </form>
    </>
  );
}