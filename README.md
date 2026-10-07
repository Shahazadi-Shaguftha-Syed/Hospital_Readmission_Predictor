# Hospital 30-Day Readmission Predictor

A full-stack web application that predicts a patient's 30-day hospital readmission
risk from their discharge data — with explainable, reviewable output instead of a
bare probability score.

Built as an OJT (On-the-Job Training) project, data science track.

---

## Overview

Care coordinators today rely on manual chart review to judge which discharged
patients are likely to be readmitted. This project turns that judgment call into a
supported decision: a patient's discharge record goes in, and a risk score comes
out — along with the specific factors driving that score and a flag when the model
itself is uncertain, so a human stays in the loop for the calls that matter.

---

## Features

- Score a single patient or upload a batch (CSV) of patients
- Risk tiering (Low / Medium / High) based on a cost-aware threshold, not a flat 0.5
- Explainable output — top contributing factors per prediction (SHAP)
- Confidence flagging for predictions the model itself is unsure about
- Evaluation dashboard — AUC, calibration, confusion matrix
- Model comparison — Logistic Regression vs Random Forest vs XGBoost

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| ML | scikit-learn, XGBoost, SHAP |
| Database | PostgreSQL (SQLite for local dev) |
| Deployment | Vercel (frontend), Render/Railway (backend) |

---

## Dataset

**AV Healthcare Analytics II** (Analytics Vidhya) — ~318,000 hospital encounters across
~92,000 unique patients, with admission details such as department, ward type,
severity of illness, type of admission, age group, and admission deposit.

The original dataset has no dates and no readmission label, so the following were
added on top of it:

- **Synthetic admission/discharge dates** — generated for each encounter; not real hospital records.
- **`readmitted_30_days` target** — derived from the gap between a patient's consecutive encounters on that synthetic timeline.
- **Admission-history features** — `previous_encounters`, `previous_30d/90d/365d_encounters`, `previous_avg_los`, `previous_readmission_count`, etc., computed from each patient's own encounter history.

> **Limitation:** because the dates and target are synthetic, model results here
> demonstrate the pipeline and approach, not real clinical performance.

Source: Analytics Vidhya — Healthcare Analytics II hackathon dataset.

---

## Repository Structure

```
readmission-predictor/
├── README.md
├── LICENSE
├── .gitignore
├── data/
│   └── raw/
│       ├── diabetic_data.csv
│       └── IDS_mapping.csv
├── backend/
│   ├── requirements.txt
│   └── app/
│       └── main.py            # FastAPI app — health check + prediction endpoint
└── frontend/
    ├── package.json
    └── src/
        └── App.tsx             # Patient Risk Dashboard entry point
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API runs at `http://localhost:8000`. Check `/health` to confirm it's up.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173` by default.

---

## License

This project is licensed under the MIT License — see [`LICENSE`](./LICENSE) for
details.
