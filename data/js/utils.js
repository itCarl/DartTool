// ============================================================================
// UTILITIES AND HELPERS
// ============================================================================

const d = document;
const s = t => t/1000;
const isEmpty = str => !str?.length;
const byId = id => d.getElementById(id);
const upt = (id, val) => { const el = byId(id); if(el?.innerHTML?.trim() != val && el) el.innerHTML = val };
const onClick = (id, cb) => { const el = byId(id); if(el) el.addEventListener('click', cb); };
const hide = (id) => { const el = byId(id); if(el) el.style.display = 'none'; };
const show = (id) => { const el = byId(id); if(el) el.style.display = (id === 'numpad' ? 'grid' : 'block'); };
const addClass = (el, cls) => el?.classList.add(cls);
const removeClass = (el, cls) => el?.classList.remove(cls);
const hasClass = (el, cls) => el?.classList.contains(cls);
const on = (el, evt, cb, capture = true) => el?.addEventListener(evt, cb, capture);
const off = (el, evt, cb, capture = true) => el?.removeEventListener(evt, cb, capture);

const isPage = (...paths) => {
  const current = window.location.pathname.replace(/\/+$/, '');
  return paths.some(path => current === path.replace(/\/+$/, ''));
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    let snackbar = byId('appSnackbar');
    if (!snackbar) {
        snackbar = document.createElement('div');
        snackbar.id = 'appSnackbar';
        snackbar.className = 'snackbar';
        document.body.appendChild(snackbar);
    }

    const iconMap = {
        success: 'check_circle',
        error: 'error',
        info: 'info'
    };
    const icon = iconMap[type] || 'info';

    snackbar.innerHTML = `<i>${icon}</i><span>${escapeHtml(message)}</span>`;

    const duration = type === 'error' ? 5000 : 3000;
    if (window.ui) window.ui(snackbar, duration);
}

function showStatus(message, type) {
    showToast(message, type === 'success' ? 'success' : type === 'error' ? 'error' : 'info');
}

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

export {
    d,
    s,
    isEmpty,
    byId,
    upt,
    onClick,
    hide,
    show,
    addClass,
    removeClass,
    hasClass,
    on,
    off,
    isPage,
    sleep,
    escapeHtml,
    showToast,
    showStatus,
    formatUptime
};
