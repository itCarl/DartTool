// ============================================================================
// WEBSOCKET CONNECTION AND HANDLERS
// ============================================================================

import { host } from './settings.js';
import { byId, hide, show, addClass, removeClass, sleep, showStatus, isPage } from './utils.js';
import { apiGet } from './api.js';

let ws;
let reconnectAttempts = 0;
const maxReconnectDelay = 30000;
let reconnectTimeoutId = null;

let deviceReady = false;
const deviceCheckInterval = 2000;
let deviceCheckTimeoutId = null;

function initWebSocket() {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
    }

    const wsUrl = host.replace(/^http/, 'ws') + '/ws';
    console.log('Trying to open a WebSocket connection...', wsUrl);

    try {
        ws = new WebSocket(wsUrl);
        ws.onopen = onOpen;
        ws.onclose = onClose;
        ws.onerror = onError;
        ws.onmessage = onMessage;
    } catch (error) {
        console.error('WebSocket initialization error:', error);
        scheduleReconnect();
    }
}

function onOpen(event) {
    console.log('Connection opened');
    reconnectAttempts = 0;

    if(isPage('/data/index.html', '/', '/index')) {
        sendMessage({ cmd: "getAllPlayer" });
        sendMessage({ cmd: "getGame" });
    }

    if(isPage('/data/settings.html', '/settings')) {
        window.loadOperationMode?.();
        window.loadSystemInfo?.();
    }

    if(isPage('/data/debug.html', '/debug')) {
        window.updateStatus?.('Verbunden', 'success');
    }
}

function onClose(event) {
    console.warn('Connection closed', event);
    console.warn('Close code:', event.code, 'Clean:', event.wasClean);
    if(isPage('/data/debug.html', '/debug')) {
        window.updateStatus?.('Verbindung getrennt - Reconnect...', 'error');
    }
    hideMainContent();

    // Only reconnect if the close was unexpected (not clean)
    if (!event.wasClean || event.code !== 1000) {
        scheduleReconnect();
    }
}

function onError(event) {
    console.error('WebSocket error:', event);
    if(isPage('/data/debug.html', '/debug')) {
        window.updateStatus?.('WebSocket-Fehler - Reconnect...', 'error');
    }
    // Don't schedule reconnect here - onClose will be called after
}

function scheduleReconnect() {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
    }

    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), maxReconnectDelay);
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);
    reconnectTimeoutId = setTimeout(initWebSocket, delay);
}

function onMessage(event) {
    let data;
    try {
        if(event.data == 'connected') return;
        data = JSON.parse(event.data);
    } catch (error) {
        console.error('JSON Parse Error:', error);
        return;
    }

    // Dispatch to registered handlers
    if (window.gameMessageHandlers) {
        window.gameMessageHandlers.forEach(handler => handler(data));
    }
}

function sendMessage(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}

function checkDeviceAvailability() {
    console.log('Checking device availability...');
    updateDeviceStatus('Daten werden abgerufen...', 'Bitte warten Sie während das Gerät initialisiert wird.');

    apiGet('PING', { timeout: 5000 })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        })
        .then(async () => {
            console.log('Device is available');
            deviceReady = true;
            initWebSocket();
            await sleep(500);
            showMainContent();
        })
        .catch((error) => {
            console.warn('Device not available, retrying...', error);
            deviceCheckTimeoutId = setTimeout(checkDeviceAvailability, deviceCheckInterval);
        });
}

function updateDeviceStatus(title, message) {
    const titleEl = byId('deviceStatusTitle');
    const msgEl = byId('deviceStatusMessage');
    if(titleEl) titleEl.textContent = title;
    if(msgEl) msgEl.textContent = message;
}

function showMainContent() {
    const overlay = byId('deviceStatusOverlay');
    const mainContent = byId('mainContent');

    if(overlay) {
        removeClass(overlay, 'visible');
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }

    if(mainContent) {
        mainContent.style.display = 'block';
    }
}

function hideMainContent() {
    const overlay = byId('deviceStatusOverlay');
    const mainContent = byId('mainContent');

    if(overlay) {
        overlay.style.display = 'flex';
        addClass(overlay, 'visible');
    }

    if(mainContent) {
        mainContent.style.display = 'none';
    }

    deviceReady = false;
    if(!deviceCheckTimeoutId) {
        checkDeviceAvailability();
    }
}

export {
    ws,
    initWebSocket,
    sendMessage,
    checkDeviceAvailability,
    updateDeviceStatus,
    showMainContent,
    hideMainContent,
    deviceReady
};
