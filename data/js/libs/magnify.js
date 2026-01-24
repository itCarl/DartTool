/**
 * Magnify - ESM module for precise canvas point selection
 * Mobile-first, optimized for dartboard hit recording
 */

export class Magnify {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.options = {
            zoom: options.zoom || 3,
            size: options.size || 150,
            shape: options.shape || 'circle', // 'circle' or 'square'
            crosshairColor: options.crosshairColor || '#ff0000',
            borderColor: options.borderColor || '#333',
            borderWidth: options.borderWidth || 2,
            ...options
        };

        this.magnifier = null;
        this.magnifierCtx = null;
        this.isVisible = false;
        this.currentPos = { x: 0, y: 0 };
        this.canvasPos = { x: 0, y: 0 };
        this.lastInteractionWasTouch = false;

        this.boundTouchStart = this.handleTouchStart.bind(this);
        this.boundTouchMove = this.handleTouchMove.bind(this);
        this.boundTouchEnd = this.handleTouchEnd.bind(this);
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseLeave = this.handleMouseLeave.bind(this);
        this.boundClick = this.handleClick.bind(this);

        this.onSelect = options.onSelect || null;

        this.init();
    }

    init() {
        // Create magnifier canvas with high DPI support
        const dpr = window.devicePixelRatio || 1;
        this.magnifier = document.createElement('canvas');

        // Set display size
        const displaySize = this.options.size;
        this.magnifier.style.width = `${displaySize}px`;
        this.magnifier.style.height = `${displaySize}px`;

        // Set actual canvas size for crisp rendering
        this.magnifier.width = displaySize * dpr;
        this.magnifier.height = displaySize * dpr;

        this.magnifier.style.cssText = `
            position: fixed;
            display: none;
            pointer-events: none;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            touch-action: none;
            width: ${displaySize}px;
            height: ${displaySize}px;
        `;

        if (this.options.shape === 'circle') {
            this.magnifier.style.borderRadius = '50%';
        }

        document.body.appendChild(this.magnifier);
        this.magnifierCtx = this.magnifier.getContext('2d');

        // Disable image smoothing for crisp pixels
        this.magnifierCtx.imageSmoothingEnabled = true;
        this.magnifierCtx.webkitImageSmoothingEnabled = true;
        this.magnifierCtx.mozImageSmoothingEnabled = true;
        this.magnifierCtx.msImageSmoothingEnabled = true;
        this.magnifierCtx.imageSmoothingQuality = 'high';

        // Scale context for high DPI
        this.magnifierCtx.scale(dpr, dpr);

        // Update canvas position cache
        this.updateCanvasPosition();
        window.addEventListener('resize', () => this.updateCanvasPosition());
        window.addEventListener('scroll', () => this.updateCanvasPosition(), { passive: true });
    }

    updateCanvasPosition() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvasPos = {
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
            width: rect.width,
            height: rect.height
        };
    }

    show() {
        if (this.isVisible) return;

        this.isVisible = true;
        this.updateCanvasPosition();

        this.canvas.style.touchAction = 'none';

        // Support both touch and mouse - let the user's interaction decide
        this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.boundTouchEnd, { passive: false });
        this.canvas.addEventListener('mousemove', this.boundMouseMove);
        this.canvas.addEventListener('mouseleave', this.boundMouseLeave);
        this.canvas.addEventListener('click', this.boundClick);
    }

    hide() {
        if (!this.isVisible) return;

        this.isVisible = false;
        this.magnifier.style.display = 'none';
        this.canvas.style.touchAction = '';

        this.canvas.removeEventListener('touchstart', this.boundTouchStart);
        this.canvas.removeEventListener('touchmove', this.boundTouchMove);
        this.canvas.removeEventListener('touchend', this.boundTouchEnd);
        this.canvas.removeEventListener('mousemove', this.boundMouseMove);
        this.canvas.removeEventListener('mouseleave', this.boundMouseLeave);
        this.canvas.removeEventListener('click', this.boundClick);
    }

    handleTouchStart(e) {
        // Don't preventDefault or stopPropagation - let dartboard handle the event
        this.lastInteractionWasTouch = true;
        const touch = e.touches[0];
        this.updatePosition(touch.clientX, touch.clientY, true);
    }

    handleTouchMove(e) {
        // Don't preventDefault or stopPropagation - let dartboard handle the event
        this.lastInteractionWasTouch = true;
        const touch = e.touches[0];
        this.updatePosition(touch.clientX, touch.clientY, true);
    }

    handleTouchEnd(e) {
        // Don't prevent default or stop propagation - let dartboard events fire

        if (this.onSelect && this.currentPos.x !== 0 && this.currentPos.y !== 0) {
            this.onSelect({
                x: this.currentPos.x,
                y: this.currentPos.y,
                event: e
            });
        }

        this.magnifier.style.display = 'none';
    }

    handleMouseMove(e) {
        // Ignore mouse events if touch was used
        if (this.lastInteractionWasTouch) return;
        // Don't stop propagation for mousemove - it's not a selection event
        this.updatePosition(e.clientX, e.clientY, false);
    }

    handleMouseLeave() {
        this.magnifier.style.display = 'none';
    }

    handleClick(e) {
        // Don't prevent default or stop propagation - let dartboard events fire

        if (this.onSelect) {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;

            const canvasX = (e.clientX - rect.left) * scaleX;
            const canvasY = (e.clientY - rect.top) * scaleY;

            this.onSelect({
                x: canvasX,
                y: canvasY,
                event: e
            });
        }
    }

    updatePosition(clientX, clientY, isTouch = false) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // Canvas coordinates (actual pixel coordinates)
        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;

        // Check if position is within dartboard bounds
        if (!this.isWithinDartboardBounds(canvasX, canvasY)) {
            this.magnifier.style.display = 'none';
            return;
        }

        this.currentPos = { x: canvasX, y: canvasY };

        // Position magnifier based on actual interaction type
        let magnifierX, magnifierY;

        if (isTouch) {
            // Center magnifier above finger on touch
            magnifierX = clientX - this.options.size / 2;
            magnifierY = clientY - this.options.size - 40; // Above finger

            // If magnifier would be off top of screen, show below finger
            if (magnifierY < 10) {
                magnifierY = clientY + 40;
            }
        } else {
            // Desktop: offset from cursor
            const offset = 30;
            magnifierX = clientX + offset;
            magnifierY = clientY + offset;
        }

        // Keep magnifier on screen
        const maxX = window.innerWidth - this.options.size - 10;
        const maxY = window.innerHeight - this.options.size - 10;

        magnifierX = Math.max(10, Math.min(magnifierX, maxX));
        magnifierY = Math.max(10, Math.min(magnifierY, maxY));

        this.magnifier.style.left = `${magnifierX}px`;
        this.magnifier.style.top = `${magnifierY}px`;
        this.magnifier.style.display = 'block';

        this.updateMagnifier();
    }

    updateMagnifier() {
        const { zoom, size, shape, crosshairColor, borderColor, borderWidth } = this.options;
        const { x, y } = this.currentPos;

        const mCtx = this.magnifierCtx;
        const halfSize = size / 2;
        // const sourceSize = (size / zoom) * 1.5; // Sample 50% more area
        const sourceSize = size / zoom;
        const halfSourceSize = sourceSize / 2;

        // Clear with proper alpha handling
        mCtx.save();
        mCtx.setTransform(1, 0, 0, 1, 0, 0);
        mCtx.clearRect(0, 0, this.magnifier.width, this.magnifier.height);
        mCtx.restore();

        // Clip to shape
        mCtx.save();
        if (shape === 'circle') {
            mCtx.beginPath();
            mCtx.arc(halfSize, halfSize, halfSize - borderWidth, 0, Math.PI * 2);
            mCtx.clip();
        }

        // Disable smoothing for crisp rendering
        mCtx.imageSmoothingEnabled = true;

        // Draw magnified portion
        mCtx.drawImage(
            this.canvas,
            x - halfSourceSize,
            y - halfSourceSize,
            sourceSize,
            sourceSize,
            0,
            0,
            size,
            size
        );

        mCtx.restore();

        // Draw crosshair at center
        mCtx.strokeStyle = crosshairColor;
        mCtx.lineWidth = 1.5;
        mCtx.setLineDash([]);

        // Vertical line
        mCtx.beginPath();
        mCtx.moveTo(halfSize, halfSize - 10);
        mCtx.lineTo(halfSize, halfSize + 10);
        mCtx.stroke();

        // Horizontal line
        mCtx.beginPath();
        mCtx.moveTo(halfSize - 10, halfSize);
        mCtx.lineTo(halfSize + 10, halfSize);
        mCtx.stroke();

        // Center dot
        mCtx.fillStyle = crosshairColor;
        mCtx.beginPath();
        mCtx.arc(halfSize, halfSize, 2, 0, Math.PI * 2);
        mCtx.fill();

        // Draw border
        mCtx.strokeStyle = borderColor;
        mCtx.lineWidth = borderWidth;
        mCtx.setLineDash([]);

        if (shape === 'circle') {
            mCtx.beginPath();
            mCtx.arc(halfSize, halfSize, halfSize - borderWidth / 2, 0, Math.PI * 2);
            mCtx.stroke();
        } else {
            mCtx.strokeRect(borderWidth / 2, borderWidth / 2, size - borderWidth, size - borderWidth);
        }
    }

    setZoom(zoom) {
        this.options.zoom = zoom;
        if (this.isVisible) {
            this.updateMagnifier();
        }
    }

    setSize(size) {
        const dpr = window.devicePixelRatio || 1;
        this.options.size = size;

        // Update display size
        this.magnifier.style.width = `${size}px`;
        this.magnifier.style.height = `${size}px`;

        // Update actual canvas size
        this.magnifier.width = size * dpr;
        this.magnifier.height = size * dpr;

        // Re-get context and disable smoothing
        this.magnifierCtx = this.magnifier.getContext('2d');
        this.magnifierCtx.imageSmoothingEnabled = true;
        this.magnifierCtx.scale(dpr, dpr);

        if (this.isVisible) {
            this.updateMagnifier();
        }
    }

    setShape(shape) {
        this.options.shape = shape;
        this.magnifier.style.borderRadius = shape === 'circle' ? '50%' : '0';
        if (this.isVisible) {
            this.updateMagnifier();
        }
    }

    isWithinDartboardBounds(canvasX, canvasY) {
        // Check if coordinates are within the canvas bounds
        if (canvasX < 0 || canvasX > this.canvas.width || canvasY < 0 || canvasY > this.canvas.height) {
            return false;
        }

        // Calculate distance from center for circular dartboard check
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(this.canvas.width, this.canvas.height) / 2;

        const dx = canvasX - centerX;
        const dy = canvasY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only show magnifier if within the circular dartboard (with small tolerance)
        return distance <= radius;
    }

    destroy() {
        this.hide();
        if (this.magnifier && this.magnifier.parentNode) {
            this.magnifier.parentNode.removeChild(this.magnifier);
        }
        window.removeEventListener('resize', () => this.updateCanvasPosition());
        window.removeEventListener('scroll', () => this.updateCanvasPosition());
    }
}

export default Magnify;
