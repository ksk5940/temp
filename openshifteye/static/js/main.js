/**
 * OpenShiftEye Dashboard JS
 * Fixes:
 * - 401 session-expired handling across all API calls (shows flash, redirects)
 * - DC/cluster switch uses AJAX, no full-page redirect → no login flicker
 * - Deployments loading error shows proper message, retries after DC switch
 * - Auth status polling stops when done or session expires
 * - Session timer countdown
 */

(function () {
  'use strict';

  // ---- State ----
  let currentProject = '';
  let currentDC = window.APP.currentDC;
  let authDone = window.APP.authDone;
  let timerSeconds = window.APP.timeRemaining;
  let authPollInterval = null;
  let timerInterval = null;
  let deploymentsPending = false;

  // ---- DOM refs (lazy) ----
  const $ = id => document.getElementById(id);
  const deploymentsBody = () => $('deploymentsBody');
  const deploymentsState = () => $('deploymentsState');
  const tableWrap = () => $('deploymentsTableWrap');

  // ---- Init ----
  document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    startTimer();
    if (!authDone) startAuthPoll();

    // Auto-dismiss flash messages after 6s
    document.querySelectorAll('.flash').forEach(el => {
      setTimeout(() => el.remove(), 6000);
    });

    // Restore selected project from sessionStorage (survives DC switch)
    const savedProject = sessionStorage.getItem('ose_project');
    if (savedProject) {
      // Will be restored after projects load
    }
  });

  // ---- Session timer ----
  function startTimer() {
    updateTimerDisplay();
    timerInterval = setInterval(() => {
      timerSeconds = Math.max(0, timerSeconds - 1);
      updateTimerDisplay();
      if (timerSeconds === 0) {
        clearInterval(timerInterval);
        showFlash('Session expired. Please log in again.', 'danger');
        setTimeout(() => { window.location.href = '/login'; }, 2000);
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const el = $('timerDisplay');
    if (!el) return;
    const h = Math.floor(timerSeconds / 3600);
    const m = Math.floor((timerSeconds % 3600) / 60);
    const s = timerSeconds % 60;
    el.textContent = h > 0
      ? `${h}h ${String(m).padStart(2,'0')}m`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  // ---- Auth status polling ----
  function startAuthPoll() {
    if (authPollInterval) return;
    authPollInterval = setInterval(pollAuthStatus, 3000);
  }

  async function pollAuthStatus() {
    try {
      const res = await apiFetch('/api/auth-status');
      if (!res.ok) { stopAuthPoll(); return; }
      const data = await res.json();

      // Update progress bar
      const fill = $('authProgressFill');
      const count = $('authCountDisplay');
      if (fill) fill.style.width = `${Math.round((data.ok / data.total) * 100)}%`;
      if (count) count.textContent = `${data.ok}/${data.total}`;

      if (data.done) {
        stopAuthPoll();
        authDone = true;
        const bar = $('authProgressBar');
        if (bar) { bar.style.transition = 'opacity 0.5s'; bar.style.opacity = '0'; setTimeout(() => bar.remove(), 500); }

        // Update DC label in case current DC changed
        if (data.current_dc) {
          currentDC = data.current_dc;
          updateDCUI(currentDC);
        }
      }
    } catch (_) { /* network error, keep polling */ }
  }

  function stopAuthPoll() {
    if (authPollInterval) { clearInterval(authPollInterval); authPollInterval = null; }
  }

  // ---- API fetch wrapper - handles 401 session expiry ----
  async function apiFetch(url, opts) {
    try {
      const res = await fetch(url, { credentials: 'same-origin', ...opts });
      if (res.status === 401) {
        handleSessionExpired();
        return res;
      }
      return res;
    } catch (err) {
      throw err;
    }
  }

  function handleSessionExpired() {
    stopAuthPoll();
    if (timerInterval) { clearInterval(timerInterval); }
    showFlash('Session expired. Redirecting to login...', 'danger');
    setTimeout(() => { window.location.href = '/login'; }, 2000);
  }

  // ---- Flash messages ----
  function showFlash(msg, type = 'danger') {
    const container = $('flashContainer');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `flash flash-${type}`;
    div.innerHTML = `${msg} <button onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(div);
    setTimeout(() => div.remove(), 6000);
  }

  // ---- Load projects ----
  async function loadProjects() {
    try {
      const res = await apiFetch(`/api/projects`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showDeploymentsState(data.error || 'Failed to load projects');
        return;
      }
      const projects = await res.json();
      if (!Array.isArray(projects)) {
        showDeploymentsState('Failed to load projects');
        return;
      }

      const sel = $('projectSelect');
      sel.innerHTML = '<option value="">— Select a Project —</option>';
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.displayName || p.name;
        sel.appendChild(opt);
      });

      // Restore saved project
      const saved = sessionStorage.getItem('ose_project');
      if (saved && projects.find(p => p.name === saved)) {
        sel.value = saved;
        loadDeployments(saved);
      }

      setLastUpdated();
    } catch (err) {
      showDeploymentsState('Network error loading projects');
    }
  }

  // ---- Project change ----
  window.onProjectChange = function () {
    const sel = $('projectSelect');
    currentProject = sel.value;
    if (!currentProject) {
      sessionStorage.removeItem('ose_project');
      showDeploymentsPlaceholder();
      return;
    }
    sessionStorage.setItem('ose_project', currentProject);
    loadDeployments(currentProject);
  };

  // ---- Load deployments ----
  async function loadDeployments(namespace) {
    if (!namespace) return;
    if (deploymentsPending) return;
    deploymentsPending = true;

    showDeploymentsLoading();
    setRefreshBtnState(true);

    try {
      const res = await apiFetch(`/api/deployments?namespace=${encodeURIComponent(namespace)}`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // FIX: Show proper error for 503 (cluster not authenticated) vs other errors
        if (res.status === 503) {
          showDeploymentsState(`Cluster ${currentDC} is not yet authenticated. Please wait or switch cluster.`);
        } else if (res.status === 403) {
          showDeploymentsState(data.error || 'Access denied to this namespace.');
        } else {
          showDeploymentsState(data.error || 'Failed to load deployments.');
        }
        return;
      }

      if (!Array.isArray(data)) {
        showDeploymentsState('Failed to load deployments.');
        return;
      }

      renderDeployments(data);
      setLastUpdated();
    } catch (err) {
      showDeploymentsState('Network error. Please try again.');
    } finally {
      deploymentsPending = false;
      setRefreshBtnState(false);
    }
  }

  function renderDeployments(deployments) {
    const tbody = deploymentsBody();
    tbody.innerHTML = '';

    $('deploymentCount').textContent = deployments.length;

    if (deployments.length === 0) {
      deploymentsState().innerHTML = '<div class="state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div><p>No deployments found in this project.</p>';
      deploymentsState().style.display = '';
      tableWrap().style.display = 'none';
      return;
    }

    deploymentsState().style.display = 'none';
    tableWrap().style.display = '';

    deployments.forEach(dep => {
      const tr = document.createElement('tr');
      const statusClass = dep.ready ? 'status-running' : 'status-not-running';
      const statusText = dep.ready ? 'RUNNING' : 'NOT RUNNING';
      const dateStr = dep.createdAt ? formatDate(dep.createdAt) : '—';

      tr.innerHTML = `
        <td class="row-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </td>
        <td>
          <button class="dep-name-btn" onclick="openPodsModal('${escHtml(dep.name)}', '${escHtml(currentProject)}')">
            ${escHtml(dep.name)}
          </button>
        </td>
        <td><span class="version-tag" title="${escHtml(dep.version)}">${escHtml(dep.version)}</span></td>
        <td><span class="status-pill ${statusClass}">${statusText}</span></td>
        <td><span class="replicas-text">${escHtml(dep.replicas)}</span></td>
        <td><span class="image-text" title="${escHtml(dep.image)}">${escHtml(dep.image)}</span></td>
        <td><span class="date-text">${dateStr}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ---- Refresh ----
  window.refreshDeployments = function () {
    if (!currentProject) { showFlash('Please select a project first.', 'warning'); return; }
    // Clear cache by reloading
    deploymentsPending = false;
    loadDeployments(currentProject);
  };

  // ---- DC / Cluster switch ----
  window.switchDC = async function (dc) {
    if (dc === currentDC) return;

    showDCSwitchOverlay(`Switching to ${dc}...`);
    setDCBtnState(true);

    try {
      const res = await apiFetch(`/switch-dc/${encodeURIComponent(dc)}`);
      const data = await res.json().catch(() => ({}));

      if (res.status === 202) {
        // Pending authentication
        showFlash(data.message || 'Cluster authentication in progress. Please wait...', 'warning');
        hideDCSwitchOverlay();
        setDCBtnState(false);
        return;
      }

      if (!res.ok) {
        showFlash(data.message || data.error || 'Failed to switch cluster.', 'danger');
        hideDCSwitchOverlay();
        setDCBtnState(false);
        return;
      }

      // FIX: Update UI without full page reload - this is the key fix for the login redirect bug
      currentDC = dc;
      updateDCUI(dc);
      hideDCSwitchOverlay();
      setDCBtnState(false);

      // Reload deployments for new cluster
      if (currentProject) {
        deploymentsPending = false;
        loadDeployments(currentProject);
      }

      // Reload projects for new cluster (they may differ)
      await loadProjects();

    } catch (err) {
      showFlash('Network error switching cluster.', 'danger');
      hideDCSwitchOverlay();
      setDCBtnState(false);
    }
  };

  function updateDCUI(dc) {
    const clusterName = $('clusterName');
    const currentDCLabel = $('currentDCLabel');
    if (clusterName) clusterName.textContent = dc.split('-')[0];
    if (currentDCLabel) currentDCLabel.textContent = dc;

    // Update GL/SL toggle active state
    const parts = dc.split('-');
    const suffix = parts[parts.length - 1];
    document.querySelectorAll('.dc-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === suffix);
    });
  }

  function setDCBtnState(disabled) {
    document.querySelectorAll('.dc-btn').forEach(btn => btn.disabled = disabled);
  }

  function showDCSwitchOverlay(msg) {
    const overlay = $('dcSwitchOverlay');
    const msgEl = $('dcSwitchMsg');
    if (overlay) { overlay.style.display = 'flex'; }
    if (msgEl) msgEl.textContent = msg || 'Switching cluster...';
  }

  function hideDCSwitchOverlay() {
    const overlay = $('dcSwitchOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  // ---- Pods modal ----
  window.openPodsModal = async function (deploymentName, namespace) {
    const modal = $('podsModal');
    const titleEl = $('podsModalTitle');
    const loading = $('podsLoading');
    const table = $('podsTable');
    const empty = $('podsEmpty');

    modal.classList.add('open');
    titleEl.textContent = deploymentName;
    loading.style.display = 'flex';
    table.style.display = 'none';
    empty.style.display = 'none';

    try {
      const res = await apiFetch(`/api/pods?namespace=${encodeURIComponent(namespace)}&deployment=${encodeURIComponent(deploymentName)}`);
      const pods = await res.json().catch(() => []);

      loading.style.display = 'none';

      if (!res.ok || !Array.isArray(pods)) {
        empty.querySelector && (empty.innerHTML = '<p>Failed to load pods.</p>');
        empty.style.display = '';
        return;
      }

      if (pods.length === 0) {
        empty.style.display = '';
        return;
      }

      renderPods(pods);
      table.style.display = '';
    } catch (err) {
      loading.style.display = 'none';
      empty.style.display = '';
    }
  };

  function renderPods(pods) {
    const tbody = $('podsBody');
    tbody.innerHTML = '';
    pods.forEach(pod => {
      const tr = document.createElement('tr');
      const statusClass = pod.ready ? 'status-running' : 'status-not-running';
      const statusText = pod.ready ? 'RUNNING' : pod.status;
      const dateStr = pod.age ? formatDate(pod.age) : '—';
      tr.innerHTML = `
        <td class="row-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </td>
        <td class="dep-name">${escHtml(pod.name)}</td>
        <td><span class="version-tag">${escHtml(pod.cluster || currentDC)}</span></td>
        <td><span class="status-pill ${statusClass}">${statusText}</span></td>
        <td><span class="replicas-text">${pod.restarts}</span></td>
        <td><span class="image-text" title="${escHtml(pod.node)}">${escHtml(pod.node)}</span></td>
        <td><span class="date-text">${dateStr}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  window.closePodsModal = function (event) {
    if (event && event.target !== $('podsModal')) return;
    $('podsModal').classList.remove('open');
  };

  // Keyboard close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $('podsModal').classList.remove('open');
  });

  // ---- Helpers ----
  function showDeploymentsPlaceholder() {
    deploymentsState().innerHTML = `
      <div class="state-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
      </div>
      <p>Select a project to view deployments</p>`;
    deploymentsState().style.display = '';
    tableWrap().style.display = 'none';
    $('deploymentCount').textContent = '0';
  }

  function showDeploymentsLoading() {
    deploymentsState().innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <span>Loading deployments...</span>
      </div>`;
    deploymentsState().style.display = '';
    tableWrap().style.display = 'none';
  }

  function showDeploymentsState(msg) {
    deploymentsState().innerHTML = `
      <div class="state-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p>${escHtml(msg)}</p>`;
    deploymentsState().style.display = '';
    tableWrap().style.display = 'none';
    $('deploymentCount').textContent = '0';
  }

  function setRefreshBtnState(loading) {
    const btn = $('refreshBtn');
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading
      ? '<span class="spinner" style="border-color:rgba(255,255,255,0.3);border-top-color:white"></span> Loading...'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Refresh';
  }

  function setLastUpdated() {
    const el = $('lastUpdatedTime');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString();
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
    } catch (_) { return iso; }
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();
