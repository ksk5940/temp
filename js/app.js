'use strict';

/* ══════════════════════════════════
   BARCLAYS BRAND CONFIG
══════════════════════════════════ */
var BRAND = {
  // Alignment offset: Barclays SVG left-edge matches "GitLab Orchestrator" title text in logo-full.png
  // logo-full.png = [icon ~32px][gap ~10px][title text]  → offset ≈ 42px
  offsets: { sm: '34px', md: '42px', lg: '60px' }
};


/* ============================
   FAVICON
============================ */
function faviconSVG(type){
  // Hero section uses: 38x38px box, border-radius:10px, icon size 20px (centred)
  // Favicon is 32x32. We reproduce those exact proportions:
  //   - box fills 32x32, rx = round(10/38*32) ≈ 8
  //   - icon occupies 20/38 of the box ≈ 16.8px → we use translate(7.6,7.6) on a 24-unit path
  //     so 24 units maps to 16.8px: scale = 16.8/24 = 0.7
  //   - centred: offset = (32 - 16.8) / 2 = 7.6
  var glP = 'M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0c.06.05.1.11.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0c.06.05.1.11.11.18l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.92z';
  var sc = 0.7, off = 7.6; // icon scale & offset to centre 16.8px icon in 32px box

  if(type==='gitlab'){
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
      +'<defs><linearGradient id="glg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7b39"/><stop offset="1" stop-color="#e8590c"/></linearGradient></defs>'
      +'<rect width="32" height="32" rx="8" fill="url(#glg)"/>'
      +'<g transform="translate('+off+','+off+') scale('+sc+')"><path d="'+glP+'" fill="#ffffff"/></g>'
      +'</svg>';
  }
  // Home/login: two mini hero-boxes side by side with "+" between them
  // Each box: 13px wide, full height, same styling as hero but half-sized
  // icon scale inside each mini-box: hero icon is 20/38 of box → same ratio of 12px / 13px ≈ 0.38
  //   mini icon = 24 * 0.37 ≈ 8.9px, centred in 13px wide box: offset x = (13-8.9)/2 = 2.05
  //   full height 28px, centred y: (28-8.9)/2 = 9.55
  var ms = 0.37, bw = 13, bh = 28, bt = 2;
  var mix = bw*ms*0.5, miy = (bh - 24*ms)/2;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
    // left GitLab box  (x=1)
    +'<rect x="1" y="'+bt+'" width="'+bw+'" height="'+bh+'" rx="4" fill="rgba(252,109,38,0.12)"/>'
    +'<rect x="1" y="'+bt+'" width="'+bw+'" height="'+bh+'" rx="4" fill="none" stroke="rgba(252,109,38,0.30)" stroke-width="0.8"/>'
    +'<g transform="translate('+(1+(bw-24*ms)/2)+','+(bt+miy)+') scale('+ms+')"><path d="'+glP+'" fill="#fc6d26"/></g>'
    // "+" in the 4px gap between boxes (x=14..18)
    +'<text x="16" y="18" text-anchor="middle" font-size="5" fill="#a0a8c0" font-family="system-ui,sans-serif" font-weight="800">+</text>'
    +'<rect x="18" y="'+bt+'" width="'+bw+'" height="'+bh+'" rx="4" fill="rgba(36,41,46,0.07)"/>'
    +'<rect x="18" y="'+bt+'" width="'+bw+'" height="'+bh+'" rx="4" fill="none" stroke="rgba(36,41,46,0.15)" stroke-width="0.8"/>'
    +'</svg>';
}

function updateFavicon(){
  // Favicon is set via <link> tags in <head> — nothing to update dynamically
}

/* ============================
   SESSION PERSISTENCE (1-hour TTL)
============================ */
var SESSION_KEY = 'pipeline_runner_session';
var SESSION_TTL = 60 * 60 * 1000; // 1 hour in ms

function saveSession(isLogin){
  try {
    // IMPORTANT: preserve the original login timestamp — never reset it.
    // This ensures the 1-hour TTL counts from login, not from last save.
    var existing = null;
    if(!isLogin){
      try { var raw = sessionStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY); if(raw) existing = JSON.parse(raw); } catch(e){}
    }
    var loginTs = (!isLogin && existing && existing.loginTs) ? existing.loginTs : Date.now();

    var data = {
      loginTs: loginTs,          // immutable — set once at login
      ts: Date.now(),            // last-save time (for staleness checks)
      provider: S.provider,
      theme: S.theme,
      currentPage: S.currentPage,
      // GitLab
      glUrl: S.glUrl,
      glToken: S.glToken,
      glUser: S.glUser,
      glSelProjId: S.glSelProj ? S.glSelProj.id : null,
      glBranch: S.glBranch,
      glAccessLevel: S.glAccessLevel,
      glSelPipelineId: S.glSelPipeline ? S.glSelPipeline.id : null,
      glParamVals: S.glParamVals,
      glShowGraph: S.glShowGraph,
      glHideOptional: S.glHideOptional,
      glShowDefaults: S.glShowDefaults,
      // Dashboard
      dashRange: S.dashRange,
      // UI state
      logJobId: S.logJob ? S.logJob.id : null,
      logExpanded: S.logExpanded
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch(e) {}
}


function loadSession(){
  try {
    var raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if(!raw) return null;
    var data = JSON.parse(raw);
    if(!data) return null;
    // Use loginTs for strict TTL; fall back to ts for old sessions
    var loginTs = data.loginTs || data.ts;
    if(!loginTs) return null;
    if(Date.now() - loginTs > SESSION_TTL){
      clearSession();
      return null;
    }
    data.loginTs = loginTs; // normalise
    return data;
  } catch(e) { return null; }
}

// Returns ms remaining in session, or 0 if expired/none
function sessionMsRemaining(){
  try {
    var raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if(!raw) return 0;
    var data = JSON.parse(raw);
    if(!data) return 0;
    var loginTs = data.loginTs || data.ts;
    if(!loginTs) return 0;
    return Math.max(0, SESSION_TTL - (Date.now() - loginTs));
  } catch(e){ return 0; }
}

function clearSession(){
  try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch(e) {}
}

/* ============================
   STATE
============================ */
var S = {
  theme: 'light',
  provider: 'gitlab',   // locked: gitlab-only
  // GitLab
  glUrl: (function(){ try { return localStorage.getItem('pipeline_runner_gl_url') || 'https://app.gitlab.barcapint.com'; } catch(e){ return 'https://gitlab.com'; } })(),
  glToken: '',
  glUser: null,
  glProjects: [],
  glSelProj: null,
  glAccessLevel: null,
  glBranch: '',
  glVarPermError: false,  // true when GitLab rejects variable-passing due to project restriction
  glHideOptional: false,  // permanently hide optional CI input vars (persisted across loads)
  glShowDefaults: false,  // show YAML default values inline (eye icon)
  glBranchInfo: null,
  glCiVars: [],
  glParamVals: {},
  glAdhoc: [],
  glRuns: [],
  glSelPipeline: null,
  glPipelineStageOrder: [],
  glProjectStageOrder: [],  // YAML stage order from .gitlab-ci.yml — cached per project
  glCiInputVars: [],        // Required input vars parsed from .gitlab-ci.yml scripts
  glPipelineJobs: [],
  glBranchSugs: [],
  glShowDrop: false,
  glAllBranches: [],
  // Shared
  currentPage: 'login',  // login|run|history|dashboard|log
  projSearch: '',
  logJob: null,
  logLines: [],
  logFilter: '',
  logMatchIdx: 0,
  glShowGraph: false,
  logExpanded: false,
  logAutoScroll: true,
  dashRange: 30,
  dashData: null,
  glDownstreamPipelines: [],  // downstream pipelines triggered by current pipeline
  glUpstreamPipeline: null,   // upstream pipeline that triggered current pipeline
  loading: {auth:false,projects:false,branch:false,trigger:false,jobs:false,logs:false,pipelines:false,dash:false,wf:false},
  // Settings
  settingsOpen: false,
  pinnedRepos: [],   // array of repo/project ids that are pinned to top
  hiddenRepos: [],   // array of repo/project ids that are hidden
  reqBranch: '',     // kept for backward compat but no longer exposed in UI
  starredRepos: [],  // array of starred repo ids (show only these + pinned if sidebarStarFilter)
  repoBranches: {},  // per-project branch arrays: { "projectId": ["branch1","branch2"] }
  projBranchCache: {},   // per-project branch name lists: { "projectId": ["main","dev",...] }
  settingsBranchSugs: {}, // per-project autocomplete suggestions for the settings input: { "projectId": [] }
  settingsProjQ: '',  // project search filter in settings panel
  sidebarIdx: -1,        // keyboard-focused index in the sidebar project list (-1 = none)
  projOrder: [],         // custom sort order: array of project IDs (persisted)
  reorderSelIdx: -1,     // index of entry currently selected for reordering via Ctrl+↑↓ (-1 = none)
  sidebarPinFilter: false,  // show only pinned projects
  sidebarStarFilter: false, // show only starred (required) projects

  sidebarCollapsed: false, // sidebar collapsed to icon-only rail
  sidebarPinned: false,    // if true, sidebar stays collapsed even without hover
  histSidebarPinned: false, // if true, histSidebar width persists on refresh
  histSidebarOpen: false,   // history sidebar expanded or not
  histSidebarWidth: 240,    // last used width in px

  // Managed projects — only these appear in sidebar and settings
  // Each: {id, name, ns, webUrl, provider, fullName}
  managedProjects: [],
  // Per-project disabled variable keys: { "projId": ["VAR_KEY1", "VAR_KEY2"] }
  glVarDisabled: {},
  // Settings panel live-search state
  stgSearchQ: '',       // current search query in settings add-project box
  stgSearchRes: [],     // search results from API
  stgSearching: false,  // loading indicator
  // Job run history drawer
  glJobRunHistory: {},  // { jobName: [run, run, ...] } — accumulated across pipelines
  jobHistoryOpen: null  // jobName currently shown in history drawer, or null
};
// Track which required fields the user has interacted with (touched)
var glInputTouched = new Set();
// Dashboard load generation — incremented every time a new load is initiated.
// loadDashData captures it at start and checks at end; stale runs are discarded.
var _dashGen = 0;
var dashCharts = [];
var logPollTimer = null;
var pipelinePollTimer = null;
var sessionTimerInterval = null;

/* ============================
   UTILS
============================ */
function el(id){ return document.getElementById(id); }
var _toastTimers = {};
function toast(msg, type){
  type = type||'ok';
  var key = type + ':' + msg;
  // If same message+type is already visible, just reset its timer — don't add a second one
  if(_toastTimers[key]){
    clearTimeout(_toastTimers[key].timer);
    _toastTimers[key].timer = setTimeout(function(){
      var existing = _toastTimers[key];
      if(existing){
        existing.el.style.opacity='0';
        existing.el.style.transform='translateY(-6px)';
        setTimeout(function(){ if(existing.el.parentNode) existing.el.remove(); }, 220);
        delete _toastTimers[key];
      }
    }, 3500);
    return;
  }
  var d = document.createElement('div');
  d.className = 'toast t-'+type;
  d.style.cssText = 'transition:opacity .22s,transform .22s';
  var icons = {ok:icoCheck(),err:icoX(),info:icoInfo()};
  d.innerHTML = (icons[type]||'') + '<span>' + msg + '</span>';
  el('toasts').appendChild(d);
  var timer = setTimeout(function(){
    d.style.opacity='0';
    d.style.transform='translateY(-6px)';
    setTimeout(function(){ if(d.parentNode) d.remove(); }, 220);
    delete _toastTimers[key];
  }, 3500);
  _toastTimers[key] = {el:d, timer:timer};
}
function setLoad(k,v){ S.loading[k]=v; }
function goTo(page){
  hideAllTips();
  S.currentPage=page; saveSession();
  // If sidebar already exists, only swap main content + update nav — avoids timer blink
  var mainCol=document.querySelector('.main-col');
  if(mainCol){
    updateFavicon();
    dashCharts.forEach(function(c){try{c.destroy();}catch{}}); dashCharts=[];
    var titles={run:'Run pipeline',history:'Run history',dashboard:'Dashboard'};
    var pageHtml='';
    if(page==='run') pageHtml=renderGLRun();
    else if(page==='history') pageHtml=renderGLHistory();
    else if(page==='dashboard') pageHtml=renderDashboard();
    mainCol.innerHTML=renderTopbar(titles[page]||'')+'<div class="page-wrap">'+pageHtml+'</div>';
    // Update nav active states in sidebar without re-rendering it
    document.querySelectorAll('.sb-item').forEach(function(btn){
      var m=btn.getAttribute('onclick').match(/goTo\('(\w+)'\)/);
      if(m) btn.classList.toggle('active', m[1]===page);
    });
    // ── Strict fresh data load on every navigation ──
    if(page==='history'){
      // Always fetch latest pipelines — never serve stale cache
      if(S.glSelProj) loadGLPipelines();
    }
    if(page==='dashboard'){
      // Always reload dashboard data — reset stale cache first so loading spinner shows
      var proj=S.glSelProj;
      if(proj){
        S.dashData=null;  // clear stale data so renderDashboard shows loading state
        loadDashData();
      }
    }
    if(S.logJob){ var ov=el('log-overlay'); if(ov) ov.remove(); renderLogOverlay(); }
  } else {
    render();
  }
}
function _handleAuthError(status){
  if(status === 401 || status === 403){
    toast('Token revoked or expired — signing out', 'err');
    setTimeout(function(){ signOut(); }, 1200);
    throw new Error('AUTH_REVOKED');
  }
}

/* ── Unified API call helper ── */
function apiCall(provider, path, opts, asText){
  opts = opts || {};
  if(provider === 'gitlab'){
    var url = S.glUrl.replace(/\/+$/,'') + '/api/v4' + path;
    var headers = {'PRIVATE-TOKEN': S.glToken};
    if(!asText) headers['Content-Type'] = 'application/json';
    return fetch(url, {headers: headers, method: opts.method||'GET', body: opts.body||undefined, signal: opts.signal||undefined})
      .then(function(r){
        _handleAuthError(r.status);
        if(!r.ok){
          return r.text().then(function(body){
            var msg = r.status+' '+r.statusText;
            try{
              var j=JSON.parse(body);
              var detail='';
              if(j.message){
                if(typeof j.message==='string') detail=j.message;
                else if(Array.isArray(j.message)) detail=j.message.join('; ');
                else if(typeof j.message==='object'){
                  // { base: ["err1","err2"] } or { field: ["err"] }
                  var parts=[];
                  Object.keys(j.message).forEach(function(k){ var v=j.message[k]; parts.push(Array.isArray(v)?v.join(', '):String(v)); });
                  detail=parts.join('; ');
                }
              } else if(j.error_description){ detail=j.error_description; }
              else if(j.error){ detail=Array.isArray(j.error)?j.error.join('; '):String(j.error); }
              if(detail) msg+=' — '+detail;
              else if(body.trim()) msg+=' — '+body.slice(0,300);
            }catch(e){ if(body&&body.trim()) msg+=' — '+body.slice(0,300); }
            throw new Error(msg);
          });
        }
        return asText ? r.text() : r.json();
      });
  }
}
function glApi(path, opts){ return apiCall('gitlab', path, opts); }
function glApiText(path){ return apiCall('gitlab', path, {}, true); }
// GitLab-only build; pages routed exclusively through renderGLHistory and renderGLRun

function timeAgo(ts){
  if(!ts) return '—';
  var s = Math.floor((Date.now()-new Date(ts))/1000);
  if(s<60) return s+'s ago';
  if(s<3600) return Math.floor(s/60)+'m ago';
  if(s<86400) return Math.floor(s/3600)+'h ago';
  return Math.floor(s/86400)+'d ago';
}
function dur(a,b){
  if(!a) return '—';
  var s=Math.floor((new Date(b||Date.now())-new Date(a))/1000);
  if(s<60) return s+'s';
  return Math.floor(s/60)+'m '+s%60+'s';
}
function fmtDur(s){ if(!s||s<0) return '—'; s=Math.round(s); if(s<60) return s+'s'; if(s<3600) return Math.floor(s/60)+'m '+s%60+'s'; return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m '+s%60+'s'; }
function fmtDateTime(ts){
  if(!ts) return '';
  try {
    var d = new Date(ts);
    var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate()+' '+months[d.getMonth()]+' '+d.getFullYear()+' '+
      String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0');
  } catch(e){ return ''; }
}

/* ============================
   STATUS HELPERS
============================ */
var ST = {
  success:  {c:'var(--gr)',bg:'var(--grB)',b:'var(--grL)'},
  passed:   {c:'var(--gr)',bg:'var(--grB)',b:'var(--grL)'},
  failed:   {c:'var(--re)',bg:'var(--reB)',b:'var(--reL)'},
  failure:  {c:'var(--re)',bg:'var(--reB)',b:'var(--reL)'},
  running:  {c:'var(--am)',bg:'var(--amB)',b:'var(--amL)'},
  in_progress:{c:'var(--am)',bg:'var(--amB)',b:'var(--amL)'},
  pending:  {c:'var(--am)',bg:'var(--amB)',b:'var(--amL)'},
  queued:   {c:'var(--am)',bg:'var(--amB)',b:'var(--amL)'},
  waiting:  {c:'var(--am)',bg:'var(--amB)',b:'var(--amL)'},
  canceled: {c:'var(--t3)',bg:'var(--bg3)',b:'var(--bd)'},
  cancelled:{c:'var(--t3)',bg:'var(--bg3)',b:'var(--bd)'},
  skipped:  {c:'var(--t3)',bg:'var(--bg3)',b:'var(--bd)'},
  created:  {c:'var(--bl)',bg:'var(--blB)',b:'var(--blL)'},
  completed:{c:'var(--gr)',bg:'var(--grB)',b:'var(--grL)'},
  action_required:{c:'var(--am)',bg:'var(--amB)',b:'var(--amL)'},
  neutral:  {c:'var(--t3)',bg:'var(--bg3)',b:'var(--bd)'},
  timed_out:{c:'var(--re)',bg:'var(--reB)',b:'var(--reL)'},
  stale:    {c:'var(--t3)',bg:'var(--bg3)',b:'var(--bd)'},
};
function stDot(st,sz){
  sz=sz||7;
  var s=ST[st]||ST.canceled;
  return '<span class="dot'+(st==='running'||st==='in_progress'?' dot-run':'')+'" style="width:'+sz+'px;height:'+sz+'px;background:'+s.c+'"></span>';
}
function stBadge(st){
  var s=ST[st]||ST.canceled;
  return '<span class="mono badge" style="font-size:9px;padding:2px 7px;background:'+s.bg+';color:'+s.c+';border:1px solid '+s.b+'">'+st+'</span>';
}
function stBadgeLg(st){
  var s=ST[st]||ST.canceled;
  var labels={success:'Success',passed:'Success',failed:'Failed',failure:'Failed',canceled:'Cancelled',cancelled:'Cancelled',running:'Running',in_progress:'Running',pending:'Pending',queued:'Pending',skipped:'Skipped',created:'Created',manual:'Manual',timed_out:'Timed out'};
  var icons={success:'✓',passed:'✓',failed:'✗',failure:'✗',canceled:'–',cancelled:'–',running:'◌',in_progress:'◌',pending:'…',timed_out:'✗'};
  var label=labels[st]||st;
  var icon=icons[st]||'';
  return '<span class="st-badge-lg" style="background:'+s.bg+';color:'+s.c+';border-color:'+s.b+'">'+(icon?'<span style="font-size:10px">'+icon+'</span> ':'')+label+'</span>';
}

/* Accumulate job run history from the currently loaded pipeline jobs */
function accumulateJobRunHistory(){
  if(!S.glPipelineJobs||!S.glPipelineJobs.length||!S.glSelPipeline) return;
  var pid=S.glSelPipeline.id;
  // Group jobs by name — within a pipeline the same job may appear multiple times
  // when retried (GitLab returns all attempts; j.retried=true on superseded ones).
  // We store ALL attempts so the Nx badge shows accurate per-pipeline retry count.
  S.glPipelineJobs.forEach(function(j){
    var key=j.name;
    if(!S.glJobRunHistory[key]) S.glJobRunHistory[key]=[];
    var alreadyHas=S.glJobRunHistory[key].some(function(r){return r.jobId===j.id;});
    if(!alreadyHas){
      S.glJobRunHistory[key].unshift({jobId:j.id,pipelineId:pid,pipelineRef:S.glSelPipeline.ref||'',status:j.status,started_at:j.started_at,finished_at:j.finished_at,user:j.user,duration:j.duration,retried:j.retried||false});
    }
  });
}


/* ============================
   ANSI PARSER
============================ */
var ANSI={'30':'#607080','31':'var(--re)','32':'var(--gr)','33':'var(--am)','34':'var(--bl)','35':'#c084fc','36':'var(--bl)','37':'var(--t1)','90':'var(--t3)','91':'#f87171','92':'#6ee7b7','93':'#fcd34d','1':null,'0':null};
function cleanRawLine(raw){
  if(!raw) return '';
  // 1. Strip null bytes (GitLab streaming framing)
  raw = raw.replace(/\x00/g, '');
  // 2. Strip GitLab trace format: ISO timestamp + stream flags
  //    Format: "2026-05-10T00:34:16.277955Z 000 content"
  //    Must match the FULL ISO timestamp before touching any digits, otherwise
  //    we accidentally eat the year digits (e.g. "2026" → "6-05-10T...").
  var isoTraceRe = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?\s*\d*\s*/;
  if(isoTraceRe.test(raw)){
    raw = raw.replace(isoTraceRe, '');
  } else {
    // Only strip leading stream-flag digits when there is NO ISO prefix
    // Guard: don't strip if next char after digits is '-' (would be a date separator)
    raw = raw.replace(/^\d{1,3}(?!-)/, '');
  }
  // Strip GitLab stream-type flags: O, O+, E, E+, S, S+ (appear after timestamp removal)
  // The flag may be followed by a space OR immediately by text (e.g. "O+Preparing...")
  raw = raw.replace(/^(O\+|E\+|S\+|O|E|S) ?/, '');
  // Strip bare ANSI remnants without ESC prefix (e.g. "[0K" after stream flag removal)
  raw = raw.replace(/^\[\d*[A-Za-z]/, '');
  // 3. Strip ALL non-SGR ANSI escape sequences:
  //    \x1b[ ... (not ending in 'm') — cursor movement, erase-line ([K,[J), etc.
  raw = raw.replace(/\x1b\[[0-9;]*[A-LN-Z]/g, '');
  // 4. Strip OSC sequences: \x1b]...(\x07 or \x1b\\)
  raw = raw.replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '');
  // 5. Strip remaining bare ESC sequences (ESC + single char)
  raw = raw.replace(/\x1b[^[\]]/g, '');
  // 6. Strip carriage returns
  raw = raw.replace(/\r/g, '');
  return raw;
}

function parseAnsi(raw){
  // raw has already been cleaned by cleanRawLine at storage time,
  // but call it defensively here too for any paths that bypass storage cleaning.
  raw = cleanRawLine(raw);
  var parts=[],re=/\x1b\[([0-9;]*)m/g,last=0,col='var(--t1)',bold=false,m;
  while((m=re.exec(raw))!==null){
    if(m.index>last) parts.push({t:raw.slice(last,m.index),c:col,b:bold});
    m[1].split(';').forEach(function(c){
      if(c==='0'||c===''){col='var(--t1)';bold=false;}
      else if(c==='1') bold=true;
      else if(ANSI[c]) col=ANSI[c];
    });
    last=re.lastIndex;
  }
  if(last<raw.length) parts.push({t:raw.slice(last),c:col,b:bold});
  return parts;
}
function renderParts(parts,filter){
  return parts.map(function(p){
    if(!p.t) return '';
    var txt=p.t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if(filter&&txt.toLowerCase().includes(filter.toLowerCase())){
      var i=txt.toLowerCase().indexOf(filter.toLowerCase());
      txt=txt.slice(0,i)+'<mark class="hl">'+txt.slice(i,i+filter.length)+'</mark>'+txt.slice(i+filter.length);
    }
    return '<span style="color:'+p.c+';'+(p.b?'font-weight:600;':'')+'">' + txt + '</span>';
  }).join('');
}

/* ============================
   SVG ICONS
============================ */
function sv(d){ return '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">'+d+'</svg>'; }
function icoGitlab(sz,col){ sz=sz||16;col=col||'var(--or)'; return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 24 24" fill="'+col+'"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0c.06.05.1.11.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0c.06.05.1.11.11.18l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.92z"/></svg>'; }
function icoPlay(){ return sv('<polygon points="5 3 19 12 5 21 5 3"/>'); }
function icoHist(){ return sv('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'); }
function icoDash(){ return sv('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'); }
function icoBranch(){ return sv('<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>'); }
function icoRefresh(){ return sv('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'); }
function icoCheck(){ return sv('<polyline points="20 6 9 17 4 12"/>'); }
function icoX(){ return sv('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'); }
function icoInfo(){ return sv('<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'); }
function icoLock(){ return sv('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'); }
function icoOut(){ return sv('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'); }
function icoExt(){ return sv('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'); }
function icoSearch(){ return sv('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'); }
function icoStage(){ return sv('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'); }
function icoCR(){ return sv('<polyline points="9 18 15 12 9 6"/>'); }
function icoDl(){ return sv('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'); }
function icoSD(){ return sv('<polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/>'); }
function icoExpand(){ return sv('<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>'); }
function icoCollapse(){ return sv('<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>'); }
function icoSun(){ return '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'; }
function icoMoon(){ return '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'; }
function icoSpin(){ return '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'; }
function icoWF(){ return sv('<path d="M12 3v4M12 17v4M4.22 6.22l2.83 2.83M16.95 16.95l2.83 2.83M3 12h4M17 12h4M4.22 17.78l2.83-2.83M16.95 7.05l2.83-2.83"/>'); }
function icoRepo(){ return sv('<path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 21V9"/>'); }
function icoKey(){ return sv('<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>'); }
function icoGear(sz){ sz=sz||14; return '<svg width="'+sz+'" height="'+sz+'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'; }
function icoPin(sz){ sz=sz||14; return '<svg width="'+sz+'" height="'+sz+'" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'; }
function icoEye(on){ return on ? sv('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>') : sv('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'); }

/* ============================
   SIDEBAR
============================ */
function renderSidebar(){
    var user = S.glUser;
  var selProj = S.glSelProj;
  // Use managedProjects for the current provider
  // Only show projects manually added by the user via Settings
  var allManaged = S.managedProjects.filter(function(p){ return p.provider === S.provider; });
  var projs = allManaged.map(function(p){
    return {id:p.id, name:p.name, namespace:{name:p.ns}, web_url:p.webUrl, path_with_namespace:p.fullName};
  });
  var filtered = projs.filter(function(p){
    // Apply star filter: if set, show starred + pinned
    if(S.sidebarStarFilter && S.starredRepos.indexOf(p.id) === -1 && S.pinnedRepos.indexOf(p.id) === -1) return false;
    // Apply pin filter
    if(S.sidebarPinFilter && S.pinnedRepos.indexOf(p.id) === -1) return false;
    var n = p.name||'';
    var ns = p.namespace?p.namespace.name:'';
    return n.toLowerCase().includes(S.projSearch.toLowerCase())||ns.toLowerCase().includes(S.projSearch.toLowerCase());
  });
  // Sort: custom order first, then pinned, then default
  filtered.sort(function(a,b){
    var ao = S.projOrder.indexOf(a.id);
    var bo = S.projOrder.indexOf(b.id);
    if(ao !== -1 && bo !== -1) return ao - bo;
    if(ao !== -1) return -1;
    if(bo !== -1) return 1;
    var ap = S.pinnedRepos.indexOf(a.id) !== -1 ? 0 : 1;
    var bp = S.pinnedRepos.indexOf(b.id) !== -1 ? 0 : 1;
    return ap - bp;
  });
  var avColor = '#fc6d26';
  var avBg = 'rgba(252,109,38,.15)';
  var isCol = S.sidebarCollapsed;
  return (
    '<div class="sidebar'+(isCol?' sb-collapsed':'')+'" id="main-sidebar" style="position:relative">' +

    // ── HEADER ──
    // Collapsed: just the SVG logo mark centered
    '<div class="sb-hd">' +

    '<div class="sb-show-on-col" style="width:100%;display:flex;align-items:center;justify-content:center">'+
    '<img src="assets/logo-icon-blue.svg" style="width:42px;height:42px;display:block;object-fit:contain" alt="GitLab Orchestrator"/>'+
    '</div>'+

    // Expanded: combined brand SVG (icon + Barclays + GitLab Orchestrator in one)
    '<div class="sb-logo sb-hide-on-col" style="width:100%;padding-right:10px">' +
    '<img src="assets/logo-brand-blue.svg" style="height:44px;width:auto;display:block;max-width:210px" alt="Barclays GitLab Orchestrator"/>'+
    '</div>'+

    '</div>'+ // end sb-hd

    '<div class="sb-nav">' +
    '<div class="sb-section sb-hide-on-col">Navigate</div>' +
    [['run','Run pipeline',icoPlay()],['history','Run history',icoHist()],['dashboard','Dashboard',icoDash()]].map(function(item){
      return '<button class="sb-item sb-tip'+(S.currentPage===item[0]?' active':'')+'" data-tip="'+item[1]+'" onmouseover="(function(el){var sb=document.getElementById(\'main-sidebar\');if(sb&&sb.classList.contains(\'sb-collapsed\'))showLogTip(el,el.getAttribute(\'data-tip\'));})(this)" onmouseout="hideLogTip()" onclick="goTo(\''+item[0]+'\')">' + item[2] + '<span>'+item[1]+'</span></button>';
    }).join('') +
    '</div>' +

    '<div class="sb-projs">' +
    // ── Collapsed icon rail (only shown when sidebar is collapsed) ──
    '<div class="sb-show-on-col" style="flex:1;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 2px;width:100%">'+
    (function(){
      return filtered.map(function(p){
        var name = p.name||'';
        var ns = p.namespace?p.namespace.name:'';
        var isPinned = S.pinnedRepos.indexOf(p.id) !== -1;
        var isReq = S.starredRepos.indexOf(p.id) !== -1;
        var isActive = selProj && selProj.id === p.id;
        var icoBg = isPinned ? 'background:var(--puG);color:var(--pu);' : isReq ? 'background:var(--amB);color:var(--am);' : '';
        var tip = name+(ns?' ('+ns+')':'');
        return '<div class="sb-proj-ico sb-tip" data-tip="'+tip+'" data-ltip="'+tip+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" onclick="selProject('+p.id+')" style="cursor:pointer;'+icoBg+(isActive?'outline:2px solid var(--pu);outline-offset:1px;':'')+'" >'+name[0].toUpperCase()+'</div>';
      }).join('');
    })()+
    '</div>'+
    // ── Expanded project list (hidden when collapsed) ──
    '<div class="sb-section sb-hide-on-col" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'+'Projects'+
    '<div style="display:flex;gap:3px;margin-left:auto">'+
    '<button data-ltip="Add project to sidebar" onmouseover="this.style.borderColor=\'var(--pu)\';this.style.color=\'var(--pu)\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.borderColor=\'var(--bd)\';this.style.color=\'var(--t3)\';hideLogTip()" onclick="toggleSettings()" style="width:20px;height:20px;border-radius:4px;border:1px solid var(--bd);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;color:var(--t3);font-size:15px;line-height:1;transition:all .15s">+</button>'+
    '<button data-ltip="Show pinned only" onmouseover="this.style.borderColor=\'var(--pu)\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="if(!'+S.sidebarPinFilter+')this.style.borderColor=\'var(--bd)\';hideLogTip()" onclick="S.sidebarPinFilter=!S.sidebarPinFilter;if(S.sidebarPinFilter)S.sidebarStarFilter=false;S.sidebarIdx=-1;reSide()" style="width:20px;height:20px;border-radius:4px;border:1px solid '+(S.sidebarPinFilter?'var(--pu)':'var(--bd)')+';background:'+(S.sidebarPinFilter?'var(--puG)':'transparent')+';cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;font-size:11px;transition:all .15s">📌</button>'+
    '<button data-ltip="Show starred only" onmouseover="this.style.borderColor=\'var(--pu)\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="if(!'+S.sidebarStarFilter+')this.style.borderColor=\'var(--bd)\';hideLogTip()" onclick="S.sidebarStarFilter=!S.sidebarStarFilter;if(S.sidebarStarFilter)S.sidebarPinFilter=false;S.sidebarIdx=-1;reSide()" style="width:20px;height:20px;border-radius:4px;border:1px solid '+(S.sidebarStarFilter?'var(--pu)':'var(--bd)')+';background:'+(S.sidebarStarFilter?'var(--puG)':'transparent')+';cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;font-size:11px;transition:all .15s">⭐</button>'+
    '</div>'+
    '</div>'+
    '<div class="sb-hide-on-col" style="position:relative;margin-bottom:8px">'+
    '<div style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--t3);pointer-events:none">'+icoSearch()+'</div>'+
    '<input class="inp" style="padding-left:30px;height:30px;font-size:12px" placeholder="Search…" value="'+S.projSearch+'" oninput="S.projSearch=this.value;S.sidebarIdx=-1;reSide()" onkeydown="sidebarSearchKey(event)"/>'+
    '</div>'+
    '<div class="sb-hide-on-col" style="flex:1;overflow-y:auto">'+
    (S.loading.projects?'<div class="mono" style="font-size:11px;color:var(--t3);padding:8px">Loading…</div>':'')+
    ((!S.loading.projects && filtered.length === 0 && S.managedProjects.filter(function(p){return p.provider==='gitlab';}).length === 0) ?
      '<div style="font-size:11px;color:var(--t3);padding:10px 8px;text-align:center;line-height:1.6">No projects added.<br><button onclick="toggleSettings()" style="margin-top:6px;padding:4px 12px;border-radius:6px;border:1px solid var(--pu);background:var(--puG);color:var(--pu);font-size:11px;cursor:pointer;font-weight:500">+ Add projects</button></div>'
    :'')+
    (function(){
      // Expand projects with tagged branches into separate entries (one per branch).
      // Projects WITHOUT tagged branches appear as a single entry (original behaviour).
      var entries = [];
      filtered.forEach(function(p){
        var taggedBranches = S.repoBranches[String(p.id)] || [];
        if(taggedBranches.length > 0){
          taggedBranches.forEach(function(br){
            entries.push({ p: p, branch: br });
          });
        } else {
          entries.push({ p: p, branch: null });
        }
      });
      return entries.map(function(entry, idx){
        var p = entry.p;
        var br = entry.branch;
        var name = p.name||'';
        var ns = p.namespace?p.namespace.name:'';
        var isPinned = S.pinnedRepos.indexOf(p.id) !== -1;
        var isReq = S.starredRepos.indexOf(p.id) !== -1;

        // Determine active state
        var isActive;
        if(br !== null){
          // Branch-specific entry: active when this project+branch is selected
          // (don't require glBranchInfo — stays active on history page too)
          isActive = selProj && selProj.id === p.id &&
                     S.glBranch === br;
        } else {
          isActive = selProj && selProj.id === p.id;
        }

        // Icon letter — always show first letter
        var icoContent = name[0].toUpperCase();

        // Background color for icon
        var icoBg = isPinned ? 'background:var(--puG);color:var(--pu);' : isReq ? 'background:var(--amB);color:var(--am);' : br!==null ? 'background:var(--bg3);color:var(--t2);' : '';

        var clickHandler = br !== null
          ? 'quickLoadBranch('+p.id+',\''+br.replace(/'/g,"\\'")+'\');'
          : 'selProject('+p.id+');';

        // Sub-label: show branch name if branch-specific, otherwise namespace + pin/req indicator
        var subLabel = br !== null
          ? '<span style="display:inline-flex;align-items:center;gap:3px;color:'+(isActive?'var(--pu)':'var(--t3)')+'">'+
            '<svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>'+
            '<span style="font-family:\'JetBrains Mono\',monospace">'+br+'</span></span>'
          : ns+(isPinned?'<span style="font-size:10px;margin-left:4px">📌</span>':isReq?'<span style="font-size:10px;margin-left:4px">⭐</span>':'');

        var isFocused = S.sidebarIdx === idx;
        var isReordering = S.reorderSelIdx === idx;
        return '<div style="margin-bottom:2px;position:relative" data-sb-idx="'+idx+'" data-sb-pid="'+p.id+'" data-sb-br="'+(br||'')+'">'+
          '<div class="sb-proj'+(isActive?' active':'')+' sb-tip" data-tip="'+(name+(br?' · '+br:'')+(ns?' ('+ns+')':''))+'" '+
          'onclick="sidebarEntryClick(event,'+idx+','+p.id+',\''+( br ? br.replace(/'/g,"\\'") : '')+'\' )" '+
          'onmousedown="sbDragMouseDown(event,'+idx+','+p.id+',\''+( br ? br.replace(/'/g,"\\'") : '')+'\')" '+
          'style="border-radius:7px;cursor:pointer;'+
          (isFocused && !isActive ? 'outline:2px solid var(--pu);outline-offset:-2px;' : '')+
          '">'+
          '<div class="sb-proj-ico" style="'+icoBg+'">'+
          icoContent+
          '</div>'+
          '<div style="min-width:0;flex:1">'+
          '<div class="sb-proj-name">'+name+'</div>'+
          '<div class="sb-proj-sub">'+subLabel+'</div>'+
          '</div>'+
          '<span class="drag-handle" data-ltip="Ctrl+drag to reorder" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" onmousedown="sbDragMouseDown(event,'+idx+','+p.id+',\''+( br ? br.replace(/'/g,"\\'") : '')+'\')">⠿</span>'+
          '</div>'+
          '</div>';
      }).join('');
    })()+
    (filtered.length===0&&!S.loading.projects?'<div style="font-size:11px;color:var(--t3);padding:8px">No results</div>':'')+
    '</div></div>'+

    '<div class="sb-ft" style="'+(isCol?'flex-direction:column;gap:6px;padding:8px 6px;':'')+'justify-content:'+(isCol?'center':'space-between')+';position:relative;">'+
    // ── Collapse/Expand toggle button ──
    // Expanded: float above the footer border (top:-13px,right:12px). Collapsed: inline at top of column, no overlap.
    (isCol
      ? '<button class="sb-col-btn" onclick="sbTogglePin()" data-ltip="Expand sidebar" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="background:var(--bg1);border-color:var(--bd2);width:24px;height:24px;flex-shrink:0">'+
        '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>'+
        '</button>'
      : '<div style="position:absolute;top:-13px;right:12px;z-index:20">'+
        '<button class="sb-col-btn" onclick="sbTogglePin()" data-ltip="Collapse sidebar" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="background:var(--bg1);border-color:var(--bd2);width:24px;height:24px">'+
        '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>'+
        '</button>'+
        '</div>'
    )+
    '<div style="position:relative;display:inline-block">'+
    '<button data-ltip="Sign out" onmouseover="this.style.background=\'rgba(214,48,49,0.2)\';this.style.borderColor=\'rgba(214,48,49,0.7)\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.background=\'rgba(214,48,49,0.1)\';this.style.borderColor=\'rgba(214,48,49,0.4)\';hideLogTip()" onclick="signOut()" style="background:rgba(214,48,49,0.1);border:1px solid rgba(214,48,49,0.4);border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;color:#e53e3e;transition:background .15s,border-color .15s"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg></button>'+
    '</div>'+
    '<div class="sb-hide-on-col" style="min-width:50px" data-ltip="Session time remaining" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()"><div id="session-timer"></div></div>'+
    '<div class="sb-hide-on-col" style="display:flex;align-items:center;justify-content:flex-end;flex-shrink:0">'+
    '<button data-ltip="'+(S.theme==='light'?'Switch to dark':'Switch to light')+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" onclick="toggleTheme()" style="width:32px;height:16px;padding:0;border-radius:8px;background:'+(S.theme==='dark'?'var(--barc)':'var(--bg3)')+';border:1.5px solid '+(S.theme==='dark'?'var(--barc)':'var(--bd2)')+';position:relative;cursor:pointer;transition:background .2s,border-color .2s" aria-label="Toggle theme">'+
    '<div style="position:absolute;top:2px;left:'+(S.theme==='dark'?'15px':'2px')+';width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .2s"></div>'+
    '</button>'+
    '</div>'+
    '<button class="sb-hide-on-col" data-ltip="Help &amp; Feedback" onmouseover="this.style.borderColor=\'var(--pu)\';this.style.color=\'var(--pu)\';this.style.background=\'var(--puG)\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.borderColor=\'var(--bd)\';this.style.color=\'var(--t3)\';this.style.background=\'transparent\';hideLogTip()" onclick="openHelpPopup()" style="width:24px;height:24px;border:1px solid var(--bd);border-radius:6px;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--t3);transition:all .15s;padding:0;flex-shrink:0">'+
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'+
    '</button></div></div></div></div>'
  );
}
/* ============================
   SIDEBAR DRAG-AND-DROP REORDER
   Ctrl+mousedown (or drag handle mousedown) initiates drag.
   A ghost follows the cursor; a blue line shows the drop position.
   On mouseup the new order is committed to S.projOrder and saved.
============================ */
var _drag = null; // active drag state

function sbDragMouseDown(e, idx, pid, br){
  // Only trigger on Ctrl+mousedown OR when clicking the ⠿ handle itself
  var isHandle = e.currentTarget.classList && e.currentTarget.classList.contains('drag-handle');
  if(!isHandle && !e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  e.stopPropagation();

  // Build current flat entry list from DOM
  var entries = sidebarBuildEntries();
  if(entries.length < 2) return;

  // Snapshot the row rects for hit-testing during drag
  var rows = Array.from(document.querySelectorAll('.sb-projs [data-sb-idx]'));
  var rects = rows.map(function(r){ return r.getBoundingClientRect(); });

  // Create ghost element
  var srcRow = rows[idx];
  var ghost = document.createElement('div');
  ghost.id = 'sb-drag-ghost';
  // Clone the inner content (name + sub)
  var nameEl = srcRow.querySelector('.sb-proj-ico');
  var textEl = srcRow.querySelector('[style*="flex:1"]') || srcRow.querySelector('.sb-proj > div:nth-child(2)');
  var nameText = textEl ? (textEl.firstElementChild ? textEl.firstElementChild.textContent : '') : '';
  ghost.innerHTML = '<div style="width:20px;height:20px;border-radius:5px;background:var(--puG);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:var(--pu);flex-shrink:0">'+(nameText[0]||'?').toUpperCase()+'</div>'+
    '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px">'+nameText+'</span>'+
    '<span style="color:var(--pu);font-size:10px;margin-left:auto;padding-left:8px">⠿</span>';
  ghost.style.left = (e.clientX + 10) + 'px';
  ghost.style.top  = (e.clientY - 16) + 'px';
  document.body.appendChild(ghost);

  // Mark source row
  if(srcRow.querySelector('.sb-proj')) srcRow.querySelector('.sb-proj').classList.add('sb-drag-source');
  document.querySelector('.sb-projs').classList.add('sb-dragging');

  // Find scrollable container inside .sb-projs — search both space and no-space variants
  var sbProjs = document.querySelector('.sb-projs');
  var scrollEl = null;
  if(sbProjs){
    // Try inline style variants
    scrollEl = sbProjs.querySelector('div[style*="overflow-y:auto"]') ||
               sbProjs.querySelector('div[style*="overflow-y: auto"]') ||
               sbProjs.querySelector('div[style*="overflow-y:scroll"]');
    // Fallback: find first child div that actually scrolls
    if(!scrollEl){
      var kids = sbProjs.querySelectorAll('div');
      for(var ki=0;ki<kids.length;ki++){
        var ks = window.getComputedStyle(kids[ki]).overflowY;
        if(ks==='auto'||ks==='scroll'){ scrollEl=kids[ki]; break; }
      }
    }
    if(!scrollEl) scrollEl = sbProjs;
  }

  _drag = {
    srcIdx: idx,
    srcPid: pid,
    srcBr:  br,
    entries: entries,
    rows: rows,
    rects: rects,
    dropIdx: idx,
    ghost: ghost,
    scrollEl: scrollEl,
    mouseY: e.clientY,
    scrollRaf: null
  };

  // kick off auto-scroll loop
  _drag.scrollRaf = requestAnimationFrame(_sbDragScroll);

  document.addEventListener('mousemove', _sbDragMove);
  document.addEventListener('mouseup',   _sbDragUp);
}

function _sbDragMove(e){
  if(!_drag) return;
  _drag.mouseY = e.clientY;

  // Move ghost
  _drag.ghost.style.left = (e.clientX + 12) + 'px';
  _drag.ghost.style.top  = (e.clientY - 16) + 'px';

  _sbDragUpdateDrop();
}

// Recalculate drop target from current mouseY and current row rects
function _sbDragUpdateDrop(){
  if(!_drag) return;

  // Refresh rects (they shift when scrolled)
  _drag.rects = _drag.rows.map(function(r){ return r.getBoundingClientRect(); });

  var rows  = _drag.rows;
  var rects = _drag.rects;
  var cy    = _drag.mouseY;
  var best  = rows.length;

  for(var i = 0; i < rects.length; i++){
    var mid = rects[i].top + rects[i].height / 2;
    if(cy < mid){ best = i; break; }
  }
  _drag.dropIdx = best;

  // Visual: highlight gap lines
  rows.forEach(function(r, i){
    var p = r.querySelector('.sb-proj');
    if(!p) return;
    p.classList.remove('drag-over-above','drag-over-below');
    if(i === best && i !== _drag.srcIdx){
      p.classList.add('drag-over-above');
    } else if(i === best - 1 && best !== _drag.srcIdx + 1 && i !== _drag.srcIdx){
      p.classList.add('drag-over-below');
    }
  });
}

// Auto-scroll the project list when cursor is near top/bottom edge
function _sbDragScroll(){
  if(!_drag){ return; }

  var el = _drag.scrollEl;
  if(el){
    var rect = el.getBoundingClientRect();
    var cy   = _drag.mouseY;
    var zone = 48;      // px from edge to start scrolling
    var maxSpeed = 14;  // px per frame at edge

    var speed = 0;
    if(cy < rect.top + zone){
      // Near top — scroll up
      var ratio = Math.max(0, (rect.top + zone - cy) / zone);
      speed = -Math.round(maxSpeed * ratio);
    } else if(cy > rect.bottom - zone){
      // Near bottom — scroll down
      var ratio2 = Math.max(0, (cy - (rect.bottom - zone)) / zone);
      speed = Math.round(maxSpeed * ratio2);
    }

    if(speed !== 0){
      el.scrollTop += speed;
      _sbDragUpdateDrop();   // keep drop indicator accurate while scrolling
    }
  }

  _drag.scrollRaf = requestAnimationFrame(_sbDragScroll);
}

function _sbDragUp(e){
  if(!_drag) return;
  document.removeEventListener('mousemove', _sbDragMove);
  document.removeEventListener('mouseup',   _sbDragUp);

  // Cancel auto-scroll
  if(_drag.scrollRaf) cancelAnimationFrame(_drag.scrollRaf);

  // Cleanup visual
  _drag.ghost.remove();
  _drag.rows.forEach(function(r){
    var p = r.querySelector('.sb-proj');
    if(p){ p.classList.remove('sb-drag-source','drag-over-above','drag-over-below'); }
  });
  var sp = document.querySelector('.sb-projs');
  if(sp) sp.classList.remove('sb-dragging');

  var src = _drag.srcIdx;
  var dst = _drag.dropIdx;
  var entries = _drag.entries;

  _drag = null;

  // No movement
  if(dst === src || dst === src + 1) { return; }

  // Build new ordered pid list from the flat entries array
  // Collect unique pids in current visual order
  var orderedPids = [];
  entries.forEach(function(en){
    if(orderedPids.indexOf(en.pid) === -1) orderedPids.push(en.pid);
  });

  // Handle same-project branch reorder
  var aEntry = entries[src];
  var bEntry = entries[dst < entries.length ? dst : entries.length - 1];

  if(aEntry.pid === bEntry.pid && aEntry.branch !== null){
    // Branch reorder within one project
    var key = String(aEntry.pid);
    var arr = (S.repoBranches[key] || []).slice();
    var ai = arr.indexOf(aEntry.branch);
    var di = dst < src ? arr.indexOf(bEntry.branch) : (dst - 1 < entries.length ? arr.indexOf(entries[dst > 0 ? dst-1 : 0].branch) : arr.length);
    if(ai !== -1){ arr.splice(ai, 1); arr.splice(Math.max(0, di), 0, aEntry.branch); }
    S.repoBranches[key] = arr;
    saveSettings(); reSide(); return;
  }

  // General reorder: move srcPid to position before destPid
  var srcPid = aEntry.pid;
  var srcOrdIdx = orderedPids.indexOf(srcPid);
  if(srcOrdIdx !== -1) orderedPids.splice(srcOrdIdx, 1);

  // Find which pid the drop slot is before
  var insertBefore = null;
  if(dst < entries.length){
    insertBefore = entries[dst].pid;
  }
  if(insertBefore !== null && insertBefore !== srcPid){
    var ib = orderedPids.indexOf(insertBefore);
    if(ib !== -1){
      orderedPids.splice(ib, 0, srcPid);
    } else {
      orderedPids.unshift(srcPid);
    }
  } else {
    orderedPids.push(srcPid);
  }

  S.projOrder = orderedPids;
  saveSettings();
  reSide();
}

function sidebarEntryClick(event, idx, projId, branch){
  if(event.ctrlKey || event.metaKey){
    // Ctrl+drag is handled by mousedown; clicks with ctrl are suppressed
    return;
  }
  S.reorderSelIdx = -1;
  if(branch) quickLoadBranch(projId, branch);
  else selProject(projId);
}



// Build the flat ordered list of {projId, branch|null} entries matching current sidebar state
function sidebarBuildEntries(){
    var projs = S.glProjects;
  var filtered = projs.filter(function(p){
    if(S.hiddenRepos.indexOf(p.id) !== -1) return false;
    var n = p.name||'';
    var ns = p.namespace?p.namespace.name:'';
    return n.toLowerCase().includes(S.projSearch.toLowerCase())||ns.toLowerCase().includes(S.projSearch.toLowerCase());
  });
  filtered.sort(function(a,b){
    var ao = S.projOrder.indexOf(a.id);
    var bo = S.projOrder.indexOf(b.id);
    if(ao !== -1 && bo !== -1) return ao - bo;
    if(ao !== -1) return -1;
    if(bo !== -1) return 1;
    var ap = S.pinnedRepos.indexOf(a.id) !== -1 ? 0 : 1;
    var bp = S.pinnedRepos.indexOf(b.id) !== -1 ? 0 : 1;
    return ap - bp;
  });
  var entries = [];
  filtered.forEach(function(p){
    var branches = S.repoBranches[String(p.id)] || [];
    if(branches.length){
      branches.forEach(function(br){ entries.push({pid: p.id, branch: br}); });
    } else {
      entries.push({pid: p.id, branch: null});
    }
  });
  return entries;
}




function sidebarSearchKey(e){
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    e.preventDefault();
    sidebarNav(e.key === 'ArrowDown' ? 1 : -1);
  } else if(e.key === 'Enter'){
    e.preventDefault();
    sidebarNavSelect();
  }
}

function sidebarGetEntries(){
  return Array.from(document.querySelectorAll('.sb-projs [data-sb-idx]'));
}

function sidebarNav(dir){
  var items = sidebarGetEntries();
  if(!items.length) return;
  var count = items.length;
  var next = S.sidebarIdx + dir;
  if(next < 0) next = 0;
  if(next >= count) next = count - 1;
  S.sidebarIdx = next;
  // Patch styles in-place — no full re-render
  items.forEach(function(wrap, i){
    var row = wrap.querySelector('.sb-proj');
    if(!row) return;
    if(i === next){
      row.style.outline = '2px solid var(--pu)';
      row.style.outlineOffset = '-2px';
      wrap.scrollIntoView({block:'nearest', behavior:'smooth'});
    } else {
      row.style.outline = '';
      row.style.outlineOffset = '';
    }
  });
}

function sidebarNavSelect(){
  var items = sidebarGetEntries();
  var wrap = items[S.sidebarIdx];
  if(!wrap) return;
  var pid = parseInt(wrap.getAttribute('data-sb-pid'), 10);
  var br  = wrap.getAttribute('data-sb-br') || '';
  if(br) quickLoadBranch(pid, br);
  else   selProject(pid);
  // move focus back to search input so arrow keys keep working
  var inp = document.querySelector('.sb-projs input');
  if(inp) inp.focus();
}


function reSide(){
  var sb = document.querySelector('.sidebar');
  if(!sb) return;
  var searchInp = sb.querySelector('.sb-projs input');
  var hadFocus = searchInp && document.activeElement === searchInp;
  var selStart = hadFocus ? searchInp.selectionStart : null;
  var selEnd   = hadFocus ? searchInp.selectionEnd   : null;
  // Save scroll position of project list before replacing DOM
  var projScroll = sb.querySelector('.sb-projs > div[style*="overflow-y"]');
  var savedScrollTop = projScroll ? projScroll.scrollTop : 0;

  var tmp = document.createElement('div');
  tmp.innerHTML = renderSidebar();
  sb.replaceWith(tmp.firstChild);
  updateSessionTimerEl();

  // Restore scroll position immediately (no jump)
  var newProjScroll = document.querySelector('.sb-projs > div[style*="overflow-y"]');
  if(newProjScroll) newProjScroll.scrollTop = savedScrollTop;

  if(hadFocus){
    var newInp = document.querySelector('.sb-projs input');
    if(newInp){
      newInp.focus();
      try{ newInp.setSelectionRange(selStart, selEnd); } catch(e){}
    }
  }

  // Scroll active project into view only if it's outside the visible area
  sbScrollActiveIntoView();
}

// Scroll the active sidebar project entry into view without jumping if already visible
function sbScrollActiveIntoView(){
  setTimeout(function(){
    var container = document.querySelector('.sb-projs > div[style*="overflow-y"]');
    var active = container && container.querySelector('.sb-proj.active');
    if(!container || !active) return;
    var cRect = container.getBoundingClientRect();
    var aRect = active.getBoundingClientRect();
    if(aRect.top < cRect.top + 4 || aRect.bottom > cRect.bottom - 4){
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, 30);
}

// ── Sidebar collapse helpers ──
function sbExpand(){
  if(S.sidebarPinned) return; // pinned open — hover does nothing
  var sb = document.getElementById('main-sidebar');
  if(sb) sb.classList.remove('sb-collapsed');
}
function sbCollapse(){
  if(S.sidebarPinned) return;
  var sb = document.getElementById('main-sidebar');
  if(sb) sb.classList.add('sb-collapsed');
}
function sbTogglePin(){
  // Arrow button on sidebar edge: simply toggle collapsed/expanded
  S.sidebarCollapsed = !S.sidebarCollapsed;
  S.sidebarPinned = !S.sidebarCollapsed; // pinned = expanded
  saveSettings();
  reSide();
}

/* ============================
   HISTORY SIDEBAR: toggle / pin / drag-resize
============================ */
function hsToggleOpen(){
  S.histSidebarOpen = !S.histSidebarOpen;
  saveSettings();
  reHistPage();
}



function hsResizeStart(e){
  e.preventDefault();
  var sidebar = document.getElementById('hist-sidebar');
  if(!sidebar) return;
  var startX = e.clientX;
  var startW = sidebar.offsetWidth;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';

  function onMove(ev){
    var newW = Math.max(160, Math.min(500, startW + (ev.clientX - startX)));
    sidebar.style.width = newW + 'px';
    S.histSidebarWidth = newW;
    // update resize handle position live — no full re-render needed
  }
  function onUp(){
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if(S.histSidebarPinned) saveSettings(); // persist if pinned
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* ============================
   HELP & FEEDBACK POPUP
============================ */
function openHelpPopup(){
  var existing = document.getElementById('help-popup-overlay');
  if(existing){ existing.remove(); return; }
  var ov = document.createElement('div');
  ov.id = 'help-popup-overlay';
  ov.className = 'help-popup-overlay';
  ov.onclick = function(e){ if(e.target===ov) ov.remove(); };
  ov.innerHTML =
    '<div class="help-popup">'+
    '<div class="help-popup-hd">'+
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pu)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'+
    '<span style="font-size:14px;font-weight:600;color:var(--t1);flex:1">Help & Feedback</span>'+
    '<button onclick="document.getElementById(\'help-popup-overlay\').remove()" style="width:26px;height:26px;border:1px solid var(--bd);border-radius:6px;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--t3);transition:all .15s;padding:0" onmouseover="this.style.borderColor=\'var(--re)\';this.style.color=\'var(--re)\'" onmouseout="this.style.borderColor=\'var(--bd)\';this.style.color=\'var(--t3)\'">'+
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'+
    '</button>'+
    '</div>'+
    '<div class="help-popup-body">'+
    '<div style="font-size:12px;color:var(--t2);line-height:1.7;margin-bottom:14px">For feature improvements or bug reports, contact:</div>'+
    '<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:8px;padding:12px 14px;margin-bottom:10px">'+
    '<div style="font-size:13px;font-weight:600;color:var(--t1);margin-bottom:10px;display:flex;align-items:center;gap:6px">'+
    '<div style="width:30px;height:30px;border-radius:50%;background:var(--puG);border:1px solid var(--bd2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--pu)">SK</div>'+
    'Sreekanth Kothapalli'+
    '</div>'+
    '<div style="display:flex;flex-direction:column;gap:7px">'+
    // Teams button
    '<button onclick="window.open(\'https://teams.microsoft.com/l/chat/0/0?users=kothapalli.sreekanth@barclays.com\',\'_blank\')" style="display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:7px;border:1px solid var(--bd);background:var(--bg1);cursor:pointer;transition:all .15s;width:100%;text-align:left" onmouseover="this.style.borderColor=\'#6264a7\';this.style.background=\'rgba(98,100,167,0.07)\'" onmouseout="this.style.borderColor=\'var(--bd)\';this.style.background=\'var(--bg1)\'">'+
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="6" width="20" height="13" rx="3" fill="#6264a7" opacity=".15"/><rect x="2" y="6" width="20" height="13" rx="3" stroke="#6264a7" stroke-width="1.5" fill="none"/><path d="M8 10h8M8 14h5" stroke="#6264a7" stroke-width="1.5" stroke-linecap="round"/><circle cx="17" cy="7" r="3" fill="#6264a7"/></svg>'+
    '<div style="flex:1;min-width:0">'+
    '<div style="font-size:12px;font-weight:600;color:var(--t1)">Microsoft Teams</div>'+
    '<div style="font-size:10px;color:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">kothapalli.sreekanth@barclays.com</div>'+
    '</div>'+
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'+
    '</button>'+
    // Outlook button
    '<button onclick="window.open(\'mailto:kothapalli.sreekanth@barclays.com?subject=Pipeline%20Runner%20Feedback\',\'_blank\')" style="display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:7px;border:1px solid var(--bd);background:var(--bg1);cursor:pointer;transition:all .15s;width:100%;text-align:left" onmouseover="this.style.borderColor=\'#0078d4\';this.style.background=\'rgba(0,120,212,0.07)\'" onmouseout="this.style.borderColor=\'var(--bd)\';this.style.background=\'var(--bg1)\'">'+
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5" width="20" height="15" rx="3" fill="#0078d4" opacity=".12"/><rect x="2" y="5" width="20" height="15" rx="3" stroke="#0078d4" stroke-width="1.5" fill="none"/><path d="M2 8l10 6 10-6" stroke="#0078d4" stroke-width="1.5" stroke-linecap="round"/></svg>'+
    '<div style="flex:1;min-width:0">'+
    '<div style="font-size:12px;font-weight:600;color:var(--t1)">Outlook Email</div>'+
    '<div style="font-size:10px;color:var(--t3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">kothapalli.sreekanth@barclays.com</div>'+
    '</div>'+
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>'+
    '</button>'+
    '</div></div>'+
    '<div style="font-size:10px;color:var(--t4);text-align:center;margin-top:4px">GitLab Orchestrator · Internal Tool</div>'+
    '</div>'+
    '</div>';
  document.body.appendChild(ov);
}

/* ============================
   SETTINGS PANEL
============================ */
function toggleSettings(){
  S.settingsOpen = !S.settingsOpen;
  if(S.settingsOpen) renderSettingsPanel();
  else closeSettings();
  // Update gear button state in topbar
  var gb = document.querySelector('.settings-gear-btn');
  if(gb) gb.classList.toggle('open', S.settingsOpen);
}
function closeSettings(){
  S.settingsOpen = false;
  var ov = document.getElementById('settings-overlay');
  if(ov) ov.remove();
  var gb = document.querySelector('.settings-gear-btn');
  if(gb) gb.classList.remove('open');
  hideAllTips();
}
function renderSettingsPanel(){
  var existing = document.getElementById('settings-overlay');
  if(existing) existing.remove();
  
  var html =
    '<div id="settings-overlay" class="settings-overlay" onclick="if(event.target===this)closeSettings()">'+
    '<div class="settings-panel">'+
    '<div class="settings-hd">'+
    '<div class="settings-hd-row1">'+
    icoGear(16)+
    '<span style="font-size:14px;font-weight:600;color:var(--t1);flex:1">Settings</span>'+
    '<button class="stg-btn" onclick="closeSettings()" data-ltip="Close" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()">'+icoX()+'</button>'+
    '</div>'+
    '<div class="settings-hd-row2">'+
    '<button onclick="clearAppCache()" data-ltip="Clear pipeline state &amp; cached data (keeps projects &amp; session)" onmouseover="this.style.background=\'var(--re)\';this.style.color=\'#fff\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.background=\'var(--reB)\';this.style.color=\'var(--re)\';hideLogTip()" style="display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px;border:1px solid var(--reL);background:var(--reB);font-size:11px;font-weight:500;color:var(--re);cursor:pointer"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> Clear cache</button>'+
    '<div style="flex:1"></div>'+
    '<button onclick="exportSettingsJSON()" data-ltip="Export settings to JSON file" onmouseover="this.style.borderColor=\'var(--pu)\';this.style.color=\'var(--pu)\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.borderColor=\'var(--bd)\';this.style.color=\'var(--t2)\';hideLogTip()" style="display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px;border:1px solid var(--bd);background:var(--bg2);font-size:11px;font-weight:500;color:var(--t2);cursor:pointer">'+
    '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Export'+
    '</button>'+
    '<button onclick="importSettingsJSON()" data-ltip="Import settings from JSON file" onmouseover="this.style.borderColor=\'var(--pu)\';this.style.color=\'var(--pu)\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.borderColor=\'var(--bd)\';this.style.color=\'var(--t2)\';hideLogTip()" style="display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px;border:1px solid var(--bd);background:var(--bg2);font-size:11px;font-weight:500;color:var(--t2);cursor:pointer">'+
    '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Import'+
    '</button>'+
    '<button onclick="resetAllSettings()" data-ltip="Reset all projects &amp; settings" onmouseover="this.style.background=\'var(--re)\';this.style.color=\'#fff\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.background=\'var(--reB)\';this.style.color=\'var(--re)\';hideLogTip()" style="display:flex;align-items:center;gap:4px;padding:4px 8px;border-radius:6px;border:1px solid var(--reL);background:var(--reB);font-size:11px;font-weight:500;color:var(--re);cursor:pointer"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.6"/></svg> Reset</button>'+
    '</div>'+
    '</div>'+
    '<div class="settings-body">'+
    '<div class="settings-section" style="margin-top:0">Add Projects to Sidebar</div>'+
    '<div style="font-size:10px;color:var(--t3);margin-bottom:10px;line-height:1.5">Search and add only the repos you need. Sidebar shows exactly these — nothing else is loaded.</div>'+
    '<div style="position:relative;margin-bottom:6px">'+
    '<span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--t4);pointer-events:none;display:flex;align-items:center">'+icoSearch()+'</span>'+
    '<input id="stg-search-inp" class="inp" placeholder="Search GitLab projects…" style="height:32px;font-size:12px;padding-left:28px;padding-right:28px" oninput="stgLiveSearch(this.value)" value="'+(S.stgSearchQ||'')+'" autocomplete="off" />'+
    '<button id="stg-search-clr" onclick="S.stgSearchQ=\'\';S.stgSearchRes=[];document.getElementById(\'stg-search-inp\').value=\'\';renderStgSearchResults([])" style="display:'+(S.stgSearchQ?'block':'none')+';position:absolute;right:7px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--t3);font-size:13px;padding:0;line-height:1">&#x2715;</button>'+
    '</div>'+
    '<div id="stg-search-results" style="background:var(--bg1);border:1px solid var(--bd);border-radius:8px;overflow:hidden;margin-bottom:14px;max-height:220px;overflow-y:auto">'+
    (S.stgSearchRes.length ? buildStgResultsHtml() : '')+
    '</div>'+
    '<div class="settings-section">My Projects</div>'+
    '<div style="font-size:10px;color:var(--t3);margin-bottom:8px;line-height:1.5"><b style="color:var(--pu)">📌 Pin</b> — move to top &nbsp;<b style="color:var(--am)">⭐ Star</b> — filter to starred only &nbsp;<b>Branch</b> — tag per project</div>'+
    '<div id="managed-proj-list">'+buildManagedProjListHtml()+'</div>'+
    '</div></div></div>';

  document.body.insertAdjacentHTML('beforeend', html);
}

function buildStgResultsHtml(){
  return S.stgSearchRes.map(function(p){
    var already = S.managedProjects.some(function(m){ return String(m.id)===String(p.id) && m.provider===S.provider; });
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--bd)" onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">'
      +'<div style="width:26px;height:26px;border-radius:6px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--t2);flex-shrink:0">'+p.name[0].toUpperCase()+'</div>'
      +'<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:500;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+p.name+'</div><div style="font-size:10px;color:var(--t3)">'+p.ns+'</div></div>'
      +'<button id="stg-add-btn-'+p.id+'" '+(already?'disabled':'')
      +' onclick="addManagedProject('+p.id+',\''+p.name.replace(/'/g,"\\'")+'\',' +
      '\''+p.ns.replace(/'/g,"\\'")+'\',' +
      '\''+p.webUrl.replace(/'/g,"\\'")+'\',' +
      '\''+p.fullName.replace(/'/g,"\\'")+'\')"'
      +' style="flex-shrink:0;padding:3px 10px;border-radius:6px;border:1px solid '+(already?'var(--grL)':'var(--pu)')+';background:'+(already?'var(--grB)':'var(--puG)')+';color:'+(already?'var(--gr)':'var(--pu)')+';font-size:11px;font-weight:600;cursor:'+(already?'default':'pointer')+'">'
      +(already?'✓ Added':'+ Add')+'</button>'
      +'</div>';
  }).join('');
}


/* ============================
   SETTINGS BRANCH AUTOCOMPLETE
   All dropdown updates patch the DOM directly — NO full panel re-render during typing.
============================ */
var settingsBranchTimers = {};
// Tracks which branch name is currently highlighted in each project's dropdown
var settingsBranchHighlight = {};  // { "projId": index }

async function fetchProjBranches(projId){
  var key = String(projId);
  if(S.projBranchCache[key]) return S.projBranchCache[key];
  try {
    var branches = await glApi('/projects/'+projId+'/repository/branches?per_page=100');
    S.projBranchCache[key] = branches.map(function(b){ return b.name; });
  } catch(e){ S.projBranchCache[key] = []; }
  return S.projBranchCache[key];
}

// Patch just the dropdown div — never touch the rest of the settings panel
function settingsBranchPatchDrop(projId, sugs, searched, searchVal){
  var key = String(projId);
  S.settingsBranchSugs[key] = sugs;
  settingsBranchHighlight[key] = -1;

  var wrap = document.getElementById('br-wrap-'+projId);
  if(!wrap) return;
  var existing = document.getElementById('br-drop-'+projId);
  if(existing) existing.remove();

  if(!sugs || !sugs.length) {
    // Show "no branch found" if user searched but got no results
    if(searched && searchVal) {
      var noRes = document.createElement('div');
      noRes.id = 'br-drop-'+projId;
      noRes.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:var(--bg1);border:1px solid var(--bd);border-radius:6px;z-index:300;box-shadow:var(--sh2);margin-top:2px;padding:8px 10px;font-size:11px;color:var(--t3);font-family:\'JetBrains Mono\',monospace';
      noRes.textContent = 'No branch found for "' + searchVal + '"';
      wrap.appendChild(noRes);
    }
    return;
  }

  var drop = document.createElement('div');
  drop.id = 'br-drop-'+projId;
  drop.style.cssText = 'position:absolute;top:100%;left:0;right:0;background:var(--bg1);border:1px solid var(--bd);border-radius:6px;z-index:300;overflow:hidden;box-shadow:var(--sh2);max-height:160px;overflow-y:auto;margin-top:2px';
  sugs.forEach(function(s, idx){
    var item = document.createElement('div');
    item.className = 'drop-item';
    item.dataset.idx = idx;
    item.style.cssText = 'font-size:11px;padding:5px 10px;display:flex;align-items:center;gap:5px;cursor:pointer';
    item.innerHTML = '<svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>' + s;
    item.addEventListener('mousedown', function(e){
      e.preventDefault(); // don't trigger blur before click registers
      settingsBranchPick(projId, s);
    });
    item.addEventListener('mouseover', function(){
      settingsBranchSetHighlight(projId, idx);
    });
    drop.appendChild(item);
  });
  wrap.appendChild(drop);
}

function settingsBranchSetHighlight(projId, idx){
  var key = String(projId);
  settingsBranchHighlight[key] = idx;
  var drop = document.getElementById('br-drop-'+projId);
  if(!drop) return;
  var items = drop.querySelectorAll('.drop-item');
  items.forEach(function(it, i){
    it.style.background = i === idx ? 'var(--bg2)' : '';
    it.style.color = i === idx ? 'var(--pu)' : '';
  });
  if(items[idx]) items[idx].scrollIntoView({block:'nearest'});
}

async function settingsBranchInput(projId, val){
  var key = String(projId);
  val = val || '';
  clearTimeout(settingsBranchTimers[key]);

  if(val.length < 1){
    settingsBranchPatchDrop(projId, [], false);
    return;
  }

  // If cache exists → filter instantly, no API call, no re-render
  if(S.projBranchCache[key]){
    var lv = val.toLowerCase();
    var tagged = S.repoBranches[key] || [];
    var sugs = S.projBranchCache[key].filter(function(b){
      return b.toLowerCase().indexOf(lv) !== -1 && tagged.indexOf(b) === -1;
    }).slice(0, 20);
    settingsBranchPatchDrop(projId, sugs, true, val);
    return;
  }

  // No cache yet — debounce then fetch
  settingsBranchTimers[key] = setTimeout(async function(){
    var inp = document.getElementById('br-inp-'+projId);
    // Check the input still has the same value (user didn't clear it)
    if(!inp || inp.value.trim() !== val) return;
    var branches = await fetchProjBranches(projId);
    var lv = val.toLowerCase();
    var tagged = S.repoBranches[key] || [];
    var sugs = branches.filter(function(b){
      return b.toLowerCase().indexOf(lv) !== -1 && tagged.indexOf(b) === -1;
    }).slice(0, 20);
    settingsBranchPatchDrop(projId, sugs, true, val);
  }, 280);
}

async function settingsBranchFocus(projId, val){
  var key = String(projId);
  if(!S.projBranchCache[key]) fetchProjBranches(projId); // fire-and-forget pre-fetch
  if((val||'').length >= 1) settingsBranchInput(projId, val);
}

function settingsBranchHideDrop(projId){
  settingsBranchPatchDrop(projId, [], false);
}

function settingsBranchPick(projId, branchName){
  // Clear dropdown first (no re-render)
  settingsBranchPatchDrop(projId, [], false);
  // Clear input
  var inp = document.getElementById('br-inp-'+projId);
  if(inp) inp.value = '';
  // Tag the branch (this will re-render the panel once to show the new chip)
  addRepoBranch(projId, branchName);
}

function settingsBranchKey(e, projId){
  var key = String(projId);
  var sugs = S.settingsBranchSugs[key] || [];
  var hi = settingsBranchHighlight[key] != null ? settingsBranchHighlight[key] : -1;

  if(e.key === 'Enter'){
    e.preventDefault();
    if(hi >= 0 && sugs[hi]){
      settingsBranchPick(projId, sugs[hi]);
    } else {
      settingsBranchAdd(projId);
    }
    return;
  }
  if(e.key === 'Escape'){
    e.preventDefault();
    settingsBranchPatchDrop(projId, []);
    return;
  }
  if((e.key === 'ArrowDown' || e.key === 'ArrowUp') && sugs.length){
    e.preventDefault();
    var next = e.key === 'ArrowDown'
      ? Math.min(hi + 1, sugs.length - 1)
      : Math.max(hi - 1, 0);
    settingsBranchSetHighlight(projId, next);
    // Update input text to match highlighted branch
    var inp = document.getElementById('br-inp-'+projId);
    if(inp) inp.value = sugs[next];
  }
}

async function settingsBranchAdd(projId){
  var key = String(projId);
  var inp = document.getElementById('br-inp-'+projId);
  var val = (inp ? inp.value : '').trim();
  if(!val) return;

  var branches = S.projBranchCache[key] || await fetchProjBranches(projId);
  if(branches.length && branches.indexOf(val) === -1){
    toast('Branch "'+val+'" not found in this project','err');
    if(inp){ inp.style.borderColor='var(--re)'; setTimeout(function(){ inp.style.borderColor=''; }, 1500); }
    return;
  }
  settingsBranchPatchDrop(projId, []);
  addRepoBranch(projId, val);
}


function addRepoBranch(id, val){
  val = (val||'').trim();
  if(!val) return;
  var key = String(id);
  var arr = S.repoBranches[key] || [];
  if(arr.indexOf(val) !== -1){
        var proj = S.glProjects.find(function(p){ return String(p.id) === key; });
    var projName = proj ? (proj.name || key) : key;
    toast('"' + val + '" is already tagged on ' + projName, 'info');
    return;
  }
  arr.push(val);
  S.repoBranches[key] = arr;
  saveSettings(); reSide(); renderManagedProjList();
}
function removeRepoBranch(id, val){
  var key = String(id);
  var arr = S.repoBranches[key] || [];
  arr = arr.filter(function(b){ return b !== val; });
  if(arr.length) S.repoBranches[key] = arr;
  else delete S.repoBranches[key];
  saveSettings(); reSide(); renderManagedProjList();
}
// kept for backwards compat / auto-load logic
function setRepoBranch(id, val){
  val = (val||'').trim();
  if(val) addRepoBranch(id, val);
}
async function quickLoadBranch(projId, branch){
    // If project not selected yet, select it first
  var curId = S.glSelProj ? S.glSelProj.id : null;
  if(curId !== projId){
    await selProject(projId, true, true);
    // skipDashLoad=true, skipBranchLoad=true — quickLoadBranch handles loadGLBranchParams itself
  }
  S.glBranch = branch;
  S.glBranchInfo = null; S.glCiVars = []; S.glParamVals = {}; S.glAdhoc = [];
  reSide();
  if(S.currentPage === 'history') reHistPage();
  else if(S.currentPage === 'dashboard'){
    S.dashData = null;
    var w=document.querySelector('.page-wrap');
    if(w) w.innerHTML=renderDashboard();
    loadDashData();
  }
  else { reRunPage(); loadGLBranchParams(); }
}
function togglePinRepo(id){
  var idx = S.pinnedRepos.indexOf(id);
  if(idx !== -1){
    S.pinnedRepos.splice(idx, 1);
  } else {
    S.pinnedRepos.push(id);
    // Mutual exclusivity: remove from starred if now pinned
    var si = S.starredRepos.indexOf(id);
    if(si !== -1) S.starredRepos.splice(si, 1);
  }
  saveSettings(); reSide(); renderManagedProjList();
}
function toggleHideRepo(id){
  var idx = S.hiddenRepos.indexOf(id);
  if(idx !== -1) S.hiddenRepos.splice(idx, 1);
  else {
    S.hiddenRepos.push(id);
    // If currently selected, deselect
        var sel = S.glSelProj;
    if(sel && sel.id === id){ S.glSelProj = null; }
    // Remove from pinned and starred too
    var pi = S.pinnedRepos.indexOf(id);
    if(pi !== -1) S.pinnedRepos.splice(pi, 1);
    var si = S.starredRepos.indexOf(id);
    if(si !== -1) S.starredRepos.splice(si, 1);
  }
  saveSettings(); reSide(); renderManagedProjList();
}
function toggleStarRepo(id){
  var idx = S.starredRepos.indexOf(id);
  if(idx !== -1){
    S.starredRepos.splice(idx, 1);
  } else {
    S.starredRepos.push(id);
    // Mutual exclusivity: remove from pinned if now starred
    var pi = S.pinnedRepos.indexOf(id);
    if(pi !== -1) S.pinnedRepos.splice(pi, 1);
  }
  saveSettings(); reSide(); renderManagedProjList();
}
function applyReqBranch(val){
  S.reqBranch = val.trim();
  // Pre-fill branch input if it exists
  if(S.reqBranch){
        S.glBranch = S.reqBranch;
    var inp = document.getElementById('gl-branch-inp');
    if(inp) inp.value = S.reqBranch;
  }
  saveSettings(); reSide();
}
function resetAllSettings(){
  S.pinnedRepos = []; S.hiddenRepos = []; S.starredRepos = []; S.reqBranch = '';
  S.repoBranches = {}; S.settingsProjQ = ''; S.managedProjects = [];
  S.stgSearchQ = ''; S.stgSearchRes = [];
  // Clear selected project and all pipeline/run state so history shows empty
  S.glSelProj = null; S.glRuns = []; S.glSelPipeline = null; S.glPipelineJobs = [];
  S.glPipelineStageOrder = []; S.glProjectStageOrder = []; S.glAdhoc = [];
  clearInterval(typeof pipelinePollTimer !== 'undefined' ? pipelinePollTimer : 0);
  saveSettings(); reSide();
  if(S.currentPage === 'history') reHistPage();
  renderSettingsPanel();
  toast('Settings reset', 'info');
}

// Project search in settings — patches DOM only, no panel re-render
function settingsProjSearch(q){
  S.settingsProjQ = q || '';
  // Update input value and clear button without re-rendering panel
  var inp = document.getElementById('settings-proj-search');
  if(inp && inp !== document.activeElement) inp.value = S.settingsProjQ;
  // Clear button: patch in/out
  var wrap = inp && inp.parentNode;
  if(wrap){
    var clr = wrap.querySelector('button');
    if(S.settingsProjQ){
      if(!clr){
        clr = document.createElement('button');
        clr.innerHTML = '&#x2715;';
        clr.setAttribute('onclick','settingsProjSearch(\'\')');
        clr.style.cssText = 'position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--t3);font-size:13px;padding:0;line-height:1';
        wrap.appendChild(clr);
      }
    } else { if(clr) clr.remove(); }
  }
  // Filter the list
    var projs = S.glProjects;
  var q2 = S.settingsProjQ.toLowerCase();
  var filtered = q2 ? projs.filter(function(p){
    var name = (p.name||'').toLowerCase();
    var ns   = (p.namespace?p.namespace.name:'').toLowerCase();
    return name.indexOf(q2) !== -1 || ns.indexOf(q2) !== -1;
  }) : projs;
  // Re-render just the list container
  var listEl = document.getElementById('settings-proj-list');
  if(!listEl) return;
  if(filtered.length === 0){
    listEl.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:12px 0;text-align:center">No results for "'+S.settingsProjQ+'"</div>';
    return;
  }
  listEl.innerHTML = filtered.map(function(p){
    var name = p.name||'';
    var ns   = p.namespace?p.namespace.name:'';
    var isPinned = S.pinnedRepos.indexOf(p.id) !== -1;
    var isHidden = S.hiddenRepos.indexOf(p.id) !== -1;
    var isStarred = S.starredRepos.indexOf(p.id) !== -1;
    var taggedBranches2 = S.repoBranches[String(p.id)] || [];
    return '<div class="settings-repo-row" style="flex-direction:column;align-items:stretch;gap:6px">'+
      '<div style="display:flex;align-items:center;gap:8px">'+
      '<div style="display:flex;flex-direction:column;flex:1;min-width:0">'+
      '<div class="repo-name">'+name+'</div>'+
      '<div class="repo-ns">'+ns+'</div>'+
      '</div>'+
      '<button class="stg-btn'+(isPinned?' active-pin':'') + '" data-ltip="'+(isPinned?'Unpin':'Pin to top')+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" onclick="togglePinRepo('+p.id+')">'+
      '<svg width="11" height="11" fill="'+(isPinned?'var(--pu)':'none')+'" stroke="'+(isPinned?'var(--pu)':'currentColor')+'" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="'+(isPinned?'white':'none')+'"/></svg>'+
      '</button>'+
      '<button class="stg-btn'+(isHidden?' active-hide':'')+'" data-ltip="'+(isHidden?'Show':'Hide')+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" onclick="toggleHideRepo('+p.id+')">'+
      icoEye(!isHidden)+
      '</button>'+
      '<button class="stg-btn'+(isStarred?' active-pin':'')+'" data-ltip="'+(isStarred?'Unstar':'Star')+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" onclick="toggleStarRepo('+p.id+')">'+
      '<svg width="11" height="11" fill="'+(isStarred?'var(--am)':'none')+'" stroke="'+(isStarred?'var(--am)':'currentColor')+'" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>'+
      '</button>'+
      '</div>'+
      '</div>';
  }).join('');
}
function saveSettings(){
  try {
    var d = {
      pinnedRepos:S.pinnedRepos, hiddenRepos:S.hiddenRepos,
      starredRepos:S.starredRepos,
      reqBranch:S.reqBranch,
      repoBranches:S.repoBranches, projOrder:S.projOrder,
      sidebarPinned:S.sidebarPinned, sidebarCollapsed:S.sidebarCollapsed,
      histSidebarPinned:S.histSidebarPinned, histSidebarOpen:S.histSidebarOpen,
      histSidebarWidth:S.histSidebarWidth,
      managedProjects:S.managedProjects,
      glVarDisabled:S.glVarDisabled
    };
    localStorage.setItem('pipeline_runner_settings', JSON.stringify(d));
  } catch(e){}
}
function loadSettings(){
  try {
    var raw = localStorage.getItem('pipeline_runner_settings');
    if(!raw) return;
    var d = JSON.parse(raw);
    if(!d) return;
    S.pinnedRepos      = d.pinnedRepos   || [];
    S.hiddenRepos      = d.hiddenRepos   || [];
    // Migrate old reqRepo (single string) → starredRepos (array)
    if(d.starredRepos && Array.isArray(d.starredRepos)){
      S.starredRepos   = d.starredRepos;
    } else if(d.reqRepo){
      S.starredRepos   = [d.reqRepo];
    }
    S.reqBranch        = d.reqBranch     || '';
    S.repoBranches     = d.repoBranches  || {};
    S.projOrder        = d.projOrder     || [];
    S.sidebarPinned    = !!d.sidebarPinned;
    S.sidebarCollapsed = !!d.sidebarCollapsed;
    S.histSidebarPinned = !!d.histSidebarPinned;
    S.histSidebarOpen   = !!d.histSidebarOpen;
    S.histSidebarWidth  = d.histSidebarWidth || 240;
    if(d.managedProjects && Array.isArray(d.managedProjects)){
      S.managedProjects = d.managedProjects;
    }
    if(d.glVarDisabled && typeof d.glVarDisabled === 'object'){
      S.glVarDisabled = d.glVarDisabled;
    }
  } catch(e){}
}

// Export full settings as a downloadable JSON file
function exportSettingsJSON(){
  var d = {
    _version: 3,
    provider: S.provider,
    glUrl: S.glUrl,
    pinnedRepos: S.pinnedRepos,
    hiddenRepos: S.hiddenRepos,
    starredRepos: S.starredRepos,
    reqBranch: S.reqBranch,
    repoBranches: S.repoBranches,
    projOrder: S.projOrder,
    managedProjects: S.managedProjects,
    glVarDisabled: S.glVarDisabled,
    sidebarPinned: S.sidebarPinned,
    sidebarCollapsed: S.sidebarCollapsed
  };
  var blob = new Blob([JSON.stringify(d, null, 2)], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'pipeline-settings.json';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Settings exported as pipeline-settings.json', 'ok');
}

// Import settings from a JSON file the user picks
function importSettingsJSON(){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){
      try {
        var d = JSON.parse(ev.target.result);
        if(d.managedProjects) S.managedProjects = d.managedProjects;
        if(d.pinnedRepos)  S.pinnedRepos  = d.pinnedRepos;
        if(d.hiddenRepos)  S.hiddenRepos  = d.hiddenRepos;
        if(d.starredRepos) S.starredRepos  = d.starredRepos;
        else if(d.reqRepo) S.starredRepos  = [d.reqRepo]; // migrate old format
        if(d.reqBranch !== undefined) S.reqBranch = d.reqBranch;
        if(d.repoBranches) S.repoBranches = d.repoBranches;
        if(d.projOrder)    S.projOrder    = d.projOrder;
        if(d.glVarDisabled && typeof d.glVarDisabled === 'object') S.glVarDisabled = d.glVarDisabled;
        if(d.sidebarPinned !== undefined) S.sidebarPinned = d.sidebarPinned;
        if(d.sidebarCollapsed !== undefined) S.sidebarCollapsed = d.sidebarCollapsed;
        if(d.glUrl) { S.glUrl = d.glUrl; try { localStorage.setItem('pipeline_runner_gl_url', S.glUrl); } catch(e){} }
        saveSettings();
        toast('Settings imported — '+S.managedProjects.length+' projects loaded', 'ok');
        closeSettings();
        render();
        setTimeout(function(){ toggleSettings(); }, 200);
      } catch(err){ toast('Invalid settings file', 'err'); }
    };
    reader.readAsText(file);
  };
  document.body.appendChild(inp);
  inp.click();
  document.body.removeChild(inp);
}

// Add a project/repo to managed list (called from settings search results)
function addManagedProject(id, name, ns, webUrl, fullName){
  var already = S.managedProjects.some(function(p){ return String(p.id)===String(id) && p.provider===S.provider; });
  if(already){ toast(name+' already added', 'info'); return; }
  S.managedProjects.push({id:id, name:name, ns:ns||'', webUrl:webUrl||'', provider:S.provider, fullName:fullName||''});
  saveSettings();
  // Patch the result row to show "Added" state
  var btn = document.getElementById('stg-add-btn-'+id);
  if(btn){
    btn.textContent = '✓ Added';
    btn.disabled = true;
    btn.style.background = 'var(--grB)';
    btn.style.color = 'var(--gr)';
    btn.style.borderColor = 'var(--grL)';
  }
  // Refresh managed list
  renderManagedProjList();
  reSide();
}

// Remove a project from managed list
function removeManagedProject(id){
  S.managedProjects = S.managedProjects.filter(function(p){ return !(String(p.id)===String(id) && p.provider===S.provider); });
  saveSettings();
  renderManagedProjList();
  reSide();
}

// Re-render just the managed project list div (no full settings re-render)
function renderManagedProjList(){
  var el2 = document.getElementById('managed-proj-list');
  if(!el2) return;
  el2.innerHTML = buildManagedProjListHtml();
}

function buildManagedProjListHtml(){
  var curProvider = S.provider;
  var mine = S.managedProjects.filter(function(p){ return p.provider === curProvider; });
  if(mine.length === 0){
    return '<div style="font-size:11px;color:var(--t3);padding:12px 8px;text-align:center;border:1px dashed var(--bd);border-radius:8px">'+
      'No projects added yet.<br>Search above to add projects to your sidebar.</div>';
  }
  return mine.map(function(p){
    var isPinned = S.pinnedRepos.indexOf(p.id) !== -1;
    var isStarred = S.starredRepos.indexOf(p.id) !== -1;
    var taggedBranches = S.repoBranches[String(p.id)] || [];
    return '<div class="settings-repo-row" style="flex-direction:column;align-items:stretch;gap:6px" id="mpr-'+p.id+'">'+
      '<div style="display:flex;align-items:center;gap:8px">'+
      '<div style="display:flex;flex-direction:column;flex:1;min-width:0">'+
      '<div class="repo-name">'+p.name+'</div>'+
      '<div class="repo-ns">'+p.ns+'</div>'+
      '</div>'+
      // Pin button
      '<button class="stg-btn'+(isPinned?' active-pin':'')+'" data-ltip="'+(isPinned?'Unpin':'Pin to top')+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" onclick="togglePinRepo('+p.id+')">'+
      '<svg width="11" height="11" fill="'+(isPinned?'var(--pu)':'none')+'" stroke="'+(isPinned?'var(--pu)':'currentColor')+'" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="'+(isPinned?'white':'none')+'"/></svg>'+
      '</button>'+
      // Star button
      '<button class="stg-btn'+(isStarred?' active-pin':'')+'" data-ltip="'+(isStarred?'Unstar':'Star (show only starred)')+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" onclick="toggleStarRepo('+p.id+')">'+
      '<svg width="11" height="11" fill="'+(isStarred?'var(--am)':'none')+'" stroke="'+(isStarred?'var(--am)':'currentColor')+'" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>'+
      '</button>'+
      // Remove button
      '<button class="stg-btn" data-ltip="Remove from sidebar" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" onclick="removeManagedProject('+p.id+')" style="color:var(--re)">'+
      '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'+
      '</button>'+
      '</div>'+
      // Tagged branches chips
      (taggedBranches.length?
        '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:2px">'+
        taggedBranches.map(function(br){
          return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px 2px 8px;border-radius:10px;background:var(--puB);border:1px solid var(--bd2);font-size:10px;font-family:\'JetBrains Mono\',monospace;color:var(--pu)">'+
            '<svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>'+
            br+
            '<button onclick="removeRepoBranch('+p.id+',\''+br.replace(/'/g,"\\'")+'\');renderManagedProjList()" style="background:none;border:none;cursor:pointer;color:var(--pu);padding:0;margin-left:1px;display:flex;align-items:center;opacity:.6" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.6">'+
            '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'+
            '</button></span>';
        }).join('')+
        '</div>'
      :'')+
      // Add branch input
      '<div id="br-wrap-'+p.id+'" style="position:relative">'+
      '<div style="display:flex;align-items:center;gap:5px">'+
      '<svg width="11" height="11" fill="none" stroke="var(--t3)" stroke-width="2" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>'+
      '<input id="br-inp-'+p.id+'" class="inp inp-mono" placeholder="Tag a branch…" autocomplete="off" '+
      'oninput="settingsBranchInput('+p.id+',this.value)" '+
      'onfocus="settingsBranchFocus('+p.id+',this.value)" '+
      'onblur="setTimeout(function(){settingsBranchHideDrop('+p.id+')},200)" '+
      'onkeydown="settingsBranchKey(event,'+p.id+')" '+
      'style="height:24px;font-size:11px;flex:1;" />'+
      '<button class="stg-btn" id="br-add-'+p.id+'" data-ltip="Add branch" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" onclick="settingsBranchAdd('+p.id+')" style="width:24px;height:24px">'+
      '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
      '</button>'+
      '</div>'+
      '</div>'+
      '</div>';
  }).join('');
}

// Live API search for settings add-project panel
// Optimisations: debounce · min-2-chars · skip-unchanged · abort in-flight · client cache
var _stgSearchTimer = null;
var _stgSearchController = null;
var _stgLastQ = '';
var _stgCache = {};

function stgLiveSearch(q){
  S.stgSearchQ = q;
  var clrBtn = document.getElementById('stg-search-clr');
  if(clrBtn) clrBtn.style.display = q ? 'block' : 'none';
  clearTimeout(_stgSearchTimer);

  // 1. Min length — no point searching below 2 chars
  if(!q || q.length < 2){
    if(_stgSearchController){ _stgSearchController.abort(); _stgSearchController = null; }
    _stgLastQ = '';
    S.stgSearchRes = []; S.stgSearching = false;
    renderStgSearchResults([]);
    return;
  }

  // 2. Client cache hit — instant results, zero API calls
  var cacheKey = S.provider + ':' + q;
  if(_stgCache[cacheKey]){
    S.stgSearchRes = _stgCache[cacheKey];
    _stgLastQ = q;
    renderStgSearchResults(S.stgSearchRes);
    return;
  }

  // 3. Skip unchanged (re-focus with same text, cache miss means query changed provider)
  if(q === _stgLastQ) return;

  S.stgSearching = true;
  renderStgSearchResults(null);

  // 4. Debounce 300ms then fire
  _stgSearchTimer = setTimeout(async function(){
    // 5. Abort previous in-flight request
    if(_stgSearchController){ _stgSearchController.abort(); }
    _stgSearchController = new AbortController();
    var signal = _stgSearchController.signal;
    var capturedQ = q;

    try {
            var results;
      results = await glApi('/projects?search='+encodeURIComponent(capturedQ)+'&membership=true&per_page=20&order_by=last_activity_at', {signal: signal});
      results = results.filter(function(p){ return !p.archived && !p.marked_for_deletion_at; });
      results = results.map(function(p){
        return {id:p.id, name:p.name, ns:p.namespace?p.namespace.name:'', webUrl:p.web_url||'', provider:'gitlab', fullName:p.path_with_namespace||p.name};
      });
      _stgCache[cacheKey] = results;
      _stgLastQ = capturedQ;
      S.stgSearchRes = results;
    } catch(e){
      if(e && e.name === 'AbortError') return;
      S.stgSearchRes = [];
    }
    S.stgSearching = false;
    _stgSearchController = null;
    renderStgSearchResults(S.stgSearchRes);
  }, 300);
}

function renderStgSearchResults(results){
  var el2 = document.getElementById('stg-search-results');
  if(!el2) return;
  if(results === null){
    el2.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:8px 10px;display:flex;align-items:center;gap:6px">'+
      '<div class="spinner" style="width:12px;height:12px;border-width:2px"></div> Searching…</div>';
    return;
  }
  if(!results.length && S.stgSearchQ.length >= 1){
    el2.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:8px 10px">No results for "'+S.stgSearchQ+'"</div>';
    return;
  }
  if(!results.length){ el2.innerHTML = ''; return; }
  el2.innerHTML = results.map(function(p){
    var already = S.managedProjects.some(function(m){ return String(m.id)===String(p.id) && m.provider===S.provider; });
    var fn = JSON.stringify(p.fullName||'').replace(/"/g,'&quot;');
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--bd);cursor:default" onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'\'">'+
      '<div style="width:26px;height:26px;border-radius:6px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--t2);flex-shrink:0">'+p.name[0].toUpperCase()+'</div>'+
      '<div style="flex:1;min-width:0">'+
      '<div style="font-size:12px;font-weight:500;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+p.name+'</div>'+
      '<div style="font-size:10px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+p.ns+'</div>'+
      '</div>'+
      '<button id="stg-add-btn-'+p.id+'" '+(already?'disabled':'')+' '+
      'onclick="addManagedProject('+p.id+',\''+p.name.replace(/'/g,"\\'")+'\',\''+p.ns.replace(/'/g,"\\'")+'\',\''+p.webUrl.replace(/'/g,"\\'")+'\',\''+p.fullName.replace(/'/g,"\\'")+'\' )" '+
      'style="flex-shrink:0;padding:3px 10px;border-radius:6px;border:1px solid '+(already?'var(--grL)':'var(--pu)')+';background:'+(already?'var(--grB)':'var(--puG)')+';color:'+(already?'var(--gr)':'var(--pu)')+';font-size:11px;font-weight:600;cursor:'+(already?'default':'pointer')+';white-space:nowrap">'+
      (already?'✓ Added':'+ Add')+'</button>'+
      '</div>';
  }).join('');
}

/* ============================
   BEAUTIFUL EMPTY STATES
============================ */
function renderRunEmptyState(){
    var providerColor = '#fc6d26';
  var providerColorDark = 'rgba(252,109,38,0.12)';
  var providerBorder = 'rgba(252,109,38,0.3)';
  var steps = [
    { icon: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0c.06.05.1.11.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0c.06.05.1.11.11.18l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.92z"/></svg>', color:'#fc6d26', bg:'rgba(252,109,38,.1)', border:'rgba(252,109,38,.25)', label:'Select Project', desc:'Click any project letter in the sidebar to load it' },
    { icon: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>', color:'var(--pu)', bg:'var(--puG)', border:'var(--bd2)', label:'Choose Branch', desc:'Type or search the branch name (e.g. main, dev, feature/x)' },
    { icon: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>', color:'var(--bl)', bg:'var(--blB)', border:'var(--blL)', label:'Load Variables', desc:'Click Load to fetch CI/CD variables defined for the branch' },
    { icon: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>', color:'var(--gr)', bg:'var(--grB)', border:'var(--grL)', label:'Trigger Pipeline', desc:'Hit Run pipeline — your pipeline starts within seconds' }
  ]

  var stepHtml = steps.map(function(s, i){
    return '<div style="display:flex;flex-direction:column;align-items:center;position:relative;flex:1;min-width:0">'+
      // connector line
      (i < steps.length-1 ? '<div style="position:absolute;top:24px;left:calc(50% + 28px);right:calc(-50% + 28px);height:1.5px;background:linear-gradient(90deg,'+s.border+',var(--bd));z-index:0"></div>' : '')+
      // circle icon
      '<div style="width:48px;height:48px;border-radius:14px;border:1.5px solid '+s.border+';background:'+s.bg+';display:flex;align-items:center;justify-content:center;color:'+s.color+';position:relative;z-index:1;flex-shrink:0;box-shadow:0 2px 10px rgba(0,0,0,.07)">'+
      s.icon+
      '</div>'+
      // step number badge
      '<div style="margin-top:10px;width:18px;height:18px;border-radius:50%;background:'+s.color+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+
      '<span style="font-size:9px;font-weight:700;color:#fff;font-family:\'JetBrains Mono\',monospace">'+(i+1)+'</span>'+
      '</div>'+
      '<div style="margin-top:7px;font-size:12px;font-weight:600;color:var(--t1);text-align:center;white-space:nowrap">'+s.label+'</div>'+
      '<div style="margin-top:4px;font-size:10px;color:var(--t3);text-align:center;line-height:1.5;max-width:110px">'+s.desc+'</div>'+
      '</div>';
  }).join('');

  // Mock pipeline status pills
  var mockStatuses = [
    {label:'build', color:'var(--gr)', bg:'var(--grB)', border:'var(--grL)'},
    {label:'test',  color:'var(--gr)', bg:'var(--grB)', border:'var(--grL)'},
    {label:'deploy',color:'var(--pu)', bg:'var(--puG)', border:'var(--bd2)'}
  ];
  var mockPill = mockStatuses.map(function(ms){
    return '<div style="display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:7px;border:1px solid '+ms.border+';background:'+ms.bg+'">'+
      '<span style="width:6px;height:6px;border-radius:50%;background:'+ms.color+';flex-shrink:0'+(ms.label==='deploy'?';animation:pulse 1.4s ease-in-out infinite':'')+'""></span>'+
      '<span style="font-size:11px;font-weight:500;color:'+ms.color+';font-family:\'JetBrains Mono\',monospace">'+ms.label+'</span>'+
      '</div>';
  }).join('');

  return '<div style="height:100%;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 20px;background:var(--bg0)">'+
    '<div style="width:100%;max-width:700px;animation:fadeUp .4s ease">'+

    // Header — compact
    '<div style="text-align:center;margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:12px">'+
    '<div style="width:38px;height:38px;border-radius:11px;background:'+providerColorDark+';border:1.5px solid '+providerBorder+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+
    icoGitlab(20, providerColor) +
    '</div>'+
    '<div style="text-align:left">'+
    '<h2 style="font-size:15px;font-weight:700;color:var(--t1);margin:0 0 2px">How to Run a '+'Pipeline'+'</h2>'+
    '<p style="font-size:11px;color:var(--t3);margin:0">Follow these steps to trigger your '+'GitLab CI/CD pipeline'+'</p>'+
    '</div>'+
    '</div>'+

    // Steps diagram — reduced padding
    '<div style="background:var(--bg1);border:1px solid var(--bd);border-radius:12px;padding:18px 20px 16px;margin-bottom:12px;box-shadow:var(--sh)">'+
    '<div style="display:flex;align-items:flex-start;gap:0;justify-content:space-between;position:relative">'+
    stepHtml+
    '</div>'+
    '</div>'+

    // Mock result preview card — compact
    '<div style="background:var(--bg1);border:1px solid var(--bd);border-radius:10px;padding:10px 16px;margin-bottom:12px;box-shadow:var(--sh)">'+
    '<div style="font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">'+( 'Pipeline' )+' Preview</div>'+
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
    '<div style="display:flex;align-items:center;gap:6px;flex:1;min-width:180px">'+
    '<div style="width:7px;height:7px;border-radius:50%;background:var(--pu);animation:pulse 1.4s ease-in-out infinite;flex-shrink:0"></div>'+
    '<span style="font-size:11px;font-weight:600;color:var(--t1)">#2494</span>'+
    '<span style="font-size:10px;font-family:\'JetBrains Mono\',monospace;color:var(--t3)">main</span>'+
    '<span style="font-size:10px;color:var(--t3)">triggered just now</span>'+
    '</div>'+
    '<div style="display:flex;gap:5px;flex-wrap:wrap">'+mockPill+'</div>'+
    '</div>'+
    '</div>'+

    // CTA
    '<div style="text-align:center">'+
    '<div style="font-size:11px;color:var(--t4);display:flex;align-items:center;justify-content:center;gap:6px">'+
    '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
    'Select a project from the sidebar to get started'+
    '</div>'+
    '</div>'+

    '</div></div>';
}

function renderHistoryEmptyState(){
    var providerColor = '#fc6d26';
  var providerColorDark = 'rgba(252,109,38,0.12)';
  var providerBorder = 'rgba(252,109,38,0.3)';
  var steps = [
    { icon: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>', color:'var(--pu)', bg:'var(--puG)', border:'var(--bd2)', label:'Trigger a Run', desc:'Go to Run pipeline and trigger your first pipeline' },
    { icon: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0c.06.05.1.11.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0c.06.05.1.11.11.18l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.92z"/></svg>', color:'#fc6d26', bg:'rgba(252,109,38,.1)', border:'rgba(252,109,38,.25)', label:'Select Project', desc:'Click a project in the sidebar to load its run history' },
    { icon: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', color:'var(--bl)', bg:'var(--blB)', border:'var(--blL)', label:'Pick a Run', desc:'Select any pipeline from the left panel to inspect it' },
    { icon: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>', color:'var(--gr)', bg:'var(--grB)', border:'var(--grL)', label:'View Logs', desc:'Click any job row to stream real-time logs in a modal' }
  ]

  var stepHtml = steps.map(function(s, i){
    return '<div style="display:flex;flex-direction:column;align-items:center;position:relative;flex:1;min-width:0">'+
      (i < steps.length-1 ? '<div style="position:absolute;top:24px;left:calc(50% + 28px);right:calc(-50% + 28px);height:1.5px;background:linear-gradient(90deg,'+s.border+',var(--bd));z-index:0"></div>' : '')+
      '<div style="width:48px;height:48px;border-radius:14px;border:1.5px solid '+s.border+';background:'+s.bg+';display:flex;align-items:center;justify-content:center;color:'+s.color+';position:relative;z-index:1;flex-shrink:0;box-shadow:0 2px 10px rgba(0,0,0,.07)">'+s.icon+'</div>'+
      '<div style="margin-top:10px;width:18px;height:18px;border-radius:50%;background:'+s.color+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+
      '<span style="font-size:9px;font-weight:700;color:#fff;font-family:\'JetBrains Mono\',monospace">'+(i+1)+'</span></div>'+
      '<div style="margin-top:7px;font-size:12px;font-weight:600;color:var(--t1);text-align:center;white-space:nowrap">'+s.label+'</div>'+
      '<div style="margin-top:4px;font-size:10px;color:var(--t3);text-align:center;line-height:1.5;max-width:110px">'+s.desc+'</div>'+
      '</div>';
  }).join('');

  // Mock run list preview
  var mockRuns = [
    {id:'#2494', ref:'main', status:'success', c:'var(--gr)', bg:'var(--grB)', b:'var(--grL)', ago:'2m ago'},
    {id:'#2493', ref:'dev', status:'failed',  c:'var(--re)', bg:'var(--reB)', b:'var(--reL)', ago:'1h ago'},
    {id:'#2492', ref:'main', status:'running', c:'var(--am)', bg:'var(--amB)', b:'var(--amL)', ago:'just now', pulse:true}
  ];
  var mockRunHtml = mockRuns.map(function(r){
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:7px;border:1px solid '+r.b+';background:'+r.bg+';margin-bottom:5px">'+
      '<span style="width:7px;height:7px;border-radius:50%;background:'+r.c+';flex-shrink:0'+(r.pulse?';animation:pulse 1.4s ease-in-out infinite':'')+'""></span>'+
      '<span style="font-size:12px;font-weight:600;color:'+r.c+';font-family:\'JetBrains Mono\',monospace;flex-shrink:0">'+r.id+'</span>'+
      '<span style="font-size:11px;font-family:\'JetBrains Mono\',monospace;color:var(--t2);flex:1">'+r.ref+'</span>'+
      '<span style="font-size:10px;color:var(--t3)">'+r.ago+'</span>'+
      '<span style="font-size:9px;font-family:\'JetBrains Mono\',monospace;padding:2px 7px;border-radius:20px;border:1px solid '+r.b+';color:'+r.c+'">'+r.status+'</span>'+
      '</div>';
  }).join('');

  return '<div style="height:100%;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 20px;background:var(--bg0)">'+
    '<div style="width:100%;max-width:700px;animation:fadeUp .4s ease">'+

    '<div style="text-align:center;margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:12px">'+
    '<div style="width:38px;height:38px;border-radius:11px;background:'+providerColorDark+';border:1.5px solid '+providerBorder+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+
    icoGitlab(20, providerColor)+
    '</div>'+
    '<div style="text-align:left">'+
    '<h2 style="font-size:15px;font-weight:700;color:var(--t1);margin:0 0 2px">How to Use Run History</h2>'+
    '<p style="font-size:11px;color:var(--t3);margin:0">Track, inspect, and debug every pipeline run for your projects</p>'+
    '</div>'+
    '</div>'+

    '<div style="background:var(--bg1);border:1px solid var(--bd);border-radius:12px;padding:18px 20px 16px;margin-bottom:12px;box-shadow:var(--sh)">'+
    '<div style="display:flex;align-items:flex-start;gap:0;justify-content:space-between;position:relative">'+
    stepHtml+
    '</div>'+
    '</div>'+

    '<div style="background:var(--bg1);border:1px solid var(--bd);border-radius:10px;padding:10px 16px;margin-bottom:12px;box-shadow:var(--sh)">'+
    '<div style="font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Example Runs</div>'+
    mockRunHtml+
    '</div>'+

    '<div style="text-align:center">'+
    '<div style="font-size:11px;color:var(--t4);display:flex;align-items:center;justify-content:center;gap:6px">'+
    '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
    'Select a project from the sidebar to view its history'+
    '</div></div>'+
    '</div></div>';
}

function renderDashboardEmptyState(){
    var steps = [
    { icon: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>', color:'var(--pu)', bg:'var(--puG)', border:'var(--bd2)', label: 'Select Project', desc: 'Choose a project from the sidebar to analyse' },
    { icon: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>', color:'var(--bl)', bg:'var(--blB)', border:'var(--blL)', label:'Data Loads', desc: 'Pipeline history is automatically fetched from the GitLab API' },
    { icon: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>', color:'var(--am)', bg:'var(--amB)', border:'var(--amL)', label:'Charts Render', desc:'Success rate, run counts, durations, and failures charted' },
    { icon: '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>', color:'var(--gr)', bg:'var(--grB)', border:'var(--grL)', label:'Export CSV', desc: 'Download pipeline data as a CSV for offline analysis' }
  ];

  var stepHtml = steps.map(function(s, i){
    return '<div style="display:flex;flex-direction:column;align-items:center;position:relative;flex:1;min-width:0">'+
      (i < steps.length-1 ? '<div style="position:absolute;top:24px;left:calc(50% + 28px);right:calc(-50% + 28px);height:1.5px;background:linear-gradient(90deg,'+s.border+',var(--bd));z-index:0"></div>' : '')+
      '<div style="width:48px;height:48px;border-radius:14px;border:1.5px solid '+s.border+';background:'+s.bg+';display:flex;align-items:center;justify-content:center;color:'+s.color+';position:relative;z-index:1;flex-shrink:0;box-shadow:0 2px 10px rgba(0,0,0,.07)">'+s.icon+'</div>'+
      '<div style="margin-top:10px;width:18px;height:18px;border-radius:50%;background:'+s.color+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+
      '<span style="font-size:9px;font-weight:700;color:#fff;font-family:\'JetBrains Mono\',monospace">'+(i+1)+'</span></div>'+
      '<div style="margin-top:7px;font-size:12px;font-weight:600;color:var(--t1);text-align:center;white-space:nowrap">'+s.label+'</div>'+
      '<div style="margin-top:4px;font-size:10px;color:var(--t3);text-align:center;line-height:1.5;max-width:110px">'+s.desc+'</div>'+
      '</div>';
  }).join('');

  // Mock mini charts as SVG bars
  var barData = [40,65,30,80,55,90,70];
  var barHtml = barData.map(function(h, i){
    var colors = ['var(--gr)','var(--gr)','var(--re)','var(--gr)','var(--gr)','var(--gr)','var(--pu)'];
    return '<div style="flex:1;background:'+colors[i]+';border-radius:3px 3px 0 0;opacity:0.75;height:'+h+'%;transition:height .3s;cursor:default" data-ltip="Day '+(i+1)+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()"></div>';
  }).join('');

  var metricCards = [
    {label:'Total Runs', val:'247', color:'var(--t1)', sub:'+12 vs last week'},
    {label:'Success Rate', val:'94%', color:'var(--gr)', sub:'↑ 3% improvement'},
    {label:'Avg Duration', val:'3m 42s', color:'var(--bl)', sub:'↓ 18s faster'},
    {label:'Failed', val:'14', color:'var(--re)', sub:'↓ 5 fewer failures'}
  ];
  var metricsHtml = metricCards.map(function(m){
    return '<div style="flex:1;min-width:100px;background:var(--bg2);border:1px solid var(--bd);border-radius:8px;padding:10px 12px">'+
      '<div style="font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">'+m.label+'</div>'+
      '<div style="font-size:20px;font-weight:700;font-family:\'JetBrains Mono\',monospace;color:'+m.color+';margin-bottom:3px">'+m.val+'</div>'+
      '<div style="font-size:10px;color:var(--t3)">'+m.sub+'</div>'+
      '</div>';
  }).join('');

  return '<div style="height:100%;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 20px;background:var(--bg0)">'+
    '<div style="width:100%;max-width:700px;animation:fadeUp .4s ease">'+

    '<div style="text-align:center;margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:12px">'+
    '<div style="width:38px;height:38px;border-radius:11px;background:var(--puG);border:1.5px solid var(--bd2);display:flex;align-items:center;justify-content:center;flex-shrink:0">'+
    '<svg width="20" height="20" fill="none" stroke="var(--pu)" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'+
    '</div>'+
    '<div style="text-align:left">'+
    '<h2 style="font-size:15px;font-weight:700;color:var(--t1);margin:0 0 2px">How to Use the Dashboard</h2>'+
    '<p style="font-size:11px;color:var(--t3);margin:0">Get deep insights into your pipeline performance and trends</p>'+
    '</div>'+
    '</div>'+

    '<div style="background:var(--bg1);border:1px solid var(--bd);border-radius:12px;padding:18px 20px 16px;margin-bottom:12px;box-shadow:var(--sh)">'+
    '<div style="display:flex;align-items:flex-start;gap:0;justify-content:space-between;position:relative">'+
    stepHtml+
    '</div>'+
    '</div>'+

    // Mock dashboard preview — compact
    '<div style="background:var(--bg1);border:1px solid var(--bd);border-radius:10px;padding:10px 16px;margin-bottom:12px;box-shadow:var(--sh)">'+
    '<div style="font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Dashboard Preview</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'+metricsHtml+'</div>'+
    '<div style="background:var(--bg2);border:1px solid var(--bd);border-radius:7px;padding:8px 10px;overflow:hidden">'+
    '<div style="font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--t3);margin-bottom:6px">Daily Runs — Last 7 days</div>'+
    '<div style="display:flex;align-items:flex-end;gap:3px;height:44px;padding:0 2px">'+barHtml+'</div>'+
    '</div>'+
    '</div>'+

    '<div style="text-align:center">'+
    '<div style="font-size:11px;color:var(--t4);display:flex;align-items:center;justify-content:center;gap:6px">'+
    '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
    'Select a project from the sidebar to load your real analytics'+
    '</div></div>'+
    '</div></div>';
}

/* ============================
   TOPBAR
============================ */
function renderTopbar(title){
  var proj = S.glSelProj;
  var user = S.glUser;
  var avColor = '#fc6d26';
  var avBg2   = 'rgba(252,109,38,.15)';
  var avBorder= 'rgba(252,109,38,.3)';
  var ACCESS  = {10:'Guest',20:'Reporter',30:'Developer',40:'Maintainer',50:'Owner'};
  return (
    '<div class="topbar">'+
    '<span style="font-size:14px;font-weight:600;color:var(--t1);flex:1">'+title+
    (proj?'<span style="font-weight:400;color:var(--t2);font-size:12px;margin-left:8px">\u00b7 '+proj.name+'</span>':'')+
    '</span>'+
    '<span class="badge b-or">'+icoGitlab(10,'#fc6d26')+' GitLab</span>'+
    (proj?'<a href="'+(S.glUrl+'/'+proj.path_with_namespace)+'" target="_blank" style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--bl)">'+icoExt()+'<span>Open</span></a>':'')+
    (user?
      (function(){
        var avatarUrl = user.avatar_url || '';
        var isGravatar = avatarUrl.indexOf('gravatar') !== -1;
        var isSystemDefault = avatarUrl.indexOf('/assets/') !== -1 || avatarUrl.indexOf('no_one') !== -1;
        var isRealUpload = avatarUrl.indexOf('/uploads/user/avatar/') !== -1 || avatarUrl.indexOf('/uploads/-/') !== -1;
        var hasRealAvatar = avatarUrl && !isGravatar && !isSystemDefault && isRealUpload;
        var initial = (user.name || user.username || 'U')[0].toUpperCase();
        var avatarEl = hasRealAvatar
          ? '<img src="'+avatarUrl+'" style="width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1px solid '+avBorder+'" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">'
            +'<span style="display:none;width:22px;height:22px;border-radius:50%;background:'+avBg2+';border:1px solid '+avBorder+';align-items:center;justify-content:center;font-size:9px;font-weight:700;color:'+avColor+';flex-shrink:0">'+initial+'</span>'
          : '<span style="width:22px;height:22px;border-radius:50%;background:'+avBg2+';border:1px solid '+avBorder+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:'+avColor+';flex-shrink:0">'+initial+'</span>';
        var displayName = user.name || '';
        var handle = user.username || '';
        var email = user.email || user.public_email || '';
        var popHtml = (displayName?'<div style="font-size:12px;font-weight:700;color:var(--t1);line-height:1.4">'+displayName+'</div>':'')
          +(handle && handle !== displayName?'<div style="font-size:11px;color:var(--t3);line-height:1.4;margin-top:1px">@'+handle+'</div>':'')
          +(email?'<div style="font-size:11px;color:var(--t3);line-height:1.4;margin-top:1px">'+email+'</div>':'')+
          '';
        return '<div class="topbar-av-wrap" style="position:relative;display:inline-block"'+
          ' onmouseenter="showAvPop(this)" onmouseleave="hideAvPop(this)">'+
          '<div style="padding:3px;background:var(--bg2);border:1px solid var(--bd);border-radius:50%;cursor:default;display:flex;align-items:center;justify-content:center;position:relative">'+
          avatarEl+
          '<span style="position:absolute;bottom:0;right:0;width:8px;height:8px;border-radius:50%;background:var(--gr);border:2px solid var(--bg1)"></span>'+
          '</div>'+
          '<div class="av-pop" style="display:none;position:absolute;top:calc(100% + 8px);right:0;min-width:170px;background:var(--bg1);border:1px solid var(--bd);border-radius:9px;box-shadow:0 6px 20px rgba(0,0,0,.14);padding:10px 13px;z-index:99999;pointer-events:auto">'+
          '<div style="position:absolute;top:-5px;right:14px;width:9px;height:9px;background:var(--bg1);border-left:1px solid var(--bd);border-top:1px solid var(--bd);transform:rotate(45deg)"></div>'+
          popHtml+
          '</div>'+
          '</div>';
      })()
    : '')+
    '<button class="settings-gear-btn'+(S.settingsOpen?' open':'')+'" onclick="toggleSettings()" data-ltip="Settings" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()">'+icoGear(15)+'</button>'+
    '</div>'
  );
}

/* ============================
   LOGIN PAGE
============================ */
function renderLogin(){
  return (
    (function(){
      var dk = S.theme==='dark';
      var bgStyle       = dk ? 'background:linear-gradient(145deg,#002a55 0%,#001428 55%,#00213d 100%)' : 'background:#00aeef';
      var iconBg        = dk ? 'rgba(0,174,239,0.13)' : 'rgba(255,255,255,0.22)';
      var iconBd        = dk ? 'rgba(0,174,239,0.3)'  : 'rgba(255,255,255,0.4)';
      var titleColor    = dk ? '#00aeef'               : '#fff';
      var subColor      = dk ? 'rgba(0,174,239,0.65)'  : 'rgba(255,255,255,0.72)';
      var descColor     = dk ? '#7a90b8'               : 'rgba(255,255,255,0.88)';
      var cardBg        = dk ? '#0d1829'               : '#fff';
      var cardBorder    = dk ? 'rgba(0,174,239,0.2)'   : 'rgba(0,0,0,0.07)';
      var cardTopBorder = dk ? '#00aeef'               : '#00395d';
      var cardShadow    = dk ? '0 8px 40px rgba(0,0,0,.55),0 0 0 1px rgba(0,174,239,.08)' : '0 8px 32px rgba(0,57,93,.18)';
      var footerStarColor = dk ? '#00aeef'             : '#fff';
      var footerByColor   = dk ? 'rgba(0,174,239,0.45)': 'rgba(255,255,255,0.7)';
      var footerNameColor = dk ? '#00aeef'             : '#fff';
      var footerTeamColor = dk ? 'rgba(0,174,239,0.55)': '#fff';
      var togActiveBg = dk ? '#00aeef' : '#00395d';
      var pillBg   = dk ? 'rgba(0,174,239,0.12)' : 'rgba(0,57,93,0.10)';
      var pillBd   = dk ? 'rgba(0,174,239,0.28)' : 'rgba(0,57,93,0.22)';
      var lblLight = dk ? 'rgba(0,174,239,0.45)' : '#fff';
      var lblDark  = dk ? '#fff'                  : 'rgba(0,57,93,0.45)';
      return (
        '<div style="width:100%;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;'+bgStyle+';padding:20px 24px 20px;box-sizing:border-box;overflow-y:auto">'+
        '<div style="width:100%;max-width:440px;animation:fadeUp .4s ease">'+

        '<div style="margin-bottom:32px;display:flex;flex-direction:column;align-items:center;text-align:center" class="login-logo-wrap">'+
        '<img src="'+(dk?'assets/logo-brand-blue.svg':'assets/logo-brand-white.svg')+'" style="height:82px;width:auto;max-width:100%;display:block;margin:0 auto" class="login-logo" alt="Barclays GitLab Orchestrator"/>'+
        '<p style="font-size:12.5px;color:'+descColor+';margin:10px 0 0;line-height:1.4">Trigger pipelines, inspect jobs &amp; track CI/CD runs across all your GitLab projects</p>'+
        '</div>'+

        '<div style="background:'+cardBg+';border:1px solid '+cardBorder+';border-top:3px solid '+cardTopBorder+';border-radius:12px;padding:32px 28px 28px;box-shadow:'+cardShadow+';position:relative">'+

        /* ── Theme switcher: pill toggle ── */
        '<div style="position:absolute;top:10px;right:12px">'+
        '<button onclick="toggleTheme()" aria-label="Toggle theme" style="width:32px;height:16px;padding:0;border-radius:8px;background:'+(dk?'var(--barc)':cardBorder)+';border:1.5px solid '+(dk?'#00aeef':cardBorder)+';position:relative;cursor:pointer;transition:background .2s,border-color .2s">'+
        '<div style="position:absolute;top:2px;left:'+(dk?'15px':'2px')+';width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:left .2s"></div>'+
        '</button>'+
        '</div>'+

        '<div id="gl-err" style="display:none;background:var(--reB);border:1px solid var(--reL);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--re);margin-bottom:18px"></div>'+
        /* Section label */
        '<div style="font-size:9.5px;font-family:\'JetBrains Mono\',monospace;letter-spacing:.12em;text-transform:uppercase;color:'+(dk?'rgba(0,174,239,0.5)':'rgba(0,57,93,0.4)')+';margin-bottom:14px;display:flex;align-items:center;gap:10px" class="login-section-lbl">'+
        '<div style="flex:1;height:1px;background:'+(dk?'rgba(0,174,239,0.12)':'rgba(0,57,93,0.1)')+';"></div>'+
        '<span>GitLab Connection</span>'+
        '<div style="flex:1;height:1px;background:'+(dk?'rgba(0,174,239,0.12)':'rgba(0,57,93,0.1)')+';"></div>'+
        '</div>'+
        /* GitLab URL field */
        '<div style="margin-bottom:14px" class="login-field-url">'+
        '<label style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:'+(dk?'rgba(0,174,239,0.7)':'rgba(0,57,93,0.55)')+';margin-bottom:8px;font-family:\'JetBrains Mono\',monospace">'+icoExt()+' GitLab Instance URL</label>'+
        '<input id="gl-url" class="inp inp-mono" placeholder="https://gitlab.com" value="'+S.glUrl+'" style="height:40px;border-radius:9px;font-size:12.5px;border:1.5px solid '+(dk?'rgba(0,174,239,0.2)':'rgba(0,57,93,0.15)')+';"/>'+
        '<div style="font-size:10.5px;color:var(--t3);margin-top:7px;padding-left:2px">Self-hosted? Use your instance URL instead of gitlab.com</div>'+
        '</div>'+
        /* Token field */
        '<div style="margin-bottom:20px" class="login-field-tok">'+
        '<label style="display:flex;align-items:center;gap:6px;font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:'+(dk?'rgba(0,174,239,0.7)':'rgba(0,57,93,0.55)')+';margin-bottom:8px;font-family:\'JetBrains Mono\',monospace">'+icoLock()+' Personal Access Token</label>'+
        '<input id="gl-token" type="password" class="inp inp-mono" placeholder="glpat-xxxxxxxxxxxxxxxxxxxx" value="'+S.glToken+'" onkeydown="if(event.key===\'Enter\')doGLLogin()" style="height:40px;border-radius:9px;font-size:12.5px;border:1.5px solid '+(dk?'rgba(0,174,239,0.2)':'rgba(0,57,93,0.15)')+';"/>'+
        '<div style="font-size:10.5px;color:var(--t3);margin-top:7px;padding-left:2px">Requires <code style="color:var(--barc);background:rgba(0,174,239,.12);padding:2px 6px;border-radius:4px;font-size:10px;border:1px solid rgba(0,174,239,.2)">api</code> scope &nbsp;&middot;&nbsp; <a href="https://gitlab.com/-/user_settings/personal_access_tokens" target="_blank" style="color:var(--barc);text-decoration:none;font-weight:600">Generate token \u2192</a></div>'+
        '</div>'+
        /* Connect button */
        '<button class="btn" id="gl-btn" onclick="doGLLogin()" style="width:100%;height:50px;font-size:14px;background:linear-gradient(135deg,#00aeef 0%,#0090cc 100%);color:#fff;border:none;font-weight:700;border-radius:10px;letter-spacing:.03em;box-shadow:0 4px 18px rgba(0,174,239,.3);transition:all .2s" onmouseover="this.style.background=\'linear-gradient(135deg,#00c4ff 0%,#00aeef 100%)\';this.style.boxShadow=\'0 6px 24px rgba(0,174,239,.5)\';this.style.transform=\'translateY(-1px)\'" onmouseout="this.style.background=\'linear-gradient(135deg,#00aeef 0%,#0090cc 100%)\';this.style.boxShadow=\'0 4px 18px rgba(0,174,239,.3)\';this.style.transform=\'none\'">'+
        '<span style="display:flex;align-items:center;justify-content:center;gap:8px">'+icoGitlab(16,'white')+'Connect to GitLab</span>'+
        '</button>'+
        '</div>'+

        '<div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:8px">'+
        '<div style="display:inline-flex;align-items:center;gap:5px">'+
        '<svg width="9" height="9" viewBox="0 0 24 24" fill="'+footerStarColor+'" stroke="none"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>'+
        '<span style="font-size:10px;color:'+footerByColor+'">Developed by</span>'+
        '<span style="font-size:10.5px;font-weight:700;color:'+footerNameColor+';font-family:\'JetBrains Mono\',monospace">Sreekanth Kothapalli</span>'+
        '</div>'+
        '<div style="display:inline-flex;align-items:center;gap:5px">'+
        '<svg width="20" height="22" viewBox="0 0 278.41 300" fill="'+(dk?'#00aeef':'#fff')+'" opacity="1"><path d="M277.64,103.3a194.07,194.07,0,0,1-.25,36.83c-1.56,18-4.56,28.74-8.88,40.26a196.4,196.4,0,0,1-15.81,32.92l-.36.58c-1.88,3.07-3.26,5.32-4,6.38l-.45-.5c-.71-.74-1.77-1.85-3.41-3.48-2.39-2.4-9.12-11.18-11-13.88a97.5,97.5,0,0,1-7.32-12.17l-1-2.17-1.88,1.48a9.21,9.21,0,0,0-3.12,7.41c0,2.69.66,5.81,2.29,11.51a107.18,107.18,0,0,0,8.56,20.38c.44.83.89,1.64,1.31,2.39,2.51,4.51,3.48,6.57,2.29,7.43a.85.85,0,0,1-.55.16c-1.49,0-4.24-1.42-7.36-3.8-2.77-2.11-10.19-8.39-19.17-20.94A188.31,188.31,0,0,1,190,184.22l-.78-1.64a12.77,12.77,0,0,0-2.19,1,4.73,4.73,0,0,0-1.79,1.76,11.51,11.51,0,0,0-1,7.07c.82,6.68,4.74,16.88,7.9,24.24,5.34,12.43,15.16,26.41,22.46,36,.28.37.61.76,1,1.16s1,1.21,1.36,1.71c-.64.65-2.13,1.87-3.93,3.35l-2.69,2.18a201.27,201.27,0,0,1-31.1,21.14c-9.12,5.1-27.68,14.52-40,17.81-12.31-3.29-30.86-12.71-40-17.81a200.34,200.34,0,0,1-31.12-21.14l-2.75-2.24c-1.8-1.47-3.29-2.7-3.89-3.32.29-.37,2.05-2.47,2.34-2.84,7.29-9.52,17.11-23.49,22.46-36,3.15-7.35,7.08-17.52,7.91-24.25a11.59,11.59,0,0,0-1-7,4.92,4.92,0,0,0-2.31-2.12l-1.67-.7-.79,1.63A188.62,188.62,0,0,1,71,214.09C62,226.63,54.56,232.91,51.78,235c-3.07,2.34-5.88,3.8-7.36,3.8a.84.84,0,0,1-.46-.1l-.28-.22c-.89-.94.12-3,2.51-7.3l1.29-2.36A108.78,108.78,0,0,0,56,208.48c1.64-5.72,2.26-8.84,2.3-11.52a9.19,9.19,0,0,0-3.13-7.41l-1.88-1.48-1,2.17A96.25,96.25,0,0,1,45,202.41c-1.9,2.71-8.63,11.51-11,13.88-1.64,1.63-2.7,2.75-3.41,3.49-.17.19-.32.34-.45.47-.8-1.08-2.25-3.44-4.23-6.67a195.86,195.86,0,0,1-16-33.19C5.57,168.86,2.57,158.1,1,140.13a193,193,0,0,1-.24-36.86c1.39-14.42,5-28,10.17-38.33,7.3-14.57,16.4-23.2,27.8-26.4a46.71,46.71,0,0,1,12.34-1.75c9.06,0,16.29,3,21.5,8.85A14.13,14.13,0,0,1,75.5,58.22c-1,4-3.79,6.52-7.47,8.25a12.85,12.85,0,0,1-2,.72,9.3,9.3,0,0,0,1.1,2.09c3.64,5.87,10.73,9,20.47,9a51.94,51.94,0,0,0,7-.5C108.45,75.8,114.69,67.05,117,50.2c.89-6.58,1.74-12.11-2.5-19-3-4.8-11.45-7.63-17.65-7.61-5.54,0-8.48,1.47-10.25,3.32-.08-.27-.47-.73-.57-1a9.85,9.85,0,0,1-.64-6.24,15.61,15.61,0,0,1,5-8.17,28.59,28.59,0,0,1,12.79-6.28,42.93,42.93,0,0,1,9.06-1.12c.71,0,3.06,0,4.11.07.45,0,.53-.16.86-.57,2-2.45,5.22-3.79,11-3.66,4.47.1,10.43.33,15.12,1.83A32.13,32.13,0,0,1,152.05,6a19.59,19.59,0,0,1,7,9.28,70.16,70.16,0,0,1,3.22,20c.32,15.56,2.53,25,6.89,30.64,7,9.08,13,11,20.29,11.44h.79c13.71,0,18.71-4.35,20.94-7.66a30.68,30.68,0,0,0,1.71-2.67,18.93,18.93,0,0,1-2.85-.73,11.22,11.22,0,0,1-7-7.87,14.17,14.17,0,0,1,2.82-12.8c6.5-7.55,16.18-8.79,21.37-8.86h.58a38.86,38.86,0,0,1,11.77,1.79,40.71,40.71,0,0,1,13.15,6.75c7.11,5.69,11.6,13.46,14.71,19.58C272.57,75,276.38,89.33,277.64,103.3Z"/></svg>'+
        '<span style="font-size:10px;font-weight:700;color:'+(dk?'#00aeef':'#fff')+';font-family:\'JetBrains Mono\',monospace;letter-spacing:.04em">EaaS Release Team</span>'+
        '</div>'+
        '</div>'+

        '</div></div>'
      );
    })()
  );
}

function reLogin(){ S.provider='gitlab'; var main=document.querySelector('.page-wrap'); if(main) main.innerHTML=renderLogin(); else render(); }

async function doGLLogin(){
  var urlVal = el('gl-url')?el('gl-url').value.trim():'';
  var tokenVal = el('gl-token')?el('gl-token').value.trim():'';
  if(!tokenVal) return;
  if(urlVal) S.glUrl = urlVal.replace(/\/+$/,'');
  var btn=el('gl-btn'); var errEl=el('gl-err');
  btn.disabled=true; btn.innerHTML=icoSpin()+' Authenticating…';
  errEl.style.display='none';
  try {
    S.glToken=tokenVal;
    var user=await glApi('/user');
    S.glUser=user;
    S.provider='gitlab';
    try { localStorage.setItem('pipeline_runner_gl_url', S.glUrl); } catch(e){}
    saveSession(true);
    toast('Welcome, '+(user.name||user.username)+'!');
    startSessionTimer();
    goTo('run');
  } catch(e) {
    S.glToken='';
    errEl.style.display='block';
    errEl.innerHTML = e.message&&e.message.includes('Failed to fetch')
      ? '<b>Network error:</b> Cannot reach GitLab API. Check your URL or try a local server.'
      : 'Auth failed: '+(e.message||'unknown error')+'. Check your token and GitLab URL.';
    btn.disabled=false;
    btn.innerHTML=icoGitlab(14,'white')+' Connect to GitLab';
  }
}


/* ============================
   GITLAB: RUN PAGE
============================ */
function renderGLRun(){
  if(!S.glSelProj) return renderRunEmptyState();
  var b=S.glBranchInfo;
  var lvl = S.glAccessLevel || 30;
  var canRun = lvl >= 30;
  var accessName = {10:'Guest',20:'Reporter',30:'Developer',40:'Maintainer',50:'Owner'}[lvl] || ('Level '+lvl);

  // ── Access warning banner ──
  var accessBanner = !canRun
    ? '<div class="info-bar info-am" style="padding:12px 16px;border-radius:11px;align-items:flex-start;gap:10px;margin-bottom:16px">'+
      '<svg width="18" height="18" fill="none" stroke="var(--am)" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0;margin-top:1px"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'+
      '<div style="flex:1;min-width:0">'+
      '<div style="font-size:12px;font-weight:700;color:var(--am);margin-bottom:3px">Read-only — no permission to run pipelines</div>'+
      '<div style="font-size:11px;color:var(--t2);line-height:1.55">Token has <b>'+accessName+'</b> access. <b>Developer</b> role or higher is required to trigger pipelines.</div>'+
      '</div></div>'
    : '';

  // ── Branch card ──
  var branchCard =
    '<div class="gl-branch-card">'+
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px" class="login-field-url">'+
    '<div style="width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,rgba(252,109,38,.15),rgba(92,79,214,.12));border:1px solid var(--bd2);display:flex;align-items:center;justify-content:center">'+
    icoBranch()+
    '</div>'+
    '<div>'+
    '<div style="font-size:11px;font-weight:700;color:var(--t1);text-transform:uppercase;letter-spacing:.06em;font-family:\'JetBrains Mono\',monospace">Branch / Ref</div>'+
    (S.glAllBranches.length?'<div style="font-size:10px;color:var(--t3);margin-top:1px">'+S.glAllBranches.length+' branches available</div>':'')+
    '</div>'+
    '</div>'+
    '<div style="display:flex;gap:10px;position:relative">'+
    '<div style="flex:1;position:relative">'+
    '<input id="gl-branch-inp" class="inp inp-mono" placeholder="Search or type branch name…" value="'+S.glBranch+'" oninput="glBranchDebounce(this.value)" onfocus="glFocusBranch()" onblur="setTimeout(function(){S.glShowDrop=false;glUpdateDrop();},200)" onkeydown="glBranchKey(event)" style="height:40px;font-size:12px;border-radius:9px;padding-left:14px"/>'+
    '</div>'+
    '<button class="btn btn-pu" onclick="loadGLBranchParams()" '+(S.loading.branch||!S.glBranch.trim()?'disabled':'')+' style="height:40px;padding:0 20px;border-radius:9px;font-size:13px;font-weight:600;gap:7px;flex-shrink:0">'+
    (S.loading.branch?icoSpin():icoRefresh())+' Load</button>'+
    '</div>'+
    (b?'<div style="margin-top:12px;display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--grB);border:1px solid var(--grL);border-radius:9px;flex-wrap:wrap">'+
    '<span style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--gr);font-family:\'JetBrains Mono\',monospace">'+
    '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>'+
    b.name+'</span>'+
    (b.commit?'<span style="font-size:10px;color:var(--t3);font-family:\'JetBrains Mono\',monospace">'+b.commit.short_id+' · '+b.commit.author_name+' · '+timeAgo(b.commit.committed_date)+'</span>':'')+
    '</div>':'')+
    '</div>';

  return (
    '<div class="page" style="max-width:1060px;margin:0 auto">'+
    accessBanner+
    branchCard+
    (b?renderGLVarsCard():'')+
    (b?(function(){
      var lvl2 = S.glAccessLevel || 30;
      var canRun2 = lvl2 >= 30;
      var accessName2 = {10:'Guest',20:'Reporter',30:'Developer',40:'Maintainer',50:'Owner'}[lvl2] || ('Level '+lvl2);
      // Run bar width mirrors vars panel; if no vars loaded, match branch card (760px)
      // Run bar never exceeds branch card width (760px), only shrinks when panel is narrower
      var _panelW = S._varsPanelMaxW || 'none';
      var _rbMaxW = (_panelW === 'none' || parseInt(_panelW) > 760) ? '760px' : _panelW;
      var _rbStyle = 'max-width:'+_rbMaxW+';';

      if(!canRun2){
        return '<div class="gl-run-bar" style="'+_rbStyle+'display:flex;gap:10px">'+
          '<button class="btn-clear-refined" onclick="clearGLBranch()">Clear</button>'+
          '<div style="flex:1;display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--amB);border:1px solid var(--amL);border-radius:10px">'+
          '<svg width="16" height="16" fill="none" stroke="var(--am)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
          '<div style="font-size:12px;color:var(--am);font-weight:600">Read-only access · '+accessName2+' role</div>'+
          '</div></div>';
      }
      if(S.glVarPermError){
        return '<div class="gl-run-bar" style="'+_rbStyle+'display:flex;flex-direction:column;gap:12px">'+
          '<div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:var(--amB);border:1px solid var(--amL);border-radius:10px">'+
          '<svg width="16" height="16" fill="none" stroke="var(--am)" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
          '<div style="flex:1;min-width:0">'+
          '<div style="font-size:12px;font-weight:600;color:var(--am);margin-bottom:3px">Project restricts pipeline variable overrides</div>'+
          '<div style="font-size:11px;color:var(--t2);line-height:1.55">Either trigger without variables, or update project CI/CD settings to allow variable overrides.</div>'+
          '</div></div>'+
          '<div style="display:flex;gap:10px">'+
          '<button class="btn-clear-refined" onclick="clearGLBranch()">Clear</button>'+
          '<button class="btn btn-ghost" onclick="S.glVarPermError=false;reRunPage()" style="flex:1;height:48px;border-radius:10px;font-size:13px">Edit Variables</button>'+
          '<button class="btn btn-run-glow" onclick="triggerGLPipeline(true)" '+(S.loading.trigger?'disabled':'')+' style="flex:2">'+
          (S.loading.trigger?icoSpin()+' Triggering…':icoPlay()+' Run without variables')+
          '</button></div></div>';
      }

      var _missingReq = (S.glBranchInfo ? (S.glCiInputVars||[]) : []).filter(function(v){
        return v.required && !(S.glParamVals[v.key]||'').trim();
      });
      var _missingBanner = _missingReq.length
        ? '<div id="gl-missing-banner" style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:var(--reB);border:1px solid var(--reL);border-radius:10px;margin-bottom:12px">'+
          '<svg width="15" height="15" fill="none" stroke="var(--re)" stroke-width="2.2" viewBox="0 0 24 24" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
          '<div style="flex:1;min-width:0">'+
          '<div style="font-size:12px;font-weight:600;color:var(--re);margin-bottom:6px">'+_missingReq.length+' required field'+(
            _missingReq.length > 1 ? 's' : ''
          )+' missing</div>'+
          '<div style="display:flex;flex-wrap:wrap;gap:4px">'+
          _missingReq.map(function(v){
            return '<span style="font-family:\'JetBrains Mono\',monospace;font-size:10px;font-weight:700;background:rgba(214,48,49,.15);color:var(--re);border-radius:5px;padding:2px 8px;border:1px solid var(--reL)">'+v.key+'</span>';
          }).join('')+
          '</div>'+
          '</div></div>'
        : '<div id="gl-missing-banner" style="display:none"></div>';

      // Fix #6: Button is disabled only when there are missing required vars OR loading.
      // On initial render, we check actual values against required fields.
      var _btnDisabled = _missingReq.length > 0 || S.loading.trigger;
      return '<div class="gl-run-bar" style="'+_rbStyle+'">'+
        _missingBanner+
        '<div style="display:flex;gap:10px;align-items:center">'+
        '<button class="btn-clear-refined" onclick="clearGLBranch()">Clear</button>'+
        '<button class="btn btn-run-glow" onclick="triggerGLPipeline()" '+(_btnDisabled?'disabled':'')+' style="flex:1;'+ (_btnDisabled?'opacity:0.5;cursor:not-allowed;':'')+'" id="gl-run-btn">'+
        (S.loading.trigger?icoSpin()+' Triggering…':icoPlay()+' Run pipeline on <b style="font-family:\'JetBrains Mono\',monospace;font-size:13px;margin-left:4px">'+S.glBranch+'</b>')+
        '</button></div></div>';
    })():'')+
    '</div>'
  );
}

function toggleGLVarDisabled(projId, varKey){
  var key = String(projId);
  var arr = S.glVarDisabled[key] ? S.glVarDisabled[key].slice() : [];
  var idx = arr.indexOf(varKey);
  if(idx !== -1) arr.splice(idx, 1);
  else arr.push(varKey);
  S.glVarDisabled[key] = arr;
  saveSettings();
  // Patch just the variable cell instead of full re-render
  var cell = document.querySelector('.ci-input-cell[data-varkey="'+varKey.replace(/'/g,"\\'")+'"]');
  if(cell){
    var isNowDisabled = arr.indexOf(varKey) !== -1;
    var inp = cell.querySelector('input,select');
    var toggle = cell.querySelector('.var-toggle-btn');
    if(inp){
      if(isNowDisabled){
        inp.disabled = true; inp.style.opacity='0.4'; inp.style.textDecoration='line-through';
      } else {
        inp.disabled = false; inp.style.opacity=''; inp.style.textDecoration='';
      }
    }
    if(toggle){
      toggle.title = isNowDisabled ? 'Enable — include this variable when running' : 'Disable — skip this variable when running';
      toggle.style.background = isNowDisabled ? 'var(--amB)' : 'transparent';
      toggle.style.borderColor = isNowDisabled ? 'var(--amL)' : 'var(--bd)';
      toggle.style.color = isNowDisabled ? 'var(--am)' : 'var(--t4)';
      toggle.innerHTML = isNowDisabled
        ? '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
        : '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    }
    if(isNowDisabled) cell.style.opacity='0.5'; else cell.style.opacity='';
  }
}

function renderGLVarsCard(){
  // Render CI vars first so renderCiInputVars() sets S._varsPanelMaxW, then read it
  var _ciHtml = (S.glCiInputVars && S.glCiInputVars.length ? renderCiInputVars() : '');
  var _vMaxW = S._varsPanelMaxW || 'none';
  return (
    '<div class="gl-vars-panel" style="max-width:'+_vMaxW+';transition:max-width .2s ease">'+
    _ciHtml+
    '<div style="border-top:1px solid var(--bd);padding-top:14px;margin-top:4px">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'+
    '<div style="display:flex;align-items:center;gap:8px">'+
    '<div style="width:24px;height:24px;border-radius:7px;background:var(--bg2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center">'+
    '<svg width="11" height="11" fill="none" stroke="var(--t3)" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>'+
    '</div>'+
    '<span style="font-size:10px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.07em;font-family:\'JetBrains Mono\',monospace">Ad-hoc variables</span>'+
    '</div>'+
    '<button class="btn btn-ghost btn-sm" onclick="addGLAdhoc()" style="height:28px;border-radius:7px;font-size:11px;gap:4px">'+
    '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
    ' Add variable</button>'+
    '</div>'+
    (S.glAdhoc.length === 0
      ? '<div style="text-align:center;padding:16px;color:var(--t4);font-size:11px;font-family:\'JetBrains Mono\',monospace;background:var(--bg2);border-radius:9px;border:1px dashed var(--bd)">No ad-hoc variables — click Add to inject custom key/value pairs</div>'
      : S.glAdhoc.map(function(r,i){
          return '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">'+
            '<div style="width:22px;height:22px;border-radius:6px;background:var(--bg3);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--t3);font-family:\'JetBrains Mono\',monospace;flex-shrink:0">'+(i+1)+'</div>'+
            '<input class="inp inp-mono" placeholder="KEY" value="'+r.key.replace(/"/g,'&quot;')+'" onchange="S.glAdhoc['+i+'].key=this.value" style="flex:0 0 160px;height:32px;font-size:11px;border-radius:8px"/>'+
            '<svg width="12" height="12" fill="none" stroke="var(--t4)" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0"><path d="M5 12h14"/></svg>'+
            '<input class="inp inp-mono" placeholder="value" value="'+r.value.replace(/"/g,'&quot;')+'" onchange="S.glAdhoc['+i+'].value=this.value" style="flex:1;height:32px;font-size:11px;border-radius:8px"/>'+
            '<button class="btn btn-danger btn-sm" onclick="rmGLAdhoc('+i+')" style="width:32px;height:32px;padding:0;border-radius:8px;flex-shrink:0">'+icoX()+'</button>'+
            '</div>';
        }).join('')
    )+
    '</div></div>'
  );
}


/* ── Branch dropdown: update ONLY the dropdown div, never re-render the whole page ── */
function glUpdateDrop(){
  var inp = document.getElementById('gl-branch-inp');
  if(!inp) return;
  var container = inp.parentNode; // position:relative div
  // Remove existing drop if any
  var old = container.querySelector('.drop') || document.getElementById('gl-branch-drop');
  if(old) old.remove();
  if(!S.glShowDrop || !S.glBranchSugs.length) return;
  var d = document.createElement('div');
  d.className = 'drop';
  d.id = 'gl-branch-drop';
  // Position using fixed coords so it escapes overflow:hidden on the card
  var rect = inp.getBoundingClientRect();
  d.style.top    = (rect.bottom + 4) + 'px';
  d.style.left   = rect.left + 'px';
  d.style.width  = rect.width + 'px';
  d.innerHTML = S.glBranchSugs.map(function(s){
    return '<div class="drop-item'+(s===S.glBranch?' active':'')+'" onmousedown="glSelBranch(\''+s.replace(/'/g,"\\'")+'\')">'+ icoBranch()+' '+s+'</div>';
  }).join('');
  // Append to body so overflow:hidden on ancestors cannot clip it
  document.body.appendChild(d);
  // Scroll active into view
  var act=d.querySelector('.active'); if(act) act.scrollIntoView({block:'nearest'});
}

var glBranchTimer=null;
function glBranchDebounce(q){
  clearTimeout(glBranchTimer);
  S.glBranch = q;
  // Update Load button state
  var btn = document.querySelector('.btn-pu[onclick="loadGLBranchParams()"]');
  if(btn) btn.disabled = !q.trim() || S.loading.branch;
  if(S.glAllBranches.length){
    // Instant local filter — NO page re-render, just patch the dropdown
    var lq = q.toLowerCase();
    S.glBranchSugs = q ? S.glAllBranches.filter(function(b){ return b.toLowerCase().indexOf(lq)!==-1; }) : S.glAllBranches;
    S.glShowDrop = S.glBranchSugs.length > 0;
    glUpdateDrop();
  } else if(q.length >= 2){
    // API search after 2 chars with debounce — do NOT re-render during typing
    glBranchTimer = setTimeout(function(){ glSearchBranches(q); }, 250);
  } else {
    S.glBranchSugs = []; S.glShowDrop = false; glUpdateDrop();
  }
}

async function glSearchBranches(q){
  if(!S.glSelProj || !q) return;
  try {
    var b = await glApi('/projects/'+S.glSelProj.id+'/repository/branches?search='+encodeURIComponent(q)+'&per_page=30');
    S.glBranchSugs = b.map(function(x){ return x.name; });
    S.glShowDrop = S.glBranchSugs.length > 0;
  } catch(e){}
  glUpdateDrop(); // only patch the dropdown, keep focus
}

function glSelBranch(n){
  S.glBranch = n;
  S.glShowDrop = false;
  var inp = document.getElementById('gl-branch-inp');
  if(inp){ inp.value = n; }
  glUpdateDrop();
  // Auto-load pipeline params immediately on branch selection
  if(n && S.glSelProj) loadGLBranchParams();
}

function glFocusBranch(){
  var lq = (S.glBranch||'').toLowerCase();
  if(S.glAllBranches.length){
    S.glBranchSugs = lq ? S.glAllBranches.filter(function(b){ return b.toLowerCase().indexOf(lq)!==-1; }) : S.glAllBranches;
    S.glShowDrop = S.glBranchSugs.length > 0;
    glUpdateDrop();
  } else if(lq.length >= 2){
    glSearchBranches(lq);
  }
}
function glBranchKey(e){
  if(e.key==='Enter'){ S.glShowDrop=false; glUpdateDrop(); loadGLBranchParams(); return; }
  if(e.key==='Escape'){ S.glShowDrop=false; glUpdateDrop(); return; }
  if((e.key==='ArrowDown'||e.key==='ArrowUp')&&S.glBranchSugs.length){
    var idx=S.glBranchSugs.indexOf(S.glBranch);
    idx = e.key==='ArrowDown' ? Math.min(idx+1,S.glBranchSugs.length-1) : Math.max(idx-1,0);
    S.glBranch=S.glBranchSugs[idx];
    var inp=document.getElementById('gl-branch-inp'); if(inp) inp.value=S.glBranch;
    S.glShowDrop=true; glUpdateDrop();
    e.preventDefault();
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC VARIABLE ENGINE — v7
//
// Handles ALL real-world .gitlab-ci.yml variable patterns:
//
//  1. spec:inputs:  (GitLab 17+ component inputs)
//       • $[[ inputs.name ]]  interpolation inside variable values
//       • type: string | number | boolean | array
//       • options: [...], default:, description:, required:
//
//  2. variables: block (top-level + job-level)
//       • Simple:    KEY: "value"
//       • Ref-CI:    KEY: "$CI_REGISTRY_IMAGE"         → show resolved hint
//       • Ref-input: KEY: "$[[ inputs.image_tag ]]"    → linked to spec:inputs var
//       • Ref-var:   KEY: "$OTHER_VAR/suffix"          → show dependency chain
//       • Expand:    KEY: "${BASE_URL}/api"            → live preview
//       • Script override: export KEY="val" / KEY="val" in script blocks
//
//  3. Branch-aware script analysis (Pass 3)
//       • CI_COMMIT_REF_NAME / CI_COMMIT_BRANCH guards
//       • rules: if: conditions → manual / never / always
//       • export VAR=val  → auto-fill for matched branch
//       • [ -z "$VAR" ]   → mark required
//       • ${VAR:?msg}     → mark required
//
//  4. Variable resolution preview
//       • resolveVarPreview(key, vars, ciVars, branch) → computed string
//       • Shown in UI as "Resolved: …" when value contains $… / $[[…]]
//
//  5. Job-level variable: blocks — merged with top-level (job overrides win)
//
//  6. Input variable linkage
//       • Vars referencing $[[ inputs.X ]] are linked; changing the input
//         also updates the downstream var preview live in the UI.
// ═══════════════════════════════════════════════════════════════════════════════

// Resolve a variable value to a preview string given the current input values.
// Returns null if value contains no expandable references (no preview needed).
function resolveVarPreview(rawValue, paramVals, ciVars, glBranch) {
  if(!rawValue || typeof rawValue !== 'string') return null;
  var hasRef = rawValue.indexOf('$') !== -1 || rawValue.indexOf('$[[') !== -1;
  if(!hasRef) return null;

  var out = rawValue;

  // 1. Expand $[[ inputs.NAME ]] → current input value
  out = out.replace(/\$\[\[\s*inputs\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\]\]/g, function(_, name){
    return (paramVals && paramVals[name] !== undefined) ? paramVals[name] : ('$[[inputs.'+name+']]');
  });

  // 2. Expand ${VAR} and $VAR from paramVals and other ciVars
  function expandVarRef(name){
    if(paramVals && paramVals[name] !== undefined && paramVals[name] !== '') return paramVals[name];
    if(ciVars){
      var cv = ciVars.filter(function(v){ return v.key === name; })[0];
      if(cv){
        var cvval = (paramVals && paramVals[name] !== undefined) ? paramVals[name] : cv.value;
        if(cvval && cvval.indexOf('$') === -1) return cvval; // avoid infinite loop
      }
    }
    // Built-in CI vars — common ones
    var builtinMap = {
      CI_REGISTRY_IMAGE: '[registry-image]',
      CI_REGISTRY: '[registry]',
      CI_REGISTRY_USER: '[registry-user]',
      CI_PROJECT_NAME: '[project-name]',
      CI_PROJECT_PATH: '[project-path]',
      CI_COMMIT_SHA: '[commit-sha]',
      CI_COMMIT_SHORT_SHA: '[short-sha]',
      CI_COMMIT_REF_NAME: glBranch || '[branch]',
      CI_COMMIT_BRANCH: glBranch || '[branch]',
      CI_ENVIRONMENT_NAME: '[env-name]',
      CI_PIPELINE_ID: '[pipeline-id]',
      CI_JOB_NAME: '[job-name]'
    };
    if(builtinMap[name]) return builtinMap[name];
    return '$'+name; // unresolved
  }

  out = out.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, function(_, name){ return expandVarRef(name); });
  out = out.replace(/\$([A-Z_][A-Z0-9_]*)/g, function(_, name){ return expandVarRef(name); });

  // Return null if nothing changed (no expansion happened)
  if(out === rawValue) return null;
  return out;
}

// Detect whether a value references a spec:inputs input
function detectInputRef(rawValue){
  var m = rawValue && rawValue.match(/\$\[\[\s*inputs\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\]\]/);
  return m ? m[1] : null;
}

// Parse .gitlab-ci.yml to extract only explicitly-declared pipeline inputs.
// Handles: spec:inputs: (GitLab 17+), top-level variables: block.
// Script required-checks ([ -z "$VAR" ]) promote declared vars to required but never create new entries.
// Project-level CI/CD settings variables and incidental $VAR usages are intentionally excluded.
function parseRequiredCiVars(yaml, existingVars) {
  if(!yaml || typeof yaml !== 'string') return [];
  var existingKeys = existingVars.map(function(v){ return v.key; });
  var builtins = /^(CI_[A-Z]|GITLAB_[A-Z]|FF_[A-Z])/ ;
  var result = [];
  var seen = {};

  function saveVar(k, obj){
    if(!k || builtins.test(k) || existingKeys.indexOf(k) !== -1 || seen[k]) return;
    seen[k] = true;
    // For spec:inputs: required = no default value AND not boolean type
    var isRequired = obj.source==='spec:inputs'
      ? (!obj.value && obj.type!=='boolean')
      : !!obj.required;
    // Detect if this variable references a spec:inputs input via $[[ inputs.X ]]
    var inputRef = detectInputRef(obj.value || '');
    result.push({
      key: k,
      value: obj.value || '',
      options: obj.options || [],
      description: obj.description || '',
      required: isRequired,
      source: obj.source || 'variables',
      type: obj.type || '',
      inputRef: inputRef || null,   // name of spec:input this var references
      rawValue: obj.value || '',    // original unresolved value (for preview)
      hasVarRef: !!(obj.value && obj.value.indexOf('$') !== -1) // has any $-ref
    });
  }

  // Strip inline YAML comments: e.g. `"" # Required — must be passed` → `""`
  function stripComment(s){
    s = (s||'').trim();
    s = s.replace(/\s+#.*$/, '');   // strip inline comment first
    s = s.replace(/^["']+|["']+$/g,'');  // then strip ALL surrounding quotes (handles "" -> empty)
    return s.trim();
  }

  var lines = yaml.split(/\r?\n/);

  // ─────────────────────────────────────────────────────────────────
  // PASS 1: spec: inputs: block (GitLab 17+ component inputs)
  // spec:
  //   inputs:
  //     environment:
  //       default: staging
  //       options: [staging, prod]
  //       description: "target env"
  //       type: string        (string|number|boolean|array)
  // ─────────────────────────────────────────────────────────────────
  (function parseSpecInputs(){
    var inSpec=false, inInputs=false, inInputDef=false;
    var specIndent=0, inputsIndent=0, inputDefIndent=0;
    var curKey=null, curObj={};
    var inOptions=false, optionsIndent=0;

    for(var i=0;i<lines.length;i++){
      var line=lines[i];
      var stripped=line.replace(/^[ \t]*/,'');
      if(!stripped||stripped[0]==='#') continue;
      var ind=line.length-stripped.length;

      // detect "spec:" at root
      if(!inSpec && /^spec\s*:/.test(line)){ inSpec=true; specIndent=ind; continue; }
      if(inSpec && ind<=specIndent && stripped && !/^spec\s*:/.test(stripped)){ inSpec=false; inInputs=false; }

      if(inSpec && !inInputs){
        if(ind===specIndent+2 && /^inputs\s*:/.test(stripped)){ inInputs=true; inputsIndent=ind; continue; }
      }

      if(inInputs){
        // leaving inputs block
        if(ind<=inputsIndent && stripped){ inInputs=false; inSpec=false; if(curKey) saveVar(curKey,curObj); curKey=null; curObj={}; continue; }
        // new input key at inputsIndent+2
        if(ind===inputsIndent+2){
          if(curKey) saveVar(curKey, curObj);
          var km=stripped.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)?$/);
          if(km){
            curKey=km[1];
            var inlineVal = stripComment(km[2]||'');
            // Inline shorthand: image_tag: "latest"  (value directly on same line — no sub-keys follow)
            curObj={value:inlineVal,options:[],description:'',required:false,source:'spec:inputs'};
            inInputDef=true; inputDefIndent=ind; inOptions=false;
          }
          continue;
        }
        // sub-keys of input definition
        if(inInputDef && curKey && ind>inputDefIndent){
          if(/^default\s*:/.test(stripped)){
            curObj.value=stripComment(stripped.replace(/^default\s*:\s*/,''));
          } else if(/^description\s*:/.test(stripped)){
            curObj.description=stripComment(stripped.replace(/^description\s*:\s*/,''));
          } else if(/^type\s*:/.test(stripped)){
            curObj.type=stripped.replace(/^type\s*:\s*/,'').trim();
          } else if(/^options\s*:/.test(stripped)){
            var inl=stripped.replace(/^options\s*:\s*/,'').trim();
            if(inl.startsWith('[')){
              var ms=inl.match(/["']?([^"',\[\]\s]+)["']?/g);
              if(ms) curObj.options=ms.map(function(s){ return s.replace(/^["'\[\]]|["'\[\]]$/g,'').trim(); }).filter(Boolean);
            }
            inOptions=true; optionsIndent=ind;
          } else if(inOptions && /^-\s+/.test(stripped) && ind>optionsIndent){
            var ov=stripped.replace(/^-\s+/,'').replace(/^["']|["']$/g,'').trim();
            if(ov) curObj.options.push(ov);
          }
          continue; // required is resolved at saveVar time based on final curObj state
        }
      }
    }
    if(curKey) saveVar(curKey, curObj);
  })();

  // ─────────────────────────────────────────────────────────────────
  // PASS 2: top-level variables: block
  //
  // Variables with an empty value ("") are marked pendingRequired=true
  // rather than required=true immediately. Pass 3 will decide per-branch
  // whether they are truly required ([ -z check in non-excluded block)
  // or auto-set (assignment in non-excluded block) or still pending
  // (neither check nor assignment found → conservative: required).
  // ─────────────────────────────────────────────────────────────────
  (function parseVarsBlock(){
    var inVars=false, inVarDef=false, inOptions=false;
    var varsIndent=0, curKey=null, curObj={};

    function flushVar(){
      if(!curKey) return;
      if(seen[curKey]){ curKey=null; curObj={}; return; }
      var _raw = curObj.value||'';
      var _v = stripComment(_raw);
      seen[curKey]=true;
      // Detect special value patterns:
      //   $[[ inputs.X ]]  → linked to spec:inputs entry, never empty at trigger time
      //   $VAR / ${VAR}    → references another var/CI builtin, has-ref flag
      var _inputRef = detectInputRef(_v);
      var _hasRef   = _v.indexOf('$') !== -1;
      // If value is ONLY a $[[ inputs.X ]] reference, treat as not-empty (input provides it)
      var _effectiveEmpty = (_v==='' || (_v===_raw && _v==='')) && !_inputRef;
      result.push({
        key: curKey,
        value: _v,
        options: curObj.options||[],
        description: curObj.description||'',
        required: false,            // start not required; Pass 3 decides
        pendingRequired: _effectiveEmpty && !_inputRef, // empty value = may be required
        autoValue: null,            // will be filled by Pass 3 if script assigns it
        source: 'variables',
        type: '',
        inputRef: _inputRef || null,  // links to a spec:inputs key
        rawValue: _v,               // original value for preview
        hasVarRef: _hasRef          // has $-reference (show preview)
      });
      curKey=null; curObj={};
    }

    for(var i=0;i<lines.length;i++){
      var line=lines[i];
      var stripped=line.replace(/^[ \t]*/,'');
      if(!stripped||stripped[0]==='#') continue;
      var ind=line.length-stripped.length;

      if(!inVars && /^variables\s*:/.test(line)){ inVars=true; varsIndent=ind; inVarDef=false; curKey=null; curObj={}; continue; }

      if(inVars){
        if(ind<=varsIndent && stripped && !/^variables\s*:/.test(stripped)){
          flushVar(); inVars=false; inVarDef=false; curKey=null; curObj={}; continue;
        }
        if(ind===varsIndent+2){
          flushVar();
          var km=stripped.match(/^([A-Z_][A-Z0-9_]*)\s*:\s*(.*)?$/);
          if(km){ curKey=km[1]; curObj={value:km[2]||'',options:[],description:''}; inVarDef=true; inOptions=false; }
          continue;
        }
        if(inVarDef && curKey && ind>varsIndent+2){
          if(/^value\s*:/.test(stripped)){
            curObj.value=stripped.replace(/^value\s*:\s*/,''); inOptions=false;
          } else if(/^description\s*:/.test(stripped)){
            curObj.description=stripComment(stripped.replace(/^description\s*:\s*/,'')); inOptions=false;
          } else if(/^options\s*:/.test(stripped)){
            var inl=stripped.replace(/^options\s*:\s*/,'').trim();
            if(inl.startsWith('[')){
              var ms=inl.match(/["']?([^"',\[\]\s]+)["']?/g);
              if(ms) curObj.options=ms.map(function(s){ return s.replace(/^["'\[\]]|["'\[\]]$/g,'').trim(); }).filter(Boolean);
            }
            inOptions=true;
          } else if(inOptions && /^-\s+/.test(stripped)){
            var ov=stripped.replace(/^-\s+/,'').replace(/^["']|["']$/g,'').trim();
            if(ov) curObj.options.push(ov);
          }
          continue;
        }
      }
    }
    flushVar();
  })();

  // ─────────────────────────────────────────────────────────────────
  // PASS 3: branch-aware script analysis
  //
  // Walks every YAML line with a shell if/else/fi stack. When the
  // loaded branch is inside a branch-guarded block that does NOT run
  // for it, that block is "excluded" and patterns inside are skipped.
  //
  // Two pattern types:
  //   required-check  [ -z "$VAR" ] / ${VAR:?}   → mark var required
  //   assignment      export VAR=value / VAR=val  → var is auto-set
  //                                                  for this branch
  //                                                  (not required, pre-fill)
  //
  // After the walk, any var still "pendingRequired" (empty default,
  // no check or assignment found) is conservatively marked required.
  // ─────────────────────────────────────────────────────────────────
  (function branchAwareScriptPass(){
    var currentBranch = (typeof S !== 'undefined' && S.glBranch) ? S.glBranch : '';

    // Stack frames: { branches:[string]|null, neg:bool, inElse:bool }
    var ifStack = [];

    function isExcluded(){
      for(var si=0;si<ifStack.length;si++){
        var frame=ifStack[si];
        if(frame.branches){
          var inSet = frame.branches.indexOf(currentBranch) !== -1;
          var inEl  = frame.inElse;
          if(!inEl){
            // if-body: runs when branch matches condition
            if(!frame.neg && !inSet) return true;  // our branch won't run this body
            if( frame.neg &&  inSet) return true;  // != condition: our branch is excluded
          } else {
            // else-body: runs when branch does NOT match condition
            if(!frame.neg &&  inSet) return true;  // our branch ran the if-body, not else
            if( frame.neg && !inSet) return true;  // our branch runs the if-body (negated)
          }
        }
      }
      return false;
    }

    var reqPats = [
      /\[\s*-[zn]\s+["']?\$\{?([A-Z_][A-Z0-9_]+)\}?["']?\s*\]/g,
      /\btest\s+-[zn]\s+["']?\$\{?([A-Z_][A-Z0-9_]+)\}?["']?/g,
      /\$\{([A-Z_][A-Z0-9_]+):?\?[^}]*\}/g
    ];
    // Matches: export VAR="value"  VAR="value"  export VAR=value  VAR=value
    var assignPat = /(?:export\s+)?([A-Z_][A-Z0-9_]*)=["']?([^"';\s$\\]+)["']?/g;

    for(var li=0;li<lines.length;li++){
      var raw = lines[li];
      var s   = raw.replace(/^[ \t]*/,'');   // strip leading whitespace only

      // Branch-guarded if: checks CI_COMMIT_REF_NAME or CI_COMMIT_BRANCH
      var mbr = s.match(/if\s+\[+\s*["']?\$\{?(?:CI_COMMIT_REF_NAME|CI_COMMIT_BRANCH)\}?["']?\s*(=+|!=)\s*["']([^"']+)["']/);
      if(mbr){
        ifStack.push({branches:[mbr[2]], neg:(mbr[1].indexOf('!')!==-1), inElse:false});
        continue;
      }

      // else flips the top frame
      if(/^else\b/.test(s)){
        if(ifStack.length) ifStack[ifStack.length-1].inElse=true;
        continue;
      }

      // fi pops
      if(/^fi\b/.test(s)){
        if(ifStack.length) ifStack.pop();
        continue;
      }

      var excluded = isExcluded();

      // Evaluate patterns BEFORE pushing a plain if (so "if [ -z $VAR ]" is
      // checked in the current exclusion context, not after being pushed)
      if(!excluded){
        // Required-check patterns
        reqPats.forEach(function(re){
          re.lastIndex=0;
          var m;
          while((m=re.exec(s))!==null){
            var k=m[1];
            if(builtins.test(k)||existingKeys.indexOf(k)!==-1) return;
            var ex=result.filter(function(r){ return r.key===k; })[0];
            if(ex){ ex.required=true; ex.pendingRequired=false; }
          }
        });
        // Assignment patterns — auto-set detection
        assignPat.lastIndex=0;
        var am;
        while((am=assignPat.exec(s))!==null){
          var ak=am[1], av=am[2];
          if(builtins.test(ak)) continue;
          var aex=result.filter(function(r){ return r.key===ak; })[0];
          if(aex && aex.pendingRequired){
            aex.pendingRequired=false;
            if(!aex.autoValue) aex.autoValue=av; // capture first assignment for this branch
          }
        }
      }

      // Plain if (no branch guard) — push neutral frame for fi-tracking
      if(/^if\s+/.test(s)){
        ifStack.push({branches:null, neg:false, inElse:false});
      }
    }

    // Finalise: resolve pendingRequired and autoValue
    result.forEach(function(v){
      if(v.pendingRequired){
        // No assignment found, no -z check found: still empty — conservative = required
        // BUT: if this var is set via a $[[ inputs.X ]] reference, it's never actually empty
        if(v.inputRef) {
          v.required = false; // provided by linked input
        } else {
          v.required=true;
        }
      }
      // If script auto-sets the var for this branch, pre-fill the value
      if(v.autoValue && !v.value){
        v.value=v.autoValue;
      }
      delete v.pendingRequired;
      delete v.autoValue;
    });
  })();

  // ─────────────────────────────────────────────────────────────────
  // PASS 4: job-level variable overrides + rules:when:manual detection
  //
  // Scans job definitions for:
  //   a) variables: blocks inside jobs — these can override top-level vars
  //      and may have different defaults per job
  //      e.g. deploy_dev: { script: [...], variables: { IMAGE_TAG: "latest" } }
  //   b) rules: if: when:manual — mark jobs as manual (informational)
  //   c) variables: with export IMAGE_TAG="latest" inside script: → already
  //      handled by Pass 3 branch-aware analysis
  //
  // Job-level vars that shadow top-level vars with a concrete value
  // → pre-fill the top-level var with that value for the matched branch.
  // ─────────────────────────────────────────────────────────────────
  (function parseJobLevelVars(){
    var currentBranch = (typeof S !== 'undefined' && S.glBranch) ? S.glBranch : '';
    var inJob=false, inJobVars=false, inJobRules=false;
    var jobIndent=0, jobVarsIndent=0;
    var jobBranches=null; // branches this job runs on (from rules:if:)
    var jobNeg=false;
    var pendingJobVars=[]; // {key, value} collected within job variables block

    function jobBranchMatches(){
      if(!jobBranches || !currentBranch) return true; // no filter = always runs
      var inSet = jobBranches.indexOf(currentBranch) !== -1;
      return jobNeg ? !inSet : inSet;
    }

    function flushJobVars(){
      if(!pendingJobVars.length) return;
      if(jobBranchMatches()){
        pendingJobVars.forEach(function(jv){
          var existing = result.filter(function(r){ return r.key===jv.key; })[0];
          if(existing && !existing.value && jv.value){
            existing.value = jv.value; // pre-fill with job-level default for this branch
          }
        });
      }
      pendingJobVars=[];
    }

    for(var i=0;i<lines.length;i++){
      var line=lines[i];
      var stripped=line.replace(/^[ \t]*/,'');
      if(!stripped||stripped[0]==='#') continue;
      var ind=line.length-stripped.length;

      // Top-level job definition: key at indent 0 that is a valid job name (not a keyword)
      var YAML_KEYWORDS = /^(spec|stages|variables|workflow|default|services|include|image|before_script|after_script|cache|artifacts)\s*:/;
      if(ind===0 && /^[a-zA-Z_][a-zA-Z0-9_\-]*\s*:/.test(stripped) && !YAML_KEYWORDS.test(stripped)){
        flushJobVars();
        inJob=true; inJobVars=false; inJobRules=false;
        jobIndent=0; jobBranches=null; jobNeg=false; pendingJobVars=[];
        continue;
      }

      if(!inJob) continue;

      // Leaving job (back to root level)
      if(ind===0 && stripped && !/^[a-zA-Z_][a-zA-Z0-9_\-]*\s*:/.test(stripped)){
        flushJobVars(); inJob=false; continue;
      }

      // Detect rules: block inside job
      if(ind===2 && /^rules\s*:/.test(stripped)){
        inJobRules=true; inJobVars=false; continue;
      }
      // Inside rules — look for if: with branch condition and when:
      if(inJobRules && ind>=4){
        var ruleIf = stripped.match(/if\s*:\s*['"]\$CI_COMMIT_BRANCH\s*(==|!=)\s*["']([^"']+)["']/);
        if(!ruleIf) ruleIf = stripped.match(/if\s*:\s*['"]\$CI_COMMIT_REF_NAME\s*(==|!=)\s*["']([^"']+)["']/);
        if(ruleIf){
          jobBranches = [ruleIf[2]];
          jobNeg = ruleIf[1]==='!=';
        }
        continue;
      }

      // Detect job-level variables: block
      if(ind===2 && /^variables\s*:/.test(stripped)){
        inJobVars=true; inJobRules=false; jobVarsIndent=ind; continue;
      }

      if(inJobVars){
        if(ind<=2 && stripped && !/^variables\s*:/.test(stripped)){ inJobVars=false; continue; }
        if(ind===4){
          var km2=stripped.match(/^([A-Z_][A-Z0-9_]*)\s*:\s*(.*)?$/);
          if(km2){
            var jval = stripComment(km2[2]||'');
            if(jval) pendingJobVars.push({key:km2[1], value:jval});
          }
        }
      }
    }
    flushJobVars();
  })();

  return result;
}


// Render CI input vars section — dropdown if options exist, checkbox for boolean, text otherwise
function renderCiInputVars(){
  var vars = S.glCiInputVars;
  if(!vars || !vars.length) return '';

  var optVars  = vars.filter(function(v){ return !v.required; });
  var reqVars  = vars.filter(function(v){ return  v.required; });
  var visible  = S.glHideOptional ? reqVars : vars;

  function srcBadge(src){
    if(src==='spec:inputs') return '<span class="badge" style="background:var(--puG);color:var(--pu);border-color:var(--bd2);font-size:8px;padding:1px 5px">spec</span>';
    return '';
  }
  var icoEyeOpen  = '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var icoEyeSlash = '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  var icoLink     = '<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

  // Smart columns + panel width — scales intelligently with visible count
  var n = visible.length;
  var gridCols = n === 1 ? '1fr'
    : n === 2 ? 'repeat(2,1fr)'
    : 'repeat(3,1fr)';
  // Panel max-width: 1 var matches branch card width, 2 vars medium, 3+ full
  var panelMaxW = n === 1 ? '760px' : n === 2 ? '900px' : 'none';
  // Expose to run bar so it can match width
  S._varsPanelMaxW = panelMaxW;

  var btnBase = 'display:inline-flex;align-items:center;gap:5px;padding:0 10px;height:26px;border-radius:7px;font-size:10px;font-family:\'JetBrains Mono\',monospace;cursor:pointer;border:1px solid var(--bd);background:var(--bg2);color:var(--t2);transition:all .15s';

  var defaultsActive  = true;
  var hasDefaults     = vars.filter(function(v){ return v.value && v.value.trim(); }).length > 0;
  var hasOptional     = optVars.length > 0;

  var defaultsBtn = '';

  var optBtn = hasOptional
    ? '<button onclick="S.glHideOptional=!S.glHideOptional;saveSession();reRunPage()" style="'+btnBase+(S.glHideOptional?';background:var(--grB);border-color:var(--gr);color:var(--gr)':'')+'">'+
      (S.glHideOptional?icoEyeOpen:icoEyeSlash)+
      (S.glHideOptional?'Show optional ('+optVars.length+')':'Hide optional ('+optVars.length+')')+'</button>'
    : '';

  var hiddenBar = (S.glHideOptional && optVars.length > 0)
    ? '<div style="display:flex;align-items:center;gap:6px;font-size:10px;color:var(--t3);margin-bottom:12px;padding:7px 10px;background:var(--bg2);border:1px dashed var(--bd);border-radius:8px;font-family:\'JetBrains Mono\',monospace">'+
      icoEyeSlash+' '+optVars.length+' optional variable'+(optVars.length>1?'s':'')+' hidden — YAML defaults apply on trigger</div>'
    : '';

  return (
    // ── Section header ──
    '<div style="margin-bottom:16px;max-width:'+panelMaxW+';transition:max-width .2s ease">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">'+

    // Left: icon + title + count
    '<div style="display:flex;align-items:center;gap:10px">'+
    '<div style="width:32px;height:32px;border-radius:9px;background:var(--puG);border:1px solid var(--bd2);display:flex;align-items:center;justify-content:center;flex-shrink:0">'+
    '<svg width="14" height="14" fill="none" stroke="var(--pu)" stroke-width="2.2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'+
    '</div>'+
    '<div>'+
    '<div style="font-size:11px;font-weight:700;color:var(--t1);font-family:\'JetBrains Mono\',monospace;text-transform:uppercase;letter-spacing:.06em">Pipeline Inputs</div>'+
    '<div style="font-size:10px;color:var(--t3);margin-top:1px;font-family:\'JetBrains Mono\',monospace">'+
    '<span style="color:var(--pu)">.gitlab-ci.yml</span>'+
    (reqVars.length?' &nbsp;·&nbsp; <span style="color:var(--re)">'+reqVars.length+' required</span>':'')+
    (optVars.length?' &nbsp;·&nbsp; '+optVars.length+' optional':'')+
    '</div>'+
    '</div>'+
    '</div>'+

    // Right: action buttons
    '<div style="display:flex;gap:6px;flex-wrap:wrap">'+defaultsBtn+optBtn+'</div>'+
    '</div>'+

    hiddenBar+

    // ── Variable cards grid ──
    '<div style="display:grid;grid-template-columns:'+gridCols+';gap:10px;margin-bottom:16px">'+
    visible.map(function(v, idx){
      var val       = S.glParamVals[v.key] !== undefined ? S.glParamVals[v.key] : (v.value||'');
      var isEmpty   = v.required && !val.trim();
      var isTouched = glInputTouched.has(v.key);
      var showErr   = isEmpty && isTouched;
      var hasOpts   = v.options && v.options.length > 0;
      var isBool    = v.type === 'boolean';
      var safeKey   = v.key.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      var _projId   = S.glSelProj ? String(S.glSelProj.id) : '';
      var _disArr   = S.glVarDisabled[_projId] || [];
      var isNowDisabled = _disArr.indexOf(v.key) !== -1;

      var borderStyle = showErr
        ? 'border-color:var(--re);box-shadow:0 0 0 2px rgba(214,48,49,.12)'
        : v.required ? 'border-left:3px solid var(--reL)' : '';
      var bgStyle = showErr ? 'background:rgba(214,48,49,0.03)' : 'background:var(--bg1)';

      // ── Resolved preview ──
      var previewPanel = '';
      if(v.hasVarRef || v.inputRef){
        var resolved = resolveVarPreview(v.rawValue || v.value, S.glParamVals, S.glCiInputVars, S.glBranch);
        if(resolved){
          previewPanel = '<div style="margin-top:6px;display:flex;align-items:center;gap:5px;background:var(--bg2);border:1px solid var(--bd);border-radius:6px;padding:3px 8px;font-size:9px;font-family:\'JetBrains Mono\',monospace;overflow:hidden">'+
            '<svg width="9" height="9" fill="none" stroke="var(--t3)" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>'+
            '<span style="color:var(--t3)">→</span>'+
            '<span style="color:var(--gr);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" data-ltip="'+resolved.replace(/"/g,'&quot;')+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()">'+resolved+'</span>'+
            '</div>';
        }
      }

      // ── Linked hint ──
      var linkedHint = '';
      if(v.inputRef){
        var linkedInput = (S.glCiInputVars||[]).filter(function(x){ return x.key===v.inputRef && x.source==='spec:inputs'; })[0];
        if(linkedInput) linkedHint = '<div style="margin-bottom:6px;display:flex;align-items:center;gap:4px;background:var(--amB);border:1px solid var(--amL);border-radius:6px;padding:3px 8px;font-size:9px;font-family:\'JetBrains Mono\',monospace">'+icoLink+' <span style="color:var(--t3)">from</span> <b style="color:var(--pu)">'+v.inputRef+'</b></div>';
      }

      // ── Default panel (removed - defaults pre-fill input fields) ──
      var defPanel = '';

      // ── Input control ──
      var inputHtml;
      if(v.inputRef && v.source === 'variables'){
        var dispVal2 = resolveVarPreview(v.rawValue||v.value, S.glParamVals, S.glCiInputVars, S.glBranch) || val || v.rawValue || '';
        inputHtml = '<div style="height:32px;background:var(--bg3);border:1px solid var(--bd);border-radius:8px;padding:0 10px;font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--t3);display:flex;align-items:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default;margin-top:auto" data-ltip="Controlled by '+v.inputRef+' input" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()">'+
          (dispVal2||('<span style="opacity:.5">→ by <b>'+v.inputRef+'</b></span>'))+
          '</div>';
      } else if(isBool){
        inputHtml = '<select class="inp inp-mono" onchange="S.glParamVals[\''+safeKey+'\']=this.value;glRefreshInputValidation()" style="height:32px;font-size:11px;cursor:pointer;border-radius:8px;margin-top:auto;'+(isNowDisabled?'opacity:0.4;text-decoration:line-through;':'')+'"'+(isNowDisabled?' disabled':'')+'>'+
          '<option value="true"'+(val==='true'?' selected':'')+'>true</option>'+
          '<option value="false"'+(val==='false'||!val?' selected':'')+'>false</option>'+
          '</select>';
      } else if(hasOpts){
        inputHtml = '<select class="inp inp-mono" onchange="glInputTouched.add(\''+safeKey+'\');S.glParamVals[\''+safeKey+'\']=this.value;glRefreshInputValidation()" style="height:32px;font-size:11px;cursor:pointer;border-radius:8px;margin-top:auto;'+(showErr?'border-color:var(--re);':'')+(isNowDisabled?'opacity:0.4;text-decoration:line-through;':'')+'"'+(isNowDisabled?' disabled':'')+'>'+
          '<option value=""'+(val===''?' selected':'')+'>— select —</option>'+
          v.options.map(function(o){ return '<option value="'+o.replace(/"/g,'&quot;')+'"'+(val===o?' selected':'')+'>'+o+'</option>'; }).join('')+
          '</select>';
      } else {
        inputHtml = '<input class="inp inp-mono" type="text" value="'+val.replace(/"/g,'&quot;')+'" '+
          'placeholder="'+(v.description||(v.required?'Required':'Enter value…'))+'" '+
          'oninput="glInputTouched.add(\''+safeKey+'\');S.glParamVals[\''+safeKey+'\']=this.value;glRefreshInputValidation();glUpdateLinkedVarPreviews(\''+safeKey+'\')" '+
          'onblur="glInputTouched.add(\''+safeKey+'\');glRefreshInputValidation()" '+
          (isNowDisabled?'disabled ':'')+'style="height:32px;font-size:11px;border-radius:8px;margin-top:auto;'+(showErr?'border-color:var(--re);':'')+(isNowDisabled?'opacity:0.4;text-decoration:line-through;':'')+'" />';
      }

      // ── Error msg ──
      var errMsg = showErr
        ? '<div style="font-size:9px;color:var(--re);font-family:\'JetBrains Mono\',monospace;margin-top:4px;display:flex;align-items:center;gap:4px">'+
          '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
          'Required field</div>'
        : '';

      return '<div class="param-cell ci-input-cell" data-varkey="'+safeKey+'" style="'+borderStyle+';'+bgStyle+(isNowDisabled?';opacity:0.5':'')+'">' +

        // ── Card header: number + name + badges ──
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:8px">'+

        // Left: index + key name
        '<div style="display:flex;align-items:center;gap:7px;min-width:0;flex:1;overflow:hidden">'+
        '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:5px;background:'+(v.required?'var(--reB)':'var(--bg3)')+';border:1px solid '+(v.required?'var(--reL)':'var(--bd)')+';font-size:9px;font-weight:700;color:'+(v.required?'var(--re)':'var(--t3)')+';font-family:\'JetBrains Mono\',monospace;flex-shrink:0">'+(idx+1)+'</span>'+
        '<span class="param-key" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:'+(v.required?'var(--t1)':'var(--t2)')+'">'+
        (v.required?'<span style="color:var(--re);margin-right:2px">*</span>':'')+v.key+
        '</span>'+
        '</div>'+

        // Right: type + opt/req + toggle btn
        '<div style="display:flex;gap:3px;align-items:center;flex-shrink:0">'+
        (isBool?'<span class="badge" style="background:var(--blB);color:var(--bl);border-color:var(--blL);font-size:8px;padding:1px 5px">bool</span>':'')+
        (hasOpts&&!isBool?'<span class="badge" style="background:var(--blB);color:var(--bl);border-color:var(--blL);font-size:8px;padding:1px 5px">list</span>':'')+
        (v.inputRef?'<span class="badge" style="background:var(--amB);color:var(--am);border-color:var(--amL);font-size:8px;padding:1px 5px">linked</span>':'')+
        srcBadge(v.source||'')+
        (!v.required?'<button class="var-toggle-btn" data-ltip="'+(isNowDisabled?'Enable':'Disable')+' this variable" onmouseover="this.style.borderColor=\'var(--pu)\';this.style.color=\'var(--pu)\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.borderColor=\''+(isNowDisabled?'var(--amL)':'var(--bd)')+'\';this.style.color=\''+(isNowDisabled?'var(--am)':'var(--t4)')+'\';hideLogTip()" onclick="toggleGLVarDisabled(\''+String(S.glSelProj?S.glSelProj.id:'')+'\',\''+safeKey+'\')" style="width:20px;height:20px;border-radius:5px;border:1px solid '+(isNowDisabled?'var(--amL)':'var(--bd)')+';background:'+(isNowDisabled?'var(--amB)':'transparent')+';color:'+(isNowDisabled?'var(--am)':'var(--t4)')+';cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;transition:all .15s">'+(isNowDisabled?'<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>':'<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>')+'</button>':'')+
        '</div>'+

        '</div>'+ // end header

        // ── Description ──
        (v.description?'<div style="font-size:9.5px;color:var(--t3);margin-bottom:8px;font-family:\'DM Sans\',sans-serif;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+v.description+'</div>':'')+

        linkedHint+
        defPanel+
        inputHtml+
        previewPanel+
        errMsg+

        '</div>'; // end param-cell
    }).join('')+
    '</div>'+ // end grid

    // ── Separator before ad-hoc ──
    '</div>'
  );
}
async function loadGLBranchParams(){
  if(!S.glBranch.trim()||!S.glSelProj) return;
  // Deduplicate: if already loading branch params, ignore the duplicate call
  if(S._branchParamsLoading) return;
  S._branchParamsLoading = true;
  S.loading.branch=true; S.glBranchInfo=null; S.glCiVars=[]; S.glCiInputVars=[]; S.glParamVals={}; S.glAdhoc=[]; S.glVarPermError=false; glInputTouched.clear();
  // Only refresh run page UI if the user is actually on it — never hijack history/dashboard
  if(S.currentPage==='run') reRunPage();
  try {
    S.glBranchInfo=await glApi('/projects/'+S.glSelProj.id+'/repository/branches/'+encodeURIComponent(S.glBranch));
    S.glCiVars=[];
    S.glParamVals={};
    // Also fetch CI YAML — parse required input variables AND update stage order for this branch
    try {
      var rawYaml = await glApiText('/projects/'+S.glSelProj.id+'/repository/files/.gitlab-ci.yml/raw?ref='+encodeURIComponent(S.glBranch||'main'));
      S.glCiInputVars = parseRequiredCiVars(rawYaml, S.glCiVars);
      // Pre-populate glParamVals for input vars not already set
      // Use the variable's parsed default value (v.value) if available — not empty string
      S.glCiInputVars.forEach(function(v){ if(!(v.key in S.glParamVals)) S.glParamVals[v.key]=v.value||''; });
      // Refresh stage order from this branch's YAML (branch may differ from project default)
      if(rawYaml && typeof rawYaml === 'string'){
        var _stLines = rawYaml.split(/\r?\n/);
        var _inSt=false, _stList=[];
        for(var _li=0;_li<_stLines.length;_li++){
          var _ln=_stLines[_li];
          if(/^stages\s*:/.test(_ln)){ _inSt=true; continue; }
          if(_inSt){
            var _stm=_ln.match(/^[ \t]+-[ \t]+(\S+)/);
            if(_stm){ _stList.push(_stm[1]); }
            else if(/^[^\s#]/.test(_ln)){ break; }
          }
        }
        if(_stList.length) S.glProjectStageOrder = _stList;
      }
    } catch(e){ S.glCiInputVars=[]; }
    var totalInputs = S.glCiInputVars.length;
    toast('Branch loaded · '+totalInputs+' pipeline input'+(totalInputs!==1?'s':'')+' found');
  } catch(e){ toast('Branch not found or no access','err'); }
  S.loading.branch=false;
  S._branchParamsLoading = false;
  if(S.currentPage==='run'){
    reRunPage();
    // Show validation state on newly-rendered inputs (runs after DOM update)
    setTimeout(glRefreshInputValidation, 50);
  }
}
function clearGLBranch(){
  // Fix #7: Clear ONLY input variable values — do NOT reload the page or reset the branch.
  // Reset each required/optional CI input field back to its YAML default (or empty).
  S.glParamVals = {};
  // Re-seed with YAML defaults so fields show their original placeholder values
  if(S.glCiInputVars && S.glCiInputVars.length){
    S.glCiInputVars.forEach(function(v){
      if(v.value) S.glParamVals[v.key] = v.value;
    });
  }
  S.glAdhoc = [];
  glInputTouched.clear();
  S.glVarPermError = false;
  // Patch input fields in-place without a full page re-render
  if(S.glCiInputVars && S.glCiInputVars.length){
    S.glCiInputVars.forEach(function(v){
      var cell = document.querySelector('.ci-input-cell[data-varkey="'+v.key.replace(/'/g,"\\'")+'"]');
      if(!cell) return;
      var inp = cell.querySelector('input.inp, select.inp');
      if(inp) inp.value = S.glParamVals[v.key] || '';
      // Reset error styling
      cell.style.borderColor = '';
      cell.style.background = '';
      var errEl = cell.querySelector('.ci-input-err');
      if(errEl) errEl.remove();
    });
  }
  // Clear adhoc list container
  var adhocWrap = document.querySelector('.gl-vars-panel');
  // Refresh run button state
  var missingNow = (S.glCiInputVars||[]).filter(function(v){
    return v.required && !(S.glParamVals[v.key]||'').trim();
  });
  var runBtn = document.querySelector('.btn-pu[onclick="triggerGLPipeline()"]');
  if(runBtn){
    runBtn.disabled = missingNow.length > 0;
    runBtn.style.opacity = missingNow.length ? '0.5' : '';
    runBtn.style.cursor = missingNow.length ? 'not-allowed' : '';
  }
  var banner = document.getElementById('gl-missing-banner');
  if(banner){ banner.style.cssText = 'display:none'; banner.innerHTML = ''; }
  // Re-render just the vars card area (not the whole page) to reflect cleared adhoc
  var varsPanel = document.querySelector('.gl-vars-panel');
  if(varsPanel) varsPanel.outerHTML = renderGLVarsCard();
  saveSession();
}
function addGLAdhoc(){ S.glAdhoc.push({key:'',value:''});reRunPage(); }
function rmGLAdhoc(i){ S.glAdhoc.splice(i,1);reRunPage(); }

// Live-update required input field borders without full re-render
function glRefreshInputValidation(){
  if(!S.glCiInputVars || !S.glCiInputVars.length) return;
  // Surgically update each ci-input-cell's validation state without replacing DOM nodes.
  // Replacing outerHTML destroys the focused <input> and causes the "page reload" feeling.
  var cells = document.querySelectorAll('.ci-input-cell');
  cells.forEach(function(cell){
    var keyEl = cell.querySelector('.param-key span:last-child');
    if(!keyEl) return;
    var key = keyEl.textContent;
    var v = (S.glCiInputVars||[]).filter(function(x){ return x.key===key; })[0];
    if(!v) return;
    var val = S.glParamVals[v.key] !== undefined ? S.glParamVals[v.key] : '';
    var isEmpty = v.required && !val.trim();
    var isTouched = glInputTouched.has(v.key);
    var showErr = isEmpty && isTouched;
    cell.style.borderColor = showErr ? 'var(--re)' : 'var(--bd)';
    cell.style.background   = showErr ? 'rgba(214,48,49,0.04)' : 'var(--bg2)';
    var inp = cell.querySelector('input.inp, select.inp');
    if(inp) inp.style.borderColor = showErr ? 'var(--re)' : '';
    // Toggle "This field is required" helper text
    var errEl = cell.querySelector('.ci-input-err');
    if(!showErr){
      if(errEl && errEl.parentNode) errEl.parentNode.removeChild(errEl);
    } else if(!errEl && inp){
      var errDiv = document.createElement('div');
      errDiv.className = 'ci-input-err';
      errDiv.style.cssText = 'font-size:10px;color:var(--re);margin-top:3px';
      errDiv.textContent = inp.tagName==='SELECT' ? 'Please select a value' : 'This field is required';
      inp.parentNode && inp.parentNode.insertBefore(errDiv, inp.nextSibling);
    }
  });
  // ── Live-update the missing-fields banner and Run button ──
  var missingNow = (S.glCiInputVars||[]).filter(function(v){
    return v.required && !(S.glParamVals[v.key]||'').trim();
  });
  // Banner only shows fields the user has interacted with (touched) so no scary red on load
  var touchedMissing = missingNow.filter(function(v){ return glInputTouched.has(v.key); });
  var banner = document.getElementById('gl-missing-banner');
  if(banner){
    if(touchedMissing.length){
      banner.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:11px 14px;background:var(--reB);border:1px solid var(--reL);border-radius:8px;margin-bottom:10px';
      banner.innerHTML =
        '<svg width="15" height="15" fill="none" stroke="var(--re)" stroke-width="2.2" viewBox="0 0 24 24" style="flex-shrink:0;margin-top:1px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
        '<div style="flex:1;min-width:0">'+
        '<div style="font-size:12px;font-weight:600;color:var(--re);margin-bottom:4px">'+touchedMissing.length+' required input'+(touchedMissing.length>1?'s are':' is')+' missing</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:4px">'+
        touchedMissing.map(function(v){
          return '<span style="font-family:\'JetBrains Mono\',monospace;font-size:10px;font-weight:600;background:var(--reL);color:var(--re);border-radius:4px;padding:2px 7px;border:1px solid var(--reL)">'+v.key+'</span>';
        }).join('')+
        '</div>'+
        '<div style="font-size:10px;color:var(--t2);margin-top:5px">Please select or fill in the highlighted fields above before running the pipeline.</div>'+
        '</div>';
    } else {
      banner.style.cssText = 'display:none';
      banner.innerHTML = '';
    }
  }
  // Run button: disabled whenever ANY required field is missing (silently, no red on load)
  var runBtn = document.querySelector('.btn-pu[onclick="triggerGLPipeline()"], .btn-run-glow[onclick="triggerGLPipeline()"], #gl-run-btn');
  if(runBtn){
    var shouldDisable = missingNow.length > 0;
    runBtn.disabled = shouldDisable;
    runBtn.style.opacity = shouldDisable ? '0.5' : '';
    runBtn.style.cursor  = shouldDisable ? 'not-allowed' : '';
  }
}

// Live-update "Resolved: …" previews for variables that reference a changed input
// Called when the user types in a spec:inputs field — updates any variables: entries
// that reference it via $[[ inputs.KEY ]] without doing a full re-render.
function glUpdateLinkedVarPreviews(changedKey){
  if(!S.glCiInputVars) return;
  // Find all vars that reference changedKey as their inputRef
  var linkedVars = S.glCiInputVars.filter(function(v){
    return v.inputRef === changedKey ||
           (v.hasVarRef && (v.rawValue||v.value||'').indexOf('inputs.'+changedKey) !== -1);
  });
  linkedVars.forEach(function(lv){
    // Find the cell for this linked var
    var cell = document.querySelector('.ci-input-cell[data-varkey="'+lv.key.replace(/'/g,"\\'")+'"]');
    if(!cell) return;
    // Update the read-only display value
    var dispEl = cell.querySelector('div[title]');
    if(dispEl){
      var newVal = resolveVarPreview(lv.rawValue||lv.value, S.glParamVals, S.glCiInputVars, S.glBranch);
      if(newVal) dispEl.textContent = newVal;
    }
    // Update the preview panel span
    var prevEl = cell.querySelector('[data-preview]');
    if(prevEl){
      var pv = resolveVarPreview(lv.rawValue||lv.value, S.glParamVals, S.glCiInputVars, S.glBranch);
      if(pv) prevEl.textContent = pv;
    }
  });
}

async function triggerGLPipeline(refOnly){
  if(!S.glSelProj||!S.glBranchInfo) return;
  // Mark all required fields as touched so errors surface if user clicks Run without filling
  if(!refOnly){
    (S.glCiInputVars||[]).forEach(function(v){ if(v.required) glInputTouched.add(v.key); });
    glRefreshInputValidation();
  }
  // Safety guard — read-only tokens must never reach this point
  if((S.glAccessLevel||30) < 30){
    toast('No permission to trigger pipelines on this project','err');
    return;
  }
  // Validate required CI input vars (skip if triggering ref-only)
  if(!refOnly){
    var missingRequired = (S.glCiInputVars||[]).filter(function(v){
      return v.required && !(S.glParamVals[v.key]||'').trim();
    });
    if(missingRequired.length){
      toast('Required input'+(missingRequired.length>1?'s':'')+' missing: '+missingRequired.map(function(v){ return v.key; }).join(', '),'err');
      glRefreshInputValidation();
      return;
    }
  }
  S.loading.trigger=true; reRunPage();
  try {
    // Separate CI vars by source type:
    //   source:'spec:inputs'  → GitLab component inputs (send as inputs:{} in body, GitLab 17+)
    //   source:'variables'    → top-level variables: block (send as variables[] override)
    var specInputVars = (S.glCiInputVars||[]).filter(function(v){ return v.source==='spec:inputs'; });
    var regularCiVars = (S.glCiInputVars||[]).filter(function(v){ return v.source!=='spec:inputs'; });

    // Ad-hoc entries added by the user
    var extra={};
    S.glAdhoc.forEach(function(r){ if(r.key) extra[r.key]=r.value; });
    // Add declared CI vars (variables: block):
    //   - required vars: always send (validated above)
    //   - optional vars: send only if the user edited the value (non-empty)
    //   - inputRef vars: skip — their value is fully determined by the linked spec:inputs
    //     entry which is already sent in the inputs:{} body. Sending the raw
    //     "$[[ inputs.X ]]" literal as a variable value would cause a GitLab error.
    regularCiVars.forEach(function(v){
      if(v.inputRef) return; // driven by spec:inputs — skip
      var val = S.glParamVals[v.key] !== undefined ? S.glParamVals[v.key] : '';
      // For vars that reference other vars/CI builtins, send the user's current value
      // (if they filled it in), otherwise skip (let GitLab resolve them server-side)
      if(val.trim()) extra[v.key] = val.trim();
    });

    // Only CI YAML input vars are sent — no project-level variable overrides
    var all=Object.assign({},extra);
    // Strip entries with empty values (GitLab 400s on blank variable values)
    var variables=Object.entries(all).filter(function(e){ return e[1]!==undefined && String(e[1]).trim()!==''; }).map(function(e){ return {key:e[0],value:String(e[1])}; });

    // For true spec:inputs (GitLab 17+ components) — send via inputs:{} key
    var inputs={};
    specInputVars.forEach(function(v){
      var val=(S.glParamVals[v.key]||'').trim();
      if(val) inputs[v.key]=val;
    });
    // If refOnly mode: send just {ref} — no variables (project restricts variable setting)
    var body = refOnly ? {ref:S.glBranch} : {ref:S.glBranch,variables:variables};
    if(!refOnly && Object.keys(inputs).length) body['inputs']=inputs;
    console.log('[PipelineRunner] POST /pipeline payload:', JSON.stringify(body,null,2));
    var res;
    try {
      res=await glApi('/projects/'+S.glSelProj.id+'/pipeline',{method:'POST',body:JSON.stringify(body)});
    } catch(apiErr){
      // If GitLab rejects due to variable permission restriction, offer ref-only trigger
      var errMsg = apiErr.message||'';
      if(!refOnly && errMsg.toLowerCase().indexOf('insufficient permissions')!==-1){
        S.loading.trigger=false;
        // Show inline warning banner and offer ref-only trigger
        S.glVarPermError = true;
        reRunPage();
        return;
      }
      throw apiErr;
    }
    toast('Pipeline #'+res.id+' triggered on '+S.glBranch+'!');
    S.glRuns=[res].concat(S.glRuns.slice(0,14));
    S.glSelPipeline=res;
    // Auto-navigate to Run history with graph on
    S.glShowGraph=true;
    saveSession();
    goTo('history');
    // Load full pipeline + jobs then start polling
    await selGLPipeline(res.id);
    startGLPoll(res.id);
  } catch(e){ toast('Failed to trigger: '+(e.message||'check permissions'),'err'); }
  S.loading.trigger=false;
}

function getFilteredRuns(){
    var runs = S.glRuns;
  var proj = S.glSelProj;
  if(!proj) return runs;
  var activeBranch = S.glBranch;
  var taggedBranches = S.repoBranches[String(proj.id)] || [];

  // Priority 1: A branch is actively loaded (user clicked Load) — filter history to that branch
  var branchLoaded = !!S.glBranchInfo;
  if(branchLoaded && activeBranch){
    return runs.filter(function(r){
      var ref = r.ref || '';
      return ref === activeBranch;
    });
  }
  // Priority 2: Tagged branches from sidebar — show only those branches
  if(taggedBranches.length > 0){
    var matchBranch = (activeBranch && taggedBranches.indexOf(activeBranch) !== -1) ? activeBranch : null;
    if(matchBranch){
      return runs.filter(function(r){
        var ref = r.ref || '';
        return ref === matchBranch;
      });
    }
    return runs.filter(function(r){
      var ref = r.ref || '';
      return taggedBranches.indexOf(ref) !== -1;
    });
  }
  // No branch filter — show all
  return runs;
}


function renderGLHistory(){
  if(!S.glSelProj) return renderHistoryEmptyState();
  var sp=S.glSelPipeline;
  var hOpen = S.histSidebarOpen;
  var hW = S.histSidebarWidth || 240;
  var panelW = hOpen ? hW : 52;
  var filteredRuns = getFilteredRuns();
  return (
    '<div style="display:flex;height:100%;background:var(--bg0)">'+

    // ── Pipeline list sidebar — same style as main sidebar ──
    '<div id="hist-sidebar" style="width:'+panelW+'px;flex-shrink:0;background:var(--bg1);border-right:1px solid var(--bd);display:flex;flex-direction:column;height:100%;overflow:hidden;position:relative;transition:width .22s cubic-bezier(.4,0,.2,1)">'+

    // Drag resize handle (only when open)
    (hOpen?'<div id="hs-resize" onmousedown="hsResizeStart(event)" style="position:absolute;right:-4px;top:0;bottom:0;width:8px;cursor:col-resize;z-index:10"></div>':'')+

    // Header — toggle button lives here, fully inside the sidebar
    '<div style="padding:10px '+(hOpen?'10':'6')+'px 8px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:8px;flex-shrink:0">'+
    (hOpen?
      '<div style="flex:1;min-width:0">'+
      '<div style="font-size:12px;font-weight:600;color:var(--t1)">Pipelines</div>'+
      '<div style="font-size:10px;color:var(--t3);font-family:\'JetBrains Mono\',monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+S.glSelProj.name+'</div>'+
      (S.glBranch&&S.glBranchInfo?'<div style="font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--pu);background:var(--puG);border:1px solid var(--bd2);border-radius:20px;padding:1px 7px;margin-top:3px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">&#9135; '+S.glBranch+'</div>':'')+
      '</div>'+
      '<button class="btn btn-ghost btn-sm gl-pipelines-refresh" onclick="loadGLPipelines()" style="height:22px;width:22px;padding:0;flex-shrink:0" data-ltip="Refresh" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()">'+icoRefresh()+'</button>'+
      '<button class="sb-col-btn" onclick="hsToggleOpen()" data-ltip="Collapse pipeline list" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="flex-shrink:0">'+
      '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>'+
      '</button>'
    :
      '<div style="width:100%;display:flex;flex-direction:column;align-items:center;gap:8px">'+
      icoHist()+
      '<button class="sb-col-btn" onclick="hsToggleOpen()" data-ltip="Expand pipeline list" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()">'+
      '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>'+
      '</button>'+
      '</div>'
    )+
    '</div>'+

    // Pipeline list
    '<div style="flex:1;overflow-y:auto;padding:'+(hOpen?'4px 6px':'6px 4px')+';display:flex;flex-direction:column;gap:1px">'+
    (S.loading.pipelines ?
      // ── Loading state: centered spinner ──
      (hOpen ?
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;padding:20px 0">'+
        '<div style="width:32px;height:32px;border-radius:50%;border:2.5px solid var(--bd2);border-top-color:var(--pu);animation:spin 0.8s linear infinite"></div>'+
        '<span style="font-size:11px;color:var(--t3);font-family:\'JetBrains Mono\',monospace">Fetching pipelines…</span>'+
        '</div>'
        :
        '<div style="display:flex;justify-content:center;padding:12px 0">'+
        '<div style="width:16px;height:16px;border-radius:50%;border:2px solid var(--bd2);border-top-color:var(--pu);animation:spin 0.8s linear infinite"></div>'+
        '</div>'
      )
    :
    (hOpen?
      (filteredRuns.length === 0 ?
        // ── Empty state (expanded): beautiful vertical layout ──
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:14px;padding:24px 16px;text-align:center">'+
        '<div style="width:48px;height:48px;border-radius:14px;background:var(--bg2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;color:var(--t4)">'+
        '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'+
        '</div>'+
        '<div>'+
        '<div style="font-size:13px;font-weight:600;color:var(--t2);margin-bottom:4px">No pipelines yet</div>'+
        '<div style="font-size:11px;color:var(--t3);line-height:1.6">Run your first pipeline<br>from the Run pipeline tab</div>'+
        '</div>'+
        '<button class="btn btn-ghost btn-sm" onclick="goTo(\'run\')" style="font-size:11px;gap:5px">'+icoPlay()+' Run pipeline</button>'+
        '</div>'
        :
        filteredRuns.map(function(r){
          var rUser=(r.user&&(r.user.name||r.user.username))||(r.username)||'';
          var tipData=encodeURIComponent(JSON.stringify({id:r.id,iid:r.iid,ref:r.ref,sha:(r.sha||'').slice(0,8),user:rUser,status:r.status,ts:r.created_at,finished_at:r.finished_at||r.updated_at,_live:1}));
          // Downstream/upstream indicators — shown for the currently selected pipeline
          var isSelected = sp && sp.id === r.id;
          var hasDownstream = isSelected && S.glDownstreamPipelines && S.glDownstreamPipelines.length > 0;
          var hasUpstream = isSelected && S.glUpstreamPipeline;
          var upId = hasUpstream ? S.glUpstreamPipeline.id : null;
          // Compute upstream duration for sidebar
          var upDurStr = '';
          if(hasUpstream && S.glUpstreamPipeline.created_at){
            var upFin = S.glUpstreamPipeline.finished_at || S.glUpstreamPipeline.updated_at;
            if(upFin) upDurStr = dur(S.glUpstreamPipeline.created_at, upFin);
          }
          return '<div class="prow'+(sp&&sp.id===r.id?' active':'')+'" onclick="selGLPipeline('+r.id+')" onmouseover="showDotPopover(event,\''+tipData+'\')" onmouseout="clearTimeout(_dotPopoverAutoHide);_dotPopoverAutoHide=setTimeout(hideDotPopover,120)" style="padding:7px 8px">'+
            stDot(r.status,7)+
            '<div style="flex:1;min-width:0">'+
            '<div style="display:flex;gap:5px;align-items:center;overflow:hidden">'+
            '<span class="mono" style="font-size:11px;color:var(--pu);font-weight:500;flex-shrink:0">#'+r.id+'</span>'+
            '<span style="font-size:11px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:1">'+r.ref+'</span>'+
            '</div>'+
            '<div class="mono" style="font-size:10px;color:var(--t3);display:flex;align-items:center;gap:5px;margin-top:1px;flex-wrap:wrap">'+
            '<span>'+timeAgo(r.created_at)+'</span>'+
            (rUser?'<span style="opacity:.6">·</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px">'+rUser+'</span>':'')+
            '</div>'+
            // ── Compact upstream pill (child pipeline sidebar) ──
            (hasUpstream?
              '<div style="margin-top:3px;display:flex;align-items:center;gap:3px;font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--am)">'+
              '<svg width="7" height="7" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/><polyline points="18 19 12 13 6 19"/></svg>'+
              '<span style="font-weight:600">upstream #'+upId+'</span>'+
              (upDurStr?'<span style="opacity:.6">· '+upDurStr+'</span>':'')+
              '</div>'
            :'')+
            // ── Compact downstream pills (parent pipeline sidebar) ──
            (hasDownstream?(function(){
              var dsHtml = '';
              S.glDownstreamPipelines.forEach(function(ds){
                var dp = ds.pipeline; if(!dp) return;
                var dpFin = dp.finished_at || dp.updated_at;
                var dpDurStr = (dp.created_at && dpFin) ? dur(dp.created_at, dpFin) : '';
                dsHtml += '<div style="margin-top:3px;display:flex;align-items:center;gap:3px;font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--bl);cursor:pointer" onclick="event.stopPropagation();loadDownstreamPipeline(\''+dp.project_id+'\','+dp.id+')">'+
                  '<svg width="7" height="7" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/><polyline points="6 5 12 11 18 5"/></svg>'+
                  '<span style="font-weight:600">downstream #'+dp.id+'</span>'+
                  (dpDurStr?'<span style="opacity:.6">· '+dpDurStr+'</span>':'')+
                  '</div>';
              });
              return dsHtml;
            })():'')+
            // Completion time for runs without upstream
            (!hasUpstream && (r.finished_at||r.updated_at) && (r.status==='success'||r.status==='failed'||r.status==='canceled'||r.status==='skipped') ?
              '<div style="margin-top:2px;font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--t3);display:flex;align-items:center;gap:3px">'+
              '<svg width="7" height="7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'+
              'done '+fmtDateTime(r.finished_at||r.updated_at)+'</div>':'')+
            '</div>'+stBadge(r.status)+'</div>';
        }).join('')
      )
    :
      // Collapsed: dots only (or mini empty)
      (filteredRuns.length === 0 ?
        ''
        :
        filteredRuns.slice(0,18).map(function(r){
          var rUsr=(r.user&&(r.user.name||r.user.username))||(r.username)||'';
          var tipData=encodeURIComponent(JSON.stringify({id:r.id,iid:r.iid,ref:r.ref,sha:(r.sha||'').slice(0,8),user:rUsr,status:r.status,ts:r.created_at,finished_at:r.finished_at||r.updated_at,_live:1}));
          return '<div style="display:flex;justify-content:center;padding:3px 0;position:relative" onmouseover="showDotPopover(event,\''+tipData+'\')" onmouseout="clearTimeout(_dotPopoverAutoHide);_dotPopoverAutoHide=setTimeout(hideDotPopover,120)" onclick="clickDot(event,'+r.id+')">'+
            '<div style="width:10px;height:10px;border-radius:50%;background:'+(ST[r.status]||ST.canceled).c+';cursor:pointer;transition:transform .1s;'+(sp&&sp.id===r.id?'outline:2px solid var(--pu);outline-offset:2px;':'')+'" onmouseover="this.style.transform=\'scale(1.4)\'" onmouseout="this.style.transform=\'scale(1)\'"></div></div>';
        }).join('')
      )
    ))+
    '</div>'+
    '</div>'+

    // ── Main content area ──
    '<div style="flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden">'+
    // Main area: loading state when pipelines are being fetched and none selected
    (S.loading.pipelines && !sp ?
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px">'+
      '<div style="width:40px;height:40px;border-radius:50%;border:3px solid var(--bd2);border-top-color:var(--pu);animation:spin 0.8s linear infinite"></div>'+
      '<div style="text-align:center">'+
      '<div style="font-size:13px;font-weight:500;color:var(--t2)">Loading pipelines</div>'+
      '<div style="font-size:11px;color:var(--t3);margin-top:4px">Fetching run history for '+S.glSelProj.name+'</div>'+
      '</div>'+
      '</div>'
    :
    !sp ?
      // Beautiful empty/prompt state when loaded but none selected
      (filteredRuns.length === 0 ?
        // No pipelines (or none for this branch)
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:20px;padding:40px">'+
        '<div style="width:72px;height:72px;border-radius:20px;background:var(--bg2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;color:var(--t4)">'+
        '<svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'+
        '</div>'+
        '<div style="text-align:center">'+
        '<div style="font-size:16px;font-weight:600;color:var(--t1);margin-bottom:8px">No pipelines yet</div>'+
        '<div style="font-size:13px;color:var(--t3);line-height:1.7;max-width:300px">This project has no pipeline runs.<br>Trigger your first run from the Run pipeline tab.</div>'+
        '</div>'+
        '<button class="btn btn-pu" onclick="goTo(\'run\')" style="gap:6px;height:38px">'+icoPlay()+' Run first pipeline</button>'+
        '</div>'
        :
        // Has pipelines but none selected — prompt to pick one
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:40px">'+
        '<div style="width:64px;height:64px;border-radius:18px;background:var(--puB);border:1px solid var(--bd2);display:flex;align-items:center;justify-content:center;color:var(--pu)">'+
        '<svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'+
        '</div>'+
        '<div style="text-align:center">'+
        '<div style="font-size:15px;font-weight:600;color:var(--t1);margin-bottom:6px">Select a pipeline</div>'+
        '<div style="font-size:12px;color:var(--t3);line-height:1.7">Pick any run from the list on the left<br>to view its jobs and logs</div>'+
        '</div>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">'+
        filteredRuns.slice(0,3).map(function(r){
          return '<div onclick="selGLPipeline('+r.id+')" style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:1px solid var(--bd);background:var(--bg1);cursor:pointer;font-size:11px;color:var(--t2);transition:all .15s" onmouseover="this.style.borderColor=\'var(--pu)\';this.style.color=\'var(--pu)\'" onmouseout="this.style.borderColor=\'var(--bd)\';this.style.color=\'var(--t2)\'">'+
            stDot(r.status,6)+
            '<span class="mono">#'+r.id+'</span>'+
            '<span>'+r.ref+'</span>'+
            '</div>';
        }).join('')+
        '</div>'+
        '</div>'
      )
    :
    '<div style="padding:10px 16px;border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:9px;flex-shrink:0;background:'+(function(){ var s=sp.status; if(s==='success'||s==='passed') return 'var(--grB)'; if(s==='failed'||s==='failure') return 'var(--reB)'; if(s==='running'||s==='in_progress') return 'var(--amB)'; if(s==='canceled'||s==='cancelled'||s==='skipped') return 'var(--bg2)'; return 'var(--bg1)'; })()+'";flex-wrap:wrap">'+
    stDot(sp.status,8)+
    '<span class="mono" style="font-size:13px;font-weight:500;color:var(--t1)">#'+sp.id+'</span>'+
    '<span class="mono" style="font-size:11px;color:var(--t2);background:var(--bg2);padding:2px 8px;border-radius:4px;border:1px solid var(--bd);display:inline-flex;align-items:center;gap:4px"><svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>'+sp.ref+'</span>'+
    (function(){ var sha=(sp.sha||sp.head_sha||'').slice(0,8); var fullSha=(sp.sha||sp.head_sha||''); var proj=S.glSelProj; var cu=(sha&&proj&&proj.web_url)?proj.web_url+'/-/commit/'+fullSha:''; return sha?(cu?'<a href="'+cu+'" target="_blank" data-ltip="'+fullSha+'" onmouseover="this.style.borderColor=\'var(--pu)\';this.style.color=\'var(--pu)\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.borderColor=\'var(--bd)\';this.style.color=\'var(--t3)\';hideLogTip()" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 7px;border-radius:3px;border:1px solid var(--bd);font-family:\'JetBrains Mono\',monospace;text-decoration:none"><svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/></svg>'+sha+'</a>':'<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 7px;border-radius:3px;border:1px solid var(--bd);font-family:\'JetBrains Mono\',monospace"><svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/></svg>'+sha+'</span>'):''; })()+ 
    (function(){ var u=sp.user; if(!u) return ''; var name=u.name||u.username||''; if(!name) return ''; var av=u.avatar_url?'<img src="'+u.avatar_url+'" style="width:14px;height:14px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display=\'none\'">':'<span style="width:14px;height:14px;border-radius:50%;background:var(--puG);color:var(--pu);font-size:8px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">'+name[0].toUpperCase()+'</span>'; var inner='<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 7px 1px 4px;border-radius:3px;border:1px solid var(--bd)">'+av+'<svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="opacity:.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span style="font-family:\'JetBrains Mono\',monospace">'+name+'</span></span>'; return u.web_url?'<a href="'+u.web_url+'" target="_blank" style="text-decoration:none">'+inner+'</a>':inner; })()+ 
    (sp.created_at?'<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 8px;border-radius:4px;border:1px solid var(--bd);font-family:\'JetBrains Mono\',monospace"><svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'+fmtDateTime(sp.created_at)+'</span>':'')+
    (function(){ var d=dur(sp.created_at,sp.finished_at||((['success','failed','canceled','skipped'].includes(sp.status))?sp.updated_at:null)); return d&&d!=='—'?'<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:var(--t2);background:var(--bg2);padding:1px 8px;border-radius:4px;border:1px solid var(--bd);font-family:\'JetBrains Mono\',monospace"><svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="5 12 12 5 19 12"/><polyline points="5 19 12 12 19 19"/></svg>'+d+'</span>':''; })()+
    (S.glPipelineJobs.length?'<span style="font-size:11px;color:var(--t3);background:var(--bg2);padding:2px 8px;border-radius:4px;border:1px solid var(--bd);font-family:\'JetBrains Mono\',monospace;flex-shrink:0">'+S.glPipelineJobs.length+' job'+(S.glPipelineJobs.length!==1?'s':'')+'</span>':'')+
    '<span style="margin-left:auto;font-size:11px;color:var(--t3)">'+timeAgo(sp.created_at)+'</span>'+
    stBadge(sp.status)+
    (sp.web_url?'<a href="'+sp.web_url+'" target="_blank" style="display:flex;align-items:center;gap:3px;font-size:11px;color:var(--bl)">'+icoExt()+' View</a>':'')+
    '<div style="display:flex;align-items:center;gap:6px;margin-left:4px;padding-left:8px;border-left:1px solid var(--bd)">'+
    '<span style="font-size:10px;color:var(--t3);font-family:\'JetBrains Mono\',monospace">Graph</span>'+
    '<div onclick="toggleGLGraph()" style="width:34px;height:18px;background:'+(S.glShowGraph?'var(--pu)':'var(--bg3)')+';border:1px solid '+(S.glShowGraph?'var(--pu)':'var(--bd2)')+';border-radius:9px;position:relative;cursor:pointer;transition:background .2s,border .2s">'+
    '<div style="position:absolute;top:2px;left:'+(S.glShowGraph?'15':'2')+'px;width:12px;height:12px;border-radius:50%;background:'+(S.glShowGraph?'#fff':'var(--t3)')+';transition:left .2s"></div>'+
    '</div>'+
    (S.glShowGraph?'<button class="btn btn-ghost btn-sm" onclick="expandGLGraph()" data-ltip="Fullscreen graph" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="height:26px;width:26px;padding:0">'+icoExpand()+'</button>':'')+
    '</div>'+
    '</div>'+
    '<div style="flex:1;overflow-y:auto;padding:'+(S.glShowGraph?'0':'12px 16px')+'">'+
    (S.loading.jobs?'<div class="mono" style="font-size:12px;color:var(--t3);padding:12px">'+icoSpin()+' Loading jobs…</div>':(S.glShowGraph?renderGLDepGraph():renderGLJobsGrouped()))+
    '</div>')+
    '</div></div>'
  );
}

function renderGLJobsGrouped(){
  var jobs=S.glPipelineJobs;
  if(!jobs.length) return '';

  // Build bridge job lookup (same logic as graph view)
  var _bridgeJobIds = {}, _bridgeJobNames = {};
  if(S.glDownstreamPipelines && S.glDownstreamPipelines.length){
    S.glDownstreamPipelines.forEach(function(ds){
      if(ds.bridgeJobId) _bridgeJobIds[ds.bridgeJobId] = true;
      if(ds.bridgeJobName) _bridgeJobNames[ds.bridgeJobName] = true;
    });
  }
  function _isBridgeJob(j){ return _bridgeJobIds[j.id] || _bridgeJobNames[j.name] || j.type === 'bridge'; }
  // Exclude bridge jobs from list view — they are shown as the downstream pipeline section
  jobs = jobs.filter(function(j){ return !_isBridgeJob(j); });
  if(!jobs.length && !S.glUpstreamPipeline && !(S.glDownstreamPipelines && S.glDownstreamPipelines.length)) return '';

  // Use the same stage order as the graph view (glPipelineStageOrder) so list view
  // always matches the left-to-right order shown in graph mode.
  var stageOrder = Array.isArray(S.glPipelineStageOrder) && S.glPipelineStageOrder.length
    ? S.glPipelineStageOrder : null;

  var sorted;
  if(stageOrder){
    var stageIdx = {};
    stageOrder.forEach(function(s,i){ stageIdx[s]=i; });
    sorted = jobs.slice().sort(function(a,b){
      var sa = stageIdx[a.stage] !== undefined ? stageIdx[a.stage] : 9999;
      var sb = stageIdx[b.stage] !== undefined ? stageIdx[b.stage] : 9999;
      if(sa !== sb) return sa - sb;
      return (a.id||0) - (b.id||0);
    });
  } else {
    sorted = jobs.slice().sort(function(a,b){
      var ta = a.started_at ? new Date(a.started_at).getTime() : (a.id||0);
      var tb = b.started_at ? new Date(b.started_at).getTime() : (b.id||0);
      if(ta !== tb) return ta - tb;
      return (a.id||0) - (b.id||0);
    });
  }

  // Group jobs of same stage into one row
  var rows = [];
  sorted.forEach(function(j){
    var last = rows[rows.length-1];
    if(last && last[0].stage === j.stage){ last.push(j); return; }
    rows.push([j]);
  });

  // Status color helper for left border accent
  function stageAccentColor(status){
    if(status==='success'||status==='passed') return 'var(--gr)';
    if(status==='failed'||status==='failure') return 'var(--re)';
    if(status==='running'||status==='in_progress') return 'var(--am)';
    if(status==='canceled'||status==='skipped') return 'var(--t4)';
    return 'var(--am)';
  }
  function stageOverallStatus(row){
    if(row.some(function(j){ return j.status==='failed'||j.status==='failure'; })) return 'failed';
    if(row.some(function(j){ return j.status==='running'||j.status==='in_progress'; })) return 'running';
    if(row.every(function(j){ return j.status==='success'||j.status==='passed'; })) return 'success';
    if(row.every(function(j){ return j.status==='canceled'||j.status==='skipped'; })) return 'canceled';
    return 'pending';
  }
  function stageIco(status){
    if(status==='success') return '<svg width="13" height="13" fill="none" stroke="var(--gr)" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
    if(status==='failed') return '<svg width="13" height="13" fill="none" stroke="var(--re)" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    if(status==='running') return '<svg width="13" height="13" fill="none" stroke="var(--am)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    if(status==='canceled'||status==='skipped') return '<svg width="13" height="13" fill="none" stroke="var(--t4)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
    return '<svg width="13" height="13" fill="none" stroke="var(--am)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  }

  var html = '<div class="pipe-seq">';

  // Fix #2: Show upstream pipeline banner if this pipeline was triggered by another
  if(S.glUpstreamPipeline){
    var up = S.glUpstreamPipeline;
    var upUser = up.user ? (up.user.name || up.user.username || '') : (up.triggeredByUser || '');
    var upRef = up.ref || '';
    var upSha = up.sha ? up.sha.slice(0,8) : '';
    var upProj = up.project || (S.glSelProj ? S.glSelProj.name : '');
    var upStatus = up.status || 'success';
    var upDateTime = up.created_at ? fmtDateTime(up.created_at) : '';
    html += '<div style="position:relative;border:1.5px dashed var(--am);border-radius:12px;padding:12px 14px;margin-bottom:6px;background:linear-gradient(135deg,var(--amB) 0%,var(--bg1) 100%)">'
      +'<div style="position:absolute;top:-10px;left:16px;background:var(--bg1);padding:0 8px;display:flex;align-items:center;gap:5px">'
      +'<div style="width:16px;height:16px;border-radius:50%;background:var(--am);display:flex;align-items:center;justify-content:center">'
      +'<svg width="8" height="8" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/><polyline points="18 19 12 13 6 19"/></svg>'
      +'</div>'
      +'<span style="font-size:9px;font-weight:700;color:var(--am);text-transform:uppercase;letter-spacing:.08em;font-family:\'JetBrains Mono\',monospace">Triggered by Upstream Pipeline</span>'
      +'</div>'
      +'<div style="border:1px solid var(--amL);border-left:4px solid var(--am);padding:10px 12px;background:var(--bg1);border-radius:0 9px 9px 0;cursor:pointer;transition:all .18s;box-shadow:var(--sh)" '
      +'onclick="loadUpstreamPipelineGraph('+up.id+',\''+((up.project_id)||'')+'\',event)" '
      +'onmouseover="this.style.background=\'var(--amB)\';this.style.transform=\'translateX(3px)\';this.style.boxShadow=\'var(--sh2)\'" '
      +'onmouseout="this.style.background=\'var(--bg1)\';this.style.transform=\'translateX(0)\';this.style.boxShadow=\'var(--sh)\'">'+
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">'+
      stDot(upStatus, 8)+
      stBadge(upStatus)+
      '<span class="mono" style="font-size:12px;font-weight:700;color:var(--am)">#'+up.id+'</span>'+
      (upRef?'<span style="font-size:10px;font-family:\'JetBrains Mono\',monospace;background:var(--bg2);padding:2px 7px;border-radius:5px;border:1px solid var(--bd);color:var(--t2);display:inline-flex;align-items:center;gap:3px"><svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>'+upRef+'</span>':'')+
      (upProj?'<span style="font-size:10px;color:var(--t3);background:var(--bg2);padding:2px 6px;border-radius:4px;border:1px solid var(--bd)">'+upProj+'</span>':'')+
      (upDateTime?'<span style="font-size:10px;font-family:\'JetBrains Mono\',monospace;color:var(--t3);display:inline-flex;align-items:center;gap:3px;background:var(--bg2);padding:1px 6px;border-radius:4px;border:1px solid var(--bd)"><svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'+upDateTime+'</span>':'')+
      '<span style="margin-left:auto;font-size:10px;color:var(--am);font-weight:600;display:flex;align-items:center;gap:3px">'+icoExt()+'<span>View</span></span>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:10px;font-size:10px;color:var(--t3);font-family:\'JetBrains Mono\',monospace;flex-wrap:wrap">'+
      (upUser?'<span style="display:inline-flex;align-items:center;gap:3px;background:var(--amB);padding:1px 6px;border-radius:4px;border:1px solid var(--amL)"><svg width="7" height="7" fill="none" stroke="var(--am)" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span style="color:var(--am);font-weight:600">'+upUser+'</span></span>':'')+
      (upSha?'<span style="font-family:\'JetBrains Mono\',monospace;background:var(--bg3);padding:1px 5px;border-radius:3px;">'+upSha+'</span>':'')+
      '<span style="opacity:.6">triggered this pipeline</span>'+
      '</div>'+
      '</div>'+
      '<div style="border-top:1px dashed var(--amL);margin-top:8px;padding-top:6px;font-size:9px;color:var(--am);font-family:\'JetBrains Mono\',monospace;display:flex;align-items:center;gap:4px">'+
      '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
      'Click to load the upstream pipeline that triggered this run in graph view</div>'+
      '</div>';
    // Arrow down from upstream card to first stage
    html += '<div style="display:flex;align-items:center;padding-left:20px;height:28px">'
      + '<svg width="16" height="28" viewBox="0 0 16 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">'
      + '<line x1="8" y1="0" x2="8" y2="20" stroke="var(--am)" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.5"/>'
      + '<polyline points="4,17 8,24 12,17" fill="none" stroke="var(--am)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.6"/>'
      + '</svg>'
      + '</div>';
  }
  rows.forEach(function(row, idx){
    var isParallel = row.length > 1;
    var stageName = row[0].stage;
    var stageStartTs = null, stageFinishTs = null;
    row.forEach(function(j){
      if(j.started_at){ var t=new Date(j.started_at).getTime(); if(!stageStartTs||t<stageStartTs) stageStartTs=t; }
      if(j.finished_at){ var t2=new Date(j.finished_at).getTime(); if(!stageFinishTs||t2>stageFinishTs) stageFinishTs=t2; }
    });
    var stageDurStr = (stageStartTs&&stageFinishTs) ? dur(new Date(stageStartTs).toISOString(), new Date(stageFinishTs).toISOString()) : '';
    var stageStartStr = stageStartTs ? fmtDateTime(new Date(stageStartTs).toISOString()) : '';
    var overallStatus = stageOverallStatus(row);
    var accentColor = stageAccentColor(overallStatus);

    // Connector between stages
    if(idx > 0){
      html += '<div style="display:flex;align-items:center;padding-left:16px;height:24px">'
        + '<svg width="16" height="24" viewBox="0 0 16 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">'
        + '<line x1="8" y1="0" x2="8" y2="18" stroke="var(--bd2)" stroke-width="1.5" stroke-dasharray="3 2"/>'
        + '<polyline points="4,15 8,22 12,15" fill="none" stroke="var(--bd2)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>'
        + '</svg>'
        + '</div>';
    }

    // Stage group
    html += '<div class="pipe-seq-item"><div class="stage-group" style="border-left:3px solid '+accentColor+'">';

    // Stage header
    html += '<div class="stage-lbl">'
      + '<div class="stage-lbl-icon" style="background:'+(overallStatus==='success'?'var(--grB)':overallStatus==='failed'?'var(--reB)':overallStatus==='running'?'var(--amB)':'var(--bg3)')+'">'+stageIco(overallStatus)+'</div>'
      + '<span class="stage-lbl-name">'+stageName+'</span>'
      + (isParallel?'<span style="font-size:9px;font-family:\'JetBrains Mono\',monospace;background:var(--puG);color:var(--pu);border-radius:10px;padding:1px 7px;border:1px solid var(--bd2)">'+row.length+'&thinsp;parallel</span>':'')
      + '<div class="stage-lbl-meta">'
      + (stageStartStr?'<span style="font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--t3)">'+stageStartStr+'</span>':'')
      + (stageDurStr?'<span style="font-size:9px;font-family:\'JetBrains Mono\',monospace;background:var(--bg3);color:var(--t2);border-radius:20px;padding:1px 8px;border:1px solid var(--bd)">⏱\u2009'+stageDurStr+'</span>':'')
      + '</div>'
      + '</div>';

    // Job rows
    row.forEach(function(j){
      var durStr = (j.started_at && dur(j.started_at, j.finished_at) !== '—') ? dur(j.started_at, j.finished_at) : '';
      var runnerName = j.runner ? (j.runner.description || j.runner.name || '').replace(/\s*\(.*?\)\s*/g,'').trim() : '';
      if(runnerName.length > 36) runnerName = runnerName.slice(0,36)+'…';
      var jStartStr = j.started_at ? fmtDateTime(j.started_at) : '';
      html += '<div class="jrow" onclick="openGLLog('+j.id+')">'
        + stDot(j.status, 8)
        + '<div style="flex:1;min-width:0">'
        +   '<div style="font-size:13px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+j.name+'</div>'
        +   '<div class="mono" style="font-size:10px;color:var(--t3);margin-top:3px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
        +     (jStartStr?'<span title="Started">🕐 '+jStartStr+'</span>':'')
        +     (durStr?'<span style="font-weight:600;color:var(--t2)">⏱ '+durStr+'</span>':'')
        +     (runnerName?'<span style="opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px" title="Runner: '+runnerName+'">⚙ '+runnerName+'</span>':'')
        +   '</div>'
        + '</div>'
        + stBadge(j.status)
        + (function(){
            var jruns = S.glJobRunHistory[j.name] || [];
            var jpid = S.glSelPipeline ? S.glSelPipeline.id : null;
            var jpruns = jpid ? jruns.filter(function(r){ return r.pipelineId===jpid; }) : jruns;
            var jrcnt = jpruns.length || 1;
            var jsafe = j.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
            return '<button onclick="event.stopPropagation();openJobHistory(\'' + jsafe + '\')" data-ltip="View run history" onmouseover="this.style.background=\'var(--puG)\';this.style.borderColor=\'var(--pu)\';this.style.color=\'var(--pu)\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.background=\'var(--bg2)\';this.style.borderColor=\'var(--bd2)\';this.style.color=\'var(--t2)\';hideLogTip()" style="display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:10px;border:1px solid var(--bd2);background:var(--bg2);cursor:pointer;font-size:10px;font-family:\'JetBrains Mono\',monospace;font-weight:700;color:var(--t2);flex-shrink:0;transition:background .15s,border-color .15s"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + jrcnt + 'x</button>';
          })()
        + (function(){
            var isRun2  = j.status==='running'||j.status==='in_progress';
            var isMnl2  = j.status==='manual';
            var isPnd2  = j.status==='pending'||j.status==='created'||j.status==='queued';
            var isFail2 = j.status==='failed'||j.status==='failure';
            if(isRun2){
              return '<button onclick="event.stopPropagation();glCancelJob('+j.id+',event)" data-ltip="Cancel job" onmouseover="this.style.background=\'rgba(229,62,62,0.18)\';this.style.borderColor=\'#e53e3e\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.background=\'rgba(229,62,62,0.07)\';this.style.borderColor=\'rgba(229,62,62,0.35)\';hideLogTip()" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;border:1px solid rgba(229,62,62,0.35);background:rgba(229,62,62,0.07);cursor:pointer;flex-shrink:0;color:#e53e3e;transition:all .15s"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="8" height="8" rx="1.5"/></svg></button>';
            } else if(isMnl2||isPnd2){
              return '<button onclick="event.stopPropagation();glPlayJob('+j.id+',event)" data-ltip="Run job" onmouseover="this.style.background=\'rgba(26,158,98,0.18)\';this.style.borderColor=\'#1a9e62\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.background=\'rgba(26,158,98,0.07)\';this.style.borderColor=\'rgba(26,158,98,0.35)\';hideLogTip()" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;border:1px solid rgba(26,158,98,0.35);background:rgba(26,158,98,0.07);cursor:pointer;flex-shrink:0;color:#1a9e62;transition:all .15s"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><polygon points="2,1 9,5 2,9"/></svg></button>';
            } else {
              var rc2=isFail2?'#e53e3e':'var(--t2)', rb2=isFail2?'rgba(229,62,62,0.07)':'var(--bg2)', rs2b=isFail2?'rgba(229,62,62,0.35)':'var(--bd2)', rbH=isFail2?'rgba(229,62,62,0.18)':'var(--bg3)', rsH=isFail2?'#e53e3e':'var(--pu)';
              return '<button onclick="event.stopPropagation();glRetryJob('+j.id+',event)" data-ltip="Re-run job" onmouseover="this.style.background=\''+rbH+'\';this.style.borderColor=\''+rsH+'\';this.style.color=\''+rsH+'\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.background=\''+rb2+'\';this.style.borderColor=\''+rs2b+'\';this.style.color=\''+rc2+'\';hideLogTip()" style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;border:1px solid '+rs2b+';background:'+rb2+';cursor:pointer;flex-shrink:0;color:'+rc2+';transition:all .15s"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" viewBox="0 0 24 24"><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></button>';
            }
          })()
        + '<span class="jrow-arrow">'+icoCR()+'</span>'
        + '</div>';
    });

    html += '</div></div>';
  });

  // Fix #1: Show downstream pipelines triggered by this pipeline — full card layout
  if(S.glDownstreamPipelines && S.glDownstreamPipelines.length){
    html += '<div style="display:flex;align-items:center;padding-left:20px;height:28px">'
      + '<svg width="16" height="28" viewBox="0 0 16 28" fill="none" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">'
      + '<line x1="8" y1="0" x2="8" y2="20" stroke="var(--bl)" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.5"/>'
      + '<polyline points="4,17 8,24 12,17" fill="none" stroke="var(--bl)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.6"/>'
      + '</svg>'
      + '</div>';

    html += '<div style="position:relative;border:1.5px dashed var(--bl);border-radius:12px;padding:12px 14px;background:linear-gradient(135deg,var(--blB) 0%,var(--bg1) 100%)">'
      +'<div style="position:absolute;top:-10px;left:16px;background:var(--bg1);padding:0 8px;display:flex;align-items:center;gap:5px">'
      +'<div style="width:16px;height:16px;border-radius:50%;background:var(--bl);display:flex;align-items:center;justify-content:center">'
      +'<svg width="8" height="8" fill="none" stroke="#fff" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/><polyline points="6 5 12 11 18 5"/></svg>'
      +'</div>'
      +'<span style="font-size:9px;font-weight:700;color:var(--bl);text-transform:uppercase;letter-spacing:.08em;font-family:\'JetBrains Mono\',monospace">Downstream Pipelines</span>'
      +'</div>'
      + S.glDownstreamPipelines.map(function(ds){
        var dp = ds.pipeline;
        if(!dp) return '';
        var dpStatus = dp.status || 'created';
        var dpSt = ST[dpStatus] || ST.canceled;
        var dpUser = dp.user ? (dp.user.name || dp.user.username || '') : '';
        var dpRef = dp.ref || '';
        var dpSha = dp.sha ? dp.sha.slice(0,8) : '';
        var dpTimeAgo = dp.created_at ? timeAgo(dp.created_at) : '';
        return '<div style="margin-bottom:8px;border:1px solid '+(dpSt.b||'var(--bd)')+';border-left:4px solid '+dpSt.c+';padding:10px 12px;background:var(--bg1);border-radius:0 9px 9px 0;cursor:pointer;transition:all .18s;box-shadow:var(--sh)" '
          +'onclick="loadDownstreamPipelineGraph(\''+dp.project_id+'\','+dp.id+',event)" '
          +'onmouseover="this.style.background=\'var(--blB)\';this.style.transform=\'translateX(3px)\';this.style.boxShadow=\'var(--sh2)\'" '
          +'onmouseout="this.style.background=\'var(--bg1)\';this.style.transform=\'translateX(0)\';this.style.boxShadow=\'var(--sh)\'">'+
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">'+
          stDot(dpStatus, 8)+
          '<span class="mono" style="font-size:12px;font-weight:700;color:var(--bl)">#'+dp.id+'</span>'+
          (dpRef?'<span style="font-size:10px;font-family:\'JetBrains Mono\',monospace;background:var(--bg2);padding:2px 7px;border-radius:5px;border:1px solid var(--bd);color:var(--t2);display:inline-flex;align-items:center;gap:3px"><svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>'+dpRef+'</span>':'')+
          stBadge(dpStatus)+
          (dp.created_at?'<span style="font-size:10px;font-family:\'JetBrains Mono\',monospace;color:var(--t3);display:inline-flex;align-items:center;gap:3px;background:var(--bg2);padding:1px 6px;border-radius:4px;border:1px solid var(--bd)"><svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'+fmtDateTime(dp.created_at)+'</span>':'')+
          '<span style="margin-left:auto;font-size:10px;color:var(--bl);font-weight:600;display:flex;align-items:center;gap:3px">'+
          icoExt()+'<span>Open</span></span>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:10px;font-size:10px;color:var(--t3);font-family:\'JetBrains Mono\',monospace;flex-wrap:wrap">'+
          '<span style="display:inline-flex;align-items:center;gap:3px;background:var(--bg2);padding:1px 6px;border-radius:4px;border:1px solid var(--bd)"><svg width="7" height="7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>via <b style="color:var(--t2)">'+ds.bridgeJobName+'</b></span>'+
          (dpUser?'<span style="display:inline-flex;align-items:center;gap:3px"><svg width="7" height="7" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'+dpUser+'</span>':'')+
          (dpSha?'<span style="font-family:\'JetBrains Mono\',monospace;background:var(--bg3);padding:1px 5px;border-radius:3px;">'+dpSha+'</span>':'')+
          (dpTimeAgo?'<span style="margin-left:auto;opacity:.7">'+dpTimeAgo+'</span>':'')+
          '</div>'+
          '</div>';
      }).join('')+
      '<div style="border-top:1px dashed var(--blL);margin-top:4px;padding-top:6px;font-size:9px;color:var(--bl);font-family:\'JetBrains Mono\',monospace;display:flex;align-items:center;gap:4px">'+
      '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
      'Click any card to load that downstream pipeline in graph view</div>'+
      '</div>';
  }

  html += '</div>';
  return html;
}

function toggleGLGraph(){
  S.glShowGraph = !S.glShowGraph;
  saveSession();
  reHistPage();
}

// Load a downstream pipeline and navigate to graph view
// ── Shared helper: switch to a project (if needed) then open a specific pipeline in graph view ──
async function _navigateToPipeline(targetProjectId, pipelineId, label){
  try {
    var currentProjId = S.glSelProj ? S.glSelProj.id : null;
    var isSameProject = String(targetProjectId) === String(currentProjId);

    if(!isSameProject){
      // Find in managed projects list
      var mp = S.managedProjects.find(function(x){ return String(x.id) === String(targetProjectId); });
      if(!mp){
        // Try fetching the project directly from GitLab API
        try {
          var fetched = await glApi('/projects/'+targetProjectId);
          if(fetched) mp = {id: fetched.id, name: fetched.name, ns: fetched.namespace ? fetched.namespace.name : '', webUrl: fetched.web_url, provider: 'gitlab', fullName: fetched.path_with_namespace};
        } catch(e2){}
      }
      if(mp){
        toast('Switching to '+label+' project: '+mp.name, 'info');
        // Switch project — do NOT call selProject (it resets everything and does full render)
        // Instead directly set the project and go to history
        var found = S.glProjects.find(function(p){ return String(p.id)===String(mp.id); });
        if(!found){
          try { found = await glApi('/projects/'+mp.id); if(found) S.glProjects.push(found); } catch(e3){}
        }
        S.glSelProj = found || {id: mp.id, name: mp.name, web_url: mp.webUrl};
        S.glRuns = []; S.glSelPipeline = null; S.glPipelineJobs = [];
        S.glPipelineStageOrder = []; S.glProjectStageOrder = [];
        S.glDownstreamPipelines = []; S.glUpstreamPipeline = null;
        S.glBranch = (S.repoBranches[String(mp.id)] || [])[0] || '';
        S.glShowGraph = true;
        S.currentPage = 'history';
        saveSession();
        render();
        // Load the target pipeline directly without waiting for full pipeline list
        await _loadAndShowPipeline(pipelineId);
      } else {
        // Not in managed list — open in GitLab directly
        var url = S.glUrl.replace(/\/+$/,'')+'/-/pipelines/'+pipelineId;
        window.open(url, '_blank');
      }
    } else {
      // Same project — ensure we're on history page with graph on
      if(S.currentPage !== 'history'){
        S.currentPage = 'history';
        S.glShowGraph = true;
        saveSession();
        render();
      } else {
        S.glShowGraph = true;
        saveSession();
      }
      await _loadAndShowPipeline(pipelineId);
    }
  } catch(e){
    toast('Could not load '+label+' pipeline: '+(e.message||'unknown error'),'err');
  }
}

// Load a specific pipeline by ID — inject into glRuns if needed, then selGLPipeline
async function _loadAndShowPipeline(pipelineId){
  try {
    // Ensure the pipeline is in glRuns so selGLPipeline can find it
    var existing = S.glRuns.find(function(r){ return String(r.id) === String(pipelineId); });
    if(!existing){
      // Fetch the pipeline stub and prepend to runs list
      try {
        var stub = await glApi('/projects/'+S.glSelProj.id+'/pipelines/'+pipelineId);
        if(stub){ S.glRuns.unshift(stub); }
        else { S.glRuns.unshift({id: pipelineId}); }
      } catch(e){ S.glRuns.unshift({id: pipelineId}); }
    }
    // Kick off selGLPipeline — this fetches all jobs, upstream/downstream, re-renders
    await selGLPipeline(pipelineId);
    S.glShowGraph = true;
    saveSession();
    reHistPage();
  } catch(e){
    toast('Could not load pipeline #'+pipelineId,'err');
  }
}

async function loadDownstreamPipelineGraph(projectId, pipelineId, evt){
  if(evt) evt.stopPropagation();
  await _navigateToPipeline(projectId, pipelineId, 'downstream');
}

// Load upstream pipeline and navigate to graph view
async function loadUpstreamPipelineGraph(pipelineId, projectId, evt){
  if(evt) evt.stopPropagation();
  // projectId may be empty string — fall back to current project
  var targetProjId = (projectId && String(projectId).trim() !== '') ? projectId : (S.glSelProj ? S.glSelProj.id : null);
  if(!targetProjId){ toast('Cannot determine upstream project','err'); return; }
  await _navigateToPipeline(targetProjId, pipelineId, 'upstream');
}

// Load a downstream pipeline from sidebar compact link
async function loadDownstreamPipeline(projectId, pipelineId){
  await _navigateToPipeline(projectId, pipelineId, 'downstream');
}

function expandGLGraph(){
  // Render graph in a fullscreen overlay
  var existing = el('graph-fullscreen');
  if(existing){ existing.remove(); return; }
  var ov = document.createElement('div');
  ov.id = 'graph-fullscreen';
  ov.className = 'graph-fullscreen-overlay';

  var sp = S.glSelPipeline;
  var proj = S.glSelProj;
  var projName = proj ? (proj.name || proj.path_with_namespace || '') : '';
  var hd = '<div style="height:52px;background:var(--bg1);border-bottom:1px solid var(--bd);display:flex;align-items:center;gap:8px;padding:0 18px;flex-shrink:0;min-width:0">'
    // Project name with icon
    + (projName ? '<div style="display:flex;align-items:center;gap:6px;padding-right:12px;border-right:1px solid var(--bd);flex-shrink:0">'
        + '<div style="width:22px;height:22px;border-radius:5px;background:var(--puG);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:var(--pu)">'+projName[0].toUpperCase()+'</div>'
        + '<span style="font-size:12px;font-weight:600;color:var(--t1)">'+projName+'</span>'
        + '</div>' : '')
    // Pipeline id, branch (with bg card), commit, user — matching minimize order
    + stDot(sp.status, 8)
    + '<span class="mono" style="font-size:13px;font-weight:700;color:var(--pu);flex-shrink:0">#'+sp.id+'</span>'
    + '<span class="mono" style="font-size:11px;color:var(--t2);background:var(--bg2);padding:2px 8px;border-radius:4px;border:1px solid var(--bd);flex-shrink:0;display:inline-flex;align-items:center;gap:4px"><svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>'+sp.ref+'</span>'
    // Commit SHA
    + (function(){ var sha=(sp.sha||sp.head_sha||'').slice(0,8); var fullSha=(sp.sha||sp.head_sha||''); var cu=(sha&&proj&&proj.web_url)?proj.web_url+'/-/commit/'+fullSha:''; return sha?(cu?'<a href="'+cu+'" target="_blank" data-ltip="'+fullSha+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 7px;border-radius:3px;border:1px solid var(--bd);font-family:\'JetBrains Mono\',monospace;text-decoration:none;flex-shrink:0"><svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/></svg>'+sha+'</a>':'<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 7px;border-radius:3px;border:1px solid var(--bd);font-family:\'JetBrains Mono\',monospace;flex-shrink:0"><svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/></svg>'+sha+'</span>'):''; })()
    // User (next to commit — same position as minimize)
    + (function(){ var u=sp.user; if(!u) return ''; var name=u.name||u.username||''; if(!name) return ''; var av=u.avatar_url?'<img src="'+u.avatar_url+'" style="width:14px;height:14px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display=\'none\'">':'<span style="width:14px;height:14px;border-radius:50%;background:var(--puG);color:var(--pu);font-size:8px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">'+name[0].toUpperCase()+'</span>'; var inner='<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 7px 1px 4px;border-radius:3px;border:1px solid var(--bd);flex-shrink:0">'+av+'<svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span style="font-family:\'JetBrains Mono\',monospace">'+name+'</span></span>'; return u.web_url?'<a href="'+u.web_url+'" target="_blank" style="text-decoration:none">'+inner+'</a>':inner; })()
    + (sp.created_at ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 8px;border-radius:4px;border:1px solid var(--bd);font-family:\'JetBrains Mono\',monospace;flex-shrink:0"><svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'+fmtDateTime(sp.created_at)+'</span>' : '')
    + (function(){ var d=dur(sp.created_at,sp.finished_at||((['success','failed','canceled','skipped'].includes(sp.status))?sp.updated_at:null)); return d&&d!=='—'?'<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:600;color:var(--t2);background:var(--bg2);padding:1px 8px;border-radius:4px;border:1px solid var(--bd);font-family:\'JetBrains Mono\',monospace;flex-shrink:0"><svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="5 12 12 5 19 12"/><polyline points="5 19 12 12 19 19"/></svg>'+d+'</span>':''; })()
    // Job count
    + (S.glPipelineJobs.length ? '<span style="font-size:11px;color:var(--t3);background:var(--bg2);padding:2px 8px;border-radius:4px;border:1px solid var(--bd);flex-shrink:0;font-family:\'JetBrains Mono\',monospace">'
        + S.glPipelineJobs.length + ' job' + (S.glPipelineJobs.length !== 1 ? 's' : '')
        + '</span>' : '')
    // Spacer
    + '<span style="flex:1"></span>'
    // timeAgo
    + (sp.created_at ? '<span style="font-size:11px;color:var(--t3);font-family:\'JetBrains Mono\',monospace;flex-shrink:0">'+timeAgo(sp.created_at)+'</span>' : '')
    // Status badge at the right end
    + stBadge(sp.status)
    + '<span style="font-size:10px;color:var(--t3);font-family:\'JetBrains Mono\',monospace;flex-shrink:0">ESC to close</span>'
    + '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'graph-fullscreen\').remove()" style="height:30px;padding:0 12px;gap:6px;display:flex;align-items:center;border-color:var(--bd2);flex-shrink:0">'
    + icoCollapse() + '<span style="font-size:12px;font-weight:600">Close</span></button>'
    + '</div>';

  var body = '<div style="flex:1;overflow:auto;background:var(--bg0);padding:12px 0">'
    + renderGLDepGraph()
    + '</div>';

  ov.innerHTML = hd + body;
  document.body.appendChild(ov);
  // Re-attach onclick for job nodes inside this overlay (they use openGLLog which is global)
}

function renderGLDepGraph(){
  var jobs = S.glPipelineJobs;
  if(!jobs.length) return '<div style="padding:40px;text-align:center;color:var(--t3);font-size:12px;font-family:\'JetBrains Mono\',monospace">No jobs</div>';

  // Stage order is locked once in selGLPipeline and never re-derived.
  // This means reruns, status polls, and new job IDs never shift column positions.
  var stageOrder = Array.isArray(S.glPipelineStageOrder) ? S.glPipelineStageOrder.slice() : [];

  // Build stageMap — bucket each job into its stage
  var stageMap = {};
  stageOrder.forEach(function(s){ stageMap[s] = []; });
  jobs.forEach(function(j){
    if(!stageMap[j.stage]){ stageMap[j.stage] = []; stageOrder.push(j.stage); }
    stageMap[j.stage].push(j);
  });

  // Within each stage, newest rerun goes last (sort by id asc = creation order)
  stageOrder.forEach(function(s){ stageMap[s].sort(function(a,b){ return a.id - b.id; }); });

  // ── Filter out bridge job stages ──
  // Bridge jobs trigger downstream pipelines and are represented as the downstream card,
  // not as regular job nodes. Remove any stage whose jobs are ALL bridge jobs.
  var bridgeJobIds = {};
  if(S.glDownstreamPipelines && S.glDownstreamPipelines.length){
    S.glDownstreamPipelines.forEach(function(ds){ if(ds.bridgeJobId) bridgeJobIds[ds.bridgeJobId] = true; });
  }
  // Also identify bridge jobs by type === 'bridge' or by job name matching bridge job names
  var bridgeJobNames = {};
  if(S.glDownstreamPipelines && S.glDownstreamPipelines.length){
    S.glDownstreamPipelines.forEach(function(ds){ if(ds.bridgeJobName) bridgeJobNames[ds.bridgeJobName] = true; });
  }
  function isBridgeJob(j){
    return bridgeJobIds[j.id] || bridgeJobNames[j.name] || j.type === 'bridge';
  }
  // Remove stages where ALL jobs are bridge jobs
  stageOrder = stageOrder.filter(function(s){
    var stagejobs = stageMap[s];
    if(!stagejobs || !stagejobs.length) return false; // drop empty stages too
    return !stagejobs.every(function(j){ return isBridgeJob(j); });
  });

  // Flatten in locked pipeline order (bridge stages now excluded)
  jobs = [];
  stageOrder.forEach(function(s){ if(stageMap[s] && stageMap[s].length) jobs = jobs.concat(stageMap[s]); });

  var ST_C = {
    success:'#1a9e62', passed:'#1a9e62',
    failed:'#e53e3e', failure:'#e53e3e',
    running:'#c07c10', in_progress:'#c07c10',
    pending:'#c07c10', queued:'#c07c10', waiting:'#c07c10',
    canceled:'#6b7280', cancelled:'#6b7280',
    skipped:'#6b7280', created:'#3b82f6', manual:'#8b5cf6'
  };
  var ST_BG = {
    success:'rgba(26,158,98,0.10)', passed:'rgba(26,158,98,0.10)',
    failed:'rgba(229,62,62,0.10)', failure:'rgba(229,62,62,0.10)',
    running:'rgba(192,124,16,0.10)', in_progress:'rgba(192,124,16,0.10)',
    pending:'rgba(192,124,16,0.10)', queued:'rgba(192,124,16,0.10)',
    canceled:'rgba(107,114,128,0.08)', cancelled:'rgba(107,114,128,0.08)',
    skipped:'rgba(107,114,128,0.08)', created:'rgba(59,130,246,0.10)', manual:'rgba(139,92,246,0.10)'
  };

  var nodeW = 236, nodeH = 118, rowGap = 20, colGap = 52, padX = 24, padY = 62;
  var hasUp = !!S.glUpstreamPipeline;
  var hasDown = !!(S.glDownstreamPipelines && S.glDownstreamPipelines.length);
  // If upstream exists, shift all real job columns right by 1 to make room
  var colOffset = hasUp ? 1 : 0;

  var numStages = stageOrder.length;
  var maxJobsInStage = Math.max.apply(null, stageOrder.map(function(s){ return stageMap[s].length; }));

  // Grid positions — real jobs shifted right by colOffset if upstream present
  var positions = {};
  stageOrder.forEach(function(stage, ci){
    stageMap[stage].forEach(function(j, ri){
      positions[j.id] = {
        x: padX + (ci + colOffset) * (nodeW + colGap),
        y: padY + ri * (nodeH + rowGap),
        row: ri,
        col: ci + colOffset
      };
    });
  });

  // Total columns in SVG = colOffset + numStages + (hasDown ? 1 : 0)
  var totalCols = colOffset + numStages + (hasDown ? 1 : 0);
  // For downstream, use a tighter gap of 32px instead of colGap (52px)
  var downColGap = 32;
  var svgW = hasDown
    ? padX + (colOffset + numStages) * (nodeW + colGap) - colGap + nodeW + downColGap + nodeW + padX
    : padX + totalCols * (nodeW + colGap) - colGap + padX;
  var svgH = padY + maxJobsInStage * (nodeH + rowGap) - rowGap + 30;

  // ── EDGES ──
  var edges = '';
  // 1. Horizontal arrows: job[stage_i][row] → job[stage_i+1][row]  (if both exist)
  stageOrder.forEach(function(stage, ci){
    if(ci === 0) return;
    var prevStage = stageOrder[ci-1];
    // Connect same-row jobs across adjacent stages
    var maxRow = Math.max(stageMap[prevStage].length, stageMap[stage].length);
    for(var ri=0; ri<maxRow; ri++){
      var fromJ = stageMap[prevStage][ri];
      var toJ   = stageMap[stage][ri];
      if(!fromJ || !toJ) continue;
      var fp = positions[fromJ.id], tp = positions[toJ.id];
      var x1 = fp.x + nodeW, y1 = fp.y + nodeH/2;
      var x2 = tp.x,          y2 = tp.y + nodeH/2;
      var mx = (x1+x2)/2;
      var isActive = ['success','passed','running','in_progress'].indexOf(fromJ.status) !== -1;
      var isFail   = ['failed','failure'].indexOf(fromJ.status) !== -1;
      var strokeCol = isActive ? (ST_C[fromJ.status]||'#6b7280') : isFail ? '#e53e3e' : 'var(--bd2)';
      var opacity   = isActive ? '0.65' : isFail ? '0.6' : '0.3';
      var mid = 'arr'+fromJ.id+'_h_'+toJ.id;
      edges += '<defs><marker id="'+mid+'" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="'+strokeCol+'" opacity="'+opacity+'"/></marker></defs>';
      var cp = Math.max(30, (x2-x1)*0.45);
      edges += '<path d="M'+x1+' '+y1+' C'+(x1+cp)+' '+y1+' '+(x2-cp)+' '+y2+' '+x2+' '+y2+'" fill="none" stroke="'+strokeCol+'" stroke-width="1.8" opacity="'+opacity+'" stroke-linecap="round" marker-end="url(#'+mid+')"/>';
    }
  });

  // 2. Vertical wrap arrows: last job in a stage's row[ri] → first job in next row[ri+1]
  //    i.e. the last stage of row ri connects down to the first stage of row ri+1
  //    This matches the image: right-end of each row drops a vertical line to the left of the next row.
  stageOrder.forEach(function(stage, ci){
    var sj = stageMap[stage];
    // For each job at row ri, if there's a next-row job in the same stage, draw vertical arrow
    for(var ri=0; ri<sj.length-1; ri++){
      var fromJ = sj[ri];
      var toJ   = sj[ri+1];
      var fp = positions[fromJ.id], tp = positions[toJ.id];
      var x1v = fp.x + nodeW/2, y1v = fp.y + nodeH;
      var x2v = tp.x + nodeW/2, y2v = tp.y;
      var isActive = ['success','passed','running','in_progress'].indexOf(fromJ.status) !== -1;
      var isFail   = ['failed','failure'].indexOf(fromJ.status) !== -1;
      var strokeCol = isActive ? (ST_C[fromJ.status]||'#6b7280') : isFail ? '#e53e3e' : 'var(--bd2)';
      var opacity   = isActive ? '0.55' : isFail ? '0.5' : '0.25';
      var midv = 'arr'+fromJ.id+'_v_'+toJ.id;
      edges += '<defs><marker id="'+midv+'" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="'+strokeCol+'" opacity="'+opacity+'"/></marker></defs>';
      edges += '<line x1="'+x1v+'" y1="'+y1v+'" x2="'+x2v+'" y2="'+y2v+'" stroke="'+strokeCol+'" stroke-width="1.2" opacity="'+opacity+'" stroke-dasharray="4 3" marker-end="url(#'+midv+')"/>';
    }
  });

  // Stage column headers — one per stage column
  // Stage headers — shifted right by colOffset so real stage headers align with real job nodes
  var headers = stageOrder.map(function(stage, ci){
    var cx = padX + (ci + colOffset) * (nodeW + colGap) + nodeW/2;
    var allSuccess = stageMap[stage].every(function(j){ return j.status==='success'||j.status==='passed'; });
    var anyFailed  = stageMap[stage].some(function(j){ return j.status==='failed'||j.status==='failure'; });
    var anyRunning3 = stageMap[stage].some(function(j){ return j.status==='running'||j.status==='in_progress'; });
    var hcol = anyFailed?'#e53e3e':anyRunning3?'#c07c10':allSuccess?'#1a9e62':'var(--t3)';
    var stageLabel = stage.toUpperCase();
    var approxW = Math.max(50, stageLabel.length * 5.6 + 16);
    return (
      '<rect x="'+(cx-approxW/2)+'" y="8" width="'+approxW+'" height="20" rx="10" fill="'+hcol+'" opacity="0.12"/>'+
      '<text x="'+cx+'" y="22" text-anchor="middle" font-size="9" font-family="JetBrains Mono,monospace" font-weight="700" fill="'+hcol+'" letter-spacing="0.1em">'+stageLabel+'</text>'
    );
  }).join('');

  // Upstream column header is embedded in the upstream node card (no separate header needed)
  // Downstream column header is embedded in each downstream card (no separate header needed)

  // Nodes — redesigned clean card: solid left border, status icon, clean meta rows, bottom badge row
  var nodes = jobs.map(function(j){
    var p = positions[j.id];
    var col = ST_C[j.status] || '#6b7280';
    var bgCol = ST_BG[j.status] || 'rgba(107,114,128,0.06)';
    var label = j.name.length > 24 ? j.name.slice(0,23)+'…' : j.name;
    var isRunning = j.status==='running'||j.status==='in_progress';
    var isPending = j.status==='pending'||j.status==='queued'||j.status==='created'||j.status==='waiting';
    var isManual  = j.status==='manual';
    var isFailed  = j.status==='failed'||j.status==='failure';
    var isSuccess = j.status==='success'||j.status==='passed';
    var isCancelled = j.status==='canceled'||j.status==='cancelled'||j.status==='skipped';
    var dur_s = (j.started_at && j.finished_at) ? dur(j.started_at,j.finished_at) : (isRunning?'running…':'—');

    var dtStr = '—';
    if(j.started_at){
      try {
        var d2 = new Date(j.started_at);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        dtStr = d2.getDate()+' '+months[d2.getMonth()]+' '+String(d2.getHours()).padStart(2,'0')+':'+String(d2.getMinutes()).padStart(2,'0')+':'+String(d2.getSeconds()).padStart(2,'0');
      } catch(e){}
    }
    var userStr = '—';
    if(j.user && j.user.name) userStr = j.user.name.length > 18 ? j.user.name.slice(0,17)+'…' : j.user.name;

    var monoFont = 'JetBrains Mono,monospace';
    var sansFont = 'DM Sans,sans-serif';

    // ── Status icon (circle with symbol, left of job name) ──
    var siX = p.x + 22, siY = p.y + 25;
    var statusIcon = '';
    if(isSuccess){
      statusIcon =
        '<circle cx="'+siX+'" cy="'+siY+'" r="11" fill="'+col+'"/>'+
        '<path d="M'+(siX-5)+','+(siY)+' L'+(siX-1.5)+','+(siY+4)+' L'+(siX+5)+','+(siY-4.5)+'" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
    } else if(isFailed){
      statusIcon =
        '<circle cx="'+siX+'" cy="'+siY+'" r="11" fill="'+col+'"/>'+
        '<line x1="'+(siX-4.5)+'" y1="'+(siY-4.5)+'" x2="'+(siX+4.5)+'" y2="'+(siY+4.5)+'" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>'+
        '<line x1="'+(siX+4.5)+'" y1="'+(siY-4.5)+'" x2="'+(siX-4.5)+'" y2="'+(siY+4.5)+'" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>';
    } else if(isRunning){
      statusIcon =
        '<circle cx="'+siX+'" cy="'+siY+'" r="11" fill="#c07c10" opacity="0.15" stroke="#c07c10" stroke-width="1.5"/>'+
        '<path d="M'+siX+','+(siY-8)+' A8 8 0 0 1 '+(siX+8)+','+siY+'" fill="none" stroke="#c07c10" stroke-width="2.5" stroke-linecap="round">'+
          '<animateTransform attributeName="transform" type="rotate" from="0 '+siX+' '+siY+'" to="360 '+siX+' '+siY+'" dur="0.9s" repeatCount="indefinite"/>'+
        '</path>';
    } else if(isCancelled){
      statusIcon =
        '<circle cx="'+siX+'" cy="'+siY+'" r="11" fill="'+col+'" opacity="0.15" stroke="'+col+'" stroke-width="1.5"/>'+
        '<line x1="'+(siX-5)+'" y1="'+siY+'" x2="'+(siX+5)+'" y2="'+siY+'" stroke="'+col+'" stroke-width="2.2" stroke-linecap="round"/>';
    } else if(isPending){
      statusIcon =
        '<circle cx="'+siX+'" cy="'+siY+'" r="11" fill="'+col+'" opacity="0.15" stroke="'+col+'" stroke-width="1.5"/>'+
        '<circle cx="'+siX+'" cy="'+siY+'" r="2.5" fill="'+col+'"/>'+
        '<line x1="'+siX+'" y1="'+siY+'" x2="'+siX+'" y2="'+(siY-6)+'" stroke="'+col+'" stroke-width="2" stroke-linecap="round"/>'+
        '<line x1="'+siX+'" y1="'+siY+'" x2="'+(siX+3.5)+'" y2="'+(siY+2)+'" stroke="'+col+'" stroke-width="2" stroke-linecap="round"/>';
    } else if(isManual){
      statusIcon =
        '<circle cx="'+siX+'" cy="'+siY+'" r="11" fill="'+col+'" opacity="0.15" stroke="'+col+'" stroke-width="1.5"/>'+
        '<polygon points="'+(siX-3.5)+','+(siY-5.5)+' '+(siX+5.5)+','+siY+' '+(siX-3.5)+','+(siY+5.5)+'" fill="'+col+'"/>';
    } else {
      statusIcon =
        '<circle cx="'+siX+'" cy="'+siY+'" r="11" fill="'+col+'" opacity="0.12" stroke="'+col+'" stroke-width="1.5"/>'+
        '<line x1="'+(siX-4)+'" y1="'+(siY-4)+'" x2="'+(siX+4)+'" y2="'+(siY+4)+'" stroke="'+col+'" stroke-width="1.8" stroke-linecap="round"/>'+
        '<line x1="'+(siX+4)+'" y1="'+(siY-4)+'" x2="'+(siX-4)+'" y2="'+(siY+4)+'" stroke="'+col+'" stroke-width="1.8" stroke-linecap="round"/>';
    }

    // ── Rerun / action button (top-right corner) ──
    var btnX = p.x + nodeW - 20, btnY = p.y + 25;
    var rerunBtn = '';
    if(isRunning){
      rerunBtn = '<g class="job-action-btn" onclick="glCancelJob('+j.id+',event)" onmouseover="showJobTip(this,\'Cancel job\')" onmouseout="hideJobTip()" style="cursor:pointer">'+
        '<circle cx="'+btnX+'" cy="'+btnY+'" r="13" fill="rgba(229,62,62,0.08)" stroke="rgba(229,62,62,0.25)" stroke-width="1.2"/>'+
        '<rect x="'+(btnX-4)+'" y="'+(btnY-4)+'" width="8" height="8" rx="2" fill="#e53e3e"/>'+
        '</g>';
    } else if(isManual || isPending){
      rerunBtn = '<g class="job-action-btn" onclick="glPlayJob('+j.id+',event)" onmouseover="showJobTip(this,\'Run job\')" onmouseout="hideJobTip()" style="cursor:pointer">'+
        '<circle cx="'+btnX+'" cy="'+btnY+'" r="13" fill="rgba(26,158,98,0.08)" stroke="rgba(26,158,98,0.25)" stroke-width="1.2"/>'+
        '<polygon points="'+(btnX-3.5)+','+(btnY-5)+' '+(btnX+5)+','+btnY+' '+(btnX-3.5)+','+(btnY+5)+'" fill="#1a9e62"/>'+
        '</g>';
    } else {
      var rc = isFailed ? '#e53e3e' : 'var(--t2)';
      var rb = isFailed ? 'rgba(229,62,62,0.07)' : 'var(--bg1)';
      var rs2 = isFailed ? 'rgba(229,62,62,0.35)' : 'var(--bd2)';
      // Clean refresh arrow: open arc ~300° with clean arrowhead
      // Arc center = btnX, btnY; radius = 5
      // Start: top-right (btnX+4.3, btnY-2.5), sweep ~300° clockwise
      // End point at approx (btnX+1.5, btnY+4.8)
      // Simple clean refresh: open circle arc with arrowhead at bottom-right end
      // Arc from top-right, sweeps ~280° CCW, arrowhead points clockwise at end
      var cx = btnX, cy = btnY;
      rerunBtn =
        '<g class="job-action-btn" onclick="glRetryJob('+j.id+',event)" onmouseover="showJobTip(this,\'Re-run job\')" onmouseout="hideJobTip()" style="cursor:pointer">'+
          '<circle cx="'+cx+'" cy="'+cy+'" r="13" fill="'+rb+'" stroke="'+rs2+'" stroke-width="1.2"/>'+
          // Arc: large open circle, gap at top-right, arrowhead pointing right-downward
          '<path d="M'+(cx+4.8)+','+(cy-1.5)+' A5.2,5.2 0 1 0 '+(cx+3.2)+','+(cy+4.0)+'" fill="none" stroke="'+rc+'" stroke-width="2" stroke-linecap="butt"/>'+
          // Arrowhead at end (cx+3.2, cy+4.0), pointing roughly right (tangent of arc end)
          '<polygon points="'+(cx+3.2)+','+(cy+4.0)+' '+(cx+0.2)+','+(cy+3.2)+' '+(cx+4.2)+','+(cy+1.4)+'" fill="'+rc+'"/>'+
        '</g>';
    }

    // Layout constants
    var cardR  = 12;         // corner radius
    var accentW = 5;         // left accent bar width
    var divY   = p.y + 48;  // divider Y
    var metaX  = p.x + accentW + 10;
    var row1Y  = divY + 13;
    var row2Y  = divY + 27;
    var row3Y  = divY + 41;
    var botY   = p.y + nodeH - 14; // bottom badge row centre

    // Status labels
    var stLabels={success:'Success',passed:'Success',failed:'Failed',failure:'Failed',canceled:'Cancelled',cancelled:'Cancelled',running:'Running',in_progress:'Running',pending:'Pending',queued:'Pending',skipped:'Skipped',created:'Created',manual:'Manual',timed_out:'Timed out'};
    var stLabel = stLabels[j.status] || j.status;

    // Run count — count only attempts within this pipeline (retries), not cross-pipeline.
    // A single job run = 1x; if the job was retried within this pipeline = 2x, etc.
    var runs = S.glJobRunHistory[j.name] || [];
    var pid = S.glSelPipeline ? S.glSelPipeline.id : null;
    var pipelineRuns = pid ? runs.filter(function(r){ return r.pipelineId===pid; }) : runs;
    var runCount = pipelineRuns.length || 1;
    var rcTxt = runCount + 'x';

    return (
      '<g class="dep-node" style="cursor:pointer" onclick="openGLLog('+j.id+')">'+

      // ── Clip path for this card (ensures accent bar clips to card shape) ──
      '<clipPath id="cp'+j.id+'"><rect x="'+p.x+'" y="'+p.y+'" width="'+nodeW+'" height="'+nodeH+'" rx="'+cardR+'"/></clipPath>'+

      // ── Card background ──
      '<rect x="'+p.x+'" y="'+p.y+'" width="'+nodeW+'" height="'+nodeH+'" rx="'+cardR+'"'+
      ' fill="var(--bg1)" stroke="'+col+'" stroke-width="1.6" stroke-opacity="0.35"/>'+

      // ── Left accent bar: clipped to card, all 4 corners naturally rounded ──
      '<rect x="'+p.x+'" y="'+p.y+'" width="'+accentW+'" height="'+nodeH+'" fill="'+col+'" opacity="0.9" clip-path="url(#cp'+j.id+')"/>'+

      // ── Status icon ──
      statusIcon+

      // ── Job name ──
      '<text x="'+(p.x+40)+'" y="'+(p.y+30)+'" font-size="13" font-weight="700" fill="var(--t1)" font-family="'+sansFont+'" dominant-baseline="middle">'+label+'</text>'+

      // ── Retry/action button ──
      rerunBtn+

      // ── Divider ──
      '<line x1="'+(p.x+accentW+6)+'" y1="'+divY+'" x2="'+(p.x+nodeW-8)+'" y2="'+divY+'" stroke="var(--bd)" stroke-width="0.8" opacity="0.8"/>'+

      // ── Row 1: # Job ID ──
      '<text x="'+metaX+'" y="'+row1Y+'" font-size="10" fill="var(--t3)" font-family="'+monoFont+'" opacity="0.8"># '+j.id+'</text>'+

      // ── Row 2: Date ──
      '<text x="'+metaX+'" y="'+row2Y+'" font-size="10" fill="var(--t3)" font-family="'+monoFont+'" opacity="0.8">'+
        '<tspan style="font-size:9px;opacity:0.7">⏱ </tspan>'+dtStr+
      '</text>'+

      // ── Row 3: User ──
      '<text x="'+metaX+'" y="'+row3Y+'" font-size="10" fill="var(--t3)" font-family="'+sansFont+'" opacity="0.8">'+
        '<tspan style="font-size:9px;opacity:0.7">👤 </tspan>'+userStr+
      '</text>'+

      // ── Duration pill (right of row 3) ──
      (dur_s && dur_s !== '—' ?
        '<rect x="'+(p.x+nodeW-58)+'" y="'+(row3Y-11)+'" width="50" height="15" rx="7" fill="'+col+'" opacity="0.12"/>'+
        '<text x="'+(p.x+nodeW-33)+'" y="'+row3Y+'" text-anchor="middle" font-size="9.5" fill="'+col+'" font-family="'+monoFont+'" font-weight="700" dominant-baseline="middle">'+dur_s+'</text>'
      : '')+

      // ── Bottom separator ──
      '<line x1="'+(p.x+accentW+6)+'" y1="'+(p.y+nodeH-26)+'" x2="'+(p.x+nodeW-8)+'" y2="'+(p.y+nodeH-26)+'" stroke="var(--bd)" stroke-width="0.6" opacity="0.6"/>'+

      // ── Status badge (bottom-left) ──
      (function(){
        var bw = stLabel.length * 5.8 + 16;
        var bx = p.x + accentW + 8;
        var by = p.y + nodeH - 21;
        return '<rect x="'+bx+'" y="'+by+'" width="'+bw+'" height="15" rx="7" fill="'+col+'" opacity="0.13"/>'+
          '<text x="'+(bx+bw/2)+'" y="'+(by+8)+'" text-anchor="middle" font-size="9" font-weight="700" fill="'+col+'" font-family="'+monoFont+'" dominant-baseline="middle" letter-spacing="0.02em">'+stLabel+'</text>';
      })()+

      // ── Run count badge (bottom-right, clickable) ──
      (function(){
        var bw = rcTxt.length * 7 + 16;
        var bx = p.x + nodeW - bw - 8;
        var by = p.y + nodeH - 21;
        return '<g onclick="openJobHistory(\''+j.name.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\')" style="cursor:pointer" onmouseover="evt=arguments[0];this.querySelector(\'rect\').style.opacity=\'0.3\'" onmouseout="this.querySelector(\'rect\').style.opacity=\'0.14\'">'+
          '<rect x="'+bx+'" y="'+by+'" width="'+bw+'" height="15" rx="7" fill="var(--t3)" opacity="0.14"/>'+
          '<text x="'+(bx+bw/2)+'" y="'+(by+8)+'" text-anchor="middle" font-size="9" font-weight="700" fill="var(--t2)" font-family="'+monoFont+'" dominant-baseline="middle">'+rcTxt+'</text>'+
          '</g>';
      })()+

      '</g>'
    );
  }).join('');

  // ── Upstream node: rendered as SVG card in col 0 (only if hasUp) ──
  var upstreamNode = '';
  var upstreamEdge = '';
  if(hasUp){
    var gup = S.glUpstreamPipeline;
    var gupUser = gup.user ? (gup.user.name || gup.user.username || '') : (gup.triggeredByUser || '');
    gupUser = gupUser.length > 18 ? gupUser.slice(0,17)+'…' : gupUser;
    var gupRef = (gup.ref || '');
    gupRef = gupRef.length > 16 ? gupRef.slice(0,15)+'…' : gupRef;
    var gupStatus = gup.status || 'success';
    var gupFinished = gup.finished_at || gup.updated_at;
    var gupDurStr = (gup.created_at && gupFinished && (gupStatus==='success'||gupStatus==='failed'||gupStatus==='canceled')) ? dur(gup.created_at, gupFinished) : '';
    var gupDateTime = gup.created_at ? fmtDateTime(gup.created_at) : '';
    var gupProjName = (gup.project || (S.glSelProj ? S.glSelProj.name : ''));
    gupProjName = gupProjName.length > 18 ? gupProjName.slice(0,17)+'…' : gupProjName;
    // Place in col 0, vertically centered to match real jobs
    var upRow = Math.floor(maxJobsInStage / 2);
    var upX = padX;
    var upY = padY + upRow * (nodeH + rowGap);
    var upCol = '#c07c10'; // always amber for upstream
    var upCardR = 12, upAccentW = 5;
    var upDivY = upY + 48;
    var upMetaX = upX + upAccentW + 10;
    var upRow1Y = upDivY + 13, upRow2Y = upDivY + 27, upRow3Y = upDivY + 41;
    var upLabel = ('#'+gup.id+(gupRef?' · '+gupRef:'')).length > 24 ? ('#'+gup.id+(gupRef?' · '+gupRef:'')).slice(0,23)+'…' : '#'+gup.id+(gupRef?' · '+gupRef:'');
    // Tiny "TRIGGERED BY" label above the card
    var upTagLabel = 'TRIGGERED BY';
    var upTagW = upTagLabel.length * 5.4 + 14;
    var upTagX = upX + (nodeW - upTagW) / 2;
    var upTagY = upY - 20;
    // Status icon: up-arrows
    var upSiX = upX + 22, upSiY = upY + 25;
    var upStatusIcon = '<circle cx="'+upSiX+'" cy="'+upSiY+'" r="11" fill="'+upCol+'" opacity="0.15" stroke="'+upCol+'" stroke-width="1.5"/>'+
      '<polyline points="'+(upSiX-4)+','+(upSiY+3)+' '+upSiX+','+(upSiY-3)+' '+(upSiX+4)+','+(upSiY+3)+'" fill="none" stroke="'+upCol+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+
      '<polyline points="'+(upSiX-4)+','+(upSiY+7)+' '+upSiX+','+(upSiY+1)+' '+(upSiX+4)+','+(upSiY+7)+'" fill="none" stroke="'+upCol+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    var upStLabel = 'Upstream';
    var upBadgeW = upStLabel.length * 5.8 + 16;
    var upBadgeX = upX + upAccentW + 8, upBadgeY = upY + nodeH - 21;
    var upIdStr = '# '+gup.id;
    upstreamNode =
      // Small "TRIGGERED BY" tag above card
      '<rect x="'+upTagX+'" y="'+(upTagY)+'" width="'+upTagW+'" height="15" rx="7" fill="'+upCol+'" opacity="0.14"/>'+
      '<text x="'+(upTagX+upTagW/2)+'" y="'+(upTagY+8)+'" text-anchor="middle" font-size="8" font-weight="700" fill="'+upCol+'" font-family="JetBrains Mono,monospace" dominant-baseline="middle" letter-spacing="0.06em">'+upTagLabel+'</text>'+
      '<g style="cursor:pointer" onclick="loadUpstreamPipelineGraph('+gup.id+',\''+((gup.project_id)||'')+'\',event)">'+
      // Dotted border card (dashed = upstream / external)
      '<rect x="'+upX+'" y="'+upY+'" width="'+nodeW+'" height="'+nodeH+'" rx="'+upCardR+'" fill="var(--bg1)" stroke="'+upCol+'" stroke-width="1.8" stroke-opacity="0.55" stroke-dasharray="6 3"/>'+
      // Subtle amber background tint
      '<rect x="'+upX+'" y="'+upY+'" width="'+nodeW+'" height="'+nodeH+'" rx="'+upCardR+'" fill="'+upCol+'" opacity="0.04"/>'+
      '<clipPath id="cpUp"><rect x="'+upX+'" y="'+upY+'" width="'+nodeW+'" height="'+nodeH+'" rx="'+upCardR+'"/></clipPath>'+
      // Left accent bar
      '<rect x="'+upX+'" y="'+upY+'" width="'+upAccentW+'" height="'+nodeH+'" fill="'+upCol+'" opacity="0.7" clip-path="url(#cpUp)"/>'+
      // Status icon
      upStatusIcon+
      // Title: pipeline # and ref
      '<text x="'+(upX+40)+'" y="'+(upY+30)+'" font-size="12" font-weight="700" fill="'+upCol+'" font-family="DM Sans,sans-serif" dominant-baseline="middle">'+upLabel+'</text>'+
      // Divider
      '<line x1="'+(upX+upAccentW+6)+'" y1="'+upDivY+'" x2="'+(upX+nodeW-8)+'" y2="'+upDivY+'" stroke="'+upCol+'" stroke-width="0.8" opacity="0.3"/>'+
      // Row 1: Project name
      '<text x="'+upMetaX+'" y="'+upRow1Y+'" font-size="9.5" fill="var(--t3)" font-family="JetBrains Mono,monospace" opacity="0.85">'+
        '<tspan style="opacity:0.65">📁 </tspan>'+(gupProjName||upIdStr)+
      '</text>'+
      // Row 2: datetime
      '<text x="'+upMetaX+'" y="'+upRow2Y+'" font-size="9.5" fill="var(--t3)" font-family="JetBrains Mono,monospace" opacity="0.85">'+
        '<tspan style="opacity:0.65">⏱ </tspan>'+(gupDateTime||'—')+
      '</text>'+
      // Row 3: user
      '<text x="'+upMetaX+'" y="'+upRow3Y+'" font-size="9.5" fill="var(--t3)" font-family="DM Sans,sans-serif" opacity="0.85">'+
        '<tspan style="opacity:0.65">👤 </tspan>'+(gupUser||'—')+
      '</text>'+
      // Duration pill
      (gupDurStr ? '<rect x="'+(upX+nodeW-58)+'" y="'+(upRow3Y-11)+'" width="50" height="15" rx="7" fill="'+upCol+'" opacity="0.13"/>'+
        '<text x="'+(upX+nodeW-33)+'" y="'+upRow3Y+'" text-anchor="middle" font-size="9.5" fill="'+upCol+'" font-family="JetBrains Mono,monospace" font-weight="700" dominant-baseline="middle">'+gupDurStr+'</text>' : '')+
      // Bottom separator
      '<line x1="'+(upX+upAccentW+6)+'" y1="'+(upY+nodeH-26)+'" x2="'+(upX+nodeW-8)+'" y2="'+(upY+nodeH-26)+'" stroke="var(--bd)" stroke-width="0.6" opacity="0.5"/>'+
      // Status badge
      '<rect x="'+upBadgeX+'" y="'+upBadgeY+'" width="'+upBadgeW+'" height="15" rx="7" fill="'+upCol+'" opacity="0.13"/>'+
      '<text x="'+(upBadgeX+upBadgeW/2)+'" y="'+(upBadgeY+8)+'" text-anchor="middle" font-size="9" font-weight="700" fill="'+upCol+'" font-family="JetBrains Mono,monospace" dominant-baseline="middle">'+upStLabel+'</text>'+
      // "View Graph" link at bottom-right
      '<text x="'+(upX+nodeW-10)+'" y="'+(upBadgeY+8)+'" text-anchor="end" font-size="9" font-weight="700" fill="'+upCol+'" font-family="JetBrains Mono,monospace" dominant-baseline="middle">View Graph ↗</text>'+
      '</g>';

    // Dotted arrow from upstream node right-edge to first real job node (row 0 of stage 0) left-edge
    var firstStage = stageOrder[0];
    var firstJob = firstStage && stageMap[firstStage] && stageMap[firstStage][0];
    if(firstJob){
      var fp = positions[firstJob.id];
      var ax1 = upX + nodeW, ay1 = upY + nodeH/2;
      var ax2 = fp.x, ay2 = fp.y + nodeH/2;
      var acp = Math.max(20, (ax2-ax1)*0.4);
      var amid = 'arr_upstream_to_first';
      upstreamEdge =
        '<defs><marker id="'+amid+'" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="'+upCol+'" opacity="0.7"/></marker></defs>'+
        '<path d="M'+ax1+' '+ay1+' C'+(ax1+acp)+' '+ay1+' '+(ax2-acp)+' '+ay2+' '+ax2+' '+ay2+'" fill="none" stroke="'+upCol+'" stroke-width="1.8" stroke-dasharray="6 3" opacity="0.6" marker-end="url(#'+amid+')"/>';
    }
  }

  // ── Downstream nodes: each downstream pipeline is an SVG card immediately after last job column ──
  var downstreamNodes = '';
  var downstreamEdges = '';
  if(hasDown){
    var dCol = colOffset + numStages;
    // Position downstream card right after last job column with tight gap (already baked into dBaseX via svgW calc)
    var dBaseX = padX + (colOffset + numStages - 1) * (nodeW + colGap) + nodeW + downColGap;
    // Connect from last stage's first job right-edge to each downstream node
    var lastStage = stageOrder[stageOrder.length - 1];
    var lastJob = lastStage && stageMap[lastStage] && stageMap[lastStage][0];

    S.glDownstreamPipelines.forEach(function(ds, di){
      var dp = ds.pipeline; if(!dp) return;
      var dpStatus = dp.status || 'created';
      var dpCol2 = '#1a73d9'; // blue for downstream
      var dpUser2 = dp.user ? (dp.user.name || dp.user.username || '') : '';
      dpUser2 = dpUser2.length > 18 ? dpUser2.slice(0,17)+'…' : dpUser2;
      var dpRef2 = dp.ref || '';
      dpRef2 = dpRef2.length > 16 ? dpRef2.slice(0,15)+'…' : dpRef2;
      var dpFinished2 = dp.finished_at || dp.updated_at;
      var dpDurStr2 = (dp.created_at && dpFinished2 && (dpStatus==='success'||dpStatus==='failed'||dpStatus==='canceled')) ? dur(dp.created_at, dpFinished2) : '';
      var dpCreatedStr2 = dp.created_at ? fmtDateTime(dp.created_at) : '';
      var dpLabel2 = ('#'+dp.id).length > 24 ? ('#'+dp.id).slice(0,23)+'…' : '#'+dp.id+(dpRef2?' · '+dpRef2:'');

      var dpY2 = padY + di * (nodeH + rowGap);
      var dpX2 = dBaseX;
      var dpCardR2 = 12, dpAccentW2 = 5;
      var dpDivY2 = dpY2 + 48;
      var dpMetaX2 = dpX2 + dpAccentW2 + 10;
      var dpRow1Y2 = dpDivY2 + 13, dpRow2Y2 = dpDivY2 + 27, dpRow3Y2 = dpDivY2 + 41;

      // Status icon for downstream: down-arrows
      var dpSiX2 = dpX2 + 22, dpSiY2 = dpY2 + 25;
      var dpStatusIcon2 = '';
      if(dpStatus==='success'||dpStatus==='passed'){
        dpStatusIcon2 = '<circle cx="'+dpSiX2+'" cy="'+dpSiY2+'" r="11" fill="#1a9e62"/>'+
          '<path d="M'+(dpSiX2-5)+','+dpSiY2+' L'+(dpSiX2-1.5)+','+(dpSiY2+4)+' L'+(dpSiX2+5)+','+(dpSiY2-4.5)+'" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
        dpCol2 = '#1a9e62';
      } else if(dpStatus==='failed'||dpStatus==='failure'){
        dpStatusIcon2 = '<circle cx="'+dpSiX2+'" cy="'+dpSiY2+'" r="11" fill="#e53e3e"/>'+
          '<line x1="'+(dpSiX2-4.5)+'" y1="'+(dpSiY2-4.5)+'" x2="'+(dpSiX2+4.5)+'" y2="'+(dpSiY2+4.5)+'" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>'+
          '<line x1="'+(dpSiX2+4.5)+'" y1="'+(dpSiY2-4.5)+'" x2="'+(dpSiX2-4.5)+'" y2="'+(dpSiY2+4.5)+'" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>';
        dpCol2 = '#e53e3e';
      } else if(dpStatus==='running'||dpStatus==='in_progress'){
        dpStatusIcon2 = '<circle cx="'+dpSiX2+'" cy="'+dpSiY2+'" r="11" fill="#c07c10" opacity="0.15" stroke="#c07c10" stroke-width="1.5"/>'+
          '<path d="M'+dpSiX2+','+(dpSiY2-8)+' A8 8 0 0 1 '+(dpSiX2+8)+','+dpSiY2+'" fill="none" stroke="#c07c10" stroke-width="2.5" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 '+dpSiX2+' '+dpSiY2+'" to="360 '+dpSiX2+' '+dpSiY2+'" dur="0.9s" repeatCount="indefinite"/></path>';
        dpCol2 = '#c07c10';
      } else {
        dpStatusIcon2 = '<circle cx="'+dpSiX2+'" cy="'+dpSiY2+'" r="11" fill="'+dpCol2+'" opacity="0.15" stroke="'+dpCol2+'" stroke-width="1.5"/>'+
          '<polyline points="'+(dpSiX2-4)+','+(dpSiY2-3)+' '+dpSiX2+','+(dpSiY2+3)+' '+(dpSiX2+4)+','+(dpSiY2-3)+'" fill="none" stroke="'+dpCol2+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'+
          '<polyline points="'+(dpSiX2-4)+','+(dpSiY2-7)+' '+dpSiX2+','+(dpSiY2-1)+' '+(dpSiX2+4)+','+(dpSiY2-7)+'" fill="none" stroke="'+dpCol2+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      }

      var dpBadgeLabel2 = 'Downstream';
      var dpBadgeW2 = dpBadgeLabel2.length * 5.8 + 16;
      var dpBadgeX2 = dpX2 + dpAccentW2 + 8, dpBadgeY2 = dpY2 + nodeH - 21;

      // Tag above card (only first downstream)
      var dpTagHtml = '';
      if(di === 0){
        var dpTagLabel = 'TRIGGER-DOWNSTREAM';
        var dpTagW = dpTagLabel.length * 5.4 + 14;
        var dpTagX2 = dpX2 + (nodeW - dpTagW) / 2;
        var dpTagY2 = dpY2 - 20;
        dpTagHtml = '<rect x="'+dpTagX2+'" y="'+dpTagY2+'" width="'+dpTagW+'" height="15" rx="7" fill="var(--bl)" opacity="0.14"/>'+
          '<text x="'+(dpTagX2+dpTagW/2)+'" y="'+(dpTagY2+8)+'" text-anchor="middle" font-size="8" font-weight="700" fill="var(--bl)" font-family="JetBrains Mono,monospace" dominant-baseline="middle" letter-spacing="0.06em">'+dpTagLabel+'</text>';
      }

      downstreamNodes +=
        dpTagHtml+
        '<g style="cursor:pointer" onclick="loadDownstreamPipelineGraph(\''+dp.project_id+'\','+dp.id+',event)">'+
        // Dotted border card
        '<rect x="'+dpX2+'" y="'+dpY2+'" width="'+nodeW+'" height="'+nodeH+'" rx="'+dpCardR2+'" fill="var(--bg1)" stroke="'+dpCol2+'" stroke-width="1.8" stroke-opacity="0.55" stroke-dasharray="6 3"/>'+
        // Subtle blue tint
        '<rect x="'+dpX2+'" y="'+dpY2+'" width="'+nodeW+'" height="'+nodeH+'" rx="'+dpCardR2+'" fill="'+dpCol2+'" opacity="0.04"/>'+
        '<clipPath id="cpDown'+di+'"><rect x="'+dpX2+'" y="'+dpY2+'" width="'+nodeW+'" height="'+nodeH+'" rx="'+dpCardR2+'"/></clipPath>'+
        // Left accent bar
        '<rect x="'+dpX2+'" y="'+dpY2+'" width="'+dpAccentW2+'" height="'+nodeH+'" fill="'+dpCol2+'" opacity="0.7" clip-path="url(#cpDown'+di+')"/>'+
        // Status icon
        dpStatusIcon2+
        // Title
        '<text x="'+(dpX2+40)+'" y="'+(dpY2+30)+'" font-size="12" font-weight="700" fill="'+dpCol2+'" font-family="DM Sans,sans-serif" dominant-baseline="middle">'+dpLabel2+'</text>'+
        // Divider
        '<line x1="'+(dpX2+dpAccentW2+6)+'" y1="'+dpDivY2+'" x2="'+(dpX2+nodeW-8)+'" y2="'+dpDivY2+'" stroke="'+dpCol2+'" stroke-width="0.8" opacity="0.3"/>'+
        // Row 1: via bridge job
        '<text x="'+dpMetaX2+'" y="'+dpRow1Y2+'" font-size="10" fill="var(--t3)" font-family="JetBrains Mono,monospace" opacity="0.8">via '+ds.bridgeJobName+'</text>'+
        // Row 2: datetime
        '<text x="'+dpMetaX2+'" y="'+dpRow2Y2+'" font-size="9.5" fill="var(--t3)" font-family="JetBrains Mono,monospace" opacity="0.8">'+
          '<tspan style="opacity:0.7">⏱ </tspan>'+(dpCreatedStr2||'—')+
        '</text>'+
        // Row 3: user
        '<text x="'+dpMetaX2+'" y="'+dpRow3Y2+'" font-size="9.5" fill="var(--t3)" font-family="DM Sans,sans-serif" opacity="0.8">'+
          '<tspan style="opacity:0.7">👤 </tspan>'+(dpUser2||'—')+
        '</text>'+
        // Duration pill
        (dpDurStr2 ? '<rect x="'+(dpX2+nodeW-58)+'" y="'+(dpRow3Y2-11)+'" width="50" height="15" rx="7" fill="'+dpCol2+'" opacity="0.12"/>'+
          '<text x="'+(dpX2+nodeW-33)+'" y="'+dpRow3Y2+'" text-anchor="middle" font-size="9.5" fill="'+dpCol2+'" font-family="JetBrains Mono,monospace" font-weight="700" dominant-baseline="middle">'+dpDurStr2+'</text>' : '')+
        // Bottom separator
        '<line x1="'+(dpX2+dpAccentW2+6)+'" y1="'+(dpY2+nodeH-26)+'" x2="'+(dpX2+nodeW-8)+'" y2="'+(dpY2+nodeH-26)+'" stroke="var(--bd)" stroke-width="0.6" opacity="0.5"/>'+
        // Badge
        '<rect x="'+dpBadgeX2+'" y="'+dpBadgeY2+'" width="'+dpBadgeW2+'" height="15" rx="7" fill="'+dpCol2+'" opacity="0.13"/>'+
        '<text x="'+(dpBadgeX2+dpBadgeW2/2)+'" y="'+(dpBadgeY2+8)+'" text-anchor="middle" font-size="9" font-weight="700" fill="'+dpCol2+'" font-family="JetBrains Mono,monospace" dominant-baseline="middle">'+dpBadgeLabel2+'</text>'+
        // "View Graph" at bottom-right
        '<text x="'+(dpX2+nodeW-10)+'" y="'+(dpBadgeY2+8)+'" text-anchor="end" font-size="9" font-weight="700" fill="'+dpCol2+'" font-family="JetBrains Mono,monospace" dominant-baseline="middle">View Graph ↗</text>'+
        '</g>';

      // Dotted arrow from last job right-edge to this downstream node left-edge
      if(lastJob){
        var lfp = positions[lastJob.id];
        var dax1 = lfp.x + nodeW, day1 = lfp.y + nodeH/2;
        var dax2 = dpX2, day2 = dpY2 + nodeH/2;
        var dacp = Math.max(20, (dax2-dax1)*0.4);
        var damid = 'arr_last_to_down'+di;
        downstreamEdges +=
          '<defs><marker id="'+damid+'" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="'+dpCol2+'" opacity="0.6"/></marker></defs>'+
          '<path d="M'+dax1+' '+day1+' C'+(dax1+dacp)+' '+day1+' '+(dax2-dacp)+' '+day2+' '+dax2+' '+day2+'" fill="none" stroke="'+dpCol2+'" stroke-width="1.8" stroke-dasharray="6 3" opacity="0.55" marker-end="url(#'+damid+')"/>';
      }
    });

    // Recalculate svgH to accommodate all downstream rows
    var dsRowCount = S.glDownstreamPipelines.length;
    var dsHeight = padY + dsRowCount * (nodeH + rowGap) - rowGap + 30;
    if(dsHeight > svgH) svgH = dsHeight;
  }

  // Fix #4: graph banner background/text matches overall pipeline status color
  var pSt = S.glSelPipeline ? S.glSelPipeline.status : '';
  var bannerC = '#1a73d9'; // default blue
  var bannerBg = 'var(--blB)';
  var bannerBd = 'var(--blL)';
  if(pSt==='success'||pSt==='passed'){ bannerC='var(--gr)'; bannerBg='var(--grB)'; bannerBd='var(--grL)'; }
  else if(pSt==='failed'||pSt==='failure'){ bannerC='var(--re)'; bannerBg='var(--reB)'; bannerBd='var(--reL)'; }
  else if(pSt==='running'||pSt==='in_progress'){ bannerC='var(--am)'; bannerBg='var(--amB)'; bannerBd='var(--amL)'; }
  else if(pSt==='canceled'||pSt==='cancelled'||pSt==='skipped'){ bannerC='var(--t3)'; bannerBg='var(--bg2)'; bannerBd='var(--bd2)'; }
  else if(pSt==='pending'||pSt==='created'){ bannerC='var(--bl)'; bannerBg='var(--blB)'; bannerBd='var(--blL)'; }

  return (
    '<div style="width:100%;height:100%;overflow:auto;background:var(--bg0);position:relative;display:flex;flex-direction:column">'+
    '<div style="font-size:10px;color:'+bannerC+';background:'+bannerBg+';border-bottom:1px solid '+bannerBd+';padding:5px 14px;display:flex;align-items:center;gap:6px;flex-shrink:0">'+
    icoInfo()+' Click card to view logs &nbsp;·&nbsp; <b>&#x21ba;</b> to rerun any job &nbsp;·&nbsp; &#x25b6; to play/start &nbsp;·&nbsp; &#x25a0; to cancel running'+
    '<span style="margin-left:auto"></span>'+
    (function(){
      var ps = S.glSelPipeline ? S.glSelPipeline.status : '';
      var isActive = ps==='running'||ps==='in_progress'||ps==='pending'||ps==='created';
      if(isActive){
        return '<button onclick="glCancelPipeline()"'+
          ' data-ltip="Cancel pipeline"'+
          ' onmouseover="this.style.background=\'rgba(229,62,62,0.18)\';this.style.borderColor=\'#e53e3e\';showLogTip(this,this.getAttribute(\'data-ltip\'))"'+
          ' onmouseout="this.style.background=\'rgba(229,62,62,0.08)\';this.style.borderColor=\'rgba(229,62,62,0.4)\';hideLogTip()"'+
          ' style="display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 10px;border-radius:5px;border:1px solid rgba(229,62,62,0.4);background:rgba(229,62,62,0.08);cursor:pointer;font-size:10px;font-weight:600;color:#e53e3e;font-family:\'DM Sans\',sans-serif;transition:all .15s">'+
          '<svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><rect width="9" height="9" rx="1.5"/></svg> Cancel Pipeline</button>';
      } else {
        return '<button onclick="glRetryPipeline()"'+
          ' data-ltip="Trigger new pipeline with same branch &amp; inputs"'+
          ' onmouseover="this.style.background=\'rgba(0,174,239,0.16)\';this.style.borderColor=\'var(--pu)\';showLogTip(this,this.getAttribute(\'data-ltip\'))"'+
          ' onmouseout="this.style.background=\'rgba(0,174,239,0.07)\';this.style.borderColor=\'rgba(0,174,239,0.35)\';hideLogTip()"'+
          ' style="display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 10px;border-radius:5px;border:1px solid rgba(0,174,239,0.35);background:rgba(0,174,239,0.07);cursor:pointer;font-size:10px;font-weight:600;color:var(--pu);font-family:\'DM Sans\',sans-serif;transition:all .15s">'+
          '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" viewBox="0 0 24 24"><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg> Retry Pipeline</button>';
      }
    })()+
    '</div>'+
    '<div style="overflow:auto;padding:8px 0;flex:1">'+
    '<svg width="'+Math.max(svgW,600)+'" height="'+svgH+'" xmlns="http://www.w3.org/2000/svg" style="display:block">'+
    '<style>'+
    '.dep-node rect:first-of-type{transition:filter .15s,stroke-width .15s,stroke .15s}'+
    '.dep-node:hover rect:nth-of-type(2){stroke-opacity:0.65!important;filter:drop-shadow(0 4px 16px rgba(92,79,214,0.22))!important}'+
    '.job-action-btn{transition:transform .15s,filter .15s}'+
    '.job-action-btn:hover circle{fill:var(--bg2)!important;stroke:var(--pu)!important}'+
    '</style>'+
    edges + upstreamEdge + downstreamEdges + headers + nodes + upstreamNode + downstreamNodes +
    '</svg></div>'+
    '</div>'
  );
}

async function glPlayJob(jobId, e){
  if(e) e.stopPropagation();
  try {
    await glApi('/projects/'+S.glSelProj.id+'/jobs/'+jobId+'/play', {method:'POST'});
    toast('Job started!');
    setTimeout(function(){ selGLPipeline(S.glSelPipeline.id); }, 1000);
  } catch(err){ toast('Failed to start job: '+(err.message||'check permissions'),'err'); }
}

async function glCancelJob(jobId, e){
  if(e) e.stopPropagation();
  try {
    await glApi('/projects/'+S.glSelProj.id+'/jobs/'+jobId+'/cancel', {method:'POST'});
    toast('Job cancelled');
    setTimeout(function(){ selGLPipeline(S.glSelPipeline.id); }, 1000);
  } catch(err){ toast('Failed to cancel job: '+(err.message||'check permissions'),'err'); }
}

async function glRetryJob(jobId, e){
  if(e) e.stopPropagation();
  try {
    await glApi('/projects/'+S.glSelProj.id+'/jobs/'+jobId+'/retry', {method:'POST'});
    toast('Job re-triggered!');
    setTimeout(function(){ selGLPipeline(S.glSelPipeline.id); }, 1200);
  } catch(err){ toast('Failed to retry job: '+(err.message||'check permissions'),'err'); }
}

async function glRetryPipeline(){
  if(!S.glSelPipeline || !S.glSelProj) return;
  // Determine the branch to re-trigger on.
  // Priority: pipeline's own ref → current run form branch → fall back to default branch
  var pipelineRef = S.glSelPipeline.ref || S.glBranch || (S.glBranchInfo && S.glBranchInfo.name) || '';
  if(!pipelineRef){
    toast('Cannot retry — could not determine pipeline branch','err');
    return;
  }
  try {
    // Build variables payload from current form state (same as triggerGLPipeline).
    // If the run form has been loaded for the same project, re-use glParamVals/glAdhoc.
    // This mirrors the original trigger so the new run gets identical inputs.
    var extra = {};
    (S.glAdhoc||[]).forEach(function(r){ if(r.key) extra[r.key] = r.value; });
    var regularCiVars = (S.glCiInputVars||[]).filter(function(v){ return v.source !== 'spec:inputs'; });
    regularCiVars.forEach(function(v){
      if(v.inputRef) return;
      var val = S.glParamVals[v.key] !== undefined ? S.glParamVals[v.key] : '';
      if(val.trim()) extra[v.key] = val.trim();
    });
    var variables = Object.entries(extra)
      .filter(function(e){ return e[1] !== undefined && String(e[1]).trim() !== ''; })
      .map(function(e){ return {key:e[0], value:String(e[1])}; });

    var inputs = {};
    var specInputVars = (S.glCiInputVars||[]).filter(function(v){ return v.source === 'spec:inputs'; });
    specInputVars.forEach(function(v){
      var val = (S.glParamVals[v.key]||'').trim();
      if(val) inputs[v.key] = val;
    });

    var body = {ref: pipelineRef, variables: variables};
    if(Object.keys(inputs).length) body['inputs'] = inputs;

    // Safety: if project restricts variable passing, fall back to ref-only
    var res;
    try {
      res = await glApi('/projects/'+S.glSelProj.id+'/pipeline', {method:'POST', body:JSON.stringify(body)});
    } catch(apiErr){
      var errMsg = apiErr.message || '';
      if(errMsg.toLowerCase().indexOf('insufficient permissions') !== -1){
        // Retry without variables
        res = await glApi('/projects/'+S.glSelProj.id+'/pipeline', {method:'POST', body:JSON.stringify({ref: pipelineRef})});
      } else {
        throw apiErr;
      }
    }

    toast('Pipeline #'+res.id+' re-triggered on '+pipelineRef+'!');
    S.glRuns = [res].concat(S.glRuns.slice(0,14));
    S.glSelPipeline = res;
    S.glShowGraph = true;
    saveSession();
    // Navigate to history graph view and load the new pipeline
    goTo('history');
    await selGLPipeline(res.id);
    startGLPoll(res.id);
  } catch(err){ toast('Failed to re-trigger pipeline: '+(err.message||'check permissions'),'err'); }
}

async function glCancelPipeline(){
  if(!S.glSelPipeline || !S.glSelProj) return;
  try {
    await glApi('/projects/'+S.glSelProj.id+'/pipelines/'+S.glSelPipeline.id+'/cancel', {method:'POST'});
    toast('Pipeline cancelled.');
    setTimeout(function(){ selGLPipeline(S.glSelPipeline.id); }, 1000);
  } catch(err){ toast('Failed to cancel pipeline: '+(err.message||'check permissions'),'err'); }
}

/* ── Job action button tooltip — shims to unified engine ── */
function showJobTip(el, text){ _showLtip(el, text); }
function hideJobTip(){ hideLogTip(); }

/* ══════════════════════════════════════════════════════
   UNIFIED TOOLTIP SYSTEM  (delegated — same pattern as sidebar)
   • One mouseover listener on document handles ALL [data-ltip] elements
   • No inline onmouseover/onmouseout needed — they're left as no-ops
   • Shows for 1350ms (≈75% of old 1800ms), then auto-dismisses
   • Click anywhere → immediate hide + 500ms suppress window
     prevents re-render mouseover re-showing the tip
══════════════════════════════════════════════════════ */
var _logTipEl       = null;   // current tip DOM node
var _logTipTimer    = null;   // fade-out timer
var _logTipAutoHide = null;   // auto-dismiss timer
var _logTipLastEl   = null;   // element that triggered the current tip

var _tipSuppressed    = false;
var _tipSuppressTimer = null;

function _suppressTips(){
  _tipSuppressed = true;
  clearTimeout(_tipSuppressTimer);
  hideLogTip();
  hideDotPopover();
  _tipSuppressTimer = setTimeout(function(){ _tipSuppressed = false; }, 500);
}

/* Core show — called by delegated listener and all legacy shims */
function _showLtip(el, text){
  if(_tipSuppressed) return;
  if(!text) return;
  // Don't re-show for the same element while tip is still live
  if(_logTipEl && _logTipLastEl === el) return;
  hideLogTip();
  var rect = el.getBoundingClientRect();
  var tip = document.createElement('div');
  tip.id = 'log-btn-tip';
  var isLong = text.length > 48;
  tip.style.cssText = [
    'position:fixed','z-index:99999','pointer-events:none',
    'background:var(--t1)','color:var(--bg1)',
    'font-size:11px','font-weight:500','font-family:DM Sans,sans-serif',
    'padding:5px 10px','border-radius:6px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.22)',
    isLong ? 'white-space:normal;max-width:240px;word-break:break-word;line-height:1.4;text-align:center' : 'white-space:nowrap',
    'opacity:0','transition:opacity .12s,transform .12s'
  ].join(';');
  tip.textContent = text;
  document.body.appendChild(tip);
  _logTipEl    = tip;
  _logTipLastEl = el;
  var tw = tip.offsetWidth || 80;
  var th = tip.offsetHeight || 24;
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var pad = 6;
  // Horizontal: centre under element, clamp to viewport
  var left = rect.left + rect.width / 2 - tw / 2;
  left = Math.max(pad, Math.min(left, vw - tw - pad));
  tip.style.left = left + 'px';
  // Vertical: prefer above the element; fall back to below if it would clip the top
  var aboveTop = rect.top - th - 8;
  var belowTop = rect.bottom + 8;
  var showBelow = aboveTop < pad || rect.top < 50;
  // If showing below would also clip the bottom, go back above (best-fit)
  if(showBelow && belowTop + th + pad > vh) showBelow = false;
  if(showBelow){
    tip.style.top       = Math.min(belowTop, vh - th - pad) + 'px';
    tip.style.transform = 'translateY(-4px)';
    requestAnimationFrame(function(){ tip.style.opacity='1'; tip.style.transform='translateY(0)'; });
  } else {
    tip.style.top       = Math.max(pad, aboveTop) + 'px';
    tip.style.transform = 'translateY(4px)';
    requestAnimationFrame(function(){ tip.style.opacity='1'; tip.style.transform='translateY(0)'; });
  }
  // Auto-dismiss after 1000ms
  clearTimeout(_logTipAutoHide);
  _logTipAutoHide = setTimeout(function(){ hideLogTip(); }, 1000);
}

/* Delegated listener — catches [data-ltip] everywhere AND [data-tip] in the sidebar */
document.addEventListener('mouseover', function(e){
  var el = e.target && e.target.closest ? e.target.closest('[data-ltip]') : null;
  if(el){ _showLtip(el, el.getAttribute('data-ltip')); return; }
  // Sidebar [data-tip] elements — only when sidebar is collapsed (icon rail)
  var sidebar = document.getElementById('main-sidebar');
  var isCol = sidebar && sidebar.classList.contains('sb-collapsed');
  if(isCol){
    var sb = e.target.closest ? e.target.closest('[data-tip]') : null;
    if(sb && sidebar.contains(sb)){ _showLtip(sb, sb.getAttribute('data-tip')); }
  } else {
    // Expanded sidebar: footer icons + truncated project names
    var sbFt = e.target.closest ? e.target.closest('.sb-ft .sb-tip[data-tip]') : null;
    if(sbFt){ _showLtip(sbFt, sbFt.getAttribute('data-tip')); return; }
    var proj = e.target.closest ? e.target.closest('.sb-proj[data-tip]') : null;
    if(proj){ var nm=proj.querySelector('.sb-proj-name'); if(nm&&nm.scrollWidth>nm.clientWidth+1) _showLtip(proj, proj.getAttribute('data-tip')); }
  }
}, false);

document.addEventListener('mouseout', function(e){
  if(!_logTipEl) return;
  var el = e.target && e.target.closest ? e.target.closest('[data-ltip],[data-tip]') : null;
  if(!el) return;
  // Only hide when actually leaving the trigger element
  var to = e.relatedTarget;
  if(to && el.contains(to)) return;
  hideLogTip();
}, false);

/* Legacy inline shim — keeps existing onmouseover="showLogTip(this,...)" calls working */
function showLogTip(el, text){
  _showLtip(el, text || (el && el.getAttribute('data-ltip')) || '');
}

function hideLogTip(){
  clearTimeout(_logTipTimer);
  clearTimeout(_logTipAutoHide);
  var t = _logTipEl; _logTipEl = null; _logTipLastEl = null;
  if(!t) return;
  t.style.opacity = '0';
  _logTipTimer = setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 120);
}


function openJobHistory(jobName){
  // Stop click from also opening log
  event && event.stopPropagation && event.stopPropagation();
  S.jobHistoryOpen = jobName;
  renderJobHistoryDrawer();
}

function closeJobHistory(){
  S.jobHistoryOpen = null;
  var el2 = document.getElementById('job-hist-overlay');
  if(el2) el2.remove();
}

function renderJobHistoryDrawer(){
  var existing = document.getElementById('job-hist-overlay');
  if(existing) existing.remove();

  var jobName = S.jobHistoryOpen;
  if(!jobName) return;

  var runs = (S.glJobRunHistory[jobName] || []).slice();
  // Sort newest first (largest pipelineId first)
  runs.sort(function(a,b){ return b.pipelineId - a.pipelineId; });

  // If no history yet, use current pipeline's job for this name
  if(!runs.length && S.glPipelineJobs) {
    var cur = S.glPipelineJobs.find(function(j){ return j.name === jobName; });
    if(cur) runs = [{jobId:cur.id, pipelineId:S.glSelPipeline?S.glSelPipeline.id:'', pipelineRef:S.glSelPipeline?S.glSelPipeline.ref:'', status:cur.status, started_at:cur.started_at, finished_at:cur.finished_at, user:cur.user, duration:cur.duration}];
  }

  var ov = document.createElement('div');
  ov.id = 'job-hist-overlay';
  ov.className = 'job-hist-overlay';
  ov.onclick = function(e){ if(e.target === ov) closeJobHistory(); };

  var stLabels={success:'Success',passed:'Success',failed:'Failed',failure:'Failed',canceled:'Cancelled',cancelled:'Cancelled',running:'Running',in_progress:'Running',pending:'Pending',queued:'Pending',skipped:'Skipped',created:'Created',manual:'Manual',timed_out:'Timed out'};
  var months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function fmtDate(ts){
    if(!ts) return '—';
    try{ var d=new Date(ts); return d.getDate()+' '+months[d.getMonth()]+', '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }catch(e){ return '—'; }
  }

  var runsHtml = runs.length === 0
    ? '<div style="padding:40px;text-align:center;color:var(--t3);font-size:12px;font-family:\'JetBrains Mono\',monospace">No run history yet.<br>History builds as you open pipelines.</div>'
    : runs.slice().sort(function(a,b){ return new Date(b.started_at||0)-new Date(a.started_at||0); }).map(function(r, i){
        var st = r.status || 'pending';
        var s = ST[st] || ST.canceled;
        var label = stLabels[st] || st;
        var userStr = (r.user && (r.user.name||r.user.username)) || '—';
        var durStr = (r.duration != null) ? fmtDur(r.duration) : dur(r.started_at, r.finished_at);
        // Check if this run belongs to a pipeline that has upstream info
        var upstreamInfo = null;
        if(S.glUpstreamPipeline && S.glSelPipeline && r.pipelineId === S.glSelPipeline.id){
          upstreamInfo = S.glUpstreamPipeline;
        }
        return '<div class="job-hist-run" data-ltip="Click to view logs" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" onclick="openGLLogByJobId('+r.jobId+')">'+
          '<div class="job-hist-run-hd">'+
          stDot(st, 7)+
          '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11px;font-weight:600;color:var(--t2)">#'+r.pipelineId+'</span>'+
          '<span class="st-badge-lg" style="background:'+s.bg+';color:'+s.c+';border-color:'+s.b+'">'+label+'</span>'+
          '</div>'+
          '<div class="job-hist-run-meta">'+
          (r.pipelineRef?'<span style="display:inline-flex;align-items:center;gap:3px"><svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>'+r.pipelineRef+'</span>':'')+
          '<span>'+fmtDate(r.started_at)+'</span>'+
          (userStr&&userStr!=='—'?'<span style="display:inline-flex;align-items:center;gap:3px"><svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'+userStr+'</span>':'')+
          (durStr&&durStr!=='—'?'<span style="font-weight:600;color:var(--t2)">⏱ '+durStr+'</span>':'')+
          '</div>'+
          // Point 5: Show upstream trigger info if this pipeline was triggered by another
          (upstreamInfo ?
            '<div style="margin-top:6px;border-top:1px dashed var(--amL);padding-top:5px">'+
            '<div style="display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--am);font-family:\'JetBrains Mono\',monospace;background:var(--amB);border:1px solid var(--amL);border-radius:6px;padding:3px 8px">'+
            '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="18 15 12 9 6 15"/><polyline points="18 19 12 13 6 19"/></svg>'+
            'Triggered by <b style="color:var(--am)">upstream #'+upstreamInfo.id+'</b>'+
            (upstreamInfo.ref?' on <b style="color:var(--t2)">'+upstreamInfo.ref+'</b>':'')+
            ((upstreamInfo.user&&(upstreamInfo.user.name||upstreamInfo.user.username))?' · <b style="color:var(--t1)">'+(upstreamInfo.user.name||upstreamInfo.user.username)+'</b>':
              (upstreamInfo.triggeredByUser?' · <b style="color:var(--t1)">'+upstreamInfo.triggeredByUser+'</b>':''))+
            '</div>'+
            '</div>'
          : '') +
          '</div>';
      }).join('');

  ov.innerHTML =
    '<div class="job-hist-panel">'+
    '<div class="job-hist-hd">'+
    '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:var(--pu);flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'+
    '<div style="flex:1;min-width:0">'+
    '<div style="font-size:13px;font-weight:700;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+jobName+'</div>'+
    '<div style="font-size:10px;color:var(--t3);font-family:\'JetBrains Mono\',monospace">'+runs.length+' run'+(runs.length!==1?'s':'')+' tracked</div>'+
    '</div>'+
    '<button onclick="closeJobHistory()" style="width:28px;height:28px;border:1px solid var(--bd);border-radius:6px;background:transparent;cursor:pointer;color:var(--t3);display:flex;align-items:center;justify-content:center;flex-shrink:0" data-ltip="Close" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()">'+
    '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'+
    '</button>'+
    '</div>'+
    '<div style="padding:8px 12px;background:var(--blB);border-bottom:1px solid var(--blL);font-size:11px;color:var(--bl);display:flex;align-items:center;gap:6px">'+
    '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
    'Click any run to view its logs</div>'+
    '<div class="job-hist-body">'+runsHtml+'</div>'+
    '</div>';

  document.body.appendChild(ov);
}

/* Open log for a specific job ID (used from history drawer) */
async function openGLLogByJobId(jobId){
  closeJobHistory();
  // Check if this job is in the current pipeline
  var job = S.glPipelineJobs.find(function(j){ return j.id === jobId; });
  if(job){
    openGLLog(jobId);
    return;
  }
  // Job is from a different pipeline — find it in history and load that pipeline first
  var histEntry = null;
  Object.values(S.glJobRunHistory).forEach(function(runs){
    runs.forEach(function(r){ if(r.jobId === jobId) histEntry = r; });
  });
  if(histEntry && histEntry.pipelineId){
    toast('Loading pipeline #'+histEntry.pipelineId+'…', 'info');
    await selGLPipeline(histEntry.pipelineId);
    setTimeout(function(){ openGLLog(jobId); }, 600);
  }
}


async function selGLPipeline(id){
  // Clear job run history when switching pipelines — prevents cross-pipeline
  // contamination where old runs bleed into new pipeline's job count badges.
  S.glJobRunHistory={};
  S.glSelPipeline=S.glRuns.find(function(r){return r.id===id;})||{id:id};
  S.glPipelineJobs=[]; S.glPipelineStageOrder=[]; S.loading.jobs=true;
  S.glDownstreamPipelines=[]; S.glUpstreamPipeline=null;
  reHistPage();
  try {
    var full=await glApi('/projects/'+S.glSelProj.id+'/pipelines/'+id);
    S.glSelPipeline=full;
    // Fetch jobs sorted ascending — GitLab returns them in YAML stage order this way
    S.glPipelineJobs=await glApi('/projects/'+S.glSelProj.id+'/pipelines/'+id+'/jobs?per_page=50&sort=asc');
    // If we don't have stage order from YAML yet, try fetching it from this pipeline's ref
    if(!S.glProjectStageOrder.length && full.ref){
      try {
        var _yaml = await glApiText('/projects/'+S.glSelProj.id+'/repository/files/.gitlab-ci.yml/raw?ref='+encodeURIComponent(full.ref));
        if(_yaml){
          var _lines=_yaml.split(/\r?\n/), _inSt=false, _sList=[];
          for(var _i=0;_i<_lines.length;_i++){
            var _ln=_lines[_i];
            if(/^stages\s*:/.test(_ln)){_inSt=true;continue;}
            if(_inSt){var _m=_ln.match(/^[ \t]+-[ \t]+(\S+)/);if(_m)_sList.push(_m[1]);else if(/^[^\s#]/.test(_ln))break;}
          }
          if(_sList.length) S.glProjectStageOrder=_sList;
        }
      } catch(e){}
    }
    // Stage order priority:
    // 1. glProjectStageOrder — fetched from .gitlab-ci.yml (most reliable)
    // 2. full.stages from pipeline API
    // 3. first-appearance from jobs sorted by ID asc (last resort)
    var seen = {};
    S.glPipelineStageOrder = [];
    var masterOrder = S.glProjectStageOrder.length ? S.glProjectStageOrder
                    : (Array.isArray(full.stages) && full.stages.length ? full.stages : []);
    masterOrder.forEach(function(s){
      if(!seen[s]){ seen[s]=true; S.glPipelineStageOrder.push(s); }
    });
    // Append any job stages not already listed (e.g. dynamic stages)
    // If masterOrder was empty, derive stage order from job IDs ascending (lowest ID = first stage)
    var jobsForOrder = S.glPipelineJobs.slice().sort(function(a,b){ return a.id - b.id; });
    jobsForOrder.forEach(function(j){
      if(!seen[j.stage]){ seen[j.stage]=true; S.glPipelineStageOrder.push(j.stage); }
    });

    // Fix #1 & #2: Detect downstream pipelines triggered by bridge jobs
    try {
      var bridges = await glApi('/projects/'+S.glSelProj.id+'/pipelines/'+id+'/bridges?per_page=50');
      if(bridges && bridges.length){
        S.glDownstreamPipelines = bridges.filter(function(b){ return b.downstream_pipeline; }).map(function(b){
          return {
            bridgeJobName: b.name,
            bridgeJobId: b.id,
            pipeline: b.downstream_pipeline
          };
        });
      }
    } catch(e){}

    // Upstream pipeline detection: was this pipeline triggered by another pipeline?
    try {
      // Strategy 1: Check source field + direct ID fields
      var isChildPipeline = full.source === 'pipeline' || full.source === 'trigger' ||
                            full.source === 'parent_pipeline' || full.source === 'bridge';
      var upInfo = null;

      if(isChildPipeline){
        // Strategy 1a: Direct ID fields (some GitLab versions expose these)
        var upId2 = full.triggered_by_pipeline_id || full.parent_id || full.upstream_pipeline_id;

        // Strategy 1b: Check full.triggered_by object
        if(!upId2 && full.triggered_by && full.triggered_by.id){
          upId2 = full.triggered_by.id;
          upInfo = {
            id: full.triggered_by.id,
            status: full.triggered_by.status || 'success',
            ref: full.triggered_by.ref || full.ref,
            sha: full.triggered_by.sha || '',
            created_at: full.triggered_by.created_at || '',
            finished_at: full.triggered_by.finished_at || full.triggered_by.updated_at || '',
            project_id: full.triggered_by.project_id || S.glSelProj.id,
            project: S.glSelProj.name,
            user: full.triggered_by.user || full.user
          };
        }

        // Strategy 1c: Check full.source_pipeline (some GitLab EE versions)
        if(!upId2 && full.source_pipeline && full.source_pipeline.pipeline_id){
          upId2 = full.source_pipeline.pipeline_id;
          upInfo = {
            id: upId2,
            status: full.source_pipeline.status || 'success',
            ref: full.source_pipeline.ref || full.ref,
            project_id: full.source_pipeline.project_id || S.glSelProj.id,
            project: S.glSelProj.name
          };
        }

        // Strategy 2: Fetch full upstream pipeline details if we have an ID
        if(upId2 && !upInfo){
          try {
            var upFull = await glApi('/projects/'+S.glSelProj.id+'/pipelines/'+upId2);
            upInfo = upFull || {id: upId2, ref: full.ref, project: S.glSelProj.name};
            if(upInfo && !upInfo.project) upInfo.project = S.glSelProj.name;
          } catch(e2){
            upInfo = {id: upId2, ref: full.ref, project: S.glSelProj.name};
          }
        }

        // Strategy 3: Search project pipelines near this one's creation time for a pipeline
        // that has a bridge pointing to this child — look for pipelines created slightly before this one
        if(!upInfo && full.created_at){
          try {
            // Search pipelines in the same project created within 5 min before this pipeline
            var beforeDt = new Date(new Date(full.created_at).getTime() - 1000).toISOString();
            var afterDt  = new Date(new Date(full.created_at).getTime() - 5*60*1000).toISOString();
            var candidates = await glApi('/projects/'+S.glSelProj.id+'/pipelines?per_page=10&updated_after='+encodeURIComponent(afterDt)+'&updated_before='+encodeURIComponent(beforeDt)+'&sort=desc');
            if(candidates && candidates.length){
              for(var ci2=0; ci2<candidates.length; ci2++){
                var cand = candidates[ci2];
                if(cand.id === full.id) continue;
                try {
                  var candBridges = await glApi('/projects/'+S.glSelProj.id+'/pipelines/'+cand.id+'/bridges?per_page=20');
                  if(candBridges && candBridges.some(function(b){ return b.downstream_pipeline && b.downstream_pipeline.id === full.id; })){
                    upInfo = cand;
                    if(!upInfo.project) upInfo.project = S.glSelProj.name;
                    break;
                  }
                } catch(e3){}
              }
            }
          } catch(e4){}
        }

        // Strategy 4: For managed projects list — search other managed projects' pipelines
        if(!upInfo && S.managedProjects && S.managedProjects.length){
          try {
            var otherProjects = S.managedProjects.filter(function(p){ return p.id !== S.glSelProj.id; });
            for(var pi=0; pi<Math.min(otherProjects.length, 3); pi++){
              var op = otherProjects[pi];
              try {
                var opPipes = await glApi('/projects/'+op.id+'/pipelines?per_page=10&sort=desc');
                if(!opPipes || !opPipes.length) continue;
                for(var opi=0; opi<opPipes.length; opi++){
                  try {
                    var opBridges = await glApi('/projects/'+op.id+'/pipelines/'+opPipes[opi].id+'/bridges?per_page=20');
                    if(opBridges && opBridges.some(function(b){ return b.downstream_pipeline && b.downstream_pipeline.id === full.id; })){
                      upInfo = opPipes[opi];
                      upInfo.project_id = op.id;
                      upInfo.project = op.name;
                      break;
                    }
                  } catch(e5){}
                }
                if(upInfo) break;
              } catch(e6){}
            }
          } catch(e7){}
        }

        S.glUpstreamPipeline = upInfo || null;
      }
    } catch(e){}

  } catch(e){ toast('Failed to load jobs','err'); }
  S.loading.jobs=false;
  accumulateJobRunHistory();
  reHistPage();
  if(['running','pending','created'].includes(S.glSelPipeline&&S.glSelPipeline.status)) startGLPoll(id);
}


function renderLogOverlay(){
  var ov=el('log-overlay');
  if(!ov){ ov=document.createElement('div'); ov.id='log-overlay'; ov.className='log-overlay'; document.body.appendChild(ov); }
  if(S.logExpanded){ ov.style.padding='0'; } else { ov.style.padding='20px'; }
  ov.innerHTML=buildLogModal();
  ov.onclick=function(e){ if(e.target===ov) closeLog(); };
  // Close job-switcher dropdown on outside click
  setTimeout(function(){
    var dd=document.getElementById('job-switch-dd');
    if(dd){
      document.addEventListener('mousedown',function _jsdClose(e){
        var wrap=document.getElementById('job-switcher-wrap');
        if(wrap&&!wrap.contains(e.target)){ dd.style.display='none'; }
        if(!document.getElementById('job-switch-dd')){ document.removeEventListener('mousedown',_jsdClose); }
      });
    }
  },0);
}

/* ── Page refresh helpers (re-render just the .page-wrap without full render) ── */
function rePage(which){
  var w = document.querySelector('.page-wrap');
  if(!w) return;
  if(which === 'run') w.innerHTML = renderGLRun();
  else if(which === 'history') w.innerHTML = renderGLHistory();
}
function reRunPage(){ rePage('run'); }
function reHistPage(){ rePage('history'); }

/* ── GitLab job log fetcher ── */
async function openGLLog(jobId){
  var job=S.glPipelineJobs.find(function(j){return j.id===jobId;});
  if(!job) return;
  S.logJob=Object.assign({},job,{_provider:'gitlab'});
  S.logLines=[]; S.logFilter=''; S.logAutoScroll=true;
  saveSession();
  renderLogOverlay();
  await fetchGLLog(jobId);
  if(['running','pending','created'].includes(job.status)){
    clearInterval(logPollTimer);
    logPollTimer=setInterval(function(){ fetchGLLog(jobId); },3000);
  }
}

async function fetchGLLog(jobId){
  try {
    var raw=await glApiText('/projects/'+S.glSelProj.id+'/jobs/'+jobId+'/trace');
    S.logLines=raw.split('\n').map(function(l,i){
      var stripped = l.replace(/\x00/g,'');
      var isoM = stripped.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*\d*\s*/);
      var lineTs = isoM ? isoM[1] : null;
      var lineContent = isoM ? stripped.slice(isoM[0].length) : stripped;
      var cl = cleanRawLine(lineContent);
      // Strip bare ANSI remnants without ESC prefix (e.g. "[0K" left after stream flag removal)
      cl = cl.replace(/^\[\d*[A-Za-z]/g, '');
      var isSection = cl.trimStart().match(/^section_(start|end):/);
      if(isSection) cl = lineContent.replace(/^(O\+|E\+|S\+|O|E|S) ?/, '').replace(/^\[\d*[A-Za-z]/g, '');
      return {id:i, raw:cl, ts:lineTs, parts:parseAnsi(cl)};
    });
    var upd=await glApi('/projects/'+S.glSelProj.id+'/jobs/'+jobId);
    S.logJob=Object.assign({},upd,{_provider:'gitlab'});
    var idx=S.glPipelineJobs.findIndex(function(j){return j.id===jobId;});
    if(idx>=0) S.glPipelineJobs[idx]=upd;
    if(['success','failed','canceled','skipped'].includes(upd.status)) clearInterval(logPollTimer);
    refreshLogModal();
    if(S.logAutoScroll){ setTimeout(function(){ var b=el('log-bottom'); if(b) b.scrollIntoView({behavior:'smooth'}); },50); }
  } catch(e){}
}

function refreshLogModal(){
  var modal=document.querySelector('.log-modal');
  if(!modal) return;

  // Preserve log body scroll position
  var logBody=modal.querySelector('#log-body');
  var scrollTop=logBody?logBody.scrollTop:0;

  // Preserve filter input focus and cursor
  var filterInp=modal.querySelector('.log-filter input');
  var hadFocus=filterInp&&document.activeElement===filterInp;
  var selStart=hadFocus?filterInp.selectionStart:null;
  var selEnd=hadFocus?filterInp.selectionEnd:null;

  var tmp=document.createElement('div');
  tmp.innerHTML=buildLogModal();
  modal.replaceWith(tmp.firstChild);

  var ov=el('log-overlay');
  if(ov){ ov.onclick=function(e){ if(e.target===ov) closeLog(); }; if(S.logExpanded){ ov.style.padding='0'; } else { ov.style.padding='20px'; } }
  // Close job-switcher dropdown on outside click
  setTimeout(function(){
    var dd=document.getElementById('job-switch-dd');
    if(dd){
      document.addEventListener('mousedown',function _jsdClose(e){
        var wrap=document.getElementById('job-switcher-wrap');
        if(wrap&&!wrap.contains(e.target)){ dd.style.display='none'; }
        if(!document.getElementById('job-switch-dd')){ document.removeEventListener('mousedown',_jsdClose); }
      });
    }
  },0);

  // Restore scroll position
  var newBody=document.getElementById('log-body');
  if(newBody&&!S.logAutoScroll) newBody.scrollTop=scrollTop;
  if(newBody&&S.logAutoScroll){ var b=el('log-bottom'); if(b) b.scrollIntoView(); }

  // Restore filter input focus and cursor
  if(hadFocus){
    var newInp=document.querySelector('.log-filter input');
    if(newInp){
      newInp.focus();
      try{ newInp.setSelectionRange(selStart,selEnd); }catch(e){}
    }
  }
}

function buildLogModal(){
  if(!S.logJob) return '';
  var job=S.logJob;
  var filter=S.logFilter;
  var lines=filter?S.logLines.filter(function(l){return l.raw.toLowerCase().includes(filter.toLowerCase());}):S.logLines;
  var isExp = S.logExpanded;
    var proj = S.glSelProj;
  var projName = proj ? (proj.name || proj.path_with_namespace || '') : '';
  var sp = S.glSelPipeline;
  var pipelineId = sp ? (sp.id || sp.run_number || '') : '';
  var pipelineRef = sp ? (sp.ref || '') : '';
  // Commit SHA
  var rawSha = (sp && (sp.sha || sp.head_sha)) || (job && job.sha) || '';
  var shortSha = rawSha ? rawSha.slice(0, 8) : '';
  var commitUrl = '';
  if(shortSha){
    if(proj && proj.web_url) commitUrl = proj.web_url + '/-/commit/' + rawSha;
  }
  // Triggered-by user: GitLab pipeline has .user {name,username,avatar_url}
    //                    Do NOT fall back to logged-in user — only show who actually triggered it.
  var triggeredBy = null;
  var pu = (sp && sp.user) || null;
  if(pu) triggeredBy = { name: pu.name || pu.username || '', avatar: pu.avatar_url || '', url: pu.web_url || '' };
  function triggeredByHtml(){
    if(!triggeredBy || !triggeredBy.name) return '';
    var initial = triggeredBy.name[0].toUpperCase();
    var avatarEl = triggeredBy.avatar
      ? '<img src="'+triggeredBy.avatar+'" style="width:16px;height:16px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display=\'none\'">'
      : '<span style="width:16px;height:16px;border-radius:50%;background:var(--puG);color:var(--pu);font-size:9px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">'+initial+'</span>';
    var inner = '<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 7px 1px 4px;border-radius:3px;border:1px solid var(--bd)">'+
      avatarEl+
      '<svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="opacity:0.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'+
      '<span style="font-family:\'JetBrains Mono\',monospace">'+triggeredBy.name+'</span>'+
      '</span>';
    if(triggeredBy.url) return '<a href="'+triggeredBy.url+'" target="_blank" style="text-decoration:none">'+inner+'</a>';
    return inner;
  }
  return (
    '<div class="log-modal'+(isExp?' log-expanded':'')+'" style="'+(isExp?'border-radius:0;':'')+'">'+
    '<div class="log-hd">'+
    // Repo + pipeline context line
    (projName?
      '<div style="display:flex;align-items:center;gap:6px;width:100%;padding-bottom:6px;border-bottom:1px solid var(--bd);margin-bottom:2px;flex-wrap:wrap">'+
        '<div style="width:18px;height:18px;border-radius:4px;background:var(--puG);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--pu);flex-shrink:0">'+projName[0].toUpperCase()+'</div>'+
        '<span style="font-size:11px;font-weight:600;color:var(--t2)">'+projName+'</span>'+
        (pipelineId?'<span style="font-size:10px;color:var(--t3)">›</span><span class="mono" style="font-size:10px;color:var(--pu);font-weight:600">#'+pipelineId+'</span>':'') +
        (pipelineRef?
          '<span class="mono" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 7px;border-radius:3px;border:1px solid var(--bd)">'+
          '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>'+
          pipelineRef+'</span>':'')+
        (shortSha?
          (commitUrl
            ? '<a href="'+commitUrl+'" target="_blank" data-ltip="'+rawSha+'" onmouseover="this.style.borderColor=\'var(--pu)\';this.style.color=\'var(--pu)\';showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="this.style.borderColor=\'var(--bd)\';this.style.color=\'var(--t3)\';hideLogTip()" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 7px;border-radius:3px;border:1px solid var(--bd);font-family:\'JetBrains Mono\',monospace;text-decoration:none;cursor:pointer">'+
              '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/></svg>'+
              shortSha+'</a>'
            : '<span data-ltip="'+rawSha+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 7px;border-radius:3px;border:1px solid var(--bd);font-family:\'JetBrains Mono\',monospace">'+
              '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/></svg>'+
              shortSha+'</span>')
        :'')+
        triggeredByHtml()+
      '</div>'
    :'')+
    // ── ROW 1: outer flex — identity left, actions right (actions wrap right-aligned if needed) ──
    '<div style="display:flex;align-items:center;gap:8px;width:100%;min-width:0;flex-wrap:wrap;row-gap:4px">'+

    // Left: job identity + meta inline
    stDot(job.status,8)+
    '<span class="mono" style="font-size:13px;font-weight:500;color:var(--t1);white-space:nowrap;flex-shrink:0">'+job.name+'</span>'+
    '<span class="mono" style="font-size:10px;color:var(--t3);background:var(--bg2);padding:2px 9px;border-radius:4px;border:1px solid var(--bd);display:inline-flex;align-items:center;gap:4px;flex-shrink:0">'+
    '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>'+
    'Job #'+job.id+'</span>'+

    // Ran timestamp — inline next to job card
    (job.started_at?'<span class="mono" style="font-size:10px;color:var(--t3);background:var(--bg2);padding:2px 8px;border-radius:4px;border:1px solid var(--bd);display:inline-flex;align-items:center;gap:4px;flex-shrink:0"><svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'+fmtDateTime(job.started_at)+'</span>':'')+

    // Run time (duration)
    '<span style="font-size:10px;font-weight:600;color:var(--t2);font-family:\'JetBrains Mono\',monospace;flex-shrink:0">'+dur(job.started_at,job.finished_at)+'</span>'+

    // Status badge
    stBadgeLg(job.status)+

    // Ago time
    (job.started_at?'<span class="mono" style="font-size:10px;color:var(--t3);flex-shrink:0">'+timeAgo(job.started_at)+'</span>':'')+

    // Right: actions group — pushed right
    '<div style="display:flex;align-items:center;gap:6px;margin-left:auto;flex-shrink:0;flex-wrap:nowrap">'+

    // Switch job — maximize only
    (isExp && S.glPipelineJobs && S.glPipelineJobs.length > 1 ?
      '<div style="position:relative;display:inline-flex;align-items:center;flex-shrink:0" id="job-switcher-wrap">'+
      '<button onclick="(function(){var d=document.getElementById(\'job-switch-dd\');d.style.display=d.style.display===\'none\'?\'flex\':\'none\';})()" style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--t2);background:var(--bg2);padding:0 10px;border-radius:6px;border:1px solid var(--bd2);cursor:pointer;height:26px;font-family:\'JetBrains Mono\',monospace;transition:all .15s" onmouseover="this.style.borderColor=\'var(--pu)\';this.style.color=\'var(--pu)\'" onmouseout="this.style.borderColor=\'var(--bd2)\';this.style.color=\'var(--t2)\'">'+
      '<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'+
      'Switch job'+
      '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>'+
      '</button>'+
      '<div id="job-switch-dd" style="display:none;flex-direction:column;position:absolute;top:calc(100% + 6px);right:0;left:auto;z-index:999;background:var(--bg1);border:1px solid var(--bd2);border-radius:9px;box-shadow:0 8px 28px rgba(0,0,0,.18);min-width:220px;max-height:320px;overflow-y:auto;padding:4px">'+
      (function(){
        var stages={};
        S.glPipelineJobs.forEach(function(j){ if(!stages[j.stage]) stages[j.stage]=[]; stages[j.stage].push(j); });
        var html='';
        Object.keys(stages).forEach(function(stage){
          html+='<div style="font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--t3);text-transform:uppercase;letter-spacing:.09em;padding:6px 10px 3px;opacity:.7">'+stage+'</div>';
          stages[stage].forEach(function(j){
            var isActive=j.id===job.id;
            html+='<div onclick="document.getElementById(\'job-switch-dd\').style.display=\'none\';openGLLog('+j.id+')" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;cursor:pointer;background:'+(isActive?'var(--puG)':'transparent')+';border:1px solid '+(isActive?'var(--bd2)':'transparent')+';margin-bottom:1px;transition:background .12s" onmouseover="if(!this.classList.contains(\'jsd-active\')) this.style.background=\'var(--bg2)\'" onmouseout="if(!this.classList.contains(\'jsd-active\')) this.style.background='+(isActive?'\'var(--puG)\'':'\'transparent\'')+'" '+(isActive?'class="jsd-active"':'')+'>'+
            (function(){var c=({success:'var(--gr)',failed:'var(--re)',running:'var(--bl)',pending:'var(--am)',canceled:'var(--t3)',skipped:'var(--t4)'})[j.status]||'var(--t3)';return '<span style="width:7px;height:7px;border-radius:50%;background:'+c+';flex-shrink:0"></span>';})()+
            '<span style="font-size:12px;font-weight:'+(isActive?'600':'500')+';color:'+(isActive?'var(--pu)':'var(--t1)')+';flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+j.name+'</span>'+
            '<span style="font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--t3);flex-shrink:0">#'+j.id+'</span>'+
            '</div>';
          });
        });
        return html;
      })()+
      '</div>'+
      '</div>'
    : '')+

    // Open in GitLab — maximize only
    (isExp && job.web_url?'<a href="'+job.web_url+'" target="_blank" data-ltip="Open in GitLab" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:var(--bl);height:26px;padding:0 8px;border-radius:5px;border:1px solid var(--bd);background:var(--bg2);flex-shrink:0;font-family:\'DM Sans\',sans-serif;transition:all .15s" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'));this.style.borderColor=\'var(--bl)\'" onmouseout="hideLogTip();this.style.borderColor=\'var(--bd)\'">'+icoExt()+' Open</a>':'')+

    '<button class="btn btn-ghost btn-sm" onclick="copyAllLogs(this)" data-ltip="Copy all log lines" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="height:26px;padding:0 8px;gap:4px;flex-shrink:0">'+
    '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'+
    ' Copy all</button>'+
    '<button class="btn btn-ghost btn-sm" onclick="downloadLog()" data-ltip="Download log file" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="height:26px;padding:0 8px;gap:4px;flex-shrink:0">'+icoDl()+' .log</button>'+
    '<button class="btn btn-ghost btn-sm" onclick="toggleLogExpand()" data-ltip="'+(isExp?'Exit fullscreen':'Fullscreen')+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="width:26px;height:26px;padding:0;flex-shrink:0">'+(isExp?icoCollapse():icoExpand())+'</button>'+
    '<button class="btn btn-ghost btn-sm" onclick="closeLog()" data-ltip="Close log" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="width:26px;height:26px;padding:0;flex-shrink:0;color:var(--re);border-color:var(--reL)">'+icoX()+'</button>'+
    '</div>'+ // end actions group

    '</div>'+ // end row 1

    // ── ROW 2: Runner — compact single chip line, same height as row 1 ──
    (job.runner||job.runner_name?
      '<div style="display:flex;align-items:center;gap:5px">'+
      '<span class="mono" style="font-size:9px;color:var(--t4);text-transform:uppercase;letter-spacing:.08em;flex-shrink:0">Runner</span>'+
      '<span class="mono" style="font-size:10px;color:var(--t3);background:var(--bg2);padding:1px 7px;border-radius:3px;border:1px solid var(--bd);display:inline-flex;align-items:center;gap:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">'+
      '<svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>'+
      (job.runner?job.runner.description||job.runner.name||'':job.runner_name||'')+
      '</span>'+
      '</div>'
    :'')+

    '</div>'+ // end log-hd
    '<div class="log-filter">'+
    '<span style="color:var(--t3)">'+icoSearch()+'</span>'+
    '<input style="flex:1;border:none;background:transparent;outline:none;font-family:\'JetBrains Mono\',monospace;font-size:12px;color:var(--t1)" placeholder="Search log lines…" value="'+filter+'" oninput="setLogFilter(this.value)" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey)navLogMatch(1);else if(event.key===\'Enter\'&&event.shiftKey)navLogMatch(-1)"/>'+
    (filter?'<button onclick="setLogFilter(\'\')" style="background:none;border:none;cursor:pointer;color:var(--t3);line-height:1;font-size:14px;padding:0 2px">&#x2715;</button>':'')+
    (filter?
      '<span class="mono" style="font-size:10px;color:'+(lines.length?'var(--t1)':'var(--re)')+';white-space:nowrap;padding:0 4px">'+(lines.length?(S.logMatchIdx+1)+' / '+lines.length:'0 matches')+'</span>'+
      '<div style="display:flex;gap:2px">'+
      '<button class="btn btn-ghost btn-sm" onclick="navLogMatch(-1)" data-ltip="Previous match (Shift+Enter)" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="height:24px;width:24px;padding:0;font-size:14px;line-height:1" '+(lines.length?'':'disabled')+'>&#8593;</button>'+
      '<button class="btn btn-ghost btn-sm" onclick="navLogMatch(1)" data-ltip="Next match (Enter)" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="height:24px;width:24px;padding:0;font-size:14px;line-height:1" '+(lines.length?'':'disabled')+'>&#8595;</button>'+
      '</div>'+
      (lines.length?
        '<div style="display:flex;gap:2px">'+
        '<button class="btn btn-ghost btn-sm" onclick="copyActiveLogLine(this)" data-ltip="Copy highlighted match line" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="height:24px;padding:0 8px;gap:4px;font-size:11px">'+
        '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'+
        ' Line</button>'+
        '<button class="btn btn-ghost btn-sm" onclick="copyAllMatchedLines(this,'+lines.length+')" data-ltip="Copy all matched lines" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="height:24px;padding:0 8px;gap:4px;font-size:11px">'+
        '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/><line x1="13" y1="5" x2="13" y2="1"/><line x1="11" y1="3" x2="15" y2="3"/></svg>'+
        ' Matches ('+lines.length+')</button>'+
        '</div>'
      :'')
    :
      '<span class="mono" style="font-size:10px;color:var(--t3);white-space:nowrap">'+S.logLines.length+' lines'+(tzAbbr()?' · '+tzAbbr():'')+' time</span>'
    )+
    '<button class="btn btn-ghost btn-sm" onclick="toggleAutoScroll()" data-ltip="'+(S.logAutoScroll?'Disable auto-scroll':'Enable auto-scroll')+'" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="height:26px;padding:0 8px;gap:3px;'+(S.logAutoScroll?'background:var(--puG);color:var(--pu);border-color:var(--bd2)':'')+'">'+icoSD()+' '+(S.logAutoScroll?'Auto-scroll on':'Auto-scroll')+'</button>'+
    '</div>'+
    '<div id="log-body" class="log-body" onscroll="onLogScroll()">'+
    (S.logLines.length===0?'<div style="padding:20px;text-align:center;color:var(--t3);font-size:12px;font-family:\'JetBrains Mono\',monospace">Fetching logs…</div>':'')+
    renderLogBodySections(lines, filter)+
    '<div id="log-bottom"></div>'+
    '</div></div>'
  );
}

/* ── Timezone abbreviation from the browser ── */
function tzAbbr(){
  try {
    var s = new Intl.DateTimeFormat('en',{timeZoneName:'short'}).format(new Date());
    var m = s.match(/([A-Z]{2,5})$/);
    return m ? m[1] : '';
  } catch(e){ return ''; }
}

function fmtUnixTime(ts){
  var d = new Date(ts * 1000);
  return d.getHours().toString().padStart(2,'0')+':'+
         d.getMinutes().toString().padStart(2,'0')+':'+
         d.getSeconds().toString().padStart(2,'0');
}
function fmtIsoTime(iso){
  var d = new Date(iso);
  if(isNaN(d)) return '';
  return d.getHours().toString().padStart(2,'0')+':'+
         d.getMinutes().toString().padStart(2,'0')+':'+
         d.getSeconds().toString().padStart(2,'0');
}
function fmtDuration(secs){
  // Format seconds as MM:SS
  if(secs == null || isNaN(secs) || secs < 0) return '';
  var m = Math.floor(secs / 60);
  var s = Math.floor(secs % 60);
  return m.toString().padStart(2,'0')+':'+s.toString().padStart(2,'0');
}

/* Pre-process log lines once to build a section-duration map:
   { sectionName: durationSeconds } — used by renderLogLine. */
/* ── Section collapse state ── */
var _logSecCollapsed = {};
function toggleLogSection(key){
  _logSecCollapsed[key] = !_logSecCollapsed[key];
  refreshLogModal();
}

/* ── Render log body — flat, no section headers, sequential line numbers ── */
function renderLogBodySections(lines, filter){
  var secDurMap = buildSectionDurations(S.logLines);
  // Filter out section_start and section_end lines — render everything else flat
  var visible = lines.filter(function(line){
    var rfs = line.raw.trimStart();
    return !rfs.startsWith('section_start') && !rfs.startsWith('section_end');
  });
  var mi = 0;
  var dispNum = 0;
  return visible.map(function(line){
    dispNum++;
    var lmi = filter ? mi++ : -1;
    return renderLogLine(line, filter, S.logMatchIdx, lmi, secDurMap, dispNum);
  }).join('');
}

function buildSectionDurations(lines){
  var map = {};
  var starts = {};
  lines.forEach(function(line){
    var raw = line.raw;
    var ss = raw.match(/^section_start:(\d+):(\S+)/);
    if(ss){ starts[ss[2]] = parseInt(ss[1],10); return; }
    var se = raw.match(/^section_end:(\d+):(\S+)/);
    if(se && starts[se[2]] != null){
      map[se[2]] = parseInt(se[1],10) - starts[se[2]];
    }
  });
  return map;
}

function renderLogLine(line, filter, matchIdx, lmi, secDurMap, dispNum){
  var raw = line.raw;
  var isActive = filter && lmi === matchIdx;
  if(!raw || raw === '\r' || raw === '') return '';

  // ── Normal log line ──
  var tsHtml = '';
  var dispRaw = raw;

  if(line.ts){
    // GitLab: timestamp extracted at storage time
    tsHtml = '<span class="log-ts">'+fmtIsoTime(line.ts)+'</span>';
  } else {
        var isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*/);
    if(isoMatch){
      tsHtml = '<span class="log-ts">'+fmtIsoTime(isoMatch[1])+'</span>';
      dispRaw = raw.slice(isoMatch[0].length);
    } else {
      tsHtml = '<span class="log-ts"></span>';
    }
  }

  var parts = parseAnsi(dispRaw);
  var cls = 'log-line'+(isActive?' log-match-active':'');
  var bg  = isActive ? 'background:rgba(92,79,214,0.13);outline:2px solid var(--pu);outline-offset:-1px;border-radius:3px;' : '';
  return '<div class="'+cls+'" style="'+bg+'">'+
    '<span class="log-lnum">'+(dispNum||'')+'</span>'+
    tsHtml+
    '<span style="flex:1;word-break:break-all">'+renderParts(parts,filter)+'</span>'+
    '</div>';
}

/* ── Dot popover for collapsed run history ── */
var _dotPopoverAutoHide = null;
function showDotPopover(e, tipDataEnc){
  if(_tipSuppressed) return;
  var existing = document.getElementById('dot-popover');
  if(existing) existing.remove();
  var d;
  try { d = JSON.parse(decodeURIComponent(tipDataEnc)); } catch(ex){ return; }
  var rect = e.currentTarget.getBoundingClientRect();

  // Live lookup from already-enriched S.glRuns
  var triggeredName = d.user || '';
  var needsFetch = false;
  if(d._live && d.id && typeof S !== 'undefined' && S.glRuns){
    var live = (S.glSelPipeline && S.glSelPipeline.id === d.id) ? S.glSelPipeline
             : S.glRuns.find(function(r){ return r.id === d.id; });
    if(live && live.user){
      triggeredName = live.user.name || live.user.username || triggeredName;
      if(live.status)      d.status      = live.status;
      if(live.finished_at) d.finished_at = live.finished_at;
    } else {
      // Not yet enriched — we'll fetch and patch the popover live
      needsFetch = true;
    }
  }

  var statusC = {'success':'var(--gr)','passed':'var(--gr)','failed':'var(--re)','failure':'var(--re)','running':'var(--am)','in_progress':'var(--am)','canceled':'var(--t3)','cancelled':'var(--t3)','pending':'var(--am)','skipped':'var(--t3)'}[d.status] || 'var(--t3)';
  var stBg    = {'success':'var(--grB)','passed':'var(--grB)','failed':'var(--reB)','failure':'var(--reB)','running':'var(--amB)','in_progress':'var(--amB)','canceled':'var(--bg3)','cancelled':'var(--bg3)','pending':'var(--amB)','skipped':'var(--bg3)'}[d.status] || 'var(--bg3)';
  var stLabel = (d.status||'').charAt(0).toUpperCase()+(d.status||'').slice(1);

  function buildRows(name){
    var rows = [];
    if(d.iid != null) rows.push({label:'Pipeline IID', val:String(d.iid), mono:true, accent:true});
    if(d.name)        rows.push({label:'Pipeline Name', val:d.name,        mono:false});
    // Always render the Triggered by row — show a loading state if still fetching
    var trigVal = name || (needsFetch ? '…' : '—');
    rows.push({label:'Triggered by', val:trigVal, mono:true, bold:true, id:'dot-pop-trigger'});
    if(d.ref) rows.push({label:'Branch',  val:d.ref,  mono:true});
    if(d.sha) rows.push({label:'Commit',  val:d.sha,  mono:true});
    if(d.ts)  rows.push({label:'Started', val:fmtDateTime(d.ts)||timeAgo(d.ts), mono:true});
    if(d.ts && d.finished_at) rows.push({label:'Duration', val:dur(d.ts, d.finished_at), mono:true, bold:true, accent:true});
    else if(d.ts && (d.status==='running'||d.status==='in_progress')) rows.push({label:'Running for', val:dur(d.ts, new Date().toISOString()), mono:true});
    return rows;
  }

  function rowHtml(r){
    return '<div'+(r.id?' id="'+r.id+'"':'')+' style="display:flex;justify-content:space-between;align-items:center;gap:14px;padding:5px 0;border-bottom:1px solid var(--bd)">'+
      '<span style="font-size:10px;color:var(--t3);white-space:nowrap;flex-shrink:0">'+r.label+'</span>'+
      '<span style="font-size:11px;color:'+(r.accent?statusC:(r.bold?'var(--t1)':'var(--t2)'))+';'+(r.mono?'font-family:\'JetBrains Mono\',monospace;':'')+(r.bold?'font-weight:700;':'')+'text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px">'+r.val+'</span>'+
      '</div>';
  }

  var pop = document.createElement('div');
  pop.id = 'dot-popover';
  pop.style.cssText = 'position:fixed;z-index:9999;background:var(--bg1);border:1px solid var(--bd2);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,0.18);padding:0;min-width:240px;font-family:\'DM Sans\',sans-serif;pointer-events:auto;overflow:hidden;';

  pop.innerHTML =
    '<div style="background:'+stBg+';padding:9px 12px;border-bottom:1px solid var(--bd);display:flex;align-items:center;justify-content:space-between;gap:8px">'+
    '<span style="font-size:13px;font-weight:800;color:'+statusC+';font-family:\'JetBrains Mono\',monospace">'+(d.id?'#'+d.id:'')+'</span>'+
    '<span style="display:inline-flex;align-items:center;gap:5px;background:'+statusC+'22;border:1px solid '+statusC+'44;border-radius:20px;padding:2px 9px">'+
    '<span style="width:5px;height:5px;border-radius:50%;background:'+statusC+';flex-shrink:0;display:inline-block"></span>'+
    '<span style="font-size:10px;font-weight:700;color:'+statusC+';letter-spacing:0.04em">'+stLabel+'</span>'+
    '</span>'+
    '</div>'+
    '<div style="padding:4px 12px 6px">'+
    buildRows(triggeredName).map(rowHtml).join('')+
    '</div>';

  document.body.appendChild(pop);

  // Smart positioning: always keep fully inside the viewport on all 4 sides.
  // Measure the real rendered size AFTER appending so we get accurate dimensions.
  var pw = pop.offsetWidth  || 260;
  var ph = pop.offsetHeight || 160;
  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var pad = 8; // min gap from viewport edge

  // Horizontal: prefer right of dot, flip left if it would clip the right edge
  var leftPos = rect.right + 10;
  if(leftPos + pw + pad > vw) leftPos = rect.left - pw - 10;
  // Final clamp so it never goes off-screen left either
  leftPos = Math.max(pad, Math.min(leftPos, vw - pw - pad));

  // Vertical: anchor top of popover to dot centre, then flip/clamp to stay in view.
  // Preferred: top of popover aligns near the dot (offset -20 for a bit of visual padding)
  var topPos = rect.top - 20;
  // If the popover would go below the viewport, shift it up so the bottom just fits
  if(topPos + ph + pad > vh) topPos = vh - ph - pad;
  // If after that adjustment it would go above the viewport, pin to top
  topPos = Math.max(pad, topPos);

  pop.style.left = leftPos + 'px';
  pop.style.top  = topPos  + 'px';

  clearTimeout(_dotPopoverAutoHide);

  // Keep popover alive while cursor is over it — hide only when cursor truly leaves.
  pop.addEventListener('mouseenter', function(){ clearTimeout(_dotPopoverAutoHide); });
  pop.addEventListener('mouseleave', function(){
    clearTimeout(_dotPopoverAutoHide);
    _dotPopoverAutoHide = setTimeout(function(){ hideDotPopover(); }, 120);
  });

  // If user data wasn't available yet, fetch it now and patch the live popover
  if(needsFetch && d._live && d.id && typeof S !== 'undefined' && S.glSelProj){
    var pid = S.glSelProj.id;
    var rid = d.id;
    glApi('/projects/'+pid+'/pipelines/'+rid).then(function(full){
      // Stash the full result so future hovers are instant
      var idx = S.glRuns ? S.glRuns.findIndex(function(x){ return x.id === full.id; }) : -1;
      if(idx >= 0) S.glRuns[idx] = full;
      if(S.glSelPipeline && S.glSelPipeline.id === full.id) S.glSelPipeline = full;
      // Patch the live popover if it's still showing this pipeline
      var livePop = document.getElementById('dot-popover');
      var trigEl  = document.getElementById('dot-pop-trigger');
      if(livePop && trigEl && full.user){
        var name = full.user.name || full.user.username || '';
        if(name){
          var valEl = trigEl.querySelector('span:last-child');
          if(valEl) valEl.textContent = name;
        }
      }
    }).catch(function(){
      // On failure, replace '…' with '—'
      var trigEl = document.getElementById('dot-pop-trigger');
      if(trigEl){ var valEl = trigEl.querySelector('span:last-child'); if(valEl && valEl.textContent === '…') valEl.textContent = '—'; }
    });
  }
}
function hideDotPopover(){
  clearTimeout(_dotPopoverAutoHide);
  var pop = document.getElementById('dot-popover');
  if(pop) pop.remove();
}
function clickDot(e, runId){
  e.stopPropagation();
  hideDotPopover();
  if(runId){
    selGLPipeline(runId);
  }
}

/* ── Topbar avatar popover — persistent on hover ── */
var _avPopTimer = null;
function showAvPop(wrap){
  clearTimeout(_avPopTimer);
  var pop = wrap.querySelector('.av-pop');
  if(pop) pop.style.display = 'block';
}
function hideAvPop(wrap){
  _avPopTimer = setTimeout(function(){
    var pop = wrap && wrap.querySelector('.av-pop');
    if(pop) pop.style.display = 'none';
  }, 120);
}
function showTopbarAvTip(target, enc){ _showLtip(target, (function(){ try { return decodeURIComponent(enc).split('\n')[0]; } catch(e){ return enc; } })()); }
function hideTopbarAvTip(){ hideLogTip(); }


function closeLog(){ clearInterval(logPollTimer); S.logJob=null; S.logExpanded=false; saveSession(); var ov=el('log-overlay'); if(ov) ov.remove(); }
function toggleLogExpand(){ S.logExpanded=!S.logExpanded; saveSession(); renderLogOverlay(); }
function setLogFilter(v){ S.logFilter=v; S.logMatchIdx=0; refreshLogModal(); setTimeout(scrollToLogMatch,50); }
function navLogMatch(dir){
  if(!S.logFilter) return;
  var total = S.logLines.filter(function(l){ return l.raw.toLowerCase().includes(S.logFilter.toLowerCase()); }).length;
  if(!total) return;
  S.logMatchIdx = ((S.logMatchIdx + dir) % total + total) % total;
  S.logAutoScroll = false;
  refreshLogModal();
  setTimeout(scrollToLogMatch, 50);
}
function scrollToLogMatch(){
  var els = document.querySelectorAll('#log-body .log-match-active');
  if(els.length){ els[0].scrollIntoView({block:'center',behavior:'smooth'}); }
}
function toggleAutoScroll(){ S.logAutoScroll=!S.logAutoScroll; refreshLogModal(); if(S.logAutoScroll){ var b=el('log-bottom'); if(b) b.scrollIntoView({behavior:'smooth'}); } }
function onLogScroll(){ var e=el('log-body'); if(!e) return; if(e.scrollHeight-e.scrollTop-e.clientHeight>40&&S.logAutoScroll) S.logAutoScroll=false; }
/* ── Shared: format a log line array to plain text (used by download + copy) ── */
function formatLogLinePlain(l, secDurMap){
    var raw = l.raw;
    var forSec = raw.trimStart();
    if(forSec.startsWith('section_start')){
      var ssm = forSec.match(/^section_start:(\d+):(\S+)(.*)/);
      if(!ssm) return null;
      var lbl = ssm[2].replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
      var extra = (ssm[3]||'').trim();
      if(extra) lbl += ' — '+extra;
      var ts = fmtUnixTime(parseInt(ssm[1],10));
      var dur = secDurMap[ssm[2]] != null ? '  ['+fmtDuration(secDurMap[ssm[2]])+']' : '';
      return ts+'  ▶ '+lbl+dur;
    }
    if(forSec.startsWith('section_end')) return null;
    var cl = raw.replace(/\x1b\[[0-9;]*m/g,'');
    if(l.ts) return fmtIsoTime(l.ts)+'  '+cl;
    var isoM = cl.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*/);
    if(isoM) return fmtIsoTime(isoM[1])+'  '+cl.slice(isoM[0].length);
    return cl || null;
}

function downloadLog(){
  var secDurMap = buildSectionDurations(S.logLines);
  var tz = tzAbbr();
  var lines = S.logLines.map(function(l){ return formatLogLinePlain(l, secDurMap); }).filter(function(l){ return l !== null && l.trim() !== ''; });

  // Header
  var header = '# Job: '+(S.logJob?S.logJob.name:'')+
    (S.logJob?' #'+S.logJob.id:'')+
    '\n# Times shown in: '+(tz||'local timezone')+
    '\n# Generated: '+new Date().toLocaleString()+
    '\n'+'─'.repeat(80)+'\n';

  var a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,'+encodeURIComponent(header+lines.join('\n'));
  a.download = 'job-'+(S.logJob?S.logJob.id:'')+(S.logJob?'-'+S.logJob.name:'')+'.log';
  a.click();
}

/* ── Shared clipboard copy feedback ── */
function clipboardFeedback(btn, toastMsg){
  if(btn){
    var orig = btn.innerHTML;
    var oc = btn.style.color, ob = btn.style.background, obc = btn.style.borderColor;
    btn.innerHTML = '<svg width="12" height="12" fill="none" stroke="var(--gr)" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
    btn.style.background = 'var(--grB)'; btn.style.color = 'var(--gr)'; btn.style.borderColor = 'var(--grL)';
    setTimeout(function(){ btn.innerHTML=orig; btn.style.background=ob; btn.style.color=oc; btn.style.borderColor=obc; }, 1800);
  }
  if(toastMsg) toast(toastMsg, 'ok');
}

/* ── Copy all logs to clipboard ── */
function copyAllLogs(btn){
  var secDurMap = buildSectionDurations(S.logLines);
  var lines = S.logLines.map(function(l){ return formatLogLinePlain(l, secDurMap); }).filter(function(l){ return l !== null && l.trim() !== ''; });
  var text = lines.join('\n');
  navigator.clipboard.writeText(text).then(function(){ clipboardFeedback(btn, 'All '+lines.length+' log lines copied'); }).catch(function(){ toast('Copy failed — use .log download instead', 'err'); });
}

/* ── Copy the currently active (search-highlighted) log line ── */
function copyActiveLogLine(btn){
  if(!S.logFilter) return;
  var matched = S.logLines.filter(function(l){ return l.raw.toLowerCase().includes(S.logFilter.toLowerCase()); });
  var line = matched[S.logMatchIdx];
  if(!line) return;
  var raw = line.raw;
  var cl = raw.replace(/\x1b\[[0-9;]*m/g,'');
  var text;
  if(line.ts){
    text = fmtIsoTime(line.ts)+'  '+cl;
  } else {
    var isoM = cl.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*/);
    text = isoM ? fmtIsoTime(isoM[1])+'  '+cl.slice(isoM[0].length) : cl;
  }
  text = text.trim();
  navigator.clipboard.writeText(text).then(function(){ clipboardFeedback(btn, 'Line '+(S.logMatchIdx+1)+' copied'); }).catch(function(){ toast('Copy failed', 'err'); });
}

/* ── Copy ALL matched (search-filtered) log lines ── */
function copyAllMatchedLines(btn, count){
  if(!S.logFilter) return;
  var matched = S.logLines.filter(function(l){ return l.raw.toLowerCase().includes(S.logFilter.toLowerCase()); });
  if(!matched.length) return;
  var lines = matched.map(function(l){
    var raw = l.raw;
    var cl = raw.replace(/\x1b\[[0-9;]*m/g,'');
    var text;
    if(l.ts){
      text = fmtIsoTime(l.ts)+'  '+cl;
    } else {
      var isoM = cl.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s*/);
      text = isoM ? fmtIsoTime(isoM[1])+'  '+cl.slice(isoM[0].length) : cl;
    }
    return text.trim();
  }).filter(Boolean);
  var text = lines.join('\n');
  navigator.clipboard.writeText(text).then(function(){ clipboardFeedback(btn, 'All '+lines.length+' matched lines copied'); }).catch(function(){ toast('Copy failed', 'err'); });
}

/* ============================
   DASHBOARD
============================ */
function renderDashboard(){
    var proj=S.glSelProj;
  if(!proj) return renderDashboardEmptyState();
  var d=S.dashData;
  var selectedBranch = d ? d.selectedBranch : null;
  return (
    '<div class="page">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">'+
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+
    '<div style="display:flex;gap:6px">'+
    [90,30,14,7,0].map(function(n){
      var lbl = n===0 ? 'Today' : n+'d';
      var active = S.dashRange===n;
      return '<button class="btn btn-ghost btn-sm" onclick="setDashRange('+n+')" style="'+(active?'background:var(--puG);color:var(--pu);border-color:var(--bd2)':'')+'">' +lbl+'</button>';
    }).join('')+
    '</div>'+
    (d&&S.dashRange>0?'<span style="font-size:10px;color:var(--t4);font-family:\'JetBrains Mono\',monospace;align-self:center">&harr; vs prev '+S.dashRange+'d</span>':'')+
    (selectedBranch ?
      '<div style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;background:var(--puG);border:1px solid var(--bd2);font-size:10px;font-weight:600;color:var(--pu);font-family:\'JetBrains Mono\',monospace">'+
      '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>'+
      selectedBranch+
      '<span style="font-weight:400;color:var(--t3);font-size:9px">filtered</span>'+
      '</div>'
    :'')+
    '</div>'+
    '<div style="display:flex;gap:6px">'+
    '<button class="btn btn-ghost btn-sm" onclick="loadDashData()" style="gap:4px">'+icoRefresh()+' Refresh</button>'+
    '<button class="btn btn-ghost btn-sm" onclick="exportDashCSV()" data-ltip="Download CSV" onmouseover="showLogTip(this,this.getAttribute(\'data-ltip\'))" onmouseout="hideLogTip()" style="gap:4px"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> CSV</button>'+
    '</div></div>'+
    (S.loading.dash?'<div class="mono" style="text-align:center;padding:40px;color:var(--t3)">'+icoSpin()+' Loading analytics…</div>':'')+
    (!d&&!S.loading.dash?'<div class="empty">'+icoDash()+'<p>No data yet</p></div>':'')+
    (d?renderDashData(d):'')+
    '</div>'
  );
}

function renderDashData(d){
  return (
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px" class="login-field-url">'+
    [['Total runs',d.total,'var(--t1)',d.totalDelta,true],['Success rate',d.successRate+'%','var(--gr)',d.rateDelta+'%',d.rateDelta>=0],['Avg duration',fmtDur(d.avgDur),'var(--bl)',fmtDurDelta(d.durDelta),d.durDelta<=0],['Failed',d.failed,'var(--re)',d.failDelta,d.failDeltaGood]].map(function(item,idx){
      var lbl=item[0],val=item[1],vc=item[2],delta=item[3],good=item[4];
      var extra = (idx===2&&d.lastSuccessDur) ? '<div style="font-size:10px;color:var(--t3);margin-top:4px;font-family:\'JetBrains Mono\',monospace">Last success: '+fmtDur(d.lastSuccessDur)+'</div>' : '';
      return '<div class="metric-card">'+
        '<div style="font-size:9px;font-family:\'JetBrains Mono\',monospace;color:var(--t3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">'+lbl+'</div>'+
        '<div style="font-size:24px;font-weight:600;font-family:\'JetBrains Mono\',monospace;color:'+vc+';margin-bottom:5px">'+val+'</div>'+
        (delta!=='—'?
          '<div style="font-size:10px;color:'+(good?'var(--gr)':'var(--re)')+';display:flex;align-items:center;gap:3px">'+
          '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="'+(good?'18 15 12 9 6 15':'6 9 12 15 18 9')+'"/></svg>'+
          delta+' vs prev period</div>'
        :
          '<div style="font-size:10px;color:var(--t4);font-family:\'JetBrains Mono\',monospace">no prev data</div>'
        )+
        extra+
        '</div>';
    }).join('')+
    '</div>'+

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'+
    '<div class="chart-card"><div class="chart-ttl">Daily runs <div style="display:flex;gap:8px;font-size:9px;font-family:\'JetBrains Mono\',monospace"><span style="display:flex;align-items:center;gap:3px;color:var(--gr)"><span style="width:7px;height:7px;border-radius:2px;background:var(--gr);display:inline-block"></span>success</span><span style="display:flex;align-items:center;gap:3px;color:var(--re)"><span style="width:7px;height:7px;border-radius:2px;background:var(--re);display:inline-block"></span>failed</span></div></div><div style="position:relative;height:130px"><canvas id="c-runs" role="img" aria-label="Daily runs chart">Daily pipeline run counts.</canvas></div></div>'+
    '<div class="chart-card"><div class="chart-ttl">Success rate trend <span class="badge b-gr" style="font-size:9px">'+d.successRate+'% avg</span></div><div style="position:relative;height:130px"><canvas id="c-rate" role="img" aria-label="Success rate trend">Success rate over time.</canvas></div></div>'+
    '</div>'+

    '<div style="display:grid;grid-template-columns:3fr 2fr;gap:10px;margin-bottom:10px">'+
    '<div class="chart-card"><div class="chart-ttl">Avg duration by branch (min) <span style="font-size:9px;color:var(--t3);font-weight:400;font-family:\'JetBrains Mono\',monospace">top 3 most triggered</span></div><div style="position:relative;height:'+Math.max(100,Math.max(3,d.branchDurs.length)*38+50)+'px"><canvas id="c-dur" role="img" aria-label="Duration by branch">Branch durations.</canvas></div></div>'+
    '<div class="chart-card"><div class="chart-ttl">Status breakdown</div>'+
    '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">'+
    '<span class="badge b-gr" style="font-size:9px">'+d.success+' success</span>'+
    '<span class="badge b-re" style="font-size:9px">'+d.failed+' failed</span>'+
    '<span class="badge b-gy" style="font-size:9px">'+d.canceled+' canceled</span>'+
    '</div>'+
    '<div style="position:relative;height:120px"><canvas id="c-pie" role="img" aria-label="Status doughnut">Status breakdown.</canvas></div>'+
    '</div></div>'+

    '<div class="chart-card"><div class="chart-ttl">Top failing jobs</div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">'+
    (d.topFailing.length===0?'<div style="font-size:12px;color:var(--gr);grid-column:1/-1">No failures in this period!</div>':
    d.topFailing.map(function(item){
      return '<div style="display:flex;align-items:center;gap:9px;padding:10px;background:var(--bg2);border-radius:7px;border:1px solid var(--bd)">'+
        '<div style="width:32px;height:32px;border-radius:7px;background:var(--reB);display:flex;align-items:center;justify-content:center;flex-shrink:0">'+
        '<span class="mono" style="font-size:13px;font-weight:600;color:var(--re)">'+item.count+'</span></div>'+
        '<div style="min-width:0"><div style="font-size:11px;font-weight:500;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+item.name+'</div>'+
        '<div class="mono" style="font-size:10px;color:var(--t3)">'+item.stage+'</div></div></div>';
    }).join(''))+
    '</div></div>'
  );
}

function fmtDurDelta(s){ if(s==null) return '--'; var abs=Math.abs(Math.round(s)); return (s>0?'+':'-')+(abs<60?abs+'s':Math.floor(abs/60)+'m'); }

async function setDashRange(n){ S.dashRange=n; S.dashData=null; saveSession(); var w=document.querySelector('.page-wrap'); if(w) w.innerHTML=renderDashboard(); await loadDashData(); }

async function loadDashData(){
    var proj=S.glSelProj;
  if(!proj) return;
  // Capture generation + project + branch at call time.
  // If a newer load starts before this one finishes, discard stale results.
  var myGen = ++_dashGen;
  var myProjId = proj.id;
  var myBranch = S.glBranch;
  S.loading.dash=true;
  var w=document.querySelector('.page-wrap');
  if(w&&S.currentPage==='dashboard') w.innerHTML=renderDashboard();
  try {
    var end=new Date();
    // dashRange===0 means "Today only"
    var effectiveDays = S.dashRange === 0 ? 1 : S.dashRange;
    var start=new Date(end - effectiveDays*86400000);
    // For Today, align start to midnight of today
    if(S.dashRange === 0){
      start = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, 0, 0, 0);
    }
    var pipelines=[];
    var raw=await glApi('/projects/'+proj.id+'/pipelines?per_page=100&updated_after='+start.toISOString());
    // GitLab list API often returns duration=null; fall back to updated_at - created_at
    // for finished pipelines so avg duration and branch charts have real data.
    pipelines=raw.map(function(p){
      var dur=p.duration&&p.duration>0?p.duration:null;
      if(!dur&&p.created_at&&p.updated_at){
        var finished=p.status==='success'||p.status==='failed'||p.status==='canceled'||p.status==='skipped';
        if(finished){
          var computed=Math.round((new Date(p.updated_at)-new Date(p.created_at))/1000);
          if(computed>0) dur=computed;
        }
      }
      return {id:p.id,status:p.status,ref:p.ref,created_at:p.created_at,duration:dur};
    });
    var days=[],labels=[];
    var today = new Date();
    var todayStr = today.toISOString().slice(0,10);
    if(S.dashRange === 0){
      // Today only — single bar
      days.push(todayStr);
      labels.push('Today · '+today.toLocaleDateString('en',{month:'short',day:'numeric'}));
    } else {
      for(var i=effectiveDays-1;i>=0;i--){
        var dayD=new Date(today.getFullYear(),today.getMonth(),today.getDate()-i);
        var dayStr=dayD.toISOString().slice(0,10);
        days.push(dayStr);
        labels.push(i===0?'Today · '+dayD.toLocaleDateString('en',{month:'short',day:'numeric'}):dayD.toLocaleDateString('en',{month:'short',day:'numeric'}));
      }
    }
    var okD={},failD={};
    days.forEach(function(d){okD[d]=0;failD[d]=0;});
    pipelines.forEach(function(p){
      var d=(p.created_at||'').slice(0,10);
      if(okD[d]!=null){
        var st=p.status;
        if(st==='success'||st==='passed'||st==='completed') okD[d]++;
        else if(st==='failed'||st==='failure') failD[d]++;
      }
    });
    var okArr=days.map(function(d){return okD[d];});
    var failArr=days.map(function(d){return failD[d];});
    var rateArr=days.map(function(_,i){ var t=okArr[i]+failArr[i]; return t?Math.round(okArr[i]/t*100):null; });
    var total=pipelines.length;
    var success=pipelines.filter(function(p){ var s=p.status; return s==='success'||s==='passed'||s==='completed'; }).length;
    var failed=pipelines.filter(function(p){ var s=p.status; return s==='failed'||s==='failure'; }).length;
    var canceled=pipelines.filter(function(p){ var s=p.status; return s==='canceled'||s==='cancelled'; }).length;
    var successRate=total?Math.round(success/total*100):0;
    var durs=pipelines.filter(function(p){return p.duration&&p.duration>0;}).map(function(p){return p.duration;});
    var avgDur=durs.length?durs.reduce(function(a,b){return a+b;},0)/durs.length:0;
    // Last success run duration
    var lastSuccess=pipelines.find(function(p){ var s=p.status; return (s==='success'||s==='passed'||s==='completed')&&p.duration>0; });
    var lastSuccessDur=lastSuccess?lastSuccess.duration:null;
    var byBranch={};
    pipelines.forEach(function(p){
      var st=p.status;
      var finished=st==='success'||st==='passed'||st==='completed'||st==='failed'||st==='failure';
      if(finished&&p.duration&&p.ref){ if(!byBranch[p.ref]) byBranch[p.ref]=[]; byBranch[p.ref].push(p.duration); }
    });

    // Determine if a specific branch is active (branch-tagged project selection).
    // Use myBranch captured at call time — S.glBranch may have changed if
    // the user switched project again while this async load was in flight.
    var taggedBranches = proj ? (S.repoBranches[String(proj.id)] || []) : [];
    var selectedBranch = (taggedBranches.length > 0 && myBranch && taggedBranches.indexOf(myBranch) !== -1) ? myBranch : null;

    // For the branch duration chart: always compare top 3 most triggered branches (by run count)
    var branchRunCount = {};
    pipelines.forEach(function(p){ if(p.ref){ branchRunCount[p.ref]=(branchRunCount[p.ref]||0)+1; } });
    var top3Branches = Object.entries(branchRunCount)
      .sort(function(a,b){ return b[1]-a[1]; })
      .slice(0,3)
      .map(function(e){ return e[0]; });
    var branchDurs = top3Branches.map(function(ref){
      var dList = byBranch[ref] || [];
      var avg = dList.length ? +(dList.reduce(function(a,b){return a+b;},0)/dList.length/60).toFixed(1) : 0;
      return {ref:ref, avg:avg, count: branchRunCount[ref]||0};
    }).filter(function(b){ return b.avg > 0; });

    // If branch is selected, filter main metrics to that branch only
    var filteredPipelines = selectedBranch
      ? pipelines.filter(function(p){ return p.ref === selectedBranch; })
      : pipelines;

    // Recompute daily arrays for filtered pipelines
    var okDf={},failDf={};
    days.forEach(function(d){okDf[d]=0;failDf[d]=0;});
    filteredPipelines.forEach(function(p){
      var d=(p.created_at||'').slice(0,10);
      if(okDf[d]!=null){
        var st=p.status;
        if(st==='success'||st==='passed'||st==='completed') okDf[d]++;
        else if(st==='failed'||st==='failure') failDf[d]++;
      }
    });
    var okArrF=days.map(function(d){return okDf[d];});
    var failArrF=days.map(function(d){return failDf[d];});
    var rateArrF=days.map(function(_,i){ var t=okArrF[i]+failArrF[i]; return t?Math.round(okArrF[i]/t*100):null; });
    var totalF=filteredPipelines.length;
    var successF=filteredPipelines.filter(function(p){ var s=p.status; return s==='success'||s==='passed'||s==='completed'; }).length;
    var failedF=filteredPipelines.filter(function(p){ var s=p.status; return s==='failed'||s==='failure'; }).length;
    var canceledF=filteredPipelines.filter(function(p){ var s=p.status; return s==='canceled'||s==='cancelled'; }).length;
    var successRateF=totalF?Math.round(successF/totalF*100):0;
    var dursF=filteredPipelines.filter(function(p){return p.duration&&p.duration>0;}).map(function(p){return p.duration;});
    var avgDurF=dursF.length?dursF.reduce(function(a,b){return a+b;},0)/dursF.length:0;
    var lastSuccessF=filteredPipelines.find(function(p){ var s=p.status; return (s==='success'||s==='passed'||s==='completed')&&p.duration>0; });
    var lastSuccessDurF=lastSuccessF?lastSuccessF.duration:null;

    // ── Previous period fetch for real deltas ──
    var prevStart=new Date(start.getTime()-effectiveDays*86400000);
    var prevEnd=start;
    var prevPipelines=[];
    try {
        var prevRaw=await glApi('/projects/'+proj.id+'/pipelines?per_page=100&updated_after='+prevStart.toISOString()+'&updated_before='+prevEnd.toISOString());
        prevPipelines=prevRaw.map(function(p){
          var dur=p.duration&&p.duration>0?p.duration:null;
          if(!dur&&p.created_at&&p.updated_at){
            var fin=p.status==='success'||p.status==='failed'||p.status==='canceled'||p.status==='skipped';
            if(fin){ var c=Math.round((new Date(p.updated_at)-new Date(p.created_at))/1000); if(c>0) dur=c; }
          }
          return {id:p.id,status:p.status,ref:p.ref,created_at:p.created_at,duration:dur};
        });
    } catch(e){}
    var prevFiltered=selectedBranch?prevPipelines.filter(function(p){return p.ref===selectedBranch;}):prevPipelines;
    var prevTotal=prevFiltered.length;
    var prevSuccess=prevFiltered.filter(function(p){var s=p.status;return s==='success'||s==='passed'||s==='completed';}).length;
    var prevFailed=prevFiltered.filter(function(p){var s=p.status;return s==='failed'||s==='failure';}).length;
    var prevRate=prevTotal?Math.round(prevSuccess/prevTotal*100):0;
    var prevDurs=prevFiltered.filter(function(p){return p.duration&&p.duration>0;}).map(function(p){return p.duration;});
    var prevAvgDur=prevDurs.length?prevDurs.reduce(function(a,b){return a+b;},0)/prevDurs.length:0;

    // Compute real deltas
    var totalDelta=prevTotal>0?(totalF-prevTotal>=0?'+':'')+Math.round((totalF-prevTotal)/prevTotal*100)+'%':(totalF>0?'new':'—');
    var rateDelta=prevRate>0?+(successRateF-prevRate).toFixed(1):0;
    var durDelta=prevAvgDur>0?(avgDurF-prevAvgDur):0;
    var failDeltaVal=prevFailed>0?Math.round((failedF-prevFailed)/prevFailed*100):0;
    var failDeltaStr=prevFailed>0?(failedF<=prevFailed?'-':'+')+Math.abs(failDeltaVal)+'%':'—';

    // ── Top failing jobs (GL only — fetch jobs for failed pipelines) ──
    var topFailing=[];
    var failedPipes=filteredPipelines.filter(function(p){return p.status==='failed'||p.status==='failure';}).slice(0,5);
      var jobFailMap={};
      await Promise.all(failedPipes.map(async function(p){
        try {
          var jobs=await glApi('/projects/'+proj.id+'/pipelines/'+p.id+'/jobs?per_page=50');
          jobs.forEach(function(j){
            if(j.status==='failed'){
              if(!jobFailMap[j.name]) jobFailMap[j.name]={name:j.name,stage:j.stage||'',count:0};
              jobFailMap[j.name].count++;
            }
          });
        } catch(e){}
      }));
      topFailing=Object.values(jobFailMap).sort(function(a,b){return b.count-a.count;}).slice(0,6);

    // Guard: discard results if a newer load has started or project was switched
    var curProj = S.glSelProj;
    if(myGen !== _dashGen || !curProj || curProj.id !== myProjId){
      S.loading.dash=false;
      return; // stale — a newer load is already in progress
    }
    S.dashData={
      total:totalF,success:successF,failed:failedF,canceled:canceledF,
      successRate:successRateF,avgDur:avgDurF,lastSuccessDur:lastSuccessDurF,
      totalDelta:totalDelta,
      rateDelta:rateDelta,
      durDelta:durDelta,
      failDelta:failDeltaStr,
      failDeltaGood: prevFailed===0 || failedF<=prevFailed,
      labels:labels,okArr:okArrF,failArr:failArrF,rateArr:rateArrF,
      branchDurs:branchDurs,
      topFailing:topFailing,
      selectedBranch:selectedBranch,
      top3Branches:top3Branches
    };
  } catch(e){
    if(myGen === _dashGen) toast('Failed to load analytics','err');
  }
  if(myGen !== _dashGen) return; // another load superseded this one
  S.loading.dash=false;
  if(S.currentPage==='dashboard'){ var w2=document.querySelector('.page-wrap'); if(w2) w2.innerHTML=renderDashboard(); setTimeout(buildCharts,100); }
}

function buildCharts(){
  dashCharts.forEach(function(c){try{c.destroy();}catch{}});
  dashCharts=[];
  var d=S.dashData; if(!d) return;
  var dk=S.theme==='dark';
  var gc=dk?'rgba(42,48,80,0.7)':'rgba(0,0,0,0.06)';
  var tc=dk?'#5a6080':'#8890ae';
  var base={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:dk?'#1c2030':'#fff',borderColor:dk?'#3a4570':'#e0e3f0',borderWidth:1,titleColor:dk?'#9098b8':'#44495f',bodyColor:dk?'#e8eaf0':'#0e1117',padding:8}}};
  var c1=el('c-runs'),c2=el('c-rate'),c3=el('c-dur'),c4=el('c-pie');
  var gr=dk?'rgba(61,214,140,0.75)':'rgba(26,158,98,0.7)';
  var re=dk?'rgba(240,82,82,0.75)':'rgba(214,48,49,0.7)';
  var pu=dk?'#7c6ef5':'#5c4fd6';
  if(c1) dashCharts.push(new Chart(c1,{type:'bar',data:{labels:d.labels,datasets:[{data:d.okArr,backgroundColor:gr,borderRadius:2,barPercentage:0.65},{data:d.failArr,backgroundColor:re,borderRadius:2,barPercentage:0.65}]},options:{...base,scales:{x:{stacked:true,grid:{color:gc},ticks:{color:tc,font:{size:9},maxTicksLimit:8}},y:{stacked:true,grid:{color:gc},ticks:{color:tc,font:{size:9}}}}}}));
  if(c2) dashCharts.push(new Chart(c2,{type:'line',data:{labels:d.labels,datasets:[{data:d.rateArr,borderColor:pu,backgroundColor:dk?'rgba(124,110,245,0.08)':'rgba(92,79,214,0.07)',borderWidth:2,pointRadius:2,fill:true,tension:0.4,spanGaps:true}]},options:{...base,scales:{x:{grid:{color:gc},ticks:{color:tc,font:{size:9},maxTicksLimit:8}},y:{min:0,max:100,grid:{color:gc},ticks:{color:tc,font:{size:9},callback:function(v){return v+'%'}}}}}}));
  if(c3&&d.branchDurs.length){
    var cols=dk?['rgba(61,214,140,0.7)','rgba(77,166,255,0.7)','rgba(240,82,82,0.7)','rgba(124,110,245,0.7)','rgba(240,160,48,0.7)','rgba(34,211,238,0.7)']:['rgba(26,158,98,0.7)','rgba(26,115,217,0.7)','rgba(214,48,49,0.7)','rgba(92,79,214,0.7)','rgba(192,124,16,0.7)','rgba(8,145,178,0.7)'];
    dashCharts.push(new Chart(c3,{type:'bar',data:{labels:d.branchDurs.map(function(b){return b.ref;}),datasets:[{data:d.branchDurs.map(function(b){return b.avg;}),backgroundColor:d.branchDurs.map(function(_,i){return cols[i%cols.length];}),borderRadius:3,barPercentage:0.6}]},options:{...base,indexAxis:'y',scales:{x:{grid:{color:gc},ticks:{color:tc,font:{size:9},callback:function(v){return v+'m'}}},y:{grid:{display:false},ticks:{color:tc,font:{size:9,family:'JetBrains Mono'}}}}}}));
  }
  if(c4) dashCharts.push(new Chart(c4,{type:'doughnut',data:{labels:['Success','Failed','Canceled'],datasets:[{data:[d.success,d.failed,d.canceled],backgroundColor:dk?['rgba(61,214,140,0.8)','rgba(240,82,82,0.8)','rgba(90,96,128,0.6)']:['rgba(26,158,98,0.8)','rgba(214,48,49,0.8)','rgba(136,144,174,0.6)'],borderWidth:0,hoverOffset:4}]},options:{...base,cutout:'65%',plugins:{...base.plugins,tooltip:{...base.plugins.tooltip,callbacks:{label:function(ctx){return ' '+ctx.label+': '+ctx.parsed;}}}}}}));
}

function exportXLSX(){
  if(!S.dashData) return;
  if(typeof XLSX === 'undefined'){ toast('XLSX library not loaded yet — try again in a moment','err'); return; }
  var d=S.dashData;
  var proj=S.glSelProj;
  var periodLabel=S.dashRange===0?'Today':S.dashRange+'d';
  var branchLabel=d.selectedBranch||'All branches';
  var wb=XLSX.utils.book_new();

  /* ─── helpers ─── */
  function hdr(label){return {v:label,t:'s',s:{font:{bold:true,sz:11,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'5C4FD6'}},alignment:{horizontal:'center',vertical:'center'},border:{bottom:{style:'medium',color:{rgb:'3B30A8'}}}}};}
  function secHdr(label){return {v:label,t:'s',s:{font:{bold:true,sz:10,color:{rgb:'5C4FD6'}},fill:{fgColor:{rgb:'EEF0FB'}},border:{bottom:{style:'thin',color:{rgb:'C5CADF'}}}}};}
  function cell(v,fmt){
    var t=typeof v==='number'?'n':'s';
    var c={v:v,t:t};
    if(fmt) c.z=fmt;
    return c;
  }
  function pct(v){return {v:v/100,t:'n',z:'0%'};}
  function num(v){return {v:v,t:'n',z:'#,##0'};}
  function dur(secs){
    if(!secs||secs<=0) return {v:'—',t:'s'};
    var m=Math.floor(secs/60),s=Math.round(secs%60);
    return {v:(m?m+'m ':'')+s+'s',t:'s'};
  }
  function green(v){return {v:v,t:'n',z:'#,##0',s:{font:{color:{rgb:'1A9E62'}},numFmt:'#,##0'}};}
  function red(v){return {v:v,t:'n',z:'#,##0',s:{font:{color:{rgb:'D63031'}},numFmt:'#,##0'}};}
  function labelCell(v){return {v:v,t:'s',s:{font:{bold:true,sz:10},fill:{fgColor:{rgb:'F0F1F8'}}}};}

  /* ══════════════════════════════
     SHEET 1 — SUMMARY
  ══════════════════════════════ */
  var sumData=[
    [{v:'Pipeline Analytics Report',t:'s',s:{font:{bold:true,sz:14,color:{rgb:'5C4FD6'}}}}],
    [{v:'Project: '+(proj?proj.name:'—'),t:'s',s:{font:{bold:true,sz:10,color:{rgb:'44495F'}}}}],
    [{v:'Branch: '+branchLabel+'   |   Period: '+periodLabel,t:'s',s:{font:{italic:true,sz:10,color:{rgb:'808599'}}}}],
    [],    [],

    [hdr('Metric'),hdr('Value'),hdr('vs Prev Period')],
    [labelCell('Total Runs'),    num(d.total),          {v:d.totalDelta,t:'s'}],
    [labelCell('Success'),       green(d.success),       {v:'',t:'s'}],
    [labelCell('Failed'),        red(d.failed),          {v:'',t:'s'}],
    [labelCell('Canceled'),      num(d.canceled||0),     {v:'',t:'s'}],
    [labelCell('Success Rate'),  pct(d.successRate),     {v:(d.rateDelta>=0?'+':'')+d.rateDelta+'%',t:'s',s:{font:{color:{rgb:d.rateDelta>=0?'1A9E62':'D63031'}}}}],
    [labelCell('Avg Duration'),  dur(d.avgDur),          {v:d.durDelta?((d.durDelta<=0?'':'+')+(d.durDelta>0?'+':'')+Math.round(d.durDelta)+'s'):'—',t:'s'}],
    [labelCell('Last Success'),  dur(d.lastSuccessDur),  {v:'',t:'s'}],
  ];
  var wsSummary=XLSX.utils.aoa_to_sheet(sumData);
  wsSummary['!cols']=[{wch:22},{wch:16},{wch:18}];
  wsSummary['!merges']=[{s:{r:0,c:0},e:{r:0,c:2}},{s:{r:1,c:0},e:{r:1,c:2}},{s:{r:2,c:0},e:{r:2,c:2}}];
  XLSX.utils.book_append_sheet(wb,wsSummary,'Summary');

  /* ══════════════════════════════
     SHEET 2 — DAILY RUNS (only days with activity)
  ══════════════════════════════ */
  var dailyRows=[[hdr('Date'),hdr('Success'),hdr('Failed'),hdr('Total'),hdr('Success Rate')]];
  var hasActivity=false;
  d.labels.forEach(function(l,i){
    var ok=d.okArr[i]||0, fail=d.failArr[i]||0, tot=ok+fail;
    if(tot===0) return; // skip empty days
    hasActivity=true;
    var rate=tot?ok/tot:null;
    // Strip special chars from label (e.g. "Today · May 11" → "Today May 11")
    var cleanLabel=l.replace(/[·•]/g,' ').replace(/\s+/g,' ').trim();
    dailyRows.push([
      {v:cleanLabel,t:'s'},
      {v:ok,t:'n',s:{font:{color:{rgb:'1A9E62'}}}},
      {v:fail,t:'n',s:{font:{color:{rgb:'D63031'}}}},
      {v:tot,t:'n',z:'#,##0'},
      rate!==null?{v:rate,t:'n',z:'0%'}:{v:'—',t:'s'}
    ]);
  });
  if(!hasActivity){
    dailyRows.push([{v:'No pipeline runs in this period',t:'s'}]);
  }
  var wsDaily=XLSX.utils.aoa_to_sheet(dailyRows);
  wsDaily['!cols']=[{wch:20},{wch:12},{wch:12},{wch:12},{wch:14}];
  XLSX.utils.book_append_sheet(wb,wsDaily,'Daily Runs');

  /* ══════════════════════════════
     SHEET 3 — BRANCH PERFORMANCE
  ══════════════════════════════ */
  var brRows=[[hdr('Branch'),hdr('Avg Duration'),hdr('Run Count')]];
  if(d.branchDurs && d.branchDurs.length){
    d.branchDurs.forEach(function(b){
      brRows.push([
        {v:b.ref,t:'s',s:{font:{family:'JetBrains Mono, monospace'}}},
        {v:b.avg,t:'n',z:'0.0"m"'},
        {v:b.count,t:'n',z:'#,##0'}
      ]);
    });
  } else {
    brRows.push([{v:'No branch data available',t:'s'}]);
  }
  var wsBranch=XLSX.utils.aoa_to_sheet(brRows);
  wsBranch['!cols']=[{wch:24},{wch:16},{wch:14}];
  XLSX.utils.book_append_sheet(wb,wsBranch,'Branch Performance');

  /* ══════════════════════════════
     SHEET 4 — TOP FAILING JOBS (GL only)
  ══════════════════════════════ */
  if(d.topFailing && d.topFailing.length){
    var jobRows=[[hdr('Job Name'),hdr('Stage'),hdr('Failure Count')]];
    d.topFailing.forEach(function(j){
      jobRows.push([
        {v:j.name,t:'s'},
        {v:j.stage||'—',t:'s'},
        {v:j.count,t:'n',s:{font:{color:{rgb:'D63031'}}}}
      ]);
    });
    var wsJobs=XLSX.utils.aoa_to_sheet(jobRows);
    wsJobs['!cols']=[{wch:28},{wch:18},{wch:16}];
    XLSX.utils.book_append_sheet(wb,wsJobs,'Top Failing Jobs');
  }

  /* ── write & download ── */
  var branchSuffix=d.selectedBranch?'-'+d.selectedBranch.replace(/[^a-zA-Z0-9_-]/g,'-'):'';
  var fname='pipeline-analytics-'+(proj?proj.name.replace(/[^a-zA-Z0-9_-]/g,'-'):'export')+branchSuffix+'-'+periodLabel+'.xlsx';
  XLSX.writeFile(wb,fname,{bookType:'xlsx',type:'binary',cellStyles:true});
  toast('Excel report downloaded — '+fname);
}
/* Keep old exportCSV as alias for safety */
function exportCSV(){ exportXLSX(); }

/* ============================
   DATA LOADERS
============================ */
async function loadGLProjects(){
  S.loading.projects=true;
  try {
    // Fetch without simple=true so we get marked_for_deletion_at field
    var allProjs=await glApi('/projects?membership=true&per_page=100&order_by=last_activity_at');
    S.glProjects=allProjs.filter(function(p){
      if(p.archived) return false;
      if(p.marked_for_deletion_at) return false;
      if(p.pending_delete) return false;
      // Hide repos with "deletion" anywhere in name/path (GitLab scheduled-deletion naming)
      var n=(p.name||'').toLowerCase();
      var pn=(p.path||'').toLowerCase();
      if(n.indexOf('deletion')!==-1||pn.indexOf('deletion')!==-1) return false;
      return true;
    });
  }
  catch(e){ toast('Failed to load projects','err'); }
  S.loading.projects=false;
  render();
}


async function selProject(id, _skipDashLoad, _skipBranchLoad){
  hideAllTips();
  var found = S.glProjects.find(function(p){return p.id===id;});
  if(!found){
    try { found = await glApi('/projects/'+id); if(found) S.glProjects.push(found); } catch(e){}
  }
  _dashGen++;
  S.glSelProj = found || null;
  S.glBranchInfo=null; S.glCiVars=[]; S.glParamVals={}; S.glRuns=[]; S.glSelPipeline=null; S.glPipelineStageOrder=[]; S.glProjectStageOrder=[]; S.glPipelineJobs=[]; S.glAdhoc=[]; S.dashData=null;
  S.glBranchSugs=[]; S.glShowDrop=false; S.glAllBranches=[];
  var taggedArr = S.repoBranches[String(id)] || [];
  S.glBranch = taggedArr[0] || S.reqBranch || '';
  try { var m=await glApi('/projects/'+id+'/members/all/'+S.glUser.id); S.glAccessLevel=m.access_level; } catch { S.glAccessLevel=40; }
  saveSession();
  render();
  loadGLPipelines();
  loadGLProjectStageOrder();
  if(S.currentPage==='dashboard' && !_skipDashLoad) loadDashData();
  await loadGLAllBranches(!_skipBranchLoad);
}

async function loadGLAllBranches(andLoadParams){
  if(!S.glSelProj) return;
  try {
    var projId = S.glSelProj.id;
    var page1 = await glApi('/projects/'+projId+'/repository/branches?per_page=100&order_by=name&sort=asc');
    // Guard: project may have changed while request was in flight
    if(!S.glSelProj || S.glSelProj.id !== projId) return;
    S.glAllBranches = page1.map(function(b){ return b.name; });
    // Auto-select only if no branch is set yet
    if(!S.glBranch){
      var taggedArr2 = S.repoBranches[String(projId)] || [];
      var tagged = taggedArr2[0] || S.reqBranch || '';
      if(tagged){
        S.glBranch = tagged;
      } else {
        // Fall back to project default branch
        var proj2 = await glApi('/projects/'+projId);
        if(!S.glSelProj || S.glSelProj.id !== projId) return;
        var def = (proj2 && proj2.default_branch) || (S.glAllBranches[0]||'main');
        S.glBranch = def;
      }
    }
    S.glBranchSugs = S.glAllBranches;
    if(S.currentPage==='run') reRunPage();
    // Auto-load pipeline params: always unless caller explicitly skipped (e.g. quickLoadBranch)
    if(S.glBranch && andLoadParams !== false) loadGLBranchParams();
  } catch(e){}
}


async function loadGLProjectStageOrder(){
  // Fetch the project's .gitlab-ci.yml and extract the top-level stages: list.
  // This gives the canonical YAML stage order, independent of which jobs ran.
  if(!S.glSelProj) return;
  try {
    // Try CI lint/config API first (returns parsed stages array)
    var ciConfig = await glApi('/projects/'+S.glSelProj.id+'/ci/lint?dry_run=false&ref='+encodeURIComponent(S.glBranch||'main'));
    if(ciConfig && Array.isArray(ciConfig.stages) && ciConfig.stages.length){
      S.glProjectStageOrder = ciConfig.stages;
      return;
    }
  } catch(e){}
  try {
    // Fallback: fetch raw .gitlab-ci.yml and parse stages: manually
    var raw = await glApiText('/projects/'+S.glSelProj.id+'/repository/files/.gitlab-ci.yml/raw?ref='+encodeURIComponent(S.glBranch||'main'));
    if(raw && typeof raw === 'string'){
      // Parse stages: block line-by-line (avoids multiline regex issues)
      var lines2 = raw.split(/\r?\n/);
      var inStages = false, stageList = [];
      for(var li=0; li<lines2.length; li++){
        var ln = lines2[li];
        if(/^stages\s*:/.test(ln)){ inStages=true; continue; }
        if(inStages){
          var stm = ln.match(/^[ \t]+-[ \t]+(\S+)/);
          if(stm){ stageList.push(stm[1]); }
          else if(ln.match(/^[^\s#]/)){ break; }
        }
      }
      if(stageList.length){ S.glProjectStageOrder = stageList; return; }
    }
  } catch(e){}
  // If both fail, leave glProjectStageOrder empty — pipeline-level full.stages will be used
}

async function loadGLPipelines(){
  if(!S.glSelProj) return;
  S.loading.pipelines=true;
  // Spin the refresh button arrow while loading
  var refreshBtn=document.querySelector('.gl-pipelines-refresh');
  if(refreshBtn){
    refreshBtn.disabled=true;
    refreshBtn.innerHTML='<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="animation:spin 0.7s linear infinite"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
  }
  try { S.glRuns=await glApi('/projects/'+S.glSelProj.id+'/pipelines?per_page=20'); } catch(e){ toast('Failed to refresh pipelines','err'); }
  S.loading.pipelines=false;
  // Restore the refresh button
  var refreshBtn2=document.querySelector('.gl-pipelines-refresh');
  if(refreshBtn2){ refreshBtn2.disabled=false; refreshBtn2.innerHTML=icoRefresh(); }
  if(S.currentPage==='history') reHistPage();
}




function startGLPoll(id){
  clearInterval(pipelinePollTimer);
  pipelinePollTimer=setInterval(async function(){
    if(!S.glSelProj) return;
    try {
      // Refresh pipeline status
      var p=await glApi('/projects/'+S.glSelProj.id+'/pipelines/'+id);
      var idx=S.glRuns.findIndex(function(r){return r.id===id;});
      if(idx>=0) S.glRuns[idx]=p;
      if(S.glSelPipeline&&S.glSelPipeline.id===id) S.glSelPipeline=p;
      // Refresh job statuses — stage order is NEVER re-derived here, it was locked on first load
      if(S.glSelPipeline&&S.glSelPipeline.id===id){
        S.glPipelineJobs=await glApi('/projects/'+S.glSelProj.id+'/pipelines/'+id+'/jobs?per_page=50&sort=asc');
      }
      var done=['success','failed','canceled','skipped'];
      if(done.includes(p.status)) clearInterval(pipelinePollTimer);
    } catch(e){ clearInterval(pipelinePollTimer); }
    if(S.currentPage==='history') reHistPage();
  },5000);
}


/* ============================
   SESSION COUNTDOWN TIMER
============================ */
function fmtSessionTime(ms){
  if(ms<=0) return '00:00';
  var totalSec = Math.floor(ms/1000);
  var m = Math.floor(totalSec/60);
  var s = totalSec % 60;
  return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}

function getTimerColor(ms){
  var pct = ms / SESSION_TTL;
  if(pct > 0.25) return 'var(--t3)';    // >15 min: neutral grey
  if(pct > 0.10) return '#f59e0b';      // 6–15 min: amber warning
  return '#ef4444';                      // <6 min: red urgent
}

function updateSessionTimerEl(){
  var el = document.getElementById('session-timer');
  if(!el) return;
  var ms = sessionMsRemaining();
  var timeStr = fmtSessionTime(ms);
  var color = getTimerColor(ms);
  var pct = ms / SESSION_TTL;
  var urgent = pct <= 0.10;
  el.innerHTML =
    '<div style="display:flex;align-items:center;gap:5px;font-family:\'JetBrains Mono\',monospace;font-size:10px;color:'+color+';'+(urgent?'animation:timerPulse 1s ease-in-out infinite':'')+'">' +
    '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="'+color+'" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
    '<span>'+timeStr+'</span>' +
    '</div>' +
    '<div style="height:2px;background:var(--bd);border-radius:2px;margin-top:3px;overflow:hidden">' +
    '<div style="height:100%;width:'+Math.max(0,pct*100).toFixed(1)+'%;background:'+color+';border-radius:2px;transition:width 1s linear"></div>' +
    '</div>';
}

function startSessionTimer(){
  stopSessionTimer();
  updateSessionTimerEl();
  sessionTimerInterval = setInterval(function(){
    var ms = sessionMsRemaining();
    updateSessionTimerEl();
    if(ms <= 0){
      stopSessionTimer();
      toast('Session expired — please sign in again', 'err');
      signOut();
    }
  }, 1000);
}

function stopSessionTimer(){
  if(sessionTimerInterval){ clearInterval(sessionTimerInterval); sessionTimerInterval=null; }
}

function signOut(){
  clearInterval(logPollTimer); clearInterval(pipelinePollTimer);
  stopSessionTimer();
  // Preserve GitLab URL before clearing session
  var savedGlUrl = S.glUrl;
  clearSession();
  S.glUser=null; S.glToken=''; S.glProjects=[]; S.glSelProj=null; S.glRuns=[];
  
  S.currentPage='login'; S.provider='gitlab'; S.logJob=null; S.dashData=null;
  // Restore preserved URL (survives logout)
  S.glUrl = savedGlUrl || 'https://gitlab.com';
  try { localStorage.setItem('pipeline_runner_gl_url', S.glUrl); } catch(e){}
  var ov=el('log-overlay'); if(ov) ov.remove();
  render();
}

function toggleTheme(){
  S.theme=S.theme==='light'?'dark':'light';
  document.documentElement.setAttribute('data-theme',S.theme);
  saveSession();
  if(S.currentPage==='dashboard'&&S.dashData){ var w=document.querySelector('.page-wrap'); if(w) w.innerHTML=renderDashboard(); setTimeout(buildCharts,100); }
  else render();
  var ov=el('log-overlay'); if(ov&&S.logJob) renderLogOverlay();
}

/* ============================
   MAIN RENDER
============================ */
function render(){
  updateFavicon();
  dashCharts.forEach(function(c){try{c.destroy();}catch{}}); dashCharts=[];
  var loggedIn=!!S.glUser;
  if(S.currentPage==='login'||!loggedIn){ el('app').innerHTML=renderLogin(); return; }
  var titles={run:'Run pipeline',history:'Run history',dashboard:'Dashboard'};
  var pageHtml='';
  if(S.currentPage==='run') pageHtml=renderGLRun();
  else if(S.currentPage==='history') pageHtml=renderGLHistory();
  else if(S.currentPage==='dashboard') pageHtml=renderDashboard();
  el('app').innerHTML=renderSidebar()+'<div class="main-col">'+renderTopbar(titles[S.currentPage]||'')+'<div class="page-wrap">'+pageHtml+'</div></div>';
  if(S.currentPage==='dashboard'&&S.dashData) setTimeout(buildCharts,100);
  if(S.currentPage==='dashboard'&&!S.dashData){ var proj=S.glSelProj; if(proj) loadDashData(); }
  if(S.logJob){ var ov=el('log-overlay'); if(ov) ov.remove(); renderLogOverlay(); }
  // Always scroll the active sidebar project into view after a full render
  sbScrollActiveIntoView();
}

/* ============================
   BOOT
============================ */

// Apply theme IMMEDIATELY before any render to prevent flash
(function(){
  var raw = null;
  try { raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY); } catch(e){}
  if(raw){
    try {
      var d = JSON.parse(raw);
      if(d && d.theme){ document.documentElement.setAttribute('data-theme', d.theme); S.theme = d.theme; }
    } catch(e){}
  }
  // Load persistent settings (pinned/hidden repos, required repo/branch)
  loadSettings();
})();

// Restore full session if within 1-hour TTL
(function(){
  var sess = loadSession();
  if(!sess) return;

  // Restore all scalar state immediately
  S.provider      = sess.provider      || S.provider;
  S.theme         = sess.theme         || S.theme;
  S.glUrl         = sess.glUrl         || S.glUrl;
  S.glToken       = sess.glToken       || '';
  S.glUser        = sess.glUser        || null;
  S.glBranch      = sess.glBranch      || S.reqBranch || '';
  S.glAccessLevel = sess.glAccessLevel || null;
  S.glParamVals   = sess.glParamVals   || {};
  S.glShowGraph   = sess.glShowGraph   || false;
  S.glHideOptional = sess.glHideOptional || false;
  S.glShowDefaults = sess.glShowDefaults || false;
  S.dashRange     = (sess.dashRange !== undefined && sess.dashRange !== null) ? sess.dashRange : 30;
  S.logExpanded   = sess.logExpanded   || false;

  var loggedIn = !!S.glUser;
  if(!loggedIn) return;

  S.currentPage = sess.currentPage || 'run';
  document.documentElement.setAttribute('data-theme', S.theme);

  // After first render, reload projects/repos and restore selected items
  setTimeout(function(){
    var mins = Math.round(sessionMsRemaining() / 60000);
    toast('Session restored — '+mins+'m remaining', 'info');
    startSessionTimer();

    if(S.provider==='gitlab'){
      // Do NOT auto-fetch all projects — only resolve the previously selected project
      (async function(){
        if(sess.glSelProjId){
          // Only restore if still in managedProjects — don't re-fetch projects that were removed/reset
          var mp = S.managedProjects.find(function(x){ return x.id===sess.glSelProjId && x.provider==='gitlab'; });
          var found = mp
            ? {id:mp.id, name:mp.name, namespace:{name:mp.ns}, web_url:mp.webUrl, path_with_namespace:mp.fullName}
            : null;
          if(found){
            S.glSelProj = found;
            if(S.currentPage==='dashboard'){
              saveSession(); render(); loadDashData(); return;
            }
            loadGLPipelines().then(function(){
              if(sess.glSelPipelineId){
                var pl = S.glRuns.find(function(x){ return x.id===sess.glSelPipelineId; }) || {id: sess.glSelPipelineId};
                S.glSelPipeline = pl;
                saveSession(); render();
                selGLPipeline(sess.glSelPipelineId).then(function(){
                  if(sess.logJobId){
                    var j = S.glPipelineJobs.find(function(x){ return x.id===sess.logJobId; });
                    if(j){ openGLLog(j.id); }
                  }
                });
              } else {
                saveSession(); render();
              }
            });
            // Auto-load branch + CI vars when restoring session on run page
            if(S.currentPage === 'run'){
              loadGLAllBranches(true);
            }
          } else { render(); }
        } else { render(); }
      })();
    }
  }, 100);
})();

updateFavicon();
render();

/* ============================
   SIDEBAR TOOLTIP SYSTEM
   Fixed-position tooltip appended to <body> — never clipped by sidebar overflow.
   Rules:
   1. Collapsed sidebar: nav items, project icons, expand button → always show (right)
   2. Expanded sidebar: project rows → only show when name is truncated (above)
============================ */
/* ── Sidebar tooltip shims — unified engine handles all tips now ── */
function sbShowTip(target, text){ _showLtip(target, text); }
function sbHideTip(){ hideLogTip(); }
function sbAttachTips(){ /* no-op — delegated listener on document handles sidebar tips */ }

// Patch render() to re-attach tooltip listeners after sidebar re-renders
var _origRender = render;
render = function(){
  _origRender.apply(this, arguments);
  setTimeout(function(){
    var s = document.getElementById('main-sidebar');
    if(s){ s._tipAttached = false; }
    sbAttachTips();
  }, 60);
};
// Also re-attach after reSide (sidebar partial re-render)
var _origReSide = typeof reSide !== 'undefined' ? reSide : null;
if(_origReSide){
  reSide = function(){
    _origReSide.apply(this, arguments);
    setTimeout(function(){
      var s = document.getElementById('main-sidebar');
      if(s){ s._tipAttached = false; }
      sbAttachTips();
    }, 60);
  };
}
setTimeout(sbAttachTips, 200);

/* ── Dashboard CSV export ── */
function exportDashCSV(){
  if(!S.dashData){ toast('No data to export','err'); return; }
  var d = S.dashData;
  var proj = S.glSelProj;
  var periodLabel = S.dashRange===0 ? 'Today' : S.dashRange+'d';
  var branchLabel = d.selectedBranch || 'All branches';

  var rows = [];
  // Header block
  rows.push(['Pipeline Analytics Report']);
  rows.push(['Project', proj ? proj.name : '—']);
  rows.push(['Branch', branchLabel]);
  rows.push(['Period', periodLabel]);
  rows.push([]);

  // Summary
  rows.push(['Metric','Value','vs Prev Period']);
  rows.push(['Total Runs', d.total, d.totalDelta]);
  rows.push(['Success', d.success, '']);
  rows.push(['Failed', d.failed, '']);
  rows.push(['Canceled', d.canceled||0, '']);
  rows.push(['Success Rate', d.successRate+'%', (d.rateDelta>=0?'+':'')+d.rateDelta+'%']);
  rows.push(['Avg Duration', fmtDur(d.avgDur), d.durDelta ? (d.durDelta<=0?'':'+')+ Math.round(d.durDelta)+'s' : '—']);
  rows.push(['Last Success', fmtDur(d.lastSuccessDur), '']);
  rows.push([]);

  // Daily runs
  rows.push(['Date','Success','Failed','Total','Success Rate']);
  var hasAct = false;
  d.labels.forEach(function(l,i){
    var ok=d.okArr[i]||0, fail=d.failArr[i]||0, tot=ok+fail;
    if(tot===0) return;
    hasAct = true;
    rows.push([l.replace(/[·•]/g,' ').trim(), ok, fail, tot, tot ? Math.round(ok/tot*100)+'%' : '—']);
  });
  if(!hasAct) rows.push(['No pipeline runs in this period','','','','']);
  rows.push([]);

  // Branch performance
  if(d.branchDurs && d.branchDurs.length){
    rows.push(['Branch','Avg Duration (min)','Run Count']);
    d.branchDurs.forEach(function(b){ rows.push([b.ref, b.avg.toFixed(1), b.count]); });
    rows.push([]);
  }

  // Top failing jobs
  if(d.topFailing && d.topFailing.length){
    rows.push(['Job Name','Stage','Failure Count']);
    d.topFailing.forEach(function(j){ rows.push([j.name, j.stage||'—', j.count]); });
  }

  // Encode as CSV
  var csv = rows.map(function(row){
    return row.map(function(v){
      var s = String(v==null?'':v);
      return s.indexOf(',')>=0||s.indexOf('"')>=0||s.indexOf('\n')>=0 ? '"'+s.replace(/"/g,'""')+'"' : s;
    }).join(',');
  }).join('\n');

  var branchSuffix = d.selectedBranch ? '-'+d.selectedBranch.replace(/[^a-zA-Z0-9_-]/g,'-') : '';
  var fname = 'pipeline-analytics-'+(proj?proj.name.replace(/[^a-zA-Z0-9_-]/g,'-'):'export')+branchSuffix+'-'+periodLabel+'.csv';
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = fname; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  toast('CSV downloaded — '+fname);
}

/* ── Clear app cache / local storage ── */
function clearAppCache(){
  // Clears ALL runtime/pipeline state — preserves projects, settings and login session
  var cleared = 0;

  // ── localStorage / sessionStorage ──
  // Remove the cached GitLab URL (re-read from login on next load)
  try {
    if(localStorage.getItem('pipeline_runner_gl_url')!==null)  { localStorage.removeItem('pipeline_runner_gl_url');  cleared++; }
    if(sessionStorage.getItem('pipeline_runner_gl_url')!==null){ sessionStorage.removeItem('pipeline_runner_gl_url'); cleared++; }
  } catch(e){}

  // Strip all runtime-only fields from pipeline_runner_settings
  // (pinnedRepos, starredRepos, managedProjects, projOrder etc are deliberately kept)
  try {
    var raw = localStorage.getItem('pipeline_runner_settings');
    if(raw){
      var d = JSON.parse(raw);
      delete d.repoBranches;
      delete d.glVarDisabled;
      localStorage.setItem('pipeline_runner_settings', JSON.stringify(d));
      cleared++;
    }
  } catch(e){}

  // ── Stop all background timers ──
  clearInterval(logPollTimer);
  clearInterval(pipelinePollTimer);
  logPollTimer = null;
  pipelinePollTimer = null;

  // ── Reset ALL in-memory pipeline / CI state ──
  // Pipeline run data
  S.glRuns              = [];
  S.glSelPipeline       = null;
  S.glPipelineJobs      = [];
  S.glPipelineStageOrder= [];
  S.glProjectStageOrder = [];
  // CI variable state
  S.glCiVars            = [];
  S.glCiInputVars       = [];
  S.glParamVals         = {};
  S.glAdhoc             = [];
  S.glVarDisabled       = {};
  S.glVarPermError      = false;
  // Branch state
  S.glBranch            = '';
  S.glBranchInfo        = null;
  S.glBranchSugs        = [];
  S.glAllBranches       = [];
  S.glShowDrop          = false;
  S.repoBranches        = {};
  S.projBranchCache     = {};
  // Dashboard + log state
  S.dashData            = null;
  S.logJob              = null;
  S.glJobRunHistory     = {};
  // Access / UI flags
  S.glAccessLevel       = null;
  S.glShowGraph         = false;
  // Loading flags — reset so no spinners are stuck
  Object.keys(S.loading).forEach(function(k){ S.loading[k] = false; });

  // ── Close any open log overlay ──
  var ov = el('log-overlay');
  if(ov) ov.remove();

  // ── Re-render current page so UI reflects cleared state ──
  if(S.currentPage === 'history' || S.currentPage === 'run' || S.currentPage === 'dashboard'){
    var w = document.querySelector('.page-wrap');
    if(w){
      if(S.currentPage === 'run')       w.innerHTML = renderGLRun();
      else if(S.currentPage === 'history') w.innerHTML = renderGLHistory();
      else if(S.currentPage === 'dashboard'){ w.innerHTML = renderDashboard(); }
    }
  }

  toast('Cache cleared — pipeline state reset, projects & session kept.', 'ok');
}

// ── Global tooltip cleanup ──
// hideAllTips() kills every tooltip type in the app at once.
// Called on scroll, navigation, Escape, and page transitions.
function hideAllTips(){
  hideLogTip();
  hideDotPopover();
  var bd = document.getElementById('gl-branch-drop');
  if(bd) bd.remove();
}

// Any click anywhere: suppress tooltips (blocks re-render mouseover re-show) then hide all
document.addEventListener('click', function(){ _suppressTips(); }, true);
// Any scroll kills all tooltips
document.addEventListener('scroll', function(){ hideAllTips(); }, true);
// Page visibility change (tab switch, window blur)
document.addEventListener('visibilitychange', function(){ if(document.hidden) hideAllTips(); });
window.addEventListener('blur', function(){ hideAllTips(); });

// Global keyboard handler
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    hideAllTips();
    var gf = el('graph-fullscreen');
    if(gf){ gf.remove(); return; }
    if(S.settingsOpen){ closeSettings(); return; }
    if(S.logJob){ closeLog(); return; }
  }
  // Sidebar arrow-key navigation — active when no modal/overlay is open
  if((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !S.settingsOpen && !S.logJob){
    var active = document.activeElement;
    var tag = active ? active.tagName : '';
    var inSidebarSearch = active && active.closest && active.closest('.sb-projs');
    var inOtherInput = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && !inSidebarSearch;
    if(!inOtherInput && sidebarGetEntries().length){
      e.preventDefault();
      sidebarNav(e.key === 'ArrowDown' ? 1 : -1);
    }
  }
  // Enter selects the focused sidebar item (only when focus is on sidebar search)
  if(e.key === 'Enter'){
    var active2 = document.activeElement;
    if(active2 && active2.closest && active2.closest('.sb-projs')){
      if(S.sidebarIdx >= 0){
        e.preventDefault();
        sidebarNavSelect();
      }
    }
  }
});
