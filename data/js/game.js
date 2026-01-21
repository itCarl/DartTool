// ============================================================================
// GAME LOGIC AND FUNCTIONS
// ============================================================================

import { byId, hide, show, addClass, removeClass, on, isPage, showStatus } from './utils.js';
import { sendMessage } from './network.js';

let currentGameMode = 'X01';
let currentGameModePoints = 301;
let latestGameSnapshot = null;

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
    data.players.forEach((player) => {
        const item = document.createElement('article');
        item.id = player.id;
        addClass(item, 'playerCard');

        const remainingPoints = player.remainingPoints !== undefined ? player.remainingPoints : 0;
        const totalThrows = player.throws !== undefined ? player.throws.reduce((partialSum, a) => partialSum + a.points, 0) : 0;
        const roundThrow = player.throws.length;
        const isCurrentPlayer = data.currentPlayerId === player.id;

        const throws = player.throws || [];
        const lastThrows = throws.slice(-3);

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

function initGameModeSelection() {
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

    updateGameModeDisplay();
}

function selectGameMode(mode, points = 0) {
    currentGameMode = mode;

    if (mode === 'X01') {
        currentGameModePoints = points;
    } else {
        currentGameModePoints = 0;
    }

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

    if (x01Options) x01Options.style.display = 'none';
    if (cricketOptions) cricketOptions.style.display = 'none';
    if (aroundTheClockOptions) aroundTheClockOptions.style.display = 'none';

    if (currentGameMode === 'X01') {
        if (displayEl) displayEl.textContent = `${currentGameModePoints} Points`;
        if (x01Options) x01Options.style.display = 'block';

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

function initGamePage(selectedPlayerList) {
    initGameModeSelection();

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
    let activeMultiplier = null;

    const getSelectedGameMode = () => {
        return { mode: currentGameMode, points: currentGameModePoints };
    };

    const startGame = byId('startGame');
    if (startGame) {
        on(startGame, 'click', e => {
            e.preventDefault();

            if (!selectedPlayerList || selectedPlayerList.length === 0) {
                showStatus('Bitte wählen Sie mindestens einen Spieler aus', 'error');
                return;
            }

            const { mode, points } = getSelectedGameMode();

            sendMessage({
                cmd: 'startGame',
                mode: mode,
                points: points
            });
        });
    }

    const numpad = byId('numpad');
    if (numpad) {
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

        numpadConfig.forEach(config => {
            const div = document.createElement('div');
            div.className = config.class;
            div.textContent = config.value;
            numpad.appendChild(div);
        });

        const numberDivs = numpad.querySelectorAll('div');

        const updateMultiplierUI = () => {
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

            numpadConfig.forEach(config => {
                const numericValue = parseInt(config.value, 10);

                if (!isNaN(numericValue)) {
                    const button = numpad.querySelector('.' + config.class);
                    if (button) {
                        button.textContent = numericValue;

                        const shouldGrayOut =
                            (numericValue === 25 && activeMultiplier === 'triple') ||
                            (numericValue === 0 && (activeMultiplier === 'double' || activeMultiplier === 'triple'));

                        if (shouldGrayOut) {
                            button.style.opacity = '0.4';
                            button.style.cursor = 'not-allowed';
                        } else {
                            button.style.opacity = '1';
                            button.style.cursor = 'pointer';
                        }
                    }
                }
            });
        };

        numberDivs.forEach(div => {
            on(div, 'click', () => {
                const value = div.textContent.trim();
                const displayedValue = parseInt(value, 10);
                const originalValue = displayedValue;

                if (value === 'back') {
                    sendMessage({
                        cmd: 'dartUndo'
                    });
                    activeMultiplier = null;
                    pendingMultiplier = 1;
                    updateMultiplierUI();
                } else if (value === 'double' || value === 'triple') {
                    if (activeMultiplier === value) {
                        activeMultiplier = null;
                        pendingMultiplier = 1;
                    } else {
                        activeMultiplier = value;
                        pendingMultiplier = value === 'double' ? 2 : 3;
                    }
                    updateMultiplierUI();
                } else if (!isNaN(originalValue)) {
                    const isInvalid =
                        (originalValue === 25 && activeMultiplier === 'triple') ||
                        (originalValue === 0 && (activeMultiplier === 'double' || activeMultiplier === 'triple'));

                    if (isInvalid) {
                        return;
                    }

                    const score = originalValue;
                    sendMessage({
                        cmd: 'dartThrow',
                        score: score,
                        multiplier: pendingMultiplier
                    });
                    activeMultiplier = null;
                    pendingMultiplier = 1;
                    updateMultiplierUI();
                }
            });
        });
    }

    const exportJsonBtn = byId('exportJsonBtn');
    if (exportJsonBtn) on(exportJsonBtn, 'click', exportGameAsJson);

    const syncGameBtn = byId('syncGameBtn');
    if (syncGameBtn) on(syncGameBtn, 'click', syncGameNow);

    const newGameBtn = byId('newGameBtn');
    if (newGameBtn) on(newGameBtn, 'click', startNewGame);

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
    window.syncNow?.();
}

function startNewGame() {
    sendMessage({ cmd: 'setGameStatus', s: 'initialised' });
    show('viewSetup');
    show('viewPlayerManagement');
    show('io');
    hide('doneActions');
}

const gameUpdates = {
    updateGameInfo,
    populatePlayers,
    setLatestGameSnapshot: (snap) => { latestGameSnapshot = snap; },
    showGameInfo,
    showGameState: (state) => {
        // Exported to message handler
    }
};

export {
    currentGameMode,
    currentGameModePoints,
    latestGameSnapshot,
    showGameInfo,
    updateGameInfo,
    populatePlayers,
    initGameModeSelection,
    selectGameMode,
    updateGameModeDisplay,
    initGamePage,
    exportGameAsJson,
    syncGameNow,
    startNewGame,
    gameUpdates
};

// Make available globally for message handlers
window.gameUpdates = gameUpdates;
