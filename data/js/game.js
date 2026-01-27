// ============================================================================
// INPUT TOGGLE FUNCTIONALITY
// ============================================================================

import { byId, hide, show, showGrid, showFlex, addClass, removeClass, on, isPage, showStatus } from './utils.js';
import { sendMessage } from './network.js';
import { playerManagerUpdates } from './players.js';
import { gameModeFactory } from './gamemodes/GameModeFactory.js';
import { Magnify } from './libs/magnify.js';
import { getInputTypePreference } from './settings.js';

let currentInputMode = 'dartboard'; // 'dartboard' or 'numpad'

function initInputToggle() {
    // Load saved input type preference from localStorage
    const savedInputType = getInputTypePreference();
    currentInputMode = savedInputType;

    const toggleBtn = byId('inputToggleBtn');
    const dartboardContainer = byId('dartboardContainer');
    const numpad = byId('numpad');
    const infoMsg = byId('infoMsg');

    // Apply the saved preference on initialization
    if (dartboardContainer && numpad) {
        if (currentInputMode === 'numpad') {
            hide('dartboardContainer');
            showGrid('numpad');
            if (infoMsg) show('infoMsg');
            if (toggleBtn) toggleBtn.innerHTML = '<i class=\"fas fa-bullseye\"></i> <span>Switch to Dartboard</span>';
        } else {
            dartboardContainer.style.display = 'block';
            hide('numpad');
            if (infoMsg) hide('infoMsg');
            if (toggleBtn) toggleBtn.innerHTML = '<i class=\"fas fa-keyboard\"></i> <span>Switch to Numpad</span>';
        }
    }

    if (toggleBtn && dartboardContainer && numpad) {
        on(toggleBtn, 'click', () => {
            if (currentInputMode === 'dartboard') {
                // Switch to numpad
                currentInputMode = 'numpad';
                hide('dartboardContainer');
                showGrid('numpad');
                if (infoMsg) show('infoMsg');
                toggleBtn.innerHTML = '<i class=\"fas fa-bullseye\"></i> <span>Switch to Dartboard</span>';
            } else {
                // Switch to dartboard
                currentInputMode = 'dartboard';
                dartboardContainer.style.display = 'block';
                hide('numpad');
                if (infoMsg) hide('infoMsg');
                toggleBtn.innerHTML = '<i class=\"fas fa-keyboard\"></i> <span>Switch to Numpad</span>';
            }
        });
    }
}

let currentGameMode = 'X01';
let currentGameModePoints = 301;
let latestGameSnapshot = null;
let currentGameModeHandler = null;
let lastDartboardPlayerId = null;
let lastDartboardTurn = null;

function updateDartboardHitsFromGameState(gameData, board) {
    if (!board) {
        board = document.querySelector('dartbot-dartboard');
    }
    if (!board) return;

    const snapshot = latestGameSnapshot || gameData;
    const currentPlayerId = snapshot?.currentPlayerId;
    const currentTurn = snapshot?.turn;

    // If player or turn changed, clear and repaint hits
    if (currentPlayerId !== lastDartboardPlayerId || currentTurn !== lastDartboardTurn) {
        lastDartboardPlayerId = currentPlayerId;
        lastDartboardTurn = currentTurn;

        board.hits = [];

        if (!currentPlayerId || !snapshot?.players) return;

        const player = snapshot.players.find(p => p.id === currentPlayerId);
        if (!player || !player.throws) return;

        // Extract throws for current turn
        let throwsToDisplay = [];
        if (player.turns && player.turns.length > 0) {
            const currentTurnObj = player.turns.find(t => t.turnNumber === currentTurn);
            if (currentTurnObj) {
                throwsToDisplay = currentTurnObj.throws || [];
            }
        } else if (Array.isArray(player.throws)) {
            // Fallback to all throws if turns structure not available
            throwsToDisplay = player.throws.slice(-3);
        }

        // Convert throws to hits on dartboard
        board.hits = throwsToDisplay.map((throwData, idx) => {
            // If throw already has polar coordinates, use them
            if (throwData.angle !== undefined && throwData.radius !== undefined) {
                return { angle: throwData.angle, radius: throwData.radius };
            }

            // Otherwise, calculate from field/value
            const value = throwData.value ?? 20;
            const field = throwData.field ?? 1;
            const sectors = board?.board?.sectors || [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

            let sectorIndex = 0;
            if (value === 25) {
                sectorIndex = 0; // Bull is at position 0
            } else {
                sectorIndex = sectors.indexOf(value);
                if (sectorIndex === -1) sectorIndex = 0;
            }

            const angleStep = (Math.PI * 2) / sectors.length;
            const angle = sectorIndex * angleStep + angleStep / 2;

            // Radius based on ring/field
            let radius = 0.66; // Default single
            if (value === 25) {
                radius = field >= 2 ? 0.06 : 0.1; // Inner or outer bull
            } else if (field === 3) {
                radius = 0.5; // Triple ring
            } else if (field === 2) {
                radius = 0.82; // Double ring
            }

            // Add slight jitter to differentiate multiple throws
            const jitter = (idx % 3) * 0.005;
            return { angle: angle + jitter, radius: radius + jitter };
        });
    }
}

function showGameInfo() {
    hide('viewSetup');
    showFlex('viewGame');
}

function updateGameInfo(gameData) {
    // Get the appropriate handler for the current game mode
    const gameMode = gameData?.mode || currentGameMode;
    const modeHandler = gameModeFactory.getGameMode(gameMode);

    // Delegate to the game mode-specific handler
    modeHandler.updateGameInfo(gameData);
}

function populatePlayers(data) {
    // Get the appropriate handler for the current game mode
    const gameMode = data?.mode || currentGameMode;
    const modeHandler = gameModeFactory.getGameMode(gameMode);

    // Delegate to the game mode-specific handler
    modeHandler.populatePlayers(data);
}

function initGameModeSelection() {
    // X01 Points option
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

    // X01 Check Out option
    const x01CheckOutSelect = byId('x01CheckOutSelect');
    if (x01CheckOutSelect) {
        on(x01CheckOutSelect, 'change', (e) => {
            if (currentGameMode === 'X01') {
                sendMessage({
                    cmd: 'setGameModeOption',
                    mode: 'X01',
                    option: 'checkout',
                    value: e.target.value
                });
            }
        });
    }

    // Cricket Hits per field option
    const cricketHitsSelect = byId('cricketHitsSelect');
    if (cricketHitsSelect) {
        on(cricketHitsSelect, 'change', (e) => {
            if (currentGameMode === 'Cricket') {
                sendMessage({
                    cmd: 'setGameModeOption',
                    mode: 'Cricket',
                    option: 'hitsPerField',
                    value: parseInt(e.target.value, 10)
                });
            }
        });
    }

    // Around The Clock Bull option
    const aroundTheClockBullCheckbox = byId('aroundTheClockBullCheckbox');
    if (aroundTheClockBullCheckbox) {
        on(aroundTheClockBullCheckbox, 'change', (e) => {
            if (currentGameMode === 'AroundTheClock') {
                sendMessage({
                    cmd: 'setGameModeOption',
                    mode: 'AroundTheClock',
                    option: 'includeBull',
                    value: e.target.checked
                });
            }
        });
    }

    // Highscore Rounds option
    const highscoreRoundsInput = byId('highscoreRoundsInput');
    if (highscoreRoundsInput) {
        on(highscoreRoundsInput, 'change', (e) => {
            if (currentGameMode === 'Highscore') {
                sendMessage({
                    cmd: 'setGameModeOption',
                    mode: 'Highscore',
                    option: 'rounds',
                    value: parseInt(e.target.value, 10)
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

    // Hide all options first
    gameModeFactory.hideAllOptions();

    // Get the handler for the current game mode
    const modeHandler = gameModeFactory.getGameMode(currentGameMode);
    currentGameModeHandler = modeHandler;

    // Show the options for this game mode
    modeHandler.showOptions();

    // Update display text
    if (currentGameMode === 'X01') {
        if (displayEl) displayEl.textContent = `${currentGameModePoints} Points`;

        const x01Select = byId('x01PointsSelect');
        if (x01Select) x01Select.value = currentGameModePoints.toString();
    } else if (currentGameMode === 'Cricket') {
        if (displayEl) displayEl.textContent = 'Cricket';
    } else if (currentGameMode === 'AroundTheClock') {
        if (displayEl) displayEl.textContent = 'Around the Clock';
    } else if (currentGameMode === 'Highscore') {
        if (displayEl) displayEl.textContent = 'Highscore';
    }
}

function initGamePage(selectedPlayerList) {
    initGameModeSelection();

    const gameModeButtons = document.querySelectorAll('.gamemode-button');
    gameModeButtons.forEach(button => {
        on(button, 'change', (e) => {
            if (e.target.checked) {
                const mode = e.target.value;
                const points = parseInt(e.target.dataset.points || '0', 10);
                selectGameMode(mode, points);
            }
        });
    });

    let pendingMultiplier = 1;
    let activeMultiplier = null;

    const getSelectedGameMode = () => {
        return { mode: currentGameMode, points: currentGameModePoints };
    };

    const startGame = byId('startGame');
    if (startGame) {
        on(startGame, 'click', e => {
            e.preventDefault();

            const currentPlayerList = playerManagerUpdates.selectedPlayerList();
            if (!currentPlayerList || currentPlayerList.length === 0) {
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

    // Initialize input toggle button
    initInputToggle();
    const board = document.querySelector('dartbot-dartboard');
    let dartboardMagnifier = null;

    // Handler for dartboard hits
    if (board) {
        board.addEventListener('dartboard-pointerup', e => {
            // console.log('Dartboard event:', e);
            const { radius, angle } = e.detail.polar ?? null;
            const { ring, sector } = e.detail ?? null;

            const hit = { radius, angle };
            board.hits = [...board.hits, hit];

            let score = board.board.sectors[sector] ?? 0;
            let multiplier = 0;

            if(ring <= 1) {
                score = 25;
            }

            else if(ring === 0 || ring === 5) {
                multiplier = 2;
            } else if(ring === 2 || ring === 4) {
                multiplier = 1;
            } else if(ring === 3) {
                multiplier = 3;
            }

            sendMessage({
                cmd: 'dartThrow',
                score: score,
                multiplier: multiplier,
                polar: { angle, radius }
            });
        });
    }

    const setupDartboardMagnifier = () => {
        if (dartboardMagnifier) return;

        const dartboardContainer = byId('dartboardContainer');
        const dartboardElement = dartboardContainer?.querySelector('dartbot-dartboard');
        const canvas = dartboardElement?.shadowRoot?.querySelector('canvas');

        if (!canvas) {
            console.warn('Canvas not found in dartboard');
            return;
        }

        dartboardMagnifier = new Magnify(canvas, {
            zoom: 3,
            size: 180,
            crosshairColor: '#ff8c00',
            borderColor: '#111'
        });

        dartboardMagnifier.show();
    };

    // Initialize magnifying glass zoom feature for dartboard
    customElements.whenDefined('dartbot-dartboard').then(() => {
        requestAnimationFrame(setupDartboardMagnifier);
    });

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
    updateDartboardHitsFromGameState,
    showGameState: (state) => {
        // Exported to message handler
    },
    getCurrentGameModeHandler: () => currentGameModeHandler
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
    updateDartboardHitsFromGameState,
    exportGameAsJson,
    syncGameNow,
    startNewGame,
    gameUpdates,
    gameModeFactory
};

// Make available globally for message handlers
window.gameUpdates = gameUpdates;
