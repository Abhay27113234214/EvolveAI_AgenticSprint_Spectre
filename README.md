# EvolveAI_AgenticSprint_Spectre

Spectre – AI CFO Platform
=========================

An AI‑powered financial intelligence platform for founders and finance teams. Upload annual reports, extract key figures with LLMs, compute KPIs, and view insights and risks on a clean dashboard.

Highlights
----------
- Upload PDF annual reports (secure local storage)
- AI extraction with Gemini (LangChain) + FAISS retrieval
- KPIs: revenue growth, margin, burn rate, runway, current ratio, D/E, ROE
- JWT APIs + Flask‑Login pages: Home, Login, Register, Dashboard, Upload, Risks, Insights, Monitoring

Project structure
-----------------
```
CFO/backend/
  app.py                 # Flask app, routes, APIs, LangChain pipeline
  app.db                 # SQLite DB (auto-created)
  templates/             # UI (HTML/CSS/JS)
    index.html login.html register.html dashboard.html upload.html ...
    css/styles.css       # Design system + components
    app.js               # Frontend controller (CFOAssistant)
  uploads/               # Uploaded PDFs
```

Prerequisites
-------------
- Python 3.10+
- Google API key for Gemini (langchain-google-genai)

Environment (.env)
------------------
Create `CFO/backend/.env`:
```
GOOGLE_API_KEY=your_google_api_key
JWT_SECRET_KEY=change_this_jwt_secret
FLASK_SECRET_KEY=change_this_flask_secret
```

Install & run (Windows PowerShell)
----------------------------------
```
cd CFO/backend

# Create & activate venv
python -m venv cfo
./cfo/Scripts/Activate.ps1

# Install dependencies
pip install --upgrade pip
pip install flask flask_sqlalchemy flask_bcrypt flask_login flask_jwt_extended flask_cors flask_restful python-dotenv \
            langchain langchain-community langchain-google-genai faiss-cpu pydantic

# Start server (creates DB and a default admin)
python app.py
```
App URL: `http://127.0.0.1:5000/`

Default admin (auto-created)
----------------------------
- Email: `admin@gmail.com`
- Password: `admin123`

How to use
----------
1) Register or use the default admin
2) Login → Dashboard
3) Upload → select your annual report PDF
4) Dashboard → see extracted data and KPIs
5) Explore Risks, Insights, Monitoring

Core backend routes
-------------------
- GET `/` – Home
- GET `/register`, POST `/register` – Form registration
- GET `/login`, POST `/login` – Form login
- GET `/dashboard` – Protected dashboard
- GET `/upload` – Protected upload page
- POST `/upload_annual_report` – Form upload field `pdf_file`

REST APIs
---------
- POST `/api/user/register` – `{ full_name, work_email, password, job_title?, company_name? }`
- POST `/api/user/login` – `{ work_email, password }` → `{ access_token }`
- POST `/api/query` (JWT) – `{ query }` → `{ response }`
- POST `/api/uploadAnnualReportPdf` – multipart `pdf_file`

FAISS index note
----------------
`/dashboard` tries to load a prebuilt FAISS index from `FAISS_INDEX_PATH` in `app.py`. If not found, you’ll be redirected to Upload. In the next iteration, build the index automatically from uploaded PDFs.

Run with a different port / production
--------------------------------------
```
# Different port
set FLASK_RUN_PORT=8080
python app.py

# With waitress (example)
pip install waitress
waitress-serve --listen=0.0.0.0:5000 app:app
```

Troubleshooting
---------------
- 401 or redirect loop: ensure you’re logged in and cookies are enabled
- Gemini errors: check `GOOGLE_API_KEY`
- FAISS index not found: upload a PDF or adjust pipeline
- PowerShell cannot activate venv: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
