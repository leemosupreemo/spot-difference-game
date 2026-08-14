// Standalone Cloud Auto-Sync App Logger
// Automatically streams physical iPhone logs to cloud endpoint so assistant can read them remotely via curl!

const CLOUD_LOG_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019ff40b979a2c7c';
const logs = [];
const listeners = new Set();
let syncTimeout = null;

function syncToCloud() {
  if (typeof fetch !== 'function') return;
  try {
    const formattedLogs = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`);
    fetch(CLOUD_LOG_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'iPhone Live App Diagnostics',
        data: {
          updatedAt: new Date().toISOString(),
          logCount: formattedLogs.length,
          logs: formattedLogs
        }
      })
    }).catch(() => {});
  } catch (_) {}
}

function scheduleCloudSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(syncToCloud, 500);
}

export function logApp(level, ...args) {
  const message = args.map(a => {
    if (typeof a === 'object' && a !== null) {
      try { return JSON.stringify(a); } catch (_) { return String(a); }
    }
    return String(a);
  }).join(' ');

  const timestamp = new Date().toLocaleTimeString();
  const entry = { id: Date.now() + Math.random(), timestamp, level, message };
  logs.push(entry);
  if (logs.length > 100) logs.shift();

  listeners.forEach(fn => {
    try { fn([...logs]); } catch (_) {}
  });

  scheduleCloudSync();
}

export function getAppLogs() {
  return [...logs];
}

export function clearAppLogs() {
  logs.length = 0;
  listeners.forEach(fn => {
    try { fn([]); } catch (_) {}
  });
  scheduleCloudSync();
}

export function subscribeAppLogs(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function auditDOMState(tag = 'DOMAudit') {
  if (typeof document === 'undefined') return;

  try {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const scrollH = document.body ? document.body.scrollHeight : -1;
    const orient = window.orientation ?? (screen.orientation ? screen.orientation.type : 'unknown');

    const rootEl = document.getElementById('root');
    const mainEl = document.querySelector('main');
    const viewportEl = document.querySelector('.game-viewport');
    const cardLeft = document.querySelector('.canvas-card-left');
    const cardRight = document.querySelector('.canvas-card-right');
    const canvasLeft = document.querySelector('.canvas-card-left canvas');
    const imgLeft = document.querySelector('.canvas-card-left img');
    const timerDisplay = document.querySelector('.game-viewport')?.previousElementSibling;

    const getMetrics = (el, name) => {
      if (!el) return `${name}:NOT_FOUND`;
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return `${name}:[L:${Math.round(r.left)},T:${Math.round(r.top)},W:${Math.round(r.width)},H:${Math.round(r.height)},Disp:${style.display},Vis:${style.visibility},Opac:${style.opacity},Z:${style.zIndex}]`;
    };

    const metricsStr = [
      getMetrics(rootEl, 'Root'),
      getMetrics(mainEl, 'Main'),
      getMetrics(timerDisplay, 'TimerHeader'),
      getMetrics(viewportEl, 'Viewport'),
      getMetrics(cardLeft, 'CardL'),
      getMetrics(cardRight, 'CardR'),
      getMetrics(canvasLeft, 'CanvasL'),
      getMetrics(imgLeft, 'ImgL')
    ].join(' | ');

    logApp('UI_AUDIT', `[${tag}] Win:${winW}x${winH} ScrollH:${scrollH} Orient:${orient} || ${metricsStr}`);
  } catch (err) {
    logApp('ERROR', `[auditDOMStateError] ${err?.message || err}`);
  }
}

// Initial startup log & Global Error Interceptors
if (typeof window !== 'undefined') {
  window.onerror = (msg, source, line, col, error) => {
    if (msg === 'Script error.' && (!source || source === '') && line === 0) return;
    logApp('ERROR', `[WindowError] ${msg} at ${source}:${line}:${col} - ${error?.stack || error}`);
  };

  window.onunhandledrejection = (event) => {
    logApp('ERROR', `[UnhandledRejection] ${event.reason?.stack || event.reason || event}`);
  };

  setTimeout(() => {
    logApp('INIT', `[AppInit] Screen: ${window.innerWidth}x${window.innerHeight} @ ${window.devicePixelRatio}x | UA: ${navigator.userAgent}`);
    auditDOMState('StartupAudit');
  }, 100);
}
