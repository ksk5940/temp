# OpenShiftEye

**Monitor. Detect. Analyse.**

## Project Structure

```
openshifteye/
├── app.py                  # Flask backend (all API routes, session management)
├── requirements.txt
├── Dockerfile
├── .env.example
├── templates/
│   ├── login.html          # Login page
│   └── index.html          # Dashboard
└── static/
    ├── css/
    │   ├── login.css
    │   └── main.css
    └── js/
        └── main.js         # Dashboard logic (DC switch, deployments, pods)
```

## Bugs Fixed

### 1. Login redirect when switching DC/Cluster
**Root cause**: `switch_dc` route did a full-page `redirect(url_for('index'))` which caused
browser to reload and re-evaluate session. If the session cookie was not sent (due to
`SESSION_COOKIE_SECURE=True` over HTTP), it appeared as logged out.

**Fix**: `switch_dc` now returns JSON (`{"ok": true, "dc": ...}`). The frontend handles the
switch via AJAX — no page reload, no session cookie re-evaluation.

### 2. Deployments not loading after DC switch
**Root cause**: After switching DC, the frontend reloaded `/` which lost the selected project
state and the namespace parameter.

**Fix**: `sessionStorage` preserves selected project across AJAX-based DC switches. After
switching DC, `loadDeployments(currentProject)` is called directly.

### 3. Session expiry redirecting to login from API calls
**Root cause**: `login_required` did `redirect(url_for('login'))` for all routes including
`/api/*`. Browsers followed the redirect and the AJAX caller got HTML instead of JSON.

**Fix**: API routes (`/api/*`) return `{"error": "session_expired"}, 401`. The JS `apiFetch`
wrapper detects 401 and redirects to `/login` with a flash message.

### 4. Stale session cookie after pod restart (OpenShift)
**Root cause**: OpenShift can restart pods, wiping `SESSION_STORE` (in-memory). The client
still has the `session_id` cookie, but the server has no matching data, causing silent failures.

**Fix**: `before_request` now detects a session_id cookie with no matching server-side session
and clears the cookie (`session.clear()`), forcing a clean re-login.

### 5. `SESSION_COOKIE_SECURE` causing login to fail
**Root cause**: `SESSION_COOKIE_SECURE=True` means the browser only sends the cookie over HTTPS.
OpenShift routes may terminate TLS at the router and forward HTTP internally, causing the
cookie to never be sent.

**Fix**: Default is now `false`. Set `SESSION_COOKIE_SECURE=true` only when TLS goes all the
way to the pod (port 8443 with certs mounted).

### 6. `session.permanent = True` not set
**Fix**: Login now sets `session.permanent = True` so the session lasts `PERMANENT_SESSION_LIFETIME`
(1 hour) instead of browser-session lifetime.

## Running Locally

```bash
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your SECRET_KEY
python app.py
```

## OpenShift Deployment

```bash
# Build and push image
docker build -t your-registry/openshifteye:latest .
docker push your-registry/openshifteye:latest

# Key environment variables to set in DeploymentConfig:
#   SECRET_KEY          - long random string (same across all pods!)
#   SESSION_COOKIE_SECURE - "false" unless TLS terminates at pod
#   PORT                - 8080
```

> **Important**: `SECRET_KEY` must be identical across all replicas. Use an OpenShift Secret
> and mount it as an env var. If it differs between pods, sessions from one pod will be
> rejected by another.
