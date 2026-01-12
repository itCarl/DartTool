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
const upt = (id, val) => { const el = byId(id); if(el?.innerHTML?.trim() != val && el) el.innerHTML = val };
const onClick = (id, cb) => { const el = byId(id); if(el) el.addEventListener('click', cb); };
const hide = (id) => { const el = byId(id); if(el) el.style.display = 'none'; };
const show = (id) => { const el = byId(id); if(el) el.style.display = (id === 'numpad' ? 'grid' : 'block'); };
const addClass = (el, cls) => el?.classList.add(cls);
const removeClass = (el, cls) => el?.classList.remove(cls);
const hasClass = (el, cls) => el?.classList.contains(cls);
const on = (el, evt, cb, capture = true) => el?.addEventListener(evt, cb, capture);
const off = (el, evt, cb, capture = true) => el?.removeEventListener(evt, cb, capture);
const isPage = (...paths) => {
  const current = window.location.pathname.replace(/\/+$/, '');
  return paths.some(path => current === path.replace(/\/+$/, ''));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Settings-related globals
const host = 'http://192.168.178.53';
let dartThrowQueue = [];
let dataSyncEnabled = false;
let operationMode = 'display';

// Game-related globals
var selectedPlayerId = null;
var selectedPlayerList = [];
var tempModalSelections = [];
var lastPlayerFetch = null;
var gameState = "unknown";
let latestGameSnapshot = null;
let pendingPlayerToSelect = null; // Track newly added player to auto-select

// Device status globals
let deviceReady = false;
const deviceCheckInterval = 2000; // Check every 2 seconds
let deviceCheckTimeoutId = null;

// ============================================================================
// MODAL HELPERS
// ============================================================================

on(window, 'load', onLoad);

// ============================================================================
// WEBSOCKET FUNCTIONS
// ============================================================================

let reconnectAttempts = 0;
const maxReconnectDelay = 30000; // 30 seconds max

function onLoad(event) {
    // Check device availability on all pages before showing content
    checkDeviceAvailability();
}

function checkDeviceAvailability() {
    console.log('Checking device availability...');
    updateDeviceStatus('Daten werden abgerufen...', 'Bitte warten Sie während das Gerät initialisiert wird.');

    // Try to ping the device using direct fetch
    fetch(`${host}/ping`, { method: 'GET', timeout: 5000 })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            // return response.json();
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
            // Retry after interval
            deviceCheckTimeoutId = setTimeout(checkDeviceAvailability, deviceCheckInterval);
        });
}

function updateDeviceStatus(title, message) {
    const titleEl = d.getElementById('deviceStatusTitle');
    const msgEl = d.getElementById('deviceStatusMessage');
    if(titleEl) titleEl.textContent = title;
    if(msgEl) msgEl.textContent = message;
}

function showMainContent() {
    const overlay = d.getElementById('deviceStatusOverlay');
    const mainContent = d.getElementById('mainContent');

    if(overlay) {
        removeClass(overlay, 'visible');
        // Remove display block after animation completes
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300);
    }

    if(mainContent) {
        mainContent.style.display = 'block';
    }
}

function hideMainContent() {
    const overlay = d.getElementById('deviceStatusOverlay');
    const mainContent = d.getElementById('mainContent');

    if(overlay) {
        overlay.style.display = 'flex';
        addClass(overlay, 'visible');
    }

    if(mainContent) {
        mainContent.style.display = 'none';
    }

    deviceReady = false;
    // Start checking again
    if(!deviceCheckTimeoutId) {
        checkDeviceAvailability();
    }
}

function initWebSocket() {
    // Close existing connection if any
    if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
    }

    console.log('Trying to open a WebSocket connection...');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    try {
        ws = new WebSocket(host + '/ws');
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
    reconnectAttempts = 0; // Reset reconnect counter on successful connection

    if(isPage('/data/game.html', '/game')) {
        // Request local players (backend handles external service sync)
        sendMessage({
            cmd: "getAllPlayer"
        });
        sendMessage({
            cmd: "getGame"
        });
    }

    if(isPage('/data/settings.html', '/settings')) {
        loadOperationMode();
        loadSystemInfo();
    }

    if(isPage('/data/debug.html', '/debug')) {
        updateStatus('Verbunden', 'success');
    }
}

function onClose(event) {
    console.warn('Connection closed', event);
    if(isPage('/data/debug.html', '/debug')) {
        updateStatus('Verbindung getrennt - Reconnect...', 'error');
    }
    // Show device unavailable status on all pages
    hideMainContent();
    scheduleReconnect();
}

function onError(event) {
    console.error('WebSocket error:', event);
    if(isPage('/data/debug.html', '/debug')) {
        updateStatus('WebSocket-Fehler - Reconnect...', 'error');
    }
    // Don't call scheduleReconnect here, onClose will be called after error
}

function scheduleReconnect() {
    reconnectAttempts++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), maxReconnectDelay);
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);
    setTimeout(initWebSocket, delay);
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

    // Handle start game response
    if (data.cmd === 'startGameResponse') {
        if (!data.success) {
            showStatus(data.msg || 'Cannot start game', 'error');
        }
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

    // Handle mode config responses
    if (data.cmd === 'getModeConfigResponse') {
        if (data.success) {
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
        }
        return;
    }

    if (data.cmd === 'setModeConfigResponse') {
        if (data.success) {
            showStatus('Anzeigemodus gespeichert', 'success');
        } else {
            showStatus('Fehler beim Speichern: ' + (data.msg || 'Unbekannter Fehler'), 'error');
        }
        return;
    }

    // Handle system info response
    if (data.cmd === 'getSystemInfoResponse') {
        const heapEl = byId('freeHeap');
        const uptimeEl = byId('uptime');

        if (heapEl && data.heap !== undefined) {
            heapEl.textContent = (data.heap / 1024).toFixed(2) + ' KB';
        }

        if (uptimeEl && data.uptime !== undefined) {
            uptimeEl.textContent = formatUptime(data.uptime);
        }
        return;
    }

    // Handle players list
    if(data.cmd === 'getAllPlayer') {
        let players = data.players;
        lastPlayerFetch = players;
        renderPlayersList(players);

        // Auto-select newly added player if pending
        if (pendingPlayerToSelect && players) {
            const newPlayer = players.find(p => p.name === pendingPlayerToSelect);
            if (newPlayer && !selectedPlayerList.includes(newPlayer.id)) {
                selectedPlayerList.push(newPlayer.id);
                updateSelectablePlayersUI();
                updateSelectedPlayersUI();
                sendMessage({
                    cmd: 'selectPlayers',
                    playerIds: selectedPlayerList
                });
            }
            pendingPlayerToSelect = null; // Clear after processing
        }
    }

    // Handle game status
    if(data.game) {
        var g = data.game;
        // Keep a full snapshot for export if provided, else use display data
        latestGameSnapshot = data.gameFull || g;
        var state = g?.status || 'unknown';
        const activeBtns = d.querySelectorAll('#gameStateSelector button.active');
        activeBtns?.forEach(btn => removeClass(btn, 'active'));
        const stateBtn = byId(`state${state.charAt(0).toUpperCase() + state.slice(1)}`);
        if(stateBtn) addClass(stateBtn, 'active');

        hide('spinner');

        if(state == "unknown" || state == "aborted") {
            show('viewSetup');
            show('viewPlayerManagement');
            hide('viewGame');
            hide('io');
            hide('doneActions');
            if (state == "aborted") {
                showStatus('Game aborted - Ready for new game', 'info');
            }

        } else if(state == "initialised") {
            show('viewSetup');
            show('viewPlayerManagement');
            hide('viewGame');
            hide('io');
            hide('doneActions');

            selectedPlayerList = g.players.map(p => p.id);
            renderPlayersList(lastPlayerFetch);
            updateSelectablePlayersUI();
            updateSelectedPlayersUI();

        // Running state
        } else if(state == "running") {
            hide('viewPlayerManagement');
            hide('show');
            show('io');
            show('numpad');
            hide('doneActions');

            showGameInfo();
            updateGameInfo(g);
            if (g && g.players) {
                populatePlayers(g);
            }

        } else if(state == "playerWon") {
            hide('viewPlayerManagement');
            hide('numpad');
            show('io');
            show('doneActions');

            showGameInfo();
            updateGameInfo(g);
            if (g && g.players) {
                populatePlayers(g);
            }

        } else if(state == "done") {
            console.log("Game is done");
        }
    }
}

function sendMessage(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}

// ============================================================================
// PLAYER RENDERING HELPERS
// ============================================================================

function renderPlayersList(players) {
    const list = byId('playersList');
    if (!list) return;
    const isGamePage = isPage('/data/game.html', '/game');

    list.innerHTML = '';

    if (!players || players.length === 0) {
        // Show empty state
        hide('playersList');
        show('playersEmpty');
        return;
    }

    if (isGamePage) {
        const availableIds = players.map(p => p.id);
        selectedPlayerList = selectedPlayerList.filter(id => availableIds.includes(id));
    }

    // Show players list, hide empty state
    show('playersList');
    hide('playersEmpty');
    hide('playersError');

    players.forEach((player) => {
        const article = document.createElement('article');
        article.style.setProperty('--_padding', '0.1rem');
        const isSelected = selectedPlayerList.includes(player.id);
        article.innerHTML = `
        <ul class="list no-space border">
            <li id="${player.id}" role="listitem" class="${isSelected ? 'selected-player' : ''}" aria-pressed="${isSelected}">
                <i class="fa-solid fa-user" aria-hidden="true"></i>
                <div class='max'>
                    <div>${escapeHtml(player.name)}</div>
                    <small class="id-ellipsis" title="${escapeHtml(player.id)}">ID: ${escapeHtml(player.id)}</small>
                </div>
                ${isGamePage ? `<div class="player-select-indicator" aria-hidden="true">
                    <i class="fa-solid fa-check"></i>
                </div>` : ''}
            </li>
        </ul>
        `;
        list.appendChild(article);

        if (isGamePage) {
            const row = article.querySelector('li');
            if (row) {
                row.classList.add('selectable-player');
                row.addEventListener('click', e => {
                    if (e.target.closest('.player-buttons')) return;
                    togglePlayerSelection(player.id);
                });
            }
        }
    });

    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-btn').forEach(button => {
        on(button, 'click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            const name = e.currentTarget.dataset.name;
            selectedPlayerId = id;
            byId('playerToRemoveName').textContent = name;
        });
    });

    if (isGamePage) {
        updateSelectablePlayersUI();
        updateSelectedPlayersUI();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showPlayersError() {
    hide('playersList');
    hide('playersEmpty');
    show('playersError');
}

function updateSelectedPlayersUI() {
    const list = byId('selectedPlayerList');
    if (!list) return;

    list.innerHTML = '';

    if (!selectedPlayerList.length || !lastPlayerFetch) {
        const emptyItem = document.createElement('li');
        emptyItem.innerHTML = `
            <div class="max">
                <p>no player selected.</p>
            </div>
        `;
        list.appendChild(emptyItem);
        return;
    }

    // Create a map of player IDs to player objects for quick lookup
    const playerMap = {};
    lastPlayerFetch.forEach(p => playerMap[p.id] = p);

    // Display players in the order they appear in selectedPlayerList
    selectedPlayerList.forEach((playerId, index) => {
        const player = playerMap[playerId];
        if (!player) return;

        const item = document.createElement('li');
        item.id = `selected-player-${playerId}`;
        item.draggable = true;
        item.className = 'selected-player-item';
        item.dataset.playerId = playerId;
        item.innerHTML = `
            <i class="fa-solid fa-grip-vertical drag-handle" style="cursor: move; color: #999;" aria-label="Drag to reorder"></i>
            <i class="fa-solid fa-user"></i>
            <div class='max'>${player.name}</div>
            <button class="circle transparent small remove-player-btn" data-player-id="${playerId}" aria-label="Remove ${player.name}">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        list.appendChild(item);

        // Add drag event listeners for desktop
        on(item, 'dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', playerId);
            addClass(item, 'dragging');
        });

        on(item, 'dragend', (e) => {
            removeClass(item, 'dragging');
            // Remove all drag-over classes
            document.querySelectorAll('.drag-over').forEach(el => removeClass(el, 'drag-over'));
        });

        on(item, 'dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const draggingItem = document.querySelector('.dragging');
            if (draggingItem && draggingItem !== item) {
                addClass(item, 'drag-over');
            }
        });

        on(item, 'dragleave', (e) => {
            removeClass(item, 'drag-over');
        });

        on(item, 'drop', (e) => {
            e.preventDefault();
            removeClass(item, 'drag-over');
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId && draggedId !== playerId) {
                reorderPlayers(draggedId, playerId);
            }
        });

        // Add touch event listeners for mobile
        let touchStartY = 0;
        let touchStartX = 0;
        let isDragging = false;
        let clone = null;

        const dragHandle = item.querySelector('.drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
                touchStartX = e.touches[0].clientX;
                isDragging = true;

                // Create visual feedback
                item.style.opacity = '0.5';
            }, { passive: true });
        }

        item.addEventListener('touchmove', (e) => {
            if (!isDragging) return;

            const touch = e.touches[0];
            const deltaY = touch.clientY - touchStartY;

            // Find the item under the touch point
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetItem = elementBelow?.closest('.selected-player-item');

            if (targetItem && targetItem !== item && targetItem.dataset.playerId) {
                // Visual feedback
                document.querySelectorAll('.drag-over').forEach(el => removeClass(el, 'drag-over'));
                addClass(targetItem, 'drag-over');
            }
        }, { passive: true });

        item.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;
            item.style.opacity = '1';

            const touch = e.changedTouches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetItem = elementBelow?.closest('.selected-player-item');

            // Remove visual feedback
            document.querySelectorAll('.drag-over').forEach(el => removeClass(el, 'drag-over'));

            if (targetItem && targetItem !== item && targetItem.dataset.playerId) {
                reorderPlayers(playerId, targetItem.dataset.playerId);
            }
        }, { passive: true });

        // Add remove button listener
        const removeBtn = item.querySelector('.remove-player-btn');
        if (removeBtn) {
            on(removeBtn, 'click', (e) => {
                e.stopPropagation();
                const playerIdToRemove = removeBtn.dataset.playerId;
                selectedPlayerList = selectedPlayerList.filter(id => id !== playerIdToRemove);
                updateSelectedPlayersUI();
                sendMessage({
                    cmd: 'selectPlayers',
                    playerIds: selectedPlayerList
                });
            });
        }
    });
}

function reorderPlayers(draggedId, targetId) {
    const draggedIndex = selectedPlayerList.indexOf(draggedId);
    const targetIndex = selectedPlayerList.indexOf(targetId);

    if (draggedIndex > -1 && targetIndex > -1) {
        // Remove dragged item
        const [draggedItem] = selectedPlayerList.splice(draggedIndex, 1);
        // Insert at new position
        selectedPlayerList.splice(targetIndex, 0, draggedItem);
        updateSelectedPlayersUI();
        sendPlayerOrder();
    }
}

function sendPlayerOrder() {
    sendMessage({
        cmd: 'selectPlayers',
        playerIds: selectedPlayerList
    });
}

function updateSelectablePlayersUI() {
    if (!isPage('/data/game.html', '/game')) return;
    const rows = d.querySelectorAll('#playersList li[role="listitem"]');
    rows.forEach(row => {
        const isSelected = selectedPlayerList.includes(row.id);
        if(isSelected) addClass(row, 'selected-player');
        else removeClass(row, 'selected-player');
        row.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
}

function togglePlayerSelection(playerId) {
    if (!lastPlayerFetch) return;
    const exists = lastPlayerFetch.some(p => p.id === playerId);
    if (!exists) return;

    if (selectedPlayerList.includes(playerId)) {
        selectedPlayerList = selectedPlayerList.filter(id => id !== playerId);
    } else {
        selectedPlayerList = [...selectedPlayerList, playerId];
    }

    updateSelectablePlayersUI();
    updateSelectedPlayersUI();

    sendMessage({
        cmd: 'selectPlayers',
        playerIds: selectedPlayerList
    });
}

function generateLocalId() {
    // Generate a simple ID if none provided
    return 'ext_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============================================================================
// GAME FUNCTIONS
// ============================================================================

function showGameInfo() {
    hide('viewSetup');
    show('viewGame');
}

function updateGameInfo(gameData) {
    const infoMsg = byId('infoMsg');
    if (!infoMsg || !gameData) return;

    const status = gameData.status || 'unknown';
    const currentPlayer = gameData.players?.find(p => p.id === gameData.currentPlayerId);
    const playerName = currentPlayer?.name || 'Unknown';
    const winner = (gameData.players || []).find(p => p.winPos === 1);
    const winnerName = winner?.name || playerName;
    const points = gameData.points || 301;

    let statusText = '';
    switch(status) {
        case 'initialised':
            statusText = `Game Ready - ${points} Points`;
            break;
        case 'running':
            statusText = `${playerName}'s Turn - ${points} Points Remaining`;
            break;
        case 'done':
            statusText = `Game Over - Winner: ${winnerName}`;
            break;
        case 'aborted':
            statusText = 'Game Aborted';
            break;
        default:
            statusText = 'Game Status: ' + status;
    }

    infoMsg.textContent = statusText;
}

function populatePlayers(data) {
    const list = byId('activePlayerList');
    if (!list) return;

    list.innerHTML = '';
    console.log(data);
    data.players.forEach((player, index) => {
        const item = document.createElement('article');
        item.id = player.id;
        addClass(item, 'playerCard');

        // Calculate remaining points and statistics
        const remainingPoints = player.remainingPoints !== undefined ? player.remainingPoints : 0;
        const totalThrows = player.throws !== undefined ? player.throws.reduce((partialSum, a) => partialSum + a.points, 0) : 0;
        const roundThrow = player.throws.length; // Current throw in round (0, 1, or 2)
        const isCurrentPlayer = data.currentPlayerId === player.id;

        // Get the last 3 throws (current round)
        const throws = player.throws || [];
        const lastThrows = throws.slice(-3);

        // Build throw display HTML
        let throwsHTML = '';
        for (let i = 0; i < 3; i++) {
            const throwData = lastThrows[i];
            const throwPoints = throwData ? throwData.points : 0;
            const opacity = i < roundThrow ? '1' : '0.3';
            throwsHTML += `<div style="opacity: ${opacity};">
                <span class="s4 center-align">${throwPoints}</span>
            </div>`;
        }

        item.innerHTML = `
            <div class="grid no-space" style="${isCurrentPlayer ? 'outline: 3px solid gold;' : ''}">
                <div class="s4 center-align">
                    <h4 class="currentPoints" style="padding:.25rem;"><b>${remainingPoints}</b></h4>
                    <div style="padding:.5rem;">${player.name}</div>
                </div>
                <div class="s4 center-align" style="display: flex;flex-direction:column;align-items: stretch;height: 100%;">
                    <div class="throwGroup">
                        ${throwsHTML}
                    </div>
                    <div class="s4 center-align" style="display: flex;flex-direction:column;flex:3;">
                        <h6>${totalThrows}</h6>
                    </div>
                </div>
                <div class="s4 center-align" style="display: flex;flex-direction:column;align-items: stretch;height: 100%;">
                    <div class="details" style="flex: 1;">
                        <div class="s6">
                            <i class="fa-brands fa-dart-lang"></i>
                        </div>
                        <div class="s6">
                            <span class="numOfThrows">${totalThrows}</span>
                        </div>
                    </div>
                    <div class="s4 center-align" style="flex: 1;">
                        <div>
                            &Oslash;
                            <span class="averagePoints">${player.averagePoints ?? 0}</span>
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

on(document, 'DOMContentLoaded', () => {
    // Setup navigation active state
    setupNavigation();

    // Page-specific initialization
    if(isPage('/data/game.html', '/game')) {
        initPlayersPage();
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
            addClass(link, "active");
        } else {
            removeClass(link, "active");
        }
    });
}

// ============================================================================
// PLAYERS PAGE
// ============================================================================

function initPlayersPage() {
    // Add player functionality moved to modal handler

    const confirmRemove = byId('confirmRemove');
    if (confirmRemove) {
        on(confirmRemove, 'click', () => {
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

function initAddPlayerModal() {
    const form = byId('addPlayerForm');
    if (form) {
        on(form, 'submit', (e) => {
            e.preventDefault();
            addNewPlayer();
        });
    }
}

function addNewPlayer() {
    const nameInput = byId('newPlayerName');
    const name = nameInput?.value.trim();

    if (!isEmpty(name)) {
        // Store the player name to auto-select after getAllPlayer response
        pendingPlayerToSelect = name;

        sendMessage({
            cmd: "addPlayer",
            name: name
        });

        sendMessage({
            cmd: "getAllPlayer"
        });

        // Close addPlayerModal and reopen playerSelectionModal
        if (window.ui) {
            window.ui('#addPlayerModal'); // Close add player modal
        }

        // Clear the input
        if (nameInput) nameInput.value = '';

        console.log(`Player "${name}" added successfully`);
    } else {
        console.error('Player name is required');
    }
}

// ============================================================================
// GAME PAGE
// ============================================================================

// Global game mode state
let currentGameMode = 'X01';
let currentGameModePoints = 301;

function initGamePage() {
    updateSelectedPlayersUI();
    initGameModeSelection();
    initPlayerSelectionModal();
    initAddPlayerModal();

    // Setup game mode modal button listeners
    const gameModeModal = byId('gameModeModal');
    if (gameModeModal) {
        const gameModeButtons = document.querySelectorAll('.gamemode-button');
        gameModeButtons.forEach(button => {
            on(button, 'click', (e) => {
                e.preventDefault();
                const mode = button.dataset.mode;
                const points = parseInt(button.dataset.points, 10);
                selectGameMode(mode, points);
                if (window.ui) window.ui(gameModeModal);
            });
        });
    }

    let pendingMultiplier = 1;
    let activeMultiplier = null; // Track which multiplier button is active (null, 'double', or 'triple')

    const getSelectedGameMode = () => {
        return { mode: currentGameMode, points: currentGameModePoints };
    };

    const startGame = byId('startGame');
    if (startGame) {
        on(startGame, 'click', e => {
            e.preventDefault();

            // Validate players are selected
            if (!selectedPlayerList || selectedPlayerList.length === 0) {
                showStatus('Bitte wählen Sie mindestens einen Spieler aus', 'error');
                return;
            }

            const { mode, points } = getSelectedGameMode();

            sendMessage({
                cmd: 'startGame',
                mode: mode,
                points: points,
                // playerIds: selectedPlayerList
            });
        });
    }

    // Setup numpad input handlers for dart score entry
    const numpad = byId('numpad');
    if (numpad) {
        // Build numpad dynamically
        const numpadConfig = [
            { class: 'one', value: '1' },
            { class: 'two', value: '2' },
            { class: 'three', value: '3' },
            { class: 'four', value: '4' },
            { class: 'five', value: '5' },
            { class: 'six', value: '6' },
            { class: 'seven', value: '7' },
            { class: 'eight', value: '8' },
            { class: 'nine', value: '9' },
            { class: 'ten', value: '10' },
            { class: 'eleven', value: '11' },
            { class: 'twelve', value: '12' },
            { class: 'thirteen', value: '13' },
            { class: 'fourtee', value: '14' },
            { class: 'fifteen', value: '15' },
            { class: 'sixteen', value: '16' },
            { class: 'seventeen', value: '17' },
            { class: 'eighteen', value: '18' },
            { class: 'nineteen', value: '19' },
            { class: 'twenty', value: '20' },
            { class: 'twentyfive', value: '25' },
            { class: 'zero', value: '0' },
            { class: 'double', value: 'double' },
            { class: 'triple', value: 'triple' },
            { class: 'back', value: 'undo' }
        ];

        // Create buttons
        numpadConfig.forEach(config => {
            const div = document.createElement('div');
            div.className = config.class;
            div.textContent = config.value;
            numpad.appendChild(div);
        });

        const numberDivs = numpad.querySelectorAll('div');

        // Store original values for number buttons
        const originalValues = {};
        numpadConfig.forEach(config => {
            const numericValue = parseInt(config.value, 10);
            if (!isNaN(numericValue)) {
                originalValues[config.value] = numericValue;
            }
        });

        const updateMultiplierUI = () => {
            // Update visual state of double/triple buttons
            const doubleBtn = numpad.querySelector('.double');
            const tripleBtn = numpad.querySelector('.triple');

            if (doubleBtn) {
                if (activeMultiplier === 'double') {
                    doubleBtn.style.backgroundColor = 'var(--primary)';
                    doubleBtn.style.color = 'var(--on-primary)';
                } else {
                    doubleBtn.style.backgroundColor = '';
                    doubleBtn.style.color = '';
                }
            }

            if (tripleBtn) {
                if (activeMultiplier === 'triple') {
                    tripleBtn.style.backgroundColor = 'var(--primary)';
                    tripleBtn.style.color = 'var(--on-primary)';
                } else {
                    tripleBtn.style.backgroundColor = '';
                    tripleBtn.style.color = '';
                }
            }

            // Update number button displays
            numpadConfig.forEach(config => {
                const numericValue = parseInt(config.value, 10);

                if (!isNaN(numericValue)) {
                    const button = numpad.querySelector('.' + config.class);
                    if (button) {
                        // 25 cannot have triple multiplier
                        if (numericValue === 25 && activeMultiplier === 'triple') {
                            // Don't show 25 multiplied by 3
                            button.textContent = numericValue;
                        } else if (activeMultiplier === 'double') {
                            button.textContent = numericValue * 2;
                        } else if (activeMultiplier === 'triple') {
                            button.textContent = numericValue * 3;
                        } else {
                            button.textContent = numericValue;
                        }
                    }
                }
            });
        };

        numberDivs.forEach(div => {
            on(div, 'click', () => {
                const value = div.textContent.trim();
                const displayedValue = parseInt(value, 10);

                // Calculate original value based on active multiplier
                let originalValue = displayedValue;
                if (activeMultiplier === 'double' && !isNaN(displayedValue)) {
                    originalValue = displayedValue / 2;
                } else if (activeMultiplier === 'triple' && !isNaN(displayedValue)) {
                    originalValue = displayedValue / 3;
                }

                if (value === 'back') {
                    // Handle backspace
                    sendMessage({
                        cmd: 'dartUndo'
                    });
                    activeMultiplier = null;
                    pendingMultiplier = 1;
                    updateMultiplierUI();
                } else if (value === 'double' || value === 'triple') {
                    // Handle multiplier selection - toggle or persist until number is pressed
                    if (activeMultiplier === value) {
                        // Clicking same multiplier again deactivates it
                        activeMultiplier = null;
                        pendingMultiplier = 1;
                    } else {
                        // Activate this multiplier
                        activeMultiplier = value;
                        pendingMultiplier = value === 'double' ? 2 : 3;
                    }
                    updateMultiplierUI();
                } else if (!isNaN(originalValue)) {
                    // Handle number input (0-25)
                    const score = originalValue;
                    sendMessage({
                        cmd: 'dartThrow',
                        score: score,
                        multiplier: pendingMultiplier
                    });
                    // Reset multiplier after throwing
                    activeMultiplier = null;
                    pendingMultiplier = 1;
                    updateMultiplierUI();
                }
            });
        });
    }

    // Post-game actions
    const exportJsonBtn = byId('exportJsonBtn');
    if (exportJsonBtn) on(exportJsonBtn, 'click', exportGameAsJson);

    const syncGameBtn = byId('syncGameBtn');
    if (syncGameBtn) on(syncGameBtn, 'click', syncGameNow);

    const newGameBtn = byId('newGameBtn');
    if (newGameBtn) on(newGameBtn, 'click', startNewGame);

    // In-game finish action
    const finishGameBtn = byId('finishGameBtn');
    if (finishGameBtn) {
        on(finishGameBtn, 'click', () => {
            sendMessage({
                cmd: 'setGameStatus',
                s: 'done'
            });
        });
    }

    ['unknown','initialised','running','playerWon','done','aborted','error'].forEach(e => {
        const btn = byId(`state${e.charAt(0).toUpperCase() + e.slice(1)}`);
        if (btn) {
            on(btn, 'click', item => {
                sendMessage({
                    cmd: 'setGameStatus',
                    s: e
                });
            });
        }
    });
}

function initGameModeSelection() {
    // Initialize X01 points dropdown
    const x01PointsSelect = byId('x01PointsSelect');
    if (x01PointsSelect) {
        on(x01PointsSelect, 'change', (e) => {
            const points = parseInt(e.target.value, 10);
            if (currentGameMode === 'X01') {
                currentGameModePoints = points;
                updateGameModeDisplay();
                sendMessage({
                    cmd: 'setGameMode',
                    mode: 'X01',
                    points: points
                });
            }
        });
    }

    // Set initial gamemode display
    updateGameModeDisplay();
}

function selectGameMode(mode, points = 0) {
    currentGameMode = mode;

    if (mode === 'X01') {
        currentGameModePoints = points;
    } else {
        currentGameModePoints = 0;
    }

    // Send message to device
    sendMessage({
        cmd: 'setGameMode',
        mode: mode,
        points: currentGameModePoints
    });

    updateGameModeDisplay();
}

function updateGameModeDisplay() {
    const displayEl = byId('selectedGameModeText');
    const x01Options = byId('x01Options');
    const cricketOptions = byId('cricketOptions');
    const aroundTheClockOptions = byId('aroundTheClockOptions');

    // Hide all option groups first
    if (x01Options) x01Options.style.display = 'none';
    if (cricketOptions) cricketOptions.style.display = 'none';
    if (aroundTheClockOptions) aroundTheClockOptions.style.display = 'none';

    if (currentGameMode === 'X01') {
        if (displayEl) displayEl.textContent = `${currentGameModePoints} Points`;
        if (x01Options) x01Options.style.display = 'block';

        // Update select value
        const x01Select = byId('x01PointsSelect');
        if (x01Select) x01Select.value = currentGameModePoints.toString();
    } else if (currentGameMode === 'Cricket') {
        if (displayEl) displayEl.textContent = 'Cricket';
        if (cricketOptions) cricketOptions.style.display = 'block';
    } else if (currentGameMode === 'AroundTheClock') {
        if (displayEl) displayEl.textContent = 'Around the Clock';
        if (aroundTheClockOptions) aroundTheClockOptions.style.display = 'block';
    }
}

function initPlayerSelectionModal() {
    // Add button in modal
    const addBtn = byId('addPlayersBtn');
    if (addBtn) {
        on(addBtn, 'click', (e) => {
            e.preventDefault();
            applyPlayerSelection();
            if (window.ui) window.ui('#playerSelectionModal');
        });
    }

    // Listen to modal show event to refresh player list
    const modal = byId('playerSelectionModal');
    if (modal) {
        on(modal, 'show', () => {
            populatePlayerSelectionModal();
        });
    }

    // Populate when the modal trigger button is clicked
    const openModalBtn = document.querySelector('[data-ui="#playerSelectionModal"]');
    if (openModalBtn) {
        on(openModalBtn, 'click', () => {
            populatePlayerSelectionModal();
        });
    }

    // Handle "Add New Player" button - close current modal first
    const addNewPlayerBtn = byId('addNewPlayerFromModal');
    if (addNewPlayerBtn) {
        on(addNewPlayerBtn, 'click', (e) => {
            if (window.ui) {
                window.ui('#playerSelectionModal'); // Close player selection modal
            }
        });
    }
}
function populatePlayerSelectionModal() {
    if (!lastPlayerFetch) return;

    // Filter out already-selected players
    const availablePlayers = lastPlayerFetch.filter(player => !selectedPlayerList.includes(player.id));

    // Reset temporary selections
    tempModalSelections = [];

    // Render only available players
    renderPlayersListForModal(availablePlayers);
}

function renderPlayersListForModal(players) {
    const list = byId('playersList');
    if (!list) return;

    list.innerHTML = '';

    if (!players || players.length === 0) {
        hide('playersList');
        show('playersEmpty');
        const emptyEl = byId('playersEmpty');
        if (emptyEl) {
            const msgEl = emptyEl.querySelector('.empty-message');
            if (msgEl) msgEl.textContent = 'All players are already selected for this game!';
        }
        return;
    }

    show('playersList');
    hide('playersEmpty');
    hide('playersError');

    players.forEach((player) => {
        const article = document.createElement('article');
        article.style.setProperty('--_padding', '0.1rem');
        const isSelected = tempModalSelections.includes(player.id);
        article.innerHTML = `
        <ul class="list no-space border">
            <li id="modal-${player.id}" role="listitem" class="${isSelected ? 'selected-player' : ''}" aria-pressed="${isSelected}">
                <i class="fa-solid fa-user" aria-hidden="true"></i>
                <div class='max'>
                    <div>${escapeHtml(player.name)}</div>
                    <small class="id-ellipsis" title="${escapeHtml(player.id)}">ID: ${escapeHtml(player.id)}</small>
                </div>
                <div class="player-select-indicator" aria-hidden="true">
                    <i class="fa-solid fa-check"></i>
                </div>
            </li>
        </ul>
        `;
        list.appendChild(article);

        const row = article.querySelector('li');
        if (row) {
            row.classList.add('selectable-player');
            row.addEventListener('click', e => {
                if (e.target.closest('.player-buttons')) return;
                toggleModalPlayerSelection(player.id);
            });
        }
    });
}

function toggleModalPlayerSelection(playerId) {
    if (tempModalSelections.includes(playerId)) {
        tempModalSelections = tempModalSelections.filter(id => id !== playerId);
    } else {
        tempModalSelections = [...tempModalSelections, playerId];
    }

    // Update UI for this player
    const row = byId(`modal-${playerId}`);
    if (row) {
        const isSelected = tempModalSelections.includes(playerId);
        if (isSelected) {
            addClass(row, 'selected-player');
        } else {
            removeClass(row, 'selected-player');
        }
        row.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    }
}

function applyPlayerSelection() {
    // Add temporary selections to the actual selected players list
    selectedPlayerList = [...selectedPlayerList, ...tempModalSelections];

    // Clear temp selections
    tempModalSelections = [];

    updateSelectedPlayersUI();

    sendMessage({
        cmd: 'selectPlayers',
        playerIds: selectedPlayerList
    });
}


function exportGameAsJson() {
    try {
        const data = latestGameSnapshot || {};
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const gameId = data.id || (data.game_id) || 'dart-game';
        a.href = url;
        a.download = `${gameId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showStatus('Game exported as JSON', 'success');
    } catch (e) {
        console.error('Export failed:', e);
        showStatus('Export failed', 'error');
    }
}

function syncGameNow() {
    // Reuse existing sync mechanism; backend handles details
    syncNow();
}

function startNewGame() {
    // Reset to setup state and allow starting a new game
    sendMessage({ cmd: 'setGameStatus', s: 'initialised' });
    show('viewSetup');
    show('viewPlayerManagement');
    show('io');
    hide('doneActions');
    show('numpad');
}

// ============================================================================
// SETTINGS PAGE
// ============================================================================

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

function loadSystemInfo() {
    sendMessage({
        cmd: 'getSystemInfo'
    });
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

function showToast(message, type = 'info') {
    // Create or get the snackbar element
    let snackbar = byId('appSnackbar');
    if (!snackbar) {
        snackbar = document.createElement('div');
        snackbar.id = 'appSnackbar';
        snackbar.className = 'snackbar';
        document.body.appendChild(snackbar);
    }

    // Update the snackbar content and style
    const iconMap = {
        success: 'check_circle',
        error: 'error',
        info: 'info'
    };
    const icon = iconMap[type] || 'info';

    snackbar.innerHTML = `<i>${icon}</i><span>${escapeHtml(message)}</span>`;

    // Use BeerCSS ui() to show the snackbar
    const duration = type === 'error' ? 5000 : 3000;
    if (window.ui) window.ui(snackbar, duration);
}

function showStatus(message, type) {
    // Alias for backward compatibility
    showToast(message, type === 'success' ? 'success' : type === 'error' ? 'error' : 'info');
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

async function loadDataSyncSettings() {
    try {
        const response = await fetch(`${host}/api/datasync/config`);
        if (!response.ok) {
            return;
        }

        const data = await response.json();

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

        const tokenEl = byId('externalToken');
        // Do not prefill token for security; show placeholder if token exists
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
        const response = await fetch(`${host}/api/external/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(Object.assign({ host: host_value }, (token_value ? { token: token_value } : {})))
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
