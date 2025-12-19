// ============================================================================
// UNIFIED APPLICATION JAVASCRIPT
// ============================================================================
// Combines: script.js, nav.js, settings.js, debug.js
// ============================================================================

// ============================================================================
// GLOBAL VARIABLES AND UTILITIES
// ============================================================================

var d = document;
var ws;
const s = t => t/1000;
const isEmpty = str => !str?.length;
const byId = id => d.getElementById(id);
const upt = (id, val) => { if(byId(id)?.innerHTML?.trim() != val) byId(id).innerHTML = val };
const onClick = (id, cb) => byId(id)?.addEventListener('click', cb);
const hide = (id) => { if(byId(id)) byId(id).style.display = 'none'; };
const show = (id) => { if(byId(id)) byId(id).style.display = 'block'; };
const isPage = (...paths) => {
  const current = window.location.pathname.replace(/\/+$/, '');
  return paths.some(path => current === path.replace(/\/+$/, ''));
};

// Settings-related globals
const host = 'http://192.168.178.53';
let dartThrowQueue = [];
let dataSyncEnabled = false;
let operationMode = 'display';
let externalHost = '';

// Game-related globals
var selectedPlayerId = null;
var selectedPlayerList = [];
var lastPlayerFetch = null;
var gameState = "unknown";

window.addEventListener('load', onLoad);

// ============================================================================
// WEBSOCKET FUNCTIONS
// ============================================================================

function onLoad(event) {
    initWebSocket();
}

function initWebSocket() {
    console.log('Trying to open a WebSocket connection...');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(host + '/ws');
    ws.onopen = onOpen;
    ws.onclose = onClose;
    ws.onerror = onError;
    ws.onmessage = onMessage;
}

function onOpen(event) {
    console.log('Connection opened');

    if(isPage('/data/players.html', '/players')) {
        sendMessage({
            cmd: "getAllPlayer"
        });
    }

    if(isPage('/data/game.html', '/game')) {
        sendMessage({
            cmd: "getGameStatus"
        });
    }

    if(isPage('/data/debug.html', '/debug')) {
        updateStatus('Verbunden', 'success');
    }
}

function onClose(event) {
    console.warn('Connection closed');
    if(isPage('/data/debug.html', '/debug')) {
        updateStatus('Verbindung getrennt', 'error');
    }
    setTimeout(initWebSocket, 5000);
}

function onError(event) {
    console.log('Connection Error');
    console.log(event);
    if(isPage('/data/debug.html', '/debug')) {
        updateStatus('Fehler bei WebSocket-Verbindung', 'error');
    }
}

function onMessage(event) {
    let data;
    try {
        if(event.data == 'connected')
            return;
        data = JSON.parse(event.data);
        console.log('path: '+ window.location.pathname);
    } catch (error) {
        console.error('JSON Parse Error:', error);
        console.error('Received data:', event.data);
        return;
    }

    // Handle servo responses (Debug page)
    if (data.cmd === 'servoResponse') {
        updateStatus(`Servo Position gesetzt: ${data.pos}°`, 'success');
        updateCurrentPosition(data.pos);
        return;
    }

    // Handle laser responses (Debug page)
    if (data.cmd === 'laserResponse') {
        updateStatus(data.msg, 'success');
        updateLaserStatus(data.state);
        return;
    }

    // Handle players list
    if(data.players) {
        let players = data.players;
        lastPlayerFetch = players;

        if(isPage('/data/players.html', '/players')) {
            const list = byId('playersList');
            list.innerHTML = '';

            players.forEach((player, index) => {
                const article = document.createElement('article');
                article.innerHTML = `
                <ul class="list no-space border">
                    <li id=${player.id}>
                        <i class="fa-solid fa-user"></i>
                        <div class='max'>${player.name}</div>
                        <div class="player-buttons">
                            <button class="secondary remove-btn" data-ui="#confirmModal" data-id="${player.id}" data-name="${player.name}">Remove</button>
                        </div>
                    </li>
                </ul>
                `;
                list.appendChild(article);
            });

            document.querySelectorAll('.remove-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    const name = e.target.dataset.name;
                    selectedPlayerId = id;
                    byId('playerToRemoveName').textContent = name;
                });
            });
        }

        if(isPage('/data/game.html', '/game')) {
            const list = byId('addPlayersList');
            list.innerHTML = '';

            players.filter(player => !selectedPlayerList.includes(player.id)).forEach((player, index) => {
                const item = document.createElement('li');
                item.id = player.id;
                item.innerHTML = `
                    <label class="checkbox">
                        <input type="checkbox" name="selectedPlayers" value="${player.id}">
                        <span></span>
                    </label>
                    <i class="fa-solid fa-user"></i>
                    <div class='max'>${player.name}</div>
                `;
                list.appendChild(item);
            });
        }
    }

    // Handle game status
    if(data.game) {
        var g = data.game;
        var state = g.status;
        d.querySelectorAll('#gameStateSelector button.active')?.forEach(btn => {
            btn.classList.remove('active');
        });
        byId(`state${state.charAt(0).toUpperCase() + state.slice(1)}`)?.classList.add('active');

        if(data.cmd === "getGameStatus" || data.cmd === "setGameStatus") {
            hide('spinner');

            if(state == "unknown") {
                show('viewSetup');
            } else if(state == "created" || state == "running") {
                showGameInfo();
                populatePlayers(g);
            }
        }
    }
}

function sendMessage(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}

// ============================================================================
// GAME FUNCTIONS
// ============================================================================

function showGameInfo() {
    hide('viewSetup');
    show('viewGame');
}

function populatePlayers(data) {
    const list = byId('activePlayerList');
    if (!list) return;

    list.innerHTML = '';
    console.log(data);
    data.players.forEach((player, index) => {
        const item = document.createElement('article');
        item.id = player.id;
        item.classList.add('playerCard');
        item.innerHTML = `
            <div class="grid no-space">
                <div class="s4 center-align">
                    <h4 class="currentPoints" style="padding:.5rem;"><b>187</b></h4>
                    <div style="padding:.5rem;">${player.name}</div>
                </div>
                <div class="s4 center-align" style="display: flex;flex-direction:column;align-items: stretch;height: 100%;">
                    <div class="throwGroup">
                        <div class="s4">
                            <span class="s4 center-align">0</span>
                        </div>
                        <div class="s4">
                            <span class="s4 center-align">1</span>
                        </div>
                        <div class="s4">
                            <span class="s4 center-align">2</span>
                        </div>
                    </div>
                    <div class="s4 center-align" style="display: flex;flex-direction:column;flex:3;">
                        <h6>333</h6>
                    </div>
                </div>
                <div class="s4 center-align" style="display: flex;flex-direction:column;align-items: stretch;height: 100%;">
                    <div class="details" style="flex: 1;">
                        <div class="s6">
                            <i class="fa-brands fa-dart-lang"></i>
                        </div>
                        <div class="s6">
                            <span id="numOfThrows">0</span>
                        </div>
                    </div>
                    <div class="s4 center-align" style="flex: 1;">
                        <div>
                            &Oslash;
                            <span class="averagePoints">333</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

// ============================================================================
// NAVIGATION AND PAGE-SPECIFIC SETUP
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Setup navigation active state
    setupNavigation();

    // Page-specific initialization
    if(isPage('/data/players.html', '/players')) {
        initPlayersPage();
    }

    if(isPage('/data/game.html', '/game')) {
        initGamePage();
    }

    if(isPage('/data/settings.html', '/settings')) {
        initSettingsPage();
    }

    if(isPage('/data/debug.html', '/debug')) {
        initDebugPage();
    }
});

function setupNavigation() {
    const navLinks = document.querySelectorAll('dialog#navigation-drawer a[href]');
    navLinks.forEach(link => {
        const linkPath = new URL(link.href).pathname;
        const currentPath = window.location.pathname;

        if (linkPath === currentPath) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
}

// ============================================================================
// PLAYERS PAGE
// ============================================================================

function initPlayersPage() {
    const addPlayerForm = byId('addPlayerForm');
    if (addPlayerForm) {
        addPlayerForm.addEventListener('click', e => {
            e.preventDefault();

            const nameInput = document.getElementById('newPlayerName');
            const name = nameInput.value.trim();

            if (!isEmpty(name)) {
                sendMessage({
                    cmd: "addPlayer",
                    name: name
                });

                nameInput.value = '';
                sendMessage({
                    cmd: "getAllPlayer"
                });
            }
        });
    }

    const confirmRemove = byId('confirmRemove');
    if (confirmRemove) {
        confirmRemove.addEventListener('click', () => {
            if (selectedPlayerId) {
                sendMessage({
                    cmd: "deletePlayer",
                    id: selectedPlayerId
                });
                selectedPlayerId = null;
                sendMessage({
                    cmd: "getAllPlayer"
                });
            }
        });
    }
}

// ============================================================================
// GAME PAGE
// ============================================================================

function initGamePage() {
    const openPlayerModal = byId('openPlayerModal');
    if (openPlayerModal) {
        openPlayerModal.addEventListener('click', () => {
            sendMessage({
                cmd: "getAllPlayer"
            });
        });
    }

    const confirmSelected = byId('confirmSelected');
    if (confirmSelected) {
        confirmSelected.addEventListener('click', () => {
            const checked = document.querySelectorAll('input[type="checkbox"][name="selectedPlayers"]:checked');
            const values = Array.from(checked).map(cb => cb.value);
            selectedPlayerList = values;
            const list = byId('selectedPlayerList');
            list.innerHTML = '';

            lastPlayerFetch.filter(player => selectedPlayerList.includes(player.id)).forEach((player, index) => {
                const item = document.createElement('li');
                item.id = player.id;
                item.innerHTML = `
                    <i class="fa-solid fa-user"></i>
                    <div class='max'>${player.name}</div>
                `;
                list.appendChild(item);
            });

            sendMessage({
                cmd: 'selectPlayers',
                playerIds: selectedPlayerList
            });
        });
    }

    const startGame = byId('startGame');
    if (startGame) {
        startGame.addEventListener('click', e => {
            e.preventDefault();
            sendMessage({
                cmd: 'startGame'
            });
        });
    }

    ['unknown','created','running','done','aborted','error'].forEach(e => {
        const btn = byId(`state${e.charAt(0).toUpperCase() + e.slice(1)}`);
        if (btn) {
            btn.addEventListener('click', item => {
                sendMessage({
                    cmd: 'setGameStatus',
                    s: e
                });
            });
        }
    });
}

// ============================================================================
// SETTINGS PAGE
// ============================================================================

function initSettingsPage() {
    loadSettings();
    loadSystemInfo();
    loadDataSyncSettings();
    loadOperationMode();
    loadExternalHostSettings();

    const saveExternalHostBtn = byId('saveExternalHostBtn');
    if (saveExternalHostBtn) {
        saveExternalHostBtn.addEventListener('click', saveExternalHostSettings);
    }

    const form = byId('wifiSettingsForm');
    if (form) {
        form.addEventListener('submit', saveSettings);
    }

    const modeScoreboardRadio = byId('modeScoreboard');
    const modeDisplayRadio = byId('modeDisplay');
    if (modeScoreboardRadio) modeScoreboardRadio.addEventListener('change', updateModeUI);
    if (modeDisplayRadio) modeDisplayRadio.addEventListener('change', updateModeUI);

    const saveModeSettingsBtn = byId('saveModeSettingsBtn');
    if (saveModeSettingsBtn) {
        saveModeSettingsBtn.addEventListener('click', saveOperationMode);
    }

    const dataSyncToggle = byId('dataSyncToggle');
    if (dataSyncToggle) {
        dataSyncToggle.addEventListener('change', updateDataSyncUI);
    }

    const saveSyncSettingsBtn = byId('saveSyncSettingsBtn');
    if (saveSyncSettingsBtn) {
        saveSyncSettingsBtn.addEventListener('click', saveDataSyncSettings);
    }

    const syncNowBtn = byId('syncNowBtn');
    if (syncNowBtn) {
        syncNowBtn.addEventListener('click', syncNow);
    }

    const rebootBtn = byId('rebootBtn');
    if (rebootBtn) {
        rebootBtn.addEventListener('click', rebootDevice);
    }

    setInterval(loadSystemInfo, 5000);
}

async function loadSettings() {
    try {
        const response = await fetch(`${host}/api/settings`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

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
        const response = await fetch(`${host}/api/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ssid: ssid,
                password: password,
                hostname: hostname
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

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

async function loadSystemInfo() {
    try {
        const heapResponse = await fetch(`${host}/freeheap`);
        const uptimeResponse = await fetch(`${host}/uptime`);

        if (heapResponse.ok) {
            const heap = await heapResponse.text();
            const heapEl = byId('freeHeap');
            if (heapEl) heapEl.textContent = (parseInt(heap) / 1024).toFixed(2) + ' KB';
        }

        if (uptimeResponse.ok) {
            const uptime = parseInt(await uptimeResponse.text());
            const uptimeEl = byId('uptime');
            if (uptimeEl) uptimeEl.textContent = formatUptime(uptime);
        }
    } catch (error) {
        console.error('Error loading system info:', error);
    }
}

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

function showStatus(message, type) {
    const statusDiv = byId('statusMessage');
    const statusText = byId('statusText');

    if (!statusDiv || !statusText) return;

    statusText.textContent = message;
    statusDiv.style.display = 'block';
    statusDiv.classList.remove('success-bg', 'error-bg');

    if (type === 'success') {
        statusDiv.style.backgroundColor = '#4CAF50';
        statusDiv.style.color = 'white';
    } else if (type === 'error') {
        statusDiv.style.backgroundColor = '#f44336';
        statusDiv.style.color = 'white';
    }

    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

async function rebootDevice() {
    if (confirm('Gerät wirklich neu starten?')) {
        try {
            const response = await fetch(`${host}/api/reboot`, {
                method: 'POST'
            });

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
// DATA SYNC FUNCTIONS
// ============================================================================

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
        const response = await fetch(`${host}/api/datasync/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: endpoint,
                enabled: enabled
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

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
        const response = await fetch(`${host}/api/datasync/sync`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

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
        const response = await fetch(`${host}/api/datasync/queue`);

        if (!response.ok) {
            return;
        }

        const data = await response.json();
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

// ============================================================================
// OPERATION MODE FUNCTIONS
// ============================================================================

async function loadOperationMode() {
    try {
        const response = await fetch(`${host}/api/mode/config`);
        if (!response.ok) {
            return;
        }

        const data = await response.json();
        operationMode = data.mode || 'display';

        const modeDisplay = byId('modeDisplay');
        const modeScoreboard = byId('modeScoreboard');
        if (operationMode === 'display') {
            if (modeDisplay) modeDisplay.checked = true;
        } else {
            if (modeScoreboard) modeScoreboard.checked = true;
        }

        const gameEndpoint = byId('gameEndpoint');
        const refreshInterval = byId('refreshInterval');
        if (gameEndpoint) gameEndpoint.value = data.gameEndpoint || '';
        if (refreshInterval) refreshInterval.value = data.refreshInterval || 5;

        updateModeUI();
    } catch (error) {
        console.error('Error loading operation mode:', error);
        const modeDisplay = byId('modeDisplay');
        if (modeDisplay) modeDisplay.checked = true;
        updateModeUI();
    }
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

async function saveOperationMode() {
    const mode = operationMode;
    const gameEndpoint = byId('gameEndpoint')?.value;
    const refreshInterval = parseInt(byId('refreshInterval')?.value) || 5;

    if (mode === 'display' && !gameEndpoint?.trim()) {
        showStatus('Game Endpoint ist erforderlich im Remote-Anzeige Modus', 'error');
        return;
    }

    try {
        const response = await fetch(`${host}/api/mode/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mode: mode,
                serverApiUrl: gameEndpoint,
                refreshInterval: refreshInterval
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            showStatus('Anzeigemodus gespeichert', 'success');
        } else {
            showStatus('Fehler beim Speichern: ' + (data.message || 'Unbekannter Fehler'), 'error');
        }
    } catch (error) {
        console.error('Error saving operation mode:', error);
        showStatus('Fehler beim Speichern des Anzeigemodus: ' + error.message, 'error');
    }
}

// ============================================================================
// EXTERNAL HOST FUNCTIONS
// ============================================================================

async function loadExternalHostSettings() {
    try {
        const response = await fetch(`${host}/api/external/config`);
        if (!response.ok) {
            return;
        }

        const data = await response.json();
        externalHost = data.host || '';
        const externalHostEl = byId('externalHost');
        if (externalHostEl) externalHostEl.value = externalHost;

    } catch (error) {
        console.error('Error loading external host settings:', error);
    }
}

async function saveExternalHostSettings() {
    const host_value = byId('externalHost')?.value?.trim();

    if (!host_value) {
        showStatus('Externer Host ist erforderlich', 'error');
        return;
    }

    try {
        const response = await fetch(`${host}/api/external/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                host: host_value
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

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

// ============================================================================
// DEBUG PAGE - SERVO FUNCTIONS
// ============================================================================

// Servo command definitions
const ServoCommands = {
    SET_POSITION: {
        cmd: 'setServo',
        buildParams: (position) => ({ pos: parseInt(position) }),
        getMessage: (position) => `Sende Befehl: Position ${position}°...`
    },
    SET_BY_DISTANCE: {
        cmd: 'setServoByDistance',
        buildParams: (distance, height) => ({
            dis: parseInt(distance),
            height: parseInt(height)
        }),
        getMessage: (distance, height) => `Berechne Winkel für Höhe ${height} cm und Distanz ${distance} cm...`
    },
    SEQUENCE: {
        cmd: 'servoSequence',
        buildParams: (sequence) => ({ seq: sequence }),
        getMessage: (sequence) => `Starte Sequenz ${sequence}...`
    },
    INIT: {
        cmd: 'initServo',
        buildParams: () => ({}),
        getMessage: () => 'Initialisiere Servo...'
    }
};

// Laser command definitions
const LaserCommands = {
    ON: {
        cmd: 'laserControl',
        buildParams: () => ({ action: 'on' }),
        getMessage: () => 'Laser wird eingeschaltet...'
    },
    OFF: {
        cmd: 'laserControl',
        buildParams: () => ({ action: 'off' }),
        getMessage: () => 'Laser wird ausgeschaltet...'
    },
    TOGGLE: {
        cmd: 'laserControl',
        buildParams: () => ({ action: 'toggle' }),
        getMessage: () => 'Laser Status wird umgeschaltet...'
    }
};

function sendServoCommand(commandConfig, ...args) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        updateStatus('Nicht verbunden', 'error');
        return false;
    }

    const cmd = {
        cmd: commandConfig.cmd,
        ...commandConfig.buildParams(...args)
    };

    ws.send(JSON.stringify(cmd));
    updateStatus(commandConfig.getMessage(...args), 'info');
    return true;
}

function sendLaserCommand(commandConfig) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        updateStatus('Nicht verbunden', 'error');
        return false;
    }

    const cmd = {
        cmd: commandConfig.cmd,
        ...commandConfig.buildParams()
    };

    ws.send(JSON.stringify(cmd));
    updateStatus(commandConfig.getMessage(), 'info');
    return true;
}

function updateCurrentPosition(pos) {
    const el = byId('currentServoPos');
    if (el) el.textContent = pos + '°';
}

function updateLaserStatus(state) {
    const el = byId('laserStatus');
    if (el) el.textContent = state ? 'EIN' : 'AUS';
}

function updateStatus(message, type = 'info') {
    const display = byId('statusDisplay');
    if (!display) return;

    const timestamp = new Date().toLocaleTimeString('de-DE');

    let icon = 'info';
    let color = '';
    if (type === 'success') {
        icon = 'check_circle';
        color = 'color: #4caf50;';
    } else if (type === 'error') {
        icon = 'error';
        color = 'color: #f44336;';
    }

    display.innerHTML = `<p class="small" style="${color}"><i style="font-size: 16px; vertical-align: middle; margin-right: 8px;">${icon}</i><strong>${timestamp}</strong>: ${message}</p>` + display.innerHTML;

    const messages = display.querySelectorAll('p');
    if (messages.length > 5) {
        messages[messages.length - 1].remove();
    }
}

function initDebugPage() {
    const servoSlider = byId('servoSlider');
    const servoSliderValue = byId('servoSliderValue');
    const setServoBtn = byId('setServoBtn');
    const servoHeightValue = byId('height');
    const servoDistanceValue = byId('distance');
    const setDistanceBtn = byId('setDistance');

    if (servoSlider) {
        servoSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            if (servoSliderValue) servoSliderValue.textContent = `Wert: ${value}°`;
            updateCurrentPosition(value);
        });
    }

    if (setServoBtn) {
        setServoBtn.addEventListener('click', () => {
            const position = servoSlider?.value;
            if (position) sendServoCommand(ServoCommands.SET_POSITION, position);
        });
    }

    if (setDistanceBtn) {
        setDistanceBtn.addEventListener('click', () => {
            const distance = servoDistanceValue?.value;
            const height = servoHeightValue?.value;
            if (distance && height) sendServoCommand(ServoCommands.SET_BY_DISTANCE, distance, height);
        });
    }

    const presets = [0, 45, 90, 135, 180];
    presets.forEach(pos => {
        const btn = byId(`servo${pos}`);
        if (btn) {
            btn.addEventListener('click', () => {
                if (servoSlider) servoSlider.value = pos;
                if (servoSliderValue) servoSliderValue.textContent = `Wert: ${pos}°`;
                updateCurrentPosition(pos);
                sendServoCommand(ServoCommands.SET_POSITION, pos);
            });
        }
    });

    const testSeq1 = byId('testSeq1');
    const testSeq2 = byId('testSeq2');
    const testSeq3 = byId('testSeq3');

    if (testSeq1) testSeq1.addEventListener('click', () => sendServoCommand(ServoCommands.SEQUENCE, 1));
    if (testSeq2) testSeq2.addEventListener('click', () => sendServoCommand(ServoCommands.SEQUENCE, 2));
    if (testSeq3) testSeq3.addEventListener('click', () => sendServoCommand(ServoCommands.SEQUENCE, 3));

    const initServo = byId('initServo');
    if (initServo) {
        initServo.addEventListener('click', () => sendServoCommand(ServoCommands.INIT));
    }

    // Laser control buttons
    const laserOnBtn = byId('laserOn');
    const laserOffBtn = byId('laserOff');

    if (laserOnBtn) {
        laserOnBtn.addEventListener('click', () => sendLaserCommand(LaserCommands.ON));
    }

    if (laserOffBtn) {
        laserOffBtn.addEventListener('click', () => sendLaserCommand(LaserCommands.OFF));
    }
}
