// ============================================================================
// UNIFIED APPLICATION JAVASCRIPT - MAIN ENTRY POINT
// ============================================================================
// Coordinates: utils.js, websocket.js, players.js, game.js, settings.js, debug.js
// ===========================================================================

import '@dartbot/dartboard/dartboard.js';

import './modal.js';

import {
    d, byId, on, hide, show, showGrid, showFlex, addClass, removeClass, isPage, showStatus, formatUptime
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
    showGameInfo, gameUpdates, updateDartboardHitsFromGameState
} from './game.js';

import {
    initSettingsPage,
    host
} from './settings.js';

import {
    initDebugPage
} from './debug.js';

import { initTheme } from './theme.js';

import {
    initTeamsPage,
    renderTeamsList,
    teamManagerUpdates,
    populateTeamGameModeGrid
} from './teams.js';

// ============================================================================
// GLOBAL STATE MANAGEMENT
// ============================================================================

let gameState = "unknown";
let currentGameType = 'standard'; // 'standard', 'team', 'tournament'

// ============================================================================
// GAME TYPE TAB HANDLING
// ============================================================================

function initGameTypeTabs() {
    const tabs = document.querySelectorAll('.game-type-tab');
    tabs.forEach(tab => {
        on(tab, 'click', () => {
            const gameType = tab.dataset.gameType;
            switchGameType(gameType);
        });
    });

    // Restore saved game type from localStorage
    restoreSavedGameType();
}

function restoreSavedGameType() {
    try {
        const savedGameType = localStorage.getItem('selectedGameType');
        if (savedGameType && ['standard', 'team', 'tournament'].includes(savedGameType)) {
            // Switch to saved game type without sending to backend yet (will be sent on connection)
            currentGameType = savedGameType;

            // Update UI
            const tabs = document.querySelectorAll('.game-type-tab');
            tabs.forEach(tab => {
                if (tab.dataset.gameType === savedGameType) {
                    tab.classList.add('active', 'bg-purple-600', 'text-white');
                    tab.classList.remove('text-gray-300', 'hover:text-white', 'hover:bg-gray-700');
                } else {
                    tab.classList.remove('active', 'bg-purple-600', 'text-white');
                    tab.classList.add('text-gray-300', 'hover:text-white', 'hover:bg-gray-700');
                }
            });

            // Show/hide views
            const viewStandard = byId('viewStandard');
            const viewTeam = byId('viewTeam');
            const viewTournament = byId('viewTournament');

            if (viewStandard) viewStandard.style.display = savedGameType === 'standard' ? 'block' : 'none';
            if (viewTeam) viewTeam.style.display = savedGameType === 'team' ? 'block' : 'none';
            if (viewTournament) viewTournament.style.display = savedGameType === 'tournament' ? 'block' : 'none';

            // Control button visibility based on game type
            if (savedGameType === 'standard') {
                show('openPlayerSelectionBtn');
                hide('addTeamBtn');
                hide('openTeamPlayerSelectionBtn');
            } else if (savedGameType === 'team') {
                hide('openPlayerSelectionBtn');
                show('addTeamBtn');
                hide('openTeamPlayerSelectionBtn');
            } else {
                hide('openPlayerSelectionBtn');
                hide('addTeamBtn');
                hide('openTeamPlayerSelectionBtn');
            }

            // Populate game mode grid for team view
            if (savedGameType === 'team') {
                populateTeamGameModeGrid();
            }
        }
    } catch (e) {
        console.warn('Failed to restore game type from localStorage:', e);
    }
}

function switchGameType(gameType) {
    currentGameType = gameType;

    // Save to localStorage
    try {
        localStorage.setItem('selectedGameType', gameType);
    } catch (e) {
        console.warn('Failed to save game type to localStorage:', e);
    }

    // Update tab UI
    const tabs = document.querySelectorAll('.game-type-tab');
    tabs.forEach(tab => {
        if (tab.dataset.gameType === gameType) {
            tab.classList.add('active', 'bg-purple-600', 'text-white');
            tab.classList.remove('text-gray-300', 'hover:text-white', 'hover:bg-gray-700');
        } else {
            tab.classList.remove('active', 'bg-purple-600', 'text-white');
            tab.classList.add('text-gray-300', 'hover:text-white', 'hover:bg-gray-700');
        }
    });

    // Show/hide views
    const viewStandard = byId('viewStandard');
    const viewTeam = byId('viewTeam');
    const viewTournament = byId('viewTournament');

    if (viewStandard) viewStandard.style.display = gameType === 'standard' ? 'block' : 'none';
    if (viewTeam) viewTeam.style.display = gameType === 'team' ? 'block' : 'none';
    if (viewTournament) viewTournament.style.display = gameType === 'tournament' ? 'block' : 'none';

    // Control button visibility based on game type
    if (gameType === 'standard') {
        show('openPlayerSelectionBtn');
        hide('addTeamBtn');
        hide('openTeamPlayerSelectionBtn');
    } else if (gameType === 'team') {
        hide('openPlayerSelectionBtn');
        show('addTeamBtn');
        hide('openTeamPlayerSelectionBtn');
    } else {
        hide('openPlayerSelectionBtn');
        hide('addTeamBtn');
        hide('openTeamPlayerSelectionBtn');
    }

    // Populate game mode grid for team view
    if (gameType === 'team') {
        populateTeamGameModeGrid();
    }
}

function getCurrentGameType() {
    return currentGameType;
}

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

    // Handle start team game response
    if (data.cmd === 'startTeamGameResponse') {
        if (!data.success) {
            showStatus(data.msg || 'Cannot start team game', 'error');
        }
        // Game view will be shown by the game state update
        return;
    }

    // Handle team management responses
    if (data.cmd === 'createTeamResponse') {
        if (data.success && data.team) {
            // Add the new team with backend-generated ID and color
            const teams = teamManagerUpdates.teams();
            teams.push(data.team);
            renderTeamsList();
            showStatus('Team created successfully', 'success');
        } else {
            showStatus(data.msg || 'Failed to create team', 'error');
        }
        return;
    }

    if (data.cmd === 'deleteTeamResponse') {
        if (data.success) {
            showStatus('Team deleted successfully', 'success');
        } else {
            showStatus(data.msg || 'Failed to delete team', 'error');
        }
        return;
    }

    if (data.cmd === 'renameTeamResponse') {
        if (data.success) {
            showStatus('Team renamed successfully', 'success');
        } else {
            showStatus(data.msg || 'Failed to rename team', 'error');
        }
        return;
    }

    if (data.cmd === 'getAllTeamsResponse') {
        if (data.success && data.teams) {
            const teams = teamManagerUpdates.teams();
            teams.splice(0, teams.length, ...data.teams);
            renderTeamsList();
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
            updateDartboardHitsFromGameState(g);

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
            updateDartboardHitsFromGameState(g);

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

on(document, 'DOMContentLoaded', () => {
    initTheme();

    // Check device availability on all pages before showing content
    checkDeviceAvailability();

    // Make utilities globally available
    window.utils = { formatUptime };

    // Page-specific initialization
    if(isPage('/data/index.html', '/', '/index')) {
        initPlayersPage();
        initAddPlayerModal();
        initPlayerSelectionModal();
        initGamePage(selectedPlayerList);
        initGameTypeTabs();
        initTeamsPage();

        // Request teams from backend
        sendMessage({ cmd: 'getAllTeams' });
    }

    if(isPage('/data/settings.html', '/settings')) {
        initSettingsPage();
    }

    if(isPage('/data/debug.html', '/debug')) {
        initDebugPage();
    }
});

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

export {
    getCurrentGameType,
    switchGameType,
    initGameTypeTabs
};
