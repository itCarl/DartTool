// ============================================================================
// MODAL MANAGEMENT
// ============================================================================
// Handles dialog modal opening, closing, and interactions

/**
 * Toggle dialog modal visibility
 * @param {string} selector - CSS selector for the dialog element
 * @returns {boolean} - Returns true if modal was found and toggled, false otherwise
 */
function toggleModal(selector) {
    const modal = document.querySelector(selector);
    if (!modal) {
        console.error(`Modal not found: ${selector}`);
        return false;
    }

    if (modal.open) {
        closeModal(modal);
    } else {
        openModal(modal);
    }

    return true;
}

/**
 * Open a modal
 * @param {HTMLDialogElement} modal - The dialog element to open
 */
function openModal(modal) {
    if (!modal) return;
    modal.showModal();
}

/**
 * Close a modal
 * @param {HTMLDialogElement} modal - The dialog element to close
 */
function closeModal(modal) {
    if (!modal) return;
    modal.close();
}

/**
 * Check if click event is outside the modal panel content
 * @param {HTMLDialogElement} modal - The dialog element
 * @param {MouseEvent} event - The click event
 * @returns {boolean} - True if click is on backdrop (outside modal-panel)
 */
function isClickOnBackdrop(modal, event) {
    const modalPanel = modal.querySelector('.modal-panel');
    if (!modalPanel) {
        // Fallback to checking dialog bounds if no modal-panel exists
        const rect = modal.getBoundingClientRect();
        return !(
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width
        );
    }

    // Check if click is outside the modal-panel element
    return !modalPanel.contains(event.target);
}

/**
 * Setup backdrop click handler for all dialog modals
 */
function setupModalBackdropClose() {
    document.querySelectorAll('dialog').forEach(modal => {
        modal.addEventListener('click', (event) => {
            if (isClickOnBackdrop(modal, event)) {
                closeModal(modal);
            }
        });
    });
}

/**
 * Setup close button handlers for all modals
 */
function setupModalCloseButtons() {
    document.querySelectorAll('.modal-close').forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            const modal = button.closest('dialog');
            if (modal) {
                closeModal(modal);
            }
        });
    });
}

/**
 * Setup global Escape key handler to close open modals
 */
function setupModalEscapeKey() {
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const openModal = document.querySelector('dialog[open]');
            if (openModal) {
                closeModal(openModal);
            }
        }
    });
}

/**
 * Initialize the modal system
 * Sets up all event handlers and behaviors for modals
 */
function initModals() {
    setupModalBackdropClose();
    setupModalCloseButtons();
    setupModalEscapeKey();
}

// Expose modal functions globally
window.ui = toggleModal; // Maintain backward compatibility
window.toggleModal = toggleModal;
window.openModal = openModal;
window.closeModal = closeModal;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModals);
} else {
    initModals();
}

export { toggleModal, openModal, closeModal, initModals, toggleModal as ui };
