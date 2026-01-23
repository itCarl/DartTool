/**
 * Magnify - A reusable ESM component for canvas zoom magnification
 *
 * Usage:
 *   // Quick init with auto-detection:
 *   import { initMagnify } from './magnify.js';
 *   const magnifier = initMagnify({
 *       sourceElement: document.getElementById('myContainer')
 *   });
 *
 *   // Advanced usage with class:
 *   import { Magnify } from './magnify.js';
 *   const magnifier = new Magnify({
 *       sourceElement: document.getElementById('container'),
 *       canvasFinder: (el) => el.shadowRoot?.querySelector('canvas'),
 *       zoomSize: 200,
 *       sampleSize: 100,
 *       offset: { x: 10, y: 10 }
 *   });
 *   magnifier.mount();
 */

import { on } from '../utils.js';

// Constants
const DEFAULTS = {
    zoomSize: 200,
    sampleSize: 100,
    offset: { x: 10, y: 10 },
    zIndex: 50,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
    boxShadow: '0 0 20px rgba(0,0,0,0.8), inset 0 0 10px rgba(0,0,0,0.5)',
    background: 'rgba(0,0,0,0.5)'
};

/**
 * Magnify Component
 * Provides canvas-based zoom magnification on mouse/touch movement
 */
class Magnify {
    #state = {
        sourceCanvas: null,
        zoomCanvas: null,
        zoomCtx: null,
        mounted: false
    };

    constructor(options = {}) {
        this.#validateOptions(options);
        this.#initializeConfig(options);
        this.#bindMethods();
    }

    #validateOptions(options) {
        if (!options.sourceElement) {
            throw new Error('Magnify: sourceElement is required');
        }
    }

    #initializeConfig(options) {
        this.sourceElement = options.sourceElement;
        this.canvasFinder = options.canvasFinder || this.#defaultCanvasFinder;
        this.appendTo = options.appendTo || document.body;

        // Merge user options with defaults
        this.config = {
            zoomSize: options.zoomSize ?? DEFAULTS.zoomSize,
            sampleSize: options.sampleSize ?? DEFAULTS.sampleSize,
            offset: { ...DEFAULTS.offset, ...options.offset },
            zIndex: options.zIndex ?? DEFAULTS.zIndex,
            borderWidth: options.borderWidth ?? DEFAULTS.borderWidth,
            borderColor: options.borderColor ?? DEFAULTS.borderColor,
            boxShadow: options.boxShadow ?? DEFAULTS.boxShadow,
            background: options.background ?? DEFAULTS.background
        };
    }

    #bindMethods() {
        // Arrow functions to preserve 'this' context
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerOut = this.handlePointerOut.bind(this);
    }

    #defaultCanvasFinder = (element) => {
        return element.shadowRoot?.querySelector('canvas') || element.querySelector('canvas');
    };

    #getSourceCanvas() {
        if (!this.#state.sourceCanvas) {
            this.#state.sourceCanvas = this.canvasFinder(this.sourceElement);
        }
        return this.#state.sourceCanvas;
    }

    #createZoomCanvas() {
        const canvas = document.createElement('canvas');
        const { zoomSize, borderWidth, borderColor, boxShadow, background, zIndex } = this.config;

        canvas.width = zoomSize;
        canvas.height = zoomSize;
        canvas.className = 'magnify-canvas';

        Object.assign(canvas.style, {
            position: 'fixed',
            display: 'none',
            border: `${borderWidth}px solid ${borderColor}`,
            borderRadius: '50%',
            boxShadow,
            background,
            pointerEvents: 'none',
            zIndex: String(zIndex),
            width: `${zoomSize}px`,
            height: `${zoomSize}px`
        });

        return canvas;
    }

    #getPointerCoordinates(e) {
        // Handle both mouse and touch events
        const point = e.touches?.[0] || e;
        return {
            clientX: point.clientX,
            clientY: point.clientY,
            pageX: point.pageX,
            pageY: point.pageY
        };
    }

    #isWithinBounds(x, y, canvas) {
        return x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height;
    }

    handlePointerMove(e) {
        const sourceCanvas = this.#getSourceCanvas();
        if (!sourceCanvas) return;

        const { clientX, clientY, pageX, pageY } = this.#getPointerCoordinates(e);
        const rect = sourceCanvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // For touch events, only show if within bounds
        if (e.touches && !this.#isWithinBounds(x, y, sourceCanvas)) {
            return;
        }

        this.#drawZoom(sourceCanvas, x, y);
        this.#positionZoomCanvas(pageX, pageY);
        this.#state.zoomCanvas.style.display = 'block';
    }

    handlePointerOut() {
        if (this.#state.zoomCanvas) {
            this.#state.zoomCanvas.style.display = 'none';
        }
    }

    #drawZoom(sourceCanvas, x, y) {
        const { sampleSize, zoomSize } = this.config;
        const halfSample = sampleSize / 2;

        const sourceX = Math.max(0, Math.min(x - halfSample, sourceCanvas.width - sampleSize));
        const sourceY = Math.max(0, Math.min(y - halfSample, sourceCanvas.height - sampleSize));

        this.#state.zoomCtx.drawImage(
            sourceCanvas,
            sourceX, sourceY, sampleSize, sampleSize,
            0, 0, zoomSize, zoomSize
        );
    }

    #positionZoomCanvas(pageX, pageY) {
        const { offset } = this.config;
        this.#state.zoomCanvas.style.left = `${pageX + offset.x}px`;
        this.#state.zoomCanvas.style.top = `${pageY + offset.y}px`;
    }

    #attachEventListeners() {
        const opts = { passive: true };
        on(this.sourceElement, 'mousemove', this.handlePointerMove);
        on(this.sourceElement, 'mouseout', this.handlePointerOut);
        on(this.sourceElement, 'touchmove', this.handlePointerMove, opts);
        on(this.sourceElement, 'touchend', this.handlePointerOut);
    }

    #removeEventListeners() {
        this.sourceElement.removeEventListener('mousemove', this.handlePointerMove);
        this.sourceElement.removeEventListener('mouseout', this.handlePointerOut);
        this.sourceElement.removeEventListener('touchmove', this.handlePointerMove);
        this.sourceElement.removeEventListener('touchend', this.handlePointerOut);
    }

    mount() {
        if (this.#state.mounted) {
            console.warn('Magnify: Already mounted');
            return this;
        }

        this.#state.zoomCanvas = this.#createZoomCanvas();
        this.#state.zoomCtx = this.#state.zoomCanvas.getContext('2d', { willReadFrequently: true });
        this.appendTo.appendChild(this.#state.zoomCanvas);
        this.#attachEventListeners();
        this.#state.mounted = true;

        return this;
    }

    unmount() {
        if (!this.#state.mounted) {
            console.warn('Magnify: Not mounted');
            return this;
        }

        this.#state.zoomCanvas?.remove();
        this.#removeEventListeners();

        this.#state.mounted = false;
        this.#state.zoomCanvas = null;
        this.#state.zoomCtx = null;
        this.#state.sourceCanvas = null;

        return this;
    }

    configure(options) {
        const prevConfig = { ...this.config };

        // Update configuration
        Object.assign(this.config, options);

        // Update offset if provided
        if (options.offset) {
            this.config.offset = { ...prevConfig.offset, ...options.offset };
        }

        // Rebuild canvas if mounted and size changed
        if (this.#state.mounted && this.#hasCanvasSizeChanged(prevConfig, options)) {
            this.#updateCanvasSize();
        }

        return this;
    }

    #hasCanvasSizeChanged(prev, next) {
        return next.zoomSize !== undefined && next.zoomSize !== prev.zoomSize;
    }

    #updateCanvasSize() {
        const { zoomSize } = this.config;
        const canvas = this.#state.zoomCanvas;

        canvas.width = zoomSize;
        canvas.height = zoomSize;
        canvas.style.width = `${zoomSize}px`;
        canvas.style.height = `${zoomSize}px`;
    }

    // Public getters
    get mounted() {
        return this.#state.mounted;
    }

    get zoomCanvas() {
        return this.#state.zoomCanvas;
    }
}

/**
 * Quick initialization function
 * Requires sourceElement to be provided explicitly
 */
function initMagnify(options = {}) {
    if (!options.sourceElement) {
        throw new Error('Magnify: sourceElement is required in options');
    }

    const magnifier = new Magnify(options);
    magnifier.mount();

    return magnifier;
}

export { Magnify, initMagnify };
