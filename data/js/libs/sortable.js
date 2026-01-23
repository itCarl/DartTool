/**
 * Sortable - A lightweight drag and drop sorting library
 * @example
 * import Sortable from './sortable.js';
 *
 * const sortable = new Sortable('#myList', {
 *     handle: '.drag-handle',
 *     placeholder: 'bg-gray-200 border-dashed',
 *     onSort: (newOrder) => console.log('New order:', newOrder)
 * });
 */

export default class Sortable {
    constructor(selector, options = {}) {
        this.container = typeof selector === 'string'
            ? document.querySelector(selector)
            : selector;

        if (!this.container) {
            throw new Error(`Container not found: ${selector}`);
        }

        this.options = {
            handle: options.handle || null,
            placeholder: options.placeholder || 'sortable-placeholder',
            draggingClass: options.draggingClass || 'sortable-dragging',
            ghostClass: options.ghostClass || 'sortable-ghost',
            onStart: options.onStart || (() => {}),
            onMove: options.onMove || (() => {}),
            onEnd: options.onEnd || (() => {}),
            onSort: options.onSort || (() => {}),
            ...options
        };

        this.draggedItem = null;
        this.placeholder = null;
        this.isDragging = false;
        this.offsetX = 0;
        this.offsetY = 0;

        this.init();
    }

    init() {
        this.getItems().forEach(item => {
            const handle = this.options.handle
                ? item.querySelector(this.options.handle)
                : item;

            if (handle) {
                handle.style.cursor = 'move';
                handle.style.touchAction = 'none';
                handle.addEventListener('mousedown', this.onPointerDown.bind(this));
                handle.addEventListener('touchstart', this.onPointerDown.bind(this), { passive: false });
            }
        });

        document.addEventListener('mousemove', this.onPointerMove.bind(this));
        document.addEventListener('mouseup', this.onPointerEnd.bind(this));
        document.addEventListener('touchmove', this.onPointerMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.onPointerEnd.bind(this));
        document.addEventListener('touchcancel', this.onPointerEnd.bind(this));
    }

    getItems() {
        return Array.from(this.container.children);
    }

    getPointerPosition(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    onPointerDown(e) {
        // Prevent default for touch to avoid scrolling
        if (e.type === 'touchstart') {
            e.preventDefault();
        }

        // Find the list item (might be clicking on handle inside item)
        this.draggedItem = e.target.closest(this.container.children[0].tagName);

        if (!this.draggedItem) return;

        const pos = this.getPointerPosition(e);
        const rect = this.draggedItem.getBoundingClientRect();
        this.offsetX = pos.x - rect.left;
        this.offsetY = pos.y - rect.top;

        this.isDragging = true;

        // Create placeholder
        this.placeholder = this.draggedItem.cloneNode(false);
        this.placeholder.className = this.options.placeholder;
        this.placeholder.style.height = rect.height + 'px';
        this.placeholder.style.visibility = 'visible';
        this.draggedItem.parentNode.insertBefore(this.placeholder, this.draggedItem);

        // Style dragged item
        this.draggedItem.classList.add(this.options.draggingClass);
        this.draggedItem.style.position = 'fixed';
        this.draggedItem.style.width = rect.width + 'px';
        this.draggedItem.style.zIndex = '9999';
        this.draggedItem.style.pointerEvents = 'none';
        this.draggedItem.style.transition = 'none';

        this.updateDragPosition(pos.x, pos.y);
        this.options.onStart({ item: this.draggedItem, event: e });
    }

    onPointerMove(e) {
        if (!this.isDragging) return;

        e.preventDefault();
        const pos = this.getPointerPosition(e);
        this.updateDragPosition(pos.x, pos.y);

        const afterElement = this.getDragAfterElement(pos.y);
        if (afterElement == null) {
            this.container.appendChild(this.placeholder);
        } else {
            this.container.insertBefore(this.placeholder, afterElement);
        }

        this.options.onMove({ item: this.draggedItem, event: e });
    }

    onPointerEnd(e) {
        if (!this.isDragging) return;

        this.isDragging = false;

        // Reset styles
        this.draggedItem.classList.remove(this.options.draggingClass);
        this.draggedItem.style.position = '';
        this.draggedItem.style.width = '';
        this.draggedItem.style.zIndex = '';
        this.draggedItem.style.pointerEvents = '';
        this.draggedItem.style.left = '';
        this.draggedItem.style.top = '';
        this.draggedItem.style.transition = '';

        // Replace placeholder with actual item
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.insertBefore(this.draggedItem, this.placeholder);
            this.placeholder.remove();
        }

        const newOrder = this.getItems().map(item => ({
            element: item,
            id: item.id || null,
            index: Array.from(this.container.children).indexOf(item)
        }));

        this.options.onEnd({ item: this.draggedItem, event: e, newOrder });
        this.options.onSort(newOrder);

        this.placeholder = null;
        this.draggedItem = null;
    }

    updateDragPosition(x, y) {
        if (!this.draggedItem) return;
        this.draggedItem.style.left = (x - this.offsetX) + 'px';
        this.draggedItem.style.top = (y - this.offsetY) + 'px';
    }

    getDragAfterElement(y) {
        const draggableElements = this.getItems().filter(
            el => el !== this.draggedItem && el !== this.placeholder
        );

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * Get current order of items
     * @returns {Array} Array of objects with element, id, and index
     */
    toArray() {
        return this.getItems().map((item, index) => ({
            element: item,
            id: item.id || null,
            index: index
        }));
    }

    /**
     * Destroy the sortable instance
     */
    destroy() {
        this.getItems().forEach(item => {
            const handle = this.options.handle
                ? item.querySelector(this.options.handle)
                : item;

            if (handle) {
                handle.style.cursor = '';
                handle.style.touchAction = '';
                handle.removeEventListener('mousedown', this.onPointerDown);
                handle.removeEventListener('touchstart', this.onPointerDown);
            }
        });

        document.removeEventListener('mousemove', this.onPointerMove);
        document.removeEventListener('mouseup', this.onPointerEnd);
        document.removeEventListener('touchmove', this.onPointerMove);
        document.removeEventListener('touchend', this.onPointerEnd);
        document.removeEventListener('touchcancel', this.onPointerEnd);
    }
}
