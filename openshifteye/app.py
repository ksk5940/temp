import os
import ssl
import json
import time
import uuid
import tempfile
import threading
import subprocess
from functools import wraps
from datetime import timedelta

import hashlib
from flask.sessions import SecureCookieSessionInterface
from itsdangerous import URLSafeTimedSerializer

from dotenv import load_dotenv
from flask import (
    Flask, jsonify, render_template, request,
    redirect, url_for, flash, session, g
)

# --------------------------------------------------
# Load env
# --------------------------------------------------
load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY", "development-key-change-in-prod")
SSL_CERT_PATH = os.environ.get("SSL_CERT_PATH", "/etc/ssl/certs/tls.crt")
SSL_KEY_PATH = os.environ.get("SSL_KEY_PATH", "/etc/ssl/private/tls.key")
PORT = int(os.environ.get("PORT", "8080"))

TOKEN_TTL = 3600  # 1 hour
CACHE_TTL = 30

DATA_CENTERS = {
    "NP1-GL": {"name": "NP1 GL", "url": "https://api.np1-gl.apaas4.barclays.intranet:6443"},
    "NP1-SL": {"name": "NP1 SL", "url": "https://api.np1-sl.apaas4.barclays.intranet:6443"},
    "NP2-GL": {"name": "NP2 GL", "url": "https://api.np2-gl.apaas4.barclays.intranet:6443"},
    "NP2-SL": {"name": "NP2 SL", "url": "https://api.np2-sl.apaas4.barclays.intranet:6443"},
    "NP3-GL": {"name": "NP3 GL", "url": "https://api.np3-gl.apaas4.barclays.intranet:6443"},
    "NP3-SL": {"name": "NP3 SL", "url": "https://api.np3-sl.apaas4.barclays.intranet:6443"},
    "NP4-SL": {"name": "NP4 SL", "url": "https://api.np4-gl.apaas4.barclays.intranet:6443"},
    "NP5-SL": {"name": "NP5 SL", "url": "https://api.np5-gl.apaas4.barclays.intranet:6443"},
    "NP6-GL": {"name": "NP6 GL", "url": "https://api.np6-gl.apaas4.barclays.intranet:6443"},
    "NP6-SL": {"name": "NP6 SL", "url": "https://api.np6-sl.apaas4.barclays.intranet:6443"},
}
DEFAULT_DC = "NP6-GL"

# --------------------------------------------------
# Flask app setup
# --------------------------------------------------
app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
    static_url_path="/static"
)
app.secret_key = SECRET_KEY
app.config["SERVER_NAME"] = None
app.config["APPLICATION_ROOT"] = "/"
app.config["PREFERRED_URL_SCHEME"] = "https"
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=1)

# FIX: SESSION_COOKIE_SECURE should be False by default so cookie is sent over HTTP too (OpenShift may
# route through HTTP internally). Set via env only when truly running HTTPS end-to-end.
cookie_secure = os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=cookie_secure,
    # FIX: Give the session cookie a consistent name so it persists across DC/cluster switches
    SESSION_COOKIE_NAME="openshifteye_session",
)

# --------------------------------------------------
# Secure session interface
# --------------------------------------------------
class SHA256SecureCookieSessionInterface(SecureCookieSessionInterface):
    def get_signing_serializer(self, app):
        if not app.secret_key:
            return None
        signer_kwargs = {
            "key_derivation": "hmac",
            "digest_method": hashlib.sha256,
        }
        return URLSafeTimedSerializer(
            app.secret_key,
            salt=self.salt,
            serializer=self.serializer,
            signer_kwargs=signer_kwargs,
        )

app.session_interface = SHA256SecureCookieSessionInterface()

# --------------------------------------------------
# In-memory stores
# --------------------------------------------------
SESSION_STORE = {}
SESSION_LOCK = threading.Lock()

CACHE = {}
CACHE_LOCK = threading.Lock()

AUTH_WORKERS = {}
AUTH_WORKERS_LOCK = threading.Lock()

def _now() -> float:
    return time.time()

def _new_session_id() -> str:
    return str(uuid.uuid4())

def _session_get(session_id: str):
    with SESSION_LOCK:
        return SESSION_STORE.get(session_id)

def _session_set(session_id: str, data: dict):
    with SESSION_LOCK:
        SESSION_STORE[session_id] = data

def _session_delete(session_id: str):
    with SESSION_LOCK:
        data = SESSION_STORE.pop(session_id, None)
    if data:
        tokens = data.get("cluster_tokens", {}) or {}
        for _, tk in tokens.items():
            kubeconfig = tk.get("kubeconfig")
            if kubeconfig and os.path.exists(kubeconfig):
                try:
                    os.remove(kubeconfig)
                except Exception:
                    pass

def token_valid(tk: dict) -> bool:
    if not tk:
        return False
    ts = tk.get("timestamp", 0)
    return (_now() - ts) < TOKEN_TTL

def _cleanup_expired_tokens(sess: dict):
    tokens = sess.get("cluster_tokens", {}) or {}
    expired = []
    for dc_key, tk in tokens.items():
        if not token_valid(tk):
            expired.append(dc_key)
    for dc_key in expired:
        kubeconfig = tokens[dc_key].get("kubeconfig")
        if kubeconfig and os.path.exists(kubeconfig):
            try:
                os.remove(kubeconfig)
            except Exception:
                pass
        del tokens[dc_key]
        if "auth_status" in sess and dc_key in sess["auth_status"]:
            sess["auth_status"][dc_key] = {"state": "pending", "error": ""}
    sess["cluster_tokens"] = tokens

def _cache_key(session_id: str, dc: str, kind: str, namespace: str = "", name: str = "") -> str:
    return f"{session_id}:{dc}:{kind}:{namespace}:{name}"

def _cache_get(key: str):
    with CACHE_LOCK:
        entry = CACHE.get(key)
        if not entry:
            return None
        if _now() - entry["ts"] > CACHE_TTL:
            del CACHE[key]
            return None
        return entry["data"]

def _cache_set(key: str, data):
    with CACHE_LOCK:
        CACHE[key] = {"ts": _now(), "data": data}

def _cache_clear_prefix(session_id: str):
    with CACHE_LOCK:
        keys = [k for k in list(CACHE.keys()) if k.startswith(session_id + ":")]
        for k in keys:
            del CACHE[k]

# --------------------------------------------------
# OpenShift helpers
# --------------------------------------------------
def oc_login(server: str, username: str, password: str, kubeconfig_path: str):
    cmd = [
        "oc", "login", server,
        "--username", username,
        "--password", password,
        "--kubeconfig", kubeconfig_path,
        "--insecure-skip-tls-verify=true",
    ]
    return subprocess.run(cmd, capture_output=True, text=True, timeout=30)

def oc_whoami_token(kubeconfig_path: str) -> str:
    cmd = ["oc", "whoami", "-t", "--kubeconfig", kubeconfig_path]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    if r.returncode == 0:
        return r.stdout.strip()
    return ""

def init_auth_status_for_session():
    return {dc_key: {"state": "pending", "error": ""} for dc_key in DATA_CENTERS.keys()}

def _is_forbidden(stderr_text: str) -> bool:
    s = (stderr_text or "").lower()
    return ("forbidden" in s) or ("unauthorized" in s) or ("access denied" in s)

# --------------------------------------------------
# Background authentication
# --------------------------------------------------
def background_authenticate_remaining(session_id: str, username: str, password: str, skip_dc: str):
    try:
        for dc_key, dc in DATA_CENTERS.items():
            if dc_key == skip_dc:
                continue
            with SESSION_LOCK:
                sess = SESSION_STORE.get(session_id)
                if not sess:
                    return
                if dc_key in sess.get("cluster_tokens", {}):
                    sess["auth_status"][dc_key] = {"state": "ok", "error": ""}
                    SESSION_STORE[session_id] = sess
                    continue
                sess["auth_status"][dc_key] = {"state": "authenticating", "error": ""}
                SESSION_STORE[session_id] = sess

            kube_fd, kube_path = tempfile.mkstemp(prefix=f"openshifteye_{dc_key}_", suffix=".kubeconfig")
            os.close(kube_fd)
            try:
                r = oc_login(dc["url"], username, password, kube_path)
                if r.returncode != 0:
                    raise Exception("oc login failed")
                token = oc_whoami_token(kube_path)
                if not token:
                    raise Exception("token not received")
                with SESSION_LOCK:
                    sess = SESSION_STORE.get(session_id)
                    if not sess:
                        os.remove(kube_path)
                        return
                    sess["cluster_tokens"][dc_key] = {"kubeconfig": kube_path, "timestamp": _now()}
                    sess["auth_status"][dc_key] = {"state": "ok", "error": ""}
                    SESSION_STORE[session_id] = sess
            except Exception:
                try:
                    if os.path.exists(kube_path):
                        os.remove(kube_path)
                except Exception:
                    pass
                with SESSION_LOCK:
                    sess = SESSION_STORE.get(session_id)
                    if not sess:
                        return
                    sess["auth_status"][dc_key] = {"state": "failed", "error": "auth failed"}
                    SESSION_STORE[session_id] = sess
    finally:
        with AUTH_WORKERS_LOCK:
            AUTH_WORKERS.pop(session_id, None)

# --------------------------------------------------
# Session loading
# --------------------------------------------------
@app.before_request
def load_server_side_session():
    g.session_id = session.get("session_id")
    g.sess = None
    if g.session_id:
        sess_data = _session_get(g.session_id)
        if sess_data:
            _cleanup_expired_tokens(sess_data)
            _session_set(g.session_id, sess_data)
            g.sess = sess_data
        else:
            # FIX: If session_id cookie exists but no server-side session (pod restart),
            # clear stale cookie instead of silently failing
            session.clear()
            g.session_id = None

# --------------------------------------------------
# Login required decorator
# FIX: For API endpoints return 401 JSON instead of redirect so frontend handles it properly
# --------------------------------------------------
def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not g.session_id or not g.sess:
            # FIX: API calls should get JSON 401, not a redirect to HTML login page
            if request.path.startswith("/api/"):
                return jsonify({"error": "session_expired", "redirect": "/login"}), 401
            return redirect(url_for("login"))
        if not g.sess.get("cluster_tokens"):
            _cache_clear_prefix(g.session_id)
            _session_delete(g.session_id)
            session.clear()
            if request.path.startswith("/api/"):
                return jsonify({"error": "session_expired", "redirect": "/login"}), 401
            return redirect(url_for("login"))
        return fn(*args, **kwargs)
    return wrapper

# --------------------------------------------------
# Routes: health / login / logout / switch-dc
# --------------------------------------------------
@app.route("/health")
def health():
    return jsonify({"status": "healthy"}), 200

@app.route("/login", methods=["GET", "POST"])
def login():
    # FIX: If already authenticated, go to index instead of showing login again
    if g.session_id and g.sess and g.sess.get("cluster_tokens"):
        return redirect(url_for("index"))

    error = None
    username = ""
    GENERIC_AUTH_ERROR = "Authentication failed. Please check username/password or network."

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "").strip()
        if not username or not password:
            error = "Username and password are required."
            return render_template("login.html", error=error, username=username), 200

        first_dc = DEFAULT_DC
        dc = DATA_CENTERS[first_dc]
        kube_fd, kube_path = tempfile.mkstemp(prefix=f"openshifteye_{first_dc}_", suffix=".kubeconfig")
        os.close(kube_fd)

        try:
            r = oc_login(dc["url"], username, password, kube_path)
            if r.returncode != 0:
                try:
                    os.remove(kube_path)
                except Exception:
                    pass
                error = GENERIC_AUTH_ERROR
                return render_template("login.html", error=error, username=username), 200

            token = oc_whoami_token(kube_path)
            if not token:
                try:
                    os.remove(kube_path)
                except Exception:
                    pass
                error = GENERIC_AUTH_ERROR
                return render_template("login.html", error=error, username=username), 200

            # FIX: Clear any old session before creating a new one to avoid stale state
            if g.session_id:
                _cache_clear_prefix(g.session_id)
                _session_delete(g.session_id)
            session.clear()

            session_id = _new_session_id()
            session["session_id"] = session_id
            session["username"] = username
            # FIX: Make session permanent so it lasts the full TOKEN_TTL hours
            session.permanent = True

            sess_data = {
                "username": username,
                "cluster_tokens": {first_dc: {"kubeconfig": kube_path, "timestamp": _now()}},
                "auth_status": init_auth_status_for_session(),
                "dc": first_dc,
                "login_time": _now(),
            }
            sess_data["auth_status"][first_dc] = {"state": "ok", "error": ""}
            _session_set(session_id, sess_data)
            _cache_clear_prefix(session_id)
            session.pop("_flashes", None)

            flash("Logged in successfully. Authenticating remaining clusters in background...", "success")

            with AUTH_WORKERS_LOCK:
                if session_id not in AUTH_WORKERS:
                    t = threading.Thread(
                        target=background_authenticate_remaining,
                        args=(session_id, username, password, first_dc),
                        daemon=True,
                    )
                    AUTH_WORKERS[session_id] = t
                    t.start()

            return redirect(url_for("index"), code=303)

        except Exception:
            try:
                os.remove(kube_path)
            except Exception:
                pass
            error = GENERIC_AUTH_ERROR
            return render_template("login.html", error=error, username=username), 200

    return render_template("login.html", error=error, username=username), 200

@app.route("/logout")
def logout():
    if g.session_id:
        _cache_clear_prefix(g.session_id)
        _session_delete(g.session_id)
    session.clear()
    flash("Logged out successfully.", "success")
    return redirect(url_for("login"))

@app.route("/switch-dc/<dc>")
@login_required
def switch_dc(dc):
    if dc not in DATA_CENTERS:
        return jsonify({"error": "Invalid cluster"}), 400

    sess_data = _session_get(g.session_id)
    if not sess_data:
        return jsonify({"error": "session_expired", "redirect": "/login"}), 401

    _cleanup_expired_tokens(sess_data)
    tokens = sess_data.get("cluster_tokens", {}) or {}
    auth_status = (sess_data.get("auth_status", {})).get(dc, {"state": "pending"})

    if dc not in tokens:
        state = auth_status.get("state", "pending")
        if state == "pending" or state == "authenticating":
            return jsonify({"error": "pending", "message": "Cluster authentication in progress. Please wait..."}), 202
        return jsonify({"error": "failed", "message": "Cluster authentication failed. Please logout and login again."}), 503

    sess_data["dc"] = dc
    _session_set(g.session_id, sess_data)
    # FIX: Only clear cache for dc-specific entries, not global session cache
    with CACHE_LOCK:
        keys = [k for k in list(CACHE.keys()) if k.startswith(g.session_id + ":")]
        for k in keys:
            del CACHE[k]

    return jsonify({"ok": True, "dc": dc, "name": DATA_CENTERS[dc]["name"]})

# --------------------------------------------------
# Index route
# --------------------------------------------------
@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        return redirect(url_for("login"), 303)

    if not g.session_id or not g.sess or not g.sess.get("cluster_tokens"):
        return redirect(url_for("login"))

    sess_data = _session_get(g.session_id)
    if not sess_data:
        return redirect(url_for("login"))

    current_dc = sess_data.get("dc", DEFAULT_DC)
    login_time = sess_data.get("login_time", _now())
    remaining = max(0, TOKEN_TTL - int(_now() - login_time))

    tokens = sess_data.get("cluster_tokens", {}) or {}
    auth_status = sess_data.get("auth_status", {}) or {}

    total = len(DATA_CENTERS)
    ok_count = sum(1 for dc_key in DATA_CENTERS.keys() if dc_key in tokens)
    failed_count = sum(
        1 for dc_key in DATA_CENTERS.keys()
        if (auth_status.get(dc_key, {}) or {}).get("state") == "failed"
    )
    pending_count = total - ok_count - failed_count
    done = (pending_count == 0)

    return render_template(
        "index.html",
        username=sess_data.get("username", ""),
        current_dc=current_dc,
        time_remaining=remaining,
        data_centers=DATA_CENTERS,
        auth_total=total,
        auth_ok=ok_count,
        auth_done=done,
        session_nonce=str(int(login_time)),
    ), 200

# --------------------------------------------------
# Auth status route
# --------------------------------------------------
@app.route("/api/auth-status")
@login_required
def api_auth_status():
    sess_data = _session_get(g.session_id)
    auth_status = sess_data.get("auth_status", {}) or {}
    tokens = sess_data.get("cluster_tokens", {}) or {}

    total = len(DATA_CENTERS)
    ok_count = sum(1 for dc_key in DATA_CENTERS.keys() if dc_key in tokens)
    failed_count = sum(
        1 for dc_key in DATA_CENTERS.keys()
        if (auth_status.get(dc_key, {}) or {}).get("state") == "failed"
    )
    pending_count = total - ok_count - failed_count
    ready = ok_count + failed_count
    done = (pending_count == 0)

    return jsonify({
        "total": total,
        "ready": ready,
        "done": done,
        "ok": ok_count,
        "failed": failed_count,
        "pending": pending_count,
        "current_dc": sess_data.get("dc", DEFAULT_DC),
        "status": auth_status,
    })

# --------------------------------------------------
# API: projects
# --------------------------------------------------
@app.route("/api/projects")
@login_required
def api_projects():
    sess_data = _session_get(g.session_id)
    dc = sess_data.get("dc", DEFAULT_DC)

    # FIX: Verify the dc token exists before using it
    tokens = sess_data.get("cluster_tokens", {}) or {}
    if dc not in tokens:
        return jsonify({"error": f"Not authenticated to {dc}. Please switch cluster or re-login."}), 503

    kubeconfig = tokens[dc]["kubeconfig"]

    key = _cache_key(g.session_id, dc, "projects")
    cached = _cache_get(key)
    if cached is not None:
        return jsonify(cached)

    try:
        cmd = ["oc", "get", "projects", "-o", "json", "--kubeconfig", kubeconfig]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30, check=True)
        data = json.loads(r.stdout)

        items = data.get("items", [])
        if not items:
            return jsonify({"error": f"You don't have access to any project on {dc}"}), 403

        projects = []
        for item in items:
            meta = item.get("metadata", {})
            projects.append({
                "name": meta.get("name", ""),
                "displayName": (meta.get("annotations", {}) or {}).get(
                    "openshift.io/display-name", meta.get("name", "")
                ),
            })

        _cache_set(key, projects)
        return jsonify(projects)

    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or "")
        if _is_forbidden(stderr):
            return jsonify({"error": f"You don't have access to any project on {dc}"}), 403
        return jsonify({"error": "Failed to load projects"}), 500
    except Exception:
        return jsonify({"error": "Failed to load projects"}), 500

# --------------------------------------------------
# API: deployments
# FIX: Return proper error instead of 500 when namespace is missing or dc token missing
# --------------------------------------------------
@app.route("/api/deployments")
@login_required
def api_deployments():
    namespace = request.args.get("namespace", "").strip()
    if not namespace:
        return jsonify({"error": "namespace parameter is required"}), 400

    sess_data = _session_get(g.session_id)
    dc = sess_data.get("dc", DEFAULT_DC)

    tokens = sess_data.get("cluster_tokens", {}) or {}
    if dc not in tokens:
        return jsonify({"error": f"Not authenticated to {dc}. Please switch cluster or re-login."}), 503

    kubeconfig = tokens[dc]["kubeconfig"]

    key = _cache_key(g.session_id, dc, "deployments", namespace=namespace)
    cached = _cache_get(key)
    if cached is not None:
        return jsonify(cached)

    try:
        cmd = ["oc", "get", "deployments", "-n", namespace, "-o", "json", "--kubeconfig", kubeconfig]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            stderr = r.stderr or ""
            if _is_forbidden(stderr):
                return jsonify({"error": f"Access denied to namespace {namespace}"}), 403
            return jsonify({"error": f"Failed to load deployments: {stderr[:200]}"}), 500

        data = json.loads(r.stdout)

        deployments = []
        for item in data.get("items", []):
            meta = item.get("metadata", {})
            spec = item.get("spec", {})
            status = item.get("status", {})

            containers = ((spec.get("template", {}) or {}).get("spec", {}) or {}).get("containers", []) or []
            image = containers[0].get("image", "") if containers else "N/A"

            version = (meta.get("labels", {}) or {}).get("version", "N/A")
            if version == "N/A" and ":" in image:
                version = image.split(":")[-1]

            desired = spec.get("replicas", 0) or 0
            ready = status.get("readyReplicas", 0) or 0

            deployments.append({
                "name": meta.get("name", ""),
                "version": version,
                "replicas": f"{ready}/{desired}",
                "ready": (ready == desired and desired > 0),
                "createdAt": meta.get("creationTimestamp", ""),
                "image": image,
            })

        _cache_set(key, deployments)
        return jsonify(deployments)

    except Exception as e:
        return jsonify({"error": f"Failed to load deployments: {str(e)[:200]}"}), 500

# --------------------------------------------------
# API: pods
# --------------------------------------------------
@app.route("/api/pods")
@login_required
def api_pods():
    namespace = request.args.get("namespace", "").strip()
    deployment = request.args.get("deployment", "").strip()

    if not namespace:
        return jsonify({"error": "namespace parameter is required"}), 400

    sess_data = _session_get(g.session_id)
    dc = sess_data.get("dc", DEFAULT_DC)

    tokens = sess_data.get("cluster_tokens", {}) or {}
    if dc not in tokens:
        return jsonify({"error": f"Not authenticated to {dc}. Please switch cluster or re-login."}), 503

    kubeconfig = tokens[dc]["kubeconfig"]

    key = _cache_key(g.session_id, dc, "pods", namespace=namespace, name=deployment)
    cached = _cache_get(key)
    if cached is not None:
        return jsonify(cached)

    try:
        cmd = ["oc", "get", "pods", "-n", namespace, "-o", "json", "--kubeconfig", kubeconfig]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            return jsonify({"error": "Failed to load pods"}), 500

        data = json.loads(r.stdout)

        pods = []
        for item in data.get("items", []):
            meta = item.get("metadata", {}) or {}
            spec = item.get("spec", {}) or {}
            st = item.get("status", {}) or {}

            if deployment:
                owners = meta.get("ownerReferences", []) or []
                belongs = any(
                    ref.get("kind") == "ReplicaSet" and deployment in (ref.get("name", "") or "")
                    for ref in owners
                )
                if not belongs:
                    continue

            phase = st.get("phase", "Unknown")
            container_statuses = st.get("containerStatuses", []) or []
            is_running = phase == "Running" and all(cs.get("ready", False) for cs in container_statuses)
            restarts = sum(cs.get("restartCount", 0) for cs in container_statuses)

            pods.append({
                "name": meta.get("name", ""),
                "status": phase,
                "ready": bool(is_running),
                "restarts": restarts,
                "age": meta.get("creationTimestamp", ""),
                "node": spec.get("nodeName", "N/A"),
                "cluster": DATA_CENTERS[dc]["name"],
            })

        _cache_set(key, pods)
        return jsonify(pods)

    except Exception as e:
        return jsonify({"error": f"Failed to load pods: {str(e)[:200]}"}), 500

# --------------------------------------------------
# API: namespaces
# --------------------------------------------------
@app.route("/api/namespaces")
@login_required
def api_namespaces():
    sess_data = _session_get(g.session_id)
    dc = sess_data.get("dc", DEFAULT_DC)

    tokens = sess_data.get("cluster_tokens", {}) or {}
    if dc not in tokens:
        return jsonify({"error": f"Not authenticated to {dc}"}), 503

    kubeconfig = tokens[dc]["kubeconfig"]

    key = _cache_key(g.session_id, dc, "namespaces")
    cached = _cache_get(key)
    if cached is not None:
        return jsonify(cached)

    try:
        cmd = ["oc", "get", "namespaces", "-o", "json", "--kubeconfig", kubeconfig]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30, check=True)
        data = json.loads(r.stdout)

        namespaces = []
        for item in data.get("items", []):
            meta = item.get("metadata", {})
            namespaces.append({
                "name": meta.get("name", ""),
                "createdAt": meta.get("creationTimestamp", ""),
            })

        _cache_set(key, namespaces)
        return jsonify(namespaces)

    except Exception:
        return jsonify({"error": "Failed to load namespaces"}), 500

# --------------------------------------------------
# TLS startup logic
# --------------------------------------------------
def _has_tls_files():
    return os.path.exists(SSL_CERT_PATH) and os.path.exists(SSL_KEY_PATH)

if __name__ == "__main__":
    if PORT == 8443 and _has_tls_files():
        try:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(SSL_CERT_PATH, SSL_KEY_PATH)
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            print("Starting HTTPS on 0.0.0.0:8443")
            app.run(host="0.0.0.0", port=8443, debug=False, ssl_context=context)
        except Exception as e:
            print(f"TLS setup failed: {e}")
            print("Falling back to HTTP on 8080")
            app.run(host="0.0.0.0", port=8080, debug=False)
    else:
        print(f"Starting HTTP on 0.0.0.0:{PORT}")
        app.run(host="0.0.0.0", port=PORT, debug=False)
