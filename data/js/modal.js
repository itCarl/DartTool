// ============================================================================
// MODAL UTILITIES
// ============================================================================

/**
 * Opens a modal by removing the 'hidden' class and preventing body scroll
 * @param {string|HTMLElement} modalId - Modal element or ID/selector
 */
function openModal(modalId) {
    const modal = typeof modalId === 'string'
        ? (modalId.startsWith('#') ? document.querySelector(modalId) : document.getElementById(modalId))
        : modalId;

    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    }
}

/**
 * Closes a modal by adding the 'hidden' class and restoring body scroll
 * @param {string|HTMLElement} modalId - Modal element or ID/selector
 */
function closeModal(modalId) {
    const modal = typeof modalId === 'string'
        ? (modalId.startsWith('#') ? document.querySelector(modalId) : document.getElementById(modalId))
        : modalId;

    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = ''; // Restore scroll
    }
}

/**
 * Simple modal/dialog utility for toggling UI elements
 * Toggles modals, toasts, and other UI elements
 * @param {string|HTMLElement} target - Element or selector to toggle
 * @param {number} duration - Optional duration in ms for auto-hide (toasts)
 */
window.ui = function(target, duration) {
    if (typeof target === 'string') {
        const element = target.startsWith('#') ? document.querySelector(target) : document.getElementById(target);
        if (element) {
            // Check if it's a modal (has fixed overlay structure)
            if (element.classList.contains('fixed') && element.classList.contains('inset-0')) {
                if (element.classList.contains('hidden')) {
                    openModal(element);
                } else {
                    closeModal(element);
                }
            } else {
                // Toggle visibility for non-modal elements (like toasts)
                element.classList.toggle('hidden');
                if (duration && !element.classList.contains('hidden')) {
                    setTimeout(() => element.classList.add('hidden'), duration);
                }
            }
        }
    } else if (target instanceof HTMLElement) {
        // Handle toast-like elements
        target.classList.remove('hidden');
        target.classList.add('toast-show');
        if (duration) {
            setTimeout(() => {
                target.classList.remove('toast-show');
                setTimeout(() => target.remove(), 300);
            }, duration);
        }
    }
};

/**
 * Initialize modal functionality on DOM ready
 * - Configures click-outside-to-close
 * - Sets up modal close buttons
 * - Enables ESC key to close modals
 */
function initModals() {
    // Setup modal functionality
    document.querySelectorAll('.fixed.inset-0').forEach(modal => {
        // Close when clicking on the overlay (outside modal content)
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });

        // Setup close buttons
        modal.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                closeModal(modal);
            });
        });
    });

    // Close modals on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.fixed.inset-0:not(.hidden)').forEach(modal => {
                closeModal(modal);
            });
        }
    });
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModals);
} else {
    // DOM is already loaded
    initModals();
}

export {
    openModal,
    closeModal,
    initModals
};
