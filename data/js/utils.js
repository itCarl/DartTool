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
    const container = byId('toastContainer') || (() => {
        const el = document.createElement('div');
        el.id = 'toastContainer';
        el.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(el);
        return el;
    })();

    const toast = document.createElement('div');
    toast.className = 'toast flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white min-w-64 max-w-sm';

    const colorClasses = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600'
    };
    toast.classList.add(colorClasses[type] || colorClasses.info);

    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    const icon = iconMap[type] || iconMap.info;

    toast.innerHTML = `
        <i class="fas ${icon} text-xl"></i>
        <span class="flex-1">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    const duration = type === 'error' ? 5000 : 3000;

    // Animate in
    setTimeout(() => toast.classList.add('toast-show'), 10);

    // Animate out and remove
    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
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
    formatUptime,
};
