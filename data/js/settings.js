// ============================================================================
// SETTINGS, DATA SYNC, AND MODE MANAGEMENT
// ============================================================================

import { byId, on, showStatus, formatUptime, isPage } from './utils.js';
import { sendMessage } from './network.js';
import { apiFetchJson, apiPostJson, apiPost } from './api.js';

const host = 'http://192.168.178.53';
let dartThrowQueue = [];
let dataSyncEnabled = false;
let operationMode = 'display';
let externalHost = '';

async function loadSettings() {
    try {
        const data = await apiFetchJson('SETTINGS');

        const ssidEl = byId('ssid');
        const passwordEl = byId('password');
        const hostnameEl = byId('hostname');
        const versionEl = byId('version');
        const buildTimeEl = byId('buildTime');

        if (ssidEl) ssidEl.value = data.ssid || '';
        if (passwordEl) passwordEl.value = data.password || '';
        if (hostnameEl) hostnameEl.value = data.hostname || '';
        if (versionEl) versionEl.textContent = data.version || 'N/A';
        if (buildTimeEl) buildTimeEl.textContent = data.buildTime || 'N/A';

    } catch (error) {
        console.error('Error loading settings:', error);
        showStatus('Fehler beim Laden der Einstellungen', 'error');
    }
}

async function saveSettings(e) {
    e.preventDefault();

    const ssid = byId('ssid')?.value;
    const password = byId('password')?.value;
    const hostname = byId('hostname')?.value;

    if (!ssid?.trim()) {
        showStatus('SSID ist erforderlich', 'error');
        return;
    }

    try {
        const data = await apiPostJson('SETTINGS', {
            ssid: ssid,
            password: password,
            hostname: hostname
        });

        if (data.success) {
            showStatus('Einstellungen erfolgreich gespeichert. Das Gerät wird neu verbunden...', 'success');
            setTimeout(loadSettings, 2000);
        } else {
            showStatus('Fehler beim Speichern: ' + (data.message || 'Unbekannter Fehler'), 'error');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Fehler beim Speichern der Einstellungen: ' + error.message, 'error');
    }
}

function loadSystemInfo() {
    sendMessage({
        cmd: 'getSystemInfo'
    });
}

async function rebootDevice() {
    if (confirm('Gerät wirklich neu starten?')) {
        try {
            const response = await apiPost('REBOOT');

            if (response.ok) {
                showStatus('Gerät wird neu gestartet...', 'success');
                setTimeout(() => {
                    location.reload();
                }, 3000);
            }
        } catch (error) {
            console.error('Error rebooting device:', error);
            showStatus('Fehler beim Neustart des Geräts', 'error');
        }
    }
}

async function loadDataSyncSettings() {
    try {
        const data = await apiFetchJson('DATASYNC_CONFIG');

        const endpointEl = byId('syncEndpoint');
        const toggleEl = byId('dataSyncToggle');

        if (endpointEl) endpointEl.value = data.endpoint || '';
        if (toggleEl) toggleEl.checked = !!data.enabled;

        updateDataSyncUI();
        updateQueueStatus();
    } catch (error) {
        console.error('Error loading data sync settings:', error);
    }
}

function updateDataSyncUI() {
    const toggle = byId('dataSyncToggle')?.checked;
    const statusDiv = byId('dataSyncStatus');
    const syncNowBtn = byId('syncNowBtn');

    if (toggle) {
        if (statusDiv) statusDiv.style.display = 'block';
        if (syncNowBtn) syncNowBtn.style.display = 'block';
    } else {
        if (statusDiv) statusDiv.style.display = 'none';
        if (syncNowBtn) syncNowBtn.style.display = 'none';
    }
}

async function saveDataSyncSettings() {
    const endpoint = byId('syncEndpoint')?.value;
    const enabled = byId('dataSyncToggle')?.checked;

    if (enabled && !endpoint?.trim()) {
        showStatus('Sync Endpoint ist erforderlich wenn aktiviert', 'error');
        return;
    }

    try {
        const data = await apiPostJson('DATASYNC_CONFIG', {
            url: endpoint,
            enabled: enabled
        });

        if (data.success) {
            dataSyncEnabled = enabled;
            showStatus('Data Sync Einstellungen gespeichert', 'success');
        } else {
            showStatus('Fehler beim Speichern: ' + (data.message || 'Unbekannter Fehler'), 'error');
        }
    } catch (error) {
        console.error('Error saving data sync settings:', error);
        showStatus('Fehler beim Speichern der Einstellungen: ' + error.message, 'error');
    }
}

async function syncNow() {
    try {
        const data = await apiPostJson('DATASYNC_SYNC');

        if (data.success) {
            showStatus(`${data.count} Datsätze synchronisiert`, 'success');
            updateQueueStatus();
        } else {
            showStatus('Fehler bei der Synchronisation: ' + (data.message || 'Unbekannter Fehler'), 'error');
        }
    } catch (error) {
        console.error('Error syncing:', error);
        showStatus('Fehler bei der Synchronisation: ' + error.message, 'error');
    }
}

async function updateQueueStatus() {
    try {
        const data = await apiFetchJson('DATASYNC_QUEUE');
        dartThrowQueue = data.queue || [];

        const queueInfo = byId('queueInfo');
        if (queueInfo) {
            if (dartThrowQueue.length === 0) {
                queueInfo.textContent = 'Warteschlange ist leer';
            } else {
                queueInfo.textContent = `${dartThrowQueue.length} Einträge in der Warteschlange`;
            }
        }
    } catch (error) {
        console.error('Error updating queue status:', error);
    }
}

function loadOperationMode() {
    sendMessage({
        cmd: 'getModeConfig'
    });
}

function updateModeUI() {
    const displayModeSettings = byId('displayModeSettings');
    const dataSyncSection = byId('dataSyncSection');
    const modeDisplay = byId('modeDisplay')?.checked;

    if (modeDisplay) {
        if (displayModeSettings) displayModeSettings.style.display = 'block';
        if (dataSyncSection) dataSyncSection.style.display = 'none';
        operationMode = 'display';
    } else {
        if (displayModeSettings) displayModeSettings.style.display = 'none';
        if (dataSyncSection) dataSyncSection.style.display = 'block';
        operationMode = 'scoreboard';
    }
}

function saveOperationMode() {
    const mode = byId('modeDisplay')?.checked ? 'display' : 'scoreboard';
    const gameEndpoint = byId('gameEndpoint')?.value;
    const refreshInterval = parseInt(byId('refreshInterval')?.value) || 5;

    if (mode === 'display' && !gameEndpoint?.trim()) {
        showStatus('Game Endpoint ist erforderlich im Display Modus', 'error');
        return;
    }

    sendMessage({
        cmd: 'setModeConfig',
        mode: mode,
        serverApiUrl: gameEndpoint,
        refreshInterval: refreshInterval
    });
}

async function loadExternalHostSettings() {
    try {
        const data = await apiFetchJson('EXTERNAL_CONFIG');
        externalHost = data.host || '';
        const externalHostEl = byId('externalHost');
        if (externalHostEl) externalHostEl.value = externalHost;

        const tokenEl = byId('externalToken');
        if (tokenEl) {
            tokenEl.value = '';
            if (data.hasToken) {
                tokenEl.placeholder = '•••••• (gespeichert)';
            }
        }

    } catch (error) {
        console.error('Error loading external host settings:', error);
    }
}

async function saveExternalHostSettings() {
    const host_value = byId('externalHost')?.value?.trim();
    const token_value = byId('externalToken')?.value?.trim();

    if (!host_value) {
        showStatus('Externer Host ist erforderlich', 'error');
        return;
    }

    try {
        const data = await apiPostJson('EXTERNAL_CONFIG',
            Object.assign({ host: host_value }, (token_value ? { token: token_value } : {}))
        );

        if (data.success) {
            externalHost = host_value;
            showStatus('Externer Host gespeichert', 'success');
        } else {
            showStatus('Fehler beim Speichern: ' + (data.message || 'Unbekannter Fehler'), 'error');
        }
    } catch (error) {
        console.error('Error saving external host settings:', error);
        showStatus('Fehler beim Speichern des Hosts: ' + error.message, 'error');
    }
}

function initSettingsPage() {
    loadSettings();
    loadDataSyncSettings();
    loadExternalHostSettings();

    const saveExternalHostBtn = byId('saveExternalHostBtn');
    if (saveExternalHostBtn) {
        on(saveExternalHostBtn, 'click', saveExternalHostSettings);
    }

    const form = byId('wifiSettingsForm');
    if (form) {
        on(form, 'submit', saveSettings);
    }

    const modeScoreboardRadio = byId('modeScoreboard');
    const modeDisplayRadio = byId('modeDisplay');
    if (modeScoreboardRadio) on(modeScoreboardRadio, 'change', updateModeUI);
    if (modeDisplayRadio) on(modeDisplayRadio, 'change', updateModeUI);

    const saveModeSettingsBtn = byId('saveModeSettingsBtn');
    if (saveModeSettingsBtn) {
        on(saveModeSettingsBtn, 'click', saveOperationMode);
    }

    const dataSyncToggle = byId('dataSyncToggle');
    if (dataSyncToggle) {
        on(dataSyncToggle, 'change', updateDataSyncUI);
    }

    const saveSyncSettingsBtn = byId('saveSyncSettingsBtn');
    if (saveSyncSettingsBtn) {
        on(saveSyncSettingsBtn, 'click', saveDataSyncSettings);
    }

    const syncNowBtn = byId('syncNowBtn');
    if (syncNowBtn) {
        on(syncNowBtn, 'click', syncNow);
    }

    const rebootBtn = byId('rebootBtn');
    if (rebootBtn) {
        on(rebootBtn, 'click', rebootDevice);
    }

    setInterval(loadSystemInfo, 5000);
}

export {
    host,
    dartThrowQueue,
    dataSyncEnabled,
    operationMode,
    externalHost,
    loadSettings,
    saveSettings,
    loadSystemInfo,
    rebootDevice,
    loadDataSyncSettings,
    updateDataSyncUI,
    saveDataSyncSettings,
    syncNow,
    updateQueueStatus,
    loadOperationMode,
    updateModeUI,
    saveOperationMode,
    loadExternalHostSettings,
    saveExternalHostSettings,
    initSettingsPage
};

// Make syncNow globally available
window.syncNow = syncNow;
window.loadOperationMode = loadOperationMode;
window.loadSystemInfo = loadSystemInfo;
