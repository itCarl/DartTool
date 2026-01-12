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
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
let latestGameSnapshot = null;

// Device status globals
let deviceReady = false;
const deviceCheckInterval = 2000; // Check every 2 seconds
let deviceCheckTimeoutId = null;

window.addEventListener('load', onLoad);

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
    updateDeviceStatus('Gerät wird verbunden...', 'Bitte warten Sie während das Gerät initialisiert wird.');

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
        overlay.classList.remove('visible');
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
        overlay.classList.add('visible');
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

function setNavCompact(isCompact) {
    const body = d.body;
    if (!body) return;
    body.classList.toggle('game-running', !!isCompact);
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

    // Handle external player fetch responses
    if (data.cmd === 'fetchExternalPlayers') {
        if (data.status === 'success') {
            console.log('External players fetched and cached successfully:', data.msg);
        } else {
            console.warn('Failed to fetch external players:', data.msg);
        }
        // Continue to handle players list if present
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
    }

    // Handle game status
    if(data.game) {
        var g = data.game;
        // Keep a full snapshot for export if provided, else use display data
        latestGameSnapshot = data.gameFull || g;
        var state = g?.status || 'unknown';
        d.querySelectorAll('#gameStateSelector button.active')?.forEach(btn => {
            btn.classList.remove('active');
        });
        byId(`state${state.charAt(0).toUpperCase() + state.slice(1)}`)?.classList.add('active');

        hide('spinner');

        if(state == "unknown" || state == "aborted") {
            setNavCompact(false);
            show('viewSetup');
            show('viewPlayerManagement');
            show('io');
            hide('doneActions');
            if (state == "aborted") {
                showStatus('Game aborted - Ready for new game', 'info');
            }

        } else if(state == "initialised") {
            setNavCompact(false);
            show('viewSetup');
            show('viewPlayerManagement');
            show('io');
            hide('doneActions');

            selectedPlayerList = g.players.map(p => p.id);
            renderPlayersList(lastPlayerFetch);
            updateSelectablePlayersUI();
            updateSelectedPlayersUI();

        } else if(state == "running" || state == "done") {
            setNavCompact(state === "running");
            hide('viewPlayerManagement');
            showGameInfo();
            updateGameInfo(g);
            if (g && g.players) {
                populatePlayers(g);
            }
            if (state == 'done') {
                setNavCompact(false);
                // Hide numpad and abort; show post-game actions
                hide('io');
                show('doneActions');
            } else {
                show('io');
                hide('doneActions');
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
        button.addEventListener('click', (e) => {
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
        item.innerHTML = `
            <i class="fa-solid fa-grip-vertical" style="cursor: move; color: #999;"></i>
            <i class="fa-solid fa-user"></i>
            <div class='max'>${player.name}</div>
            <div class="order-controls">
                ${index > 0 ? `<button class="tiny secondary move-up-btn" aria-label="Move up"><i class="fa-solid fa-chevron-up"></i></button>` : '<span style="width: 32px;"></span>'}
                ${index < selectedPlayerList.length - 1 ? `<button class="tiny secondary move-down-btn" aria-label="Move down"><i class="fa-solid fa-chevron-down"></i></button>` : '<span style="width: 32px;"></span>'}
            </div>
        `;
        list.appendChild(item);

        // Add drag event listeners
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.innerHTML);
            item.style.opacity = '0.5';
        });

        item.addEventListener('dragend', (e) => {
            item.style.opacity = '1';
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            item.style.backgroundColor = '#f5f5f5';
        });

        item.addEventListener('dragleave', (e) => {
            item.style.backgroundColor = '';
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.style.backgroundColor = '';
            const sourceId = e.dataTransfer.getData('text/html');
            const draggedItem = document.querySelector('[style*="opacity: 0.5"]');
            if (draggedItem && draggedItem !== item) {
                reorderPlayers(draggedItem.id.replace('selected-player-', ''), playerId);
            }
        });

        // Add button listeners for up/down controls
        const moveUpBtn = item.querySelector('.move-up-btn');
        const moveDownBtn = item.querySelector('.move-down-btn');

        if (moveUpBtn) {
            moveUpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (index > 0) {
                    // Swap with previous
                    [selectedPlayerList[index - 1], selectedPlayerList[index]] = [selectedPlayerList[index], selectedPlayerList[index - 1]];
                    updateSelectedPlayersUI();
                    sendPlayerOrder();
                }
            });
        }

        if (moveDownBtn) {
            moveDownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (index < selectedPlayerList.length - 1) {
                    // Swap with next
                    [selectedPlayerList[index], selectedPlayerList[index + 1]] = [selectedPlayerList[index + 1], selectedPlayerList[index]];
                    updateSelectedPlayersUI();
                    sendPlayerOrder();
                }
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
        row.classList.toggle('selected-player', isSelected);
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

function handleExternalPlayers(externalPlayers) {
    // Transform external player format to match our internal format
    const transformedPlayers = externalPlayers.map(p => ({
        id: p.id || p.player_id || generateLocalId(),
        name: p.name || p.player_name || 'Unknown'
    }));

    // Update lastPlayerFetch for consistency
    lastPlayerFetch = transformedPlayers;

    // Update the players list on the page
    if (isPage('/data/players.html', '/players', '/data/game.html', '/game')) {
        renderPlayersList(transformedPlayers);
    }

    // Also update for game page if needed
    if (isPage('/data/game.html', '/game')) {
        const list = byId('addPlayersList');
        if (list) {
            list.innerHTML = '';

            transformedPlayers.filter(player => !selectedPlayerList.includes(player.id)).forEach((player) => {
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

        updateSelectablePlayersUI();
        updateSelectedPlayersUI();
    }
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
        item.classList.add('playerCard');

        // Calculate remaining points and statistics
        const remainingPoints = player.remainingPoints !== undefined ? player.remainingPoints : 0;
        const totalThrows = player.throwCounter !== undefined ? player.throwCounter : 0;
        const roundThrow = totalThrows % 3; // Current throw in round (0, 1, or 2)
        const averagePoints = totalThrows > 0 ? Math.round(remainingPoints / totalThrows) : 0;
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
                            <span class="averagePoints">${averagePoints}</span>
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
        addPlayerForm.addEventListener('submit', e => {
            e.preventDefault();

            const nameInput = document.getElementById('newPlayerName');
            const name = nameInput?.value.trim();

            if (!isEmpty(name)) {
                // Send add player command
                sendMessage({
                    cmd: "addPlayer",
                    name: name
                });

                // Clear input
                nameInput.value = '';

                // Request updated player list
                sendMessage({
                    cmd: "getAllPlayer"
                });

                // Show success feedback
                console.log(`Player "${name}" added successfully`);
            } else {
                console.error('Player name is required');
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
    updateSelectedPlayersUI();

    let pendingMultiplier = 1;

    const getSelectedGameMode = () => {
        const selectedMode = document.querySelector('input[name="radio5_"]:checked');
        const rawMode = selectedMode?.value || '301';

        if (/^\d+$/.test(rawMode)) {
            return { mode: 'X01', points: parseInt(rawMode, 10) };
        }

        return { mode: rawMode, points: 0 };
    };

    const gameModeRadios = document.querySelectorAll('input[name="radio5_"]');
    if (gameModeRadios?.length) {
        gameModeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const { mode, points } = getSelectedGameMode();
                sendMessage({
                    cmd: 'setGameMode',
                    mode,
                    points
                });
            });
        });
    }

    const startGame = byId('startGame');
    if (startGame) {
        startGame.addEventListener('click', e => {
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
        const numberDivs = numpad.querySelectorAll('div');
        numberDivs.forEach(div => {
            div.addEventListener('click', () => {
                const value = div.textContent.trim();

                if (value === 'back') {
                    // Handle backspace
                    sendMessage({
                        cmd: 'dartUndo'
                    });
                    pendingMultiplier = 1;
                } else if (value === 'double' || value === 'tripple') {
                    // Handle multiplier selection for the next dart
                    pendingMultiplier = value === 'double' ? 2 : 3;
                } else if (value !== '') {
                    // Handle number input
                    const score = parseInt(value, 10);
                    sendMessage({
                        cmd: 'dartThrow',
                        score: score,
                        multiplier: pendingMultiplier
                    });
                    pendingMultiplier = 1;
                }
            });
        });
    }

    // Post-game actions
    const exportJsonBtn = byId('exportJsonBtn');
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportGameAsJson);

    const syncGameBtn = byId('syncGameBtn');
    if (syncGameBtn) syncGameBtn.addEventListener('click', syncGameNow);

    const newGameBtn = byId('newGameBtn');
    if (newGameBtn) newGameBtn.addEventListener('click', startNewGame);

    ['unknown','initialised','running','done','aborted','error'].forEach(e => {
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
    const toastContainer = byId('toastContainer');
    if (!toastContainer) {
        console.warn('[Toast] Container not found');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="toast-content">
            <span>${escapeHtml(message)}</span>
        </div>
    `;

    toastContainer.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('toast-show'), 10);

    // Auto remove
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
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
