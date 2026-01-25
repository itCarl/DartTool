// ============================================================================
// THEME MANAGEMENT - Light/Dark/System Toggle
// ============================================================================

const STORAGE_KEY = 'themePreference';
let initialized = false;

const ThemeOption = {
    LIGHT: 'light',
    DARK: 'dark',
    SYSTEM: 'system'
};

function migrateLegacyPreference() {
    const legacy = localStorage.getItem('darkMode');
    if (legacy === 'enabled' || legacy === 'disabled') {
        const mapped = legacy === 'enabled' ? ThemeOption.DARK : ThemeOption.LIGHT;
        localStorage.setItem(STORAGE_KEY, mapped);
        localStorage.removeItem('darkMode');
    }
}

function getThemePreference() {
    migrateLegacyPreference();
    const pref = localStorage.getItem(STORAGE_KEY);
    if (pref === ThemeOption.LIGHT || pref === ThemeOption.DARK || pref === ThemeOption.SYSTEM) {
        return pref;
    }
    return ThemeOption.SYSTEM;
}

function resolveTheme(pref) {
    if (pref === ThemeOption.LIGHT) return ThemeOption.LIGHT;
    if (pref === ThemeOption.DARK) return ThemeOption.DARK;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? ThemeOption.DARK : ThemeOption.LIGHT;
}

function applyTheme(pref) {
    const resolved = resolveTheme(pref);
    document.documentElement.classList.toggle('dark', resolved === ThemeOption.DARK);
    updateDarkModeIcon(resolved === ThemeOption.DARK);
    syncThemeControls(pref, resolved);
}

function setThemePreference(pref) {
    const normalized = [ThemeOption.LIGHT, ThemeOption.DARK, ThemeOption.SYSTEM].includes(pref)
        ? pref
        : ThemeOption.SYSTEM;
    localStorage.setItem(STORAGE_KEY, normalized);
    applyTheme(normalized);
}

function toggleDarkMode() {
    const pref = getThemePreference();
    const resolved = resolveTheme(pref);
    const next = resolved === ThemeOption.DARK ? ThemeOption.LIGHT : ThemeOption.DARK;
    setThemePreference(next);
}

function updateDarkModeIcon(isDark) {
    document.querySelectorAll('[data-toggle-dark-mode]').forEach(button => {
        const icon = button.querySelector('i');
        if (icon) {
            icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
    });
}

function syncThemeControls(pref, resolved) {
    document.querySelectorAll('input[name="themePreference"]').forEach(input => {
        input.checked = input.value === pref;
    });

    const isDarkResolved = resolved === ThemeOption.DARK;

    const toggle = document.getElementById('themeToggle');
    const knob = document.getElementById('toggleIcon');
    const sunIcon = document.getElementById('sunIcon');
    const moonIcon = document.getElementById('moonIcon');

    if (toggle) {
        toggle.classList.toggle('bg-gray-300', !isDarkResolved);
        toggle.classList.toggle('bg-gray-600', isDarkResolved);
        toggle.setAttribute('aria-pressed', isDarkResolved ? 'true' : 'false');
    }

    if (knob) {
        knob.classList.toggle('translate-x-0', !isDarkResolved);
        knob.classList.toggle('translate-x-6', isDarkResolved);
    }

    if (sunIcon) sunIcon.classList.toggle('hidden', isDarkResolved);
    if (moonIcon) moonIcon.classList.toggle('hidden', !isDarkResolved);

    const autoBtn = document.querySelector('[data-theme-auto]');
    if (autoBtn) {
        const isSystem = pref === ThemeOption.SYSTEM;
        autoBtn.classList.toggle('bg-gray-900', isSystem);
        autoBtn.classList.toggle('text-white', isSystem);
        autoBtn.classList.toggle('border-gray-500', isSystem);
        autoBtn.setAttribute('aria-pressed', isSystem ? 'true' : 'false');
    }

    const statusEl = document.querySelector('[data-theme-status]');
    if (statusEl) {
        let label = 'System (folgt deinem Gerät)';
        if (pref === ThemeOption.LIGHT) label = 'Hell';
        if (pref === ThemeOption.DARK) label = 'Dunkel';
        const activeLabel = resolved === ThemeOption.DARK ? 'Dunkel' : 'Hell';
        statusEl.textContent = `Aktuelle Einstellung: ${label} — aktive Darstellung: ${activeLabel}`;
    }
}

function setupDarkModeToggles() {
    document.querySelectorAll('[data-toggle-dark-mode]').forEach(button => {
        if (button.dataset.themeBound) return;
        button.dataset.themeBound = 'true';
        button.addEventListener('click', toggleDarkMode);
    });
}

function setupThemeOptions() {
    document.querySelectorAll('input[name="themePreference"]').forEach(input => {
        if (input.dataset.themeBound) return;
        input.dataset.themeBound = 'true';
        input.addEventListener('change', () => setThemePreference(input.value));
    });

    const toggle = document.getElementById('themeToggle');
    if (toggle && !toggle.dataset.themeBound) {
        toggle.dataset.themeBound = 'true';
        toggle.addEventListener('click', toggleDarkMode);
    }

    const autoBtn = document.querySelector('[data-theme-auto]');
    if (autoBtn && !autoBtn.dataset.themeBound) {
        autoBtn.dataset.themeBound = 'true';
        autoBtn.addEventListener('click', () => setThemePreference(ThemeOption.SYSTEM));
    }
}

function watchSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = e => {
        const pref = getThemePreference();
        if (pref === ThemeOption.SYSTEM) {
            const resolved = e.matches ? ThemeOption.DARK : ThemeOption.LIGHT;
            document.documentElement.classList.toggle('dark', resolved === ThemeOption.DARK);
            updateDarkModeIcon(resolved === ThemeOption.DARK);
            syncThemeControls(pref, resolved);
        }
    };

    // Avoid double listeners
    if (!mediaQuery._themeBound) {
        mediaQuery.addEventListener('change', handler);
        mediaQuery._themeBound = true;
    }
}

function initTheme() {
    const pref = getThemePreference();
    applyTheme(pref);

    if (initialized) return;
    initialized = true;
    setupDarkModeToggles();
    setupThemeOptions();
    watchSystemTheme();
}

export {
    initTheme,
    setThemePreference,
    getThemePreference,
    toggleDarkMode
};
