// ============================================================================
// SETTINGS
// ============================================================================

import { byId, on, showStatus, formatUptime, isPage } from './utils.js';
import { sendMessage } from './network.js';
import { apiFetchJson, apiPostJson, apiPost } from './api.js';

const host = 'http://192.168.178.53';
let dartThrowQueue = [];

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

async function loadAPSettings() {
    try {
        const data = await apiFetchJson('AP_SETTINGS');

        const apSsidEl = byId('apSsid');
        const apPasswordEl = byId('apPassword');
        const apChannelEl = byId('apChannel');
        const apOpensEl = byId('apOpens');
        const apHiddenEl = byId('apHidden');

        if (apSsidEl) apSsidEl.value = data.apSsid || 'DartTool-AP';
        if (apPasswordEl) apPasswordEl.value = data.apPassword || '';
        if (apChannelEl) apChannelEl.value = data.apChannel || '1';
        if (apOpensEl) apOpensEl.value = data.apOpens || 'noConnectionAfterBoot';
        if (apHiddenEl) apHiddenEl.checked = data.apHidden || false;

    } catch (error) {
        console.error('Error loading AP settings:', error);
        showStatus('Fehler beim Laden der AP-Einstellungen', 'error');
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

async function saveAPSettings(e) {
    e.preventDefault();

    const apSsid = byId('apSsid')?.value;
    const apPassword = byId('apPassword')?.value;
    const apChannel = byId('apChannel')?.value;
    const apOpens = byId('apOpens')?.value;
    const apHidden = byId('apHidden')?.checked;

    if (!apSsid?.trim()) {
        showStatus('AP SSID ist erforderlich', 'error');
        return;
    }

    if (apPassword && apPassword.length < 8) {
        showStatus('AP Passwort muss mindestens 8 Zeichen lang sein', 'error');
        return;
    }

    try {
        const data = await apiPostJson('AP_SETTINGS', {
            apSsid: apSsid,
            apPassword: apPassword,
            apChannel: apChannel,
            apOpens: apOpens,
            apHidden: apHidden
        });

        if (data.success) {
            showStatus('AP-Einstellungen erfolgreich gespeichert', 'success');
            setTimeout(loadAPSettings, 2000);
        } else {
            showStatus('Fehler beim Speichern: ' + (data.message || 'Unbekannter Fehler'), 'error');
        }
    } catch (error) {
        console.error('Error saving AP settings:', error);
        showStatus('Fehler beim Speichern der AP-Einstellungen: ' + error.message, 'error');
    }
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

// ============================================================================
// INPUT TYPE SETTINGS
// ============================================================================

const INPUT_TYPE_STORAGE_KEY = 'dartToolInputType';
const DEFAULT_INPUT_TYPE = 'dartboard';

function getInputTypePreference() {
    const saved = localStorage.getItem(INPUT_TYPE_STORAGE_KEY);
    if (saved === 'dartboard' || saved === 'numpad') {
        return saved;
    }
    return DEFAULT_INPUT_TYPE;
}

function setInputTypePreference(inputType) {
    if (inputType === 'dartboard' || inputType === 'numpad') {
        localStorage.setItem(INPUT_TYPE_STORAGE_KEY, inputType);
        return true;
    }
    return false;
}

function loadInputTypeSettings() {
    try {
        const savedType = getInputTypePreference();
        const radios = document.querySelectorAll('input[name="inputType"]');
        radios.forEach(radio => {
            radio.checked = radio.value === savedType;
        });
    } catch (error) {
        console.error('Error loading input type settings:', error);
    }
}

async function saveInputTypeSettings(e) {
    e.preventDefault();

    const selectedRadio = document.querySelector('input[name="inputType"]:checked');
    if (!selectedRadio) {
        showStatus('Bitte wählen Sie einen Input-Typ aus', 'error');
        return;
    }

    const inputType = selectedRadio.value;
    try {
        if (setInputTypePreference(inputType)) {
            showStatus('Input-Einstellungen erfolgreich gespeichert', 'success');
        } else {
            showStatus('Ungültiger Input-Typ', 'error');
        }
    } catch (error) {
        console.error('Error saving input type settings:', error);
        showStatus('Fehler beim Speichern der Input-Einstellungen: ' + error.message, 'error');
    }
}



function initSettingsPage() {
    loadSettings();
    loadAPSettings();
    loadInputTypeSettings();

    const form = byId('wifiSettingsForm');
    if (form) {
        on(form, 'submit', saveSettings);
    }

    const apForm = byId('apSettingsForm');
    if (apForm) {
        on(apForm, 'submit', saveAPSettings);
    }

    const inputTypeForm = byId('inputTypeSettingsForm');
    if (inputTypeForm) {
        on(inputTypeForm, 'submit', saveInputTypeSettings);
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
    loadSettings,
    saveSettings,
    loadAPSettings,
    saveAPSettings,
    loadSystemInfo,
    rebootDevice,
    getInputTypePreference,
    setInputTypePreference,
    loadInputTypeSettings,
    saveInputTypeSettings,
    initSettingsPage
};

// Make functions globally available
window.loadSystemInfo = loadSystemInfo;
