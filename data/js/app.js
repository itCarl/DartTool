// ============================================================================
// UNIFIED APPLICATION JAVASCRIPT - MAIN ENTRY POINT
// ============================================================================
// Coordinates: utils.js, websocket.js, players.js, game.js, settings.js, debug.js
// ===========================================================================

import '@dartbot/dartboard/dartboard.js';

import {
    d, byId, on, hide, show, addClass, removeClass, isPage, showStatus
} from './utils.js';

import {
    initWebSocket, sendMessage, checkDeviceAvailability, showMainContent, hideMainContent
} from './network.js';

import {
    renderPlayersList, updateSelectedPlayersUI, updateSelectablePlayersUI,
    initPlayersPage, initAddPlayerModal, initPlayerSelectionModal,
    applyPlayerSelection, lastPlayerFetch, pendingPlayerToSelect,
    selectedPlayerList, playerManagerUpdates
} from './players.js';

import {
    updateGameInfo, populatePlayers, initGamePage, startNewGame,
    showGameInfo, gameUpdates
} from './game.js';

import {
    initSettingsPage,
    host
} from './settings.js';

import {
    initDebugPage
} from './debug.js';

// ============================================================================
// GLOBAL STATE MANAGEMENT
// ============================================================================

let gameState = "unknown";

// ============================================================================
// MESSAGE HANDLERS - Unified message dispatcher
// ============================================================================

function handleGameMessage(data) {
    // Handle start game response
    if (data.cmd === 'startGameResponse') {
        if (!data.success) {
            showStatus(data.msg || 'Cannot start game', 'error');
        }
        return;
    }

    // Handle servo responses (Debug page)
    if (data.cmd === 'servoResponse') {
        window.updateStatus?.(`Servo Position gesetzt: ${data.pos}°`, 'success');
        window.updateCurrentPosition?.(data.pos);
        return;
    }

    // Handle laser responses (Debug page)
    if (data.cmd === 'laserResponse') {
        window.updateStatus?.(data.msg, 'success');
        window.updateLaserStatus?.(data.state);
        return;
    }

    // Handle mode config responses
    if (data.cmd === 'getModeConfigResponse') {
        if (data.success) {
            window.operationMode = data.mode || 'display';
            const modeDisplay = byId('modeDisplay');
            const modeScoreboard = byId('modeScoreboard');
            if (window.operationMode === 'display') {
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
            const { formatUptime } = window.utils || {};
            uptimeEl.textContent = formatUptime ? formatUptime(data.uptime) : data.uptime;
        }
        return;
    }

    // Handle players list
    if(data.cmd === 'getAllPlayer') {
        let players = data.players;
        playerManagerUpdates.setLastPlayerFetch(players);
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
            playerManagerUpdates.setPendingPlayerToSelect(null);
        }
    }

    // Handle game status
    if(data.game) {
        var g = data.game;
        gameUpdates.setLatestGameSnapshot(data.gameFull || g);
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

            const lastFetch = playerManagerUpdates.lastPlayerFetch?.() || [];
            selectedPlayerList.splice(0, selectedPlayerList.length, ...g.players.map(p => p.id));
            renderPlayersList(lastFetch);
            updateSelectablePlayersUI();
            updateSelectedPlayersUI();

        } else if(state == "running") {
            hide('viewPlayerManagement');
            hide('show');
            show('io');
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

// Register message handler
window.gameMessageHandlers = [handleGameMessage];

// ============================================================================
// INITIALIZATION
// ============================================================================

on(window, 'load', onLoad);

function onLoad(event) {
    // Setup dartboard visualization
    const board = document.querySelector('dartbot-dartboard');
    if (board) {
        board.hits = [
            { radius: 147, angle: 0.2595 },
            { radius: 149, angle: 0.1368 },
        ];

        board.addEventListener('dartboard-click', (event) => {
            const { radius, angle } = event.detail.polar;
            const hit = { radius, angle };
            board.hits = [...board.hits, hit];
        });
    }
}

on(document, 'DOMContentLoaded', () => {
    // Check device availability on all pages before showing content
    checkDeviceAvailability();

    // Setup navigation active state
    setupNavigation();

    // Make utilities globally available
    window.utils = { formatUptime: require('./utils.js').formatUptime };

    // Page-specific initialization
    if(isPage('/data/game.html', '/game')) {
        initPlayersPage();
        initGamePage(selectedPlayerList);
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

function updateModeUI() {
    const displayModeSettings = byId('displayModeSettings');
    const dataSyncSection = byId('dataSyncSection');
    const modeDisplay = byId('modeDisplay')?.checked;

    if (modeDisplay) {
        if (displayModeSettings) displayModeSettings.style.display = 'block';
        if (dataSyncSection) dataSyncSection.style.display = 'none';
    } else {
        if (displayModeSettings) displayModeSettings.style.display = 'none';
        if (dataSyncSection) dataSyncSection.style.display = 'block';
    }
}

// export {
//     sendMessage,
//     handleGameMessage,
//     updateModeUI
// };
