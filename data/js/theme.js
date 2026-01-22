// ============================================================================
// THEME MANAGEMENT - Tailwind Dark Mode Toggle
// ============================================================================

/**
 * Initialize dark mode based on user preference or system setting
 * Checks localStorage first, then falls back to system preference
 */
function initDarkMode() {
    const darkMode = localStorage.getItem('darkMode');

    if (darkMode === 'enabled') {
        enableDarkMode();
    } else if (darkMode === 'disabled') {
        disableDarkMode();
    } else {
        // No preference set, use system preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            enableDarkMode();
        } else {
            disableDarkMode();
        }
    }
}

/**
 * Toggle dark mode on/off
 */
function toggleDarkMode() {
    const isDark = document.documentElement.classList.contains('dark');

    if (isDark) {
        disableDarkMode();
    } else {
        enableDarkMode();
    }
}

/**
 * Enable dark mode
 */
function enableDarkMode() {
    document.documentElement.classList.add('dark');
    localStorage.setItem('darkMode', 'enabled');
    updateDarkModeIcon(true);
}

/**
 * Disable dark mode
 */
function disableDarkMode() {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('darkMode', 'disabled');
    updateDarkModeIcon(false);
}

/**
 * Update the icon in toggle buttons
 * @param {boolean} isDark - Whether dark mode is enabled
 */
function updateDarkModeIcon(isDark) {
    document.querySelectorAll('[data-toggle-dark-mode]').forEach(button => {
        const icon = button.querySelector('i');
        if (icon) {
            // Moon icon for light mode (click to enable dark)
            // Sun icon for dark mode (click to disable dark)
            icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }
    });
}

/**
 * Setup dark mode toggle button event listeners
 */
function setupDarkModeToggles() {
    document.querySelectorAll('[data-toggle-dark-mode]').forEach(button => {
        button.addEventListener('click', toggleDarkMode);
    });
}

/**
 * Listen for system theme changes
 */
function watchSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    mediaQuery.addEventListener('change', (e) => {
        // Only auto-switch if user hasn't set a preference
        const darkMode = localStorage.getItem('darkMode');
        if (!darkMode) {
            if (e.matches) {
                enableDarkMode();
            } else {
                disableDarkMode();
            }
        }
    });
}

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initDarkMode();
        setupDarkModeToggles();
        watchSystemTheme();
    });
} else {
    // DOM already loaded
    initDarkMode();
    setupDarkModeToggles();
    watchSystemTheme();
}

// Export functions for use in other modules
export {
    initDarkMode,
    toggleDarkMode,
    enableDarkMode,
    disableDarkMode,
    setupDarkModeToggles,
    watchSystemTheme
};
