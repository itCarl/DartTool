// ============================================================================
// TEAM MANAGEMENT
// ============================================================================
// Handles team creation, naming, and player assignment for team game modes

import { byId, hide, show, on, escapeHtml } from './utils.js';
import { sendMessage } from './network.js';
import { playerManagerUpdates } from './players.js';
import { gameModeFactory, GameModeAvailability } from './gamemodes/GameModeFactory.js';

// ============================================================================
// STATE
// ============================================================================

let teams = [];
let currentTeamGameMode = 'X01';
let editingTeamId = null;
let assigningPlayersToTeamId = null;

// ============================================================================
// TEAM GAME MODE SELECTION
// ============================================================================

const gameModeDisplayNames = {
    'X01': 'X01',
    'Cricket': 'Cricket',
    'AroundTheClock': 'ATC',
    'Highscore': 'Highscore'
};

let currentTeamGameModePoints = 501;

function updateTeamGameModeOptions() {
    const x01Options = byId('teamX01Options');
    const cricketOptions = byId('teamCricketOptions');

    // Hide all options first
    if (x01Options) x01Options.style.display = 'none';
    if (cricketOptions) cricketOptions.style.display = 'none';

    // Show options for current mode
    if (currentTeamGameMode === 'X01' && x01Options) {
        x01Options.style.display = 'block';
    } else if (currentTeamGameMode === 'Cricket' && cricketOptions) {
        cricketOptions.style.display = 'block';
    }
}

function populateTeamGameModeGrid() {
    const grid = byId('teamGameModeGrid');
    if (!grid) return;

    const availableModes = gameModeFactory.getAvailableGameModes('team');

    grid.innerHTML = availableModes.map((mode, index) => {
        const isChecked = mode === currentTeamGameMode;
        const displayName = gameModeDisplayNames[mode] || mode;
        return `
            <label class="gamemode-label py-5 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors flex flex-col items-center justify-center cursor-pointer has-[:checked]:ring-2 has-[:checked]:ring-primary">
                <input type="radio" name="teamGamemode" class="team-gamemode-button hidden" value="${mode}" ${isChecked ? 'checked' : ''}>
                <span class="font-semibold">${displayName}</span>
            </label>
        `;
    }).join('');

    // Attach event listeners
    grid.querySelectorAll('.team-gamemode-button').forEach(button => {
        on(button, 'change', (e) => {
            if (e.target.checked) {
                currentTeamGameMode = e.target.value;
                updateTeamGameModeOptions();
                sendMessage({
                    cmd: 'setGameMode',
                    mode: currentTeamGameMode,
                    gameType: 'team'
                });
            }
        });
    });

    // Select first mode if none selected
    if (!availableModes.includes(currentTeamGameMode) && availableModes.length > 0) {
        currentTeamGameMode = availableModes[0];
        const firstInput = grid.querySelector('.team-gamemode-button');
        if (firstInput) firstInput.checked = true;
    }

    // Show options for initial mode
    updateTeamGameModeOptions();
}

function initTeamGameModeOptions() {
    // X01 Points selection for team mode
    const teamX01PointsSelect = byId('teamX01PointsSelect');
    if (teamX01PointsSelect) {
        on(teamX01PointsSelect, 'change', (e) => {
            currentTeamGameModePoints = parseInt(e.target.value, 10);
        });
    }
}

// ============================================================================
// TEAM MANAGEMENT
// ============================================================================

function createTeam(name) {
    // Send request to backend - will receive team with GUID and color in response
    sendMessage({
        cmd: 'createTeam',
        team: {
            name: name || `Team ${teams.length + 1}`
        }
    });
}

function deleteTeam(teamId) {
    teams = teams.filter(t => t.id !== teamId);
    renderTeamsList();

    // Notify backend
    sendMessage({
        cmd: 'deleteTeam',
        teamId: teamId
    });
}

function renameTeam(teamId, newName) {
    const team = teams.find(t => t.id === teamId);
    if (team) {
        team.name = newName;
        renderTeamsList();

        // Notify backend
        sendMessage({
            cmd: 'renameTeam',
            teamId: teamId,
            name: newName
        });
    }
}

function addPlayerToTeam(teamId, playerId) {
    const team = teams.find(t => t.id === teamId);
    if (team && !team.players.includes(playerId)) {
        // Remove player from other teams first
        teams.forEach(t => {
            t.players = t.players.filter(p => p !== playerId);
        });
        team.players.push(playerId);
        renderTeamsList();

        // Notify backend
        sendMessage({
            cmd: 'assignPlayerToTeam',
            teamId: teamId,
            playerId: playerId
        });
    }
}

function removePlayerFromTeam(teamId, playerId) {
    const team = teams.find(t => t.id === teamId);
    if (team) {
        team.players = team.players.filter(p => p !== playerId);
        renderTeamsList();

        // Notify backend
        sendMessage({
            cmd: 'removePlayerFromTeam',
            teamId: teamId,
            playerId: playerId
        });
    }
}

function getTeams() {
    return teams;
}

function getTeamPlayers(teamId) {
    const team = teams.find(t => t.id === teamId);
    return team ? team.players : [];
}

// ============================================================================
// UI RENDERING
// ============================================================================

function renderTeamsList() {
    const container = byId('teamsList');
    if (!container) return;

    const allPlayers = playerManagerUpdates.lastPlayerFetch() || [];
    const playerMap = {};
    allPlayers.forEach(p => playerMap[p.id] = p);

    if (teams.length === 0) {
        container.innerHTML = `
            <p class="w-full p-4 text-center text-gray-400">
                Create teams by pressing the "Add Team" button, then assign players to each team.
            </p>
        `;
        return;
    }

    container.innerHTML = teams.map(team => `
        <div class="team-card" data-team-id="${team.id}">
            <div class="team-card-header">
                <div class="team-card-name">
                    ${team.color ? `<div class="w-4 h-4 rounded-full mr-1" style="background-color: ${team.color};"></div>` : '<i class="fa-solid fa-users text-purple-400"></i>'}
                    <span>${escapeHtml(team.name)}</span>
                </div>
                <div class="team-card-actions">
                    <button class="assign-players-btn text-green-400 hover:bg-green-900/30" data-team-id="${team.id}" title="Assign Players">
                        <i class="fa-solid fa-user-plus"></i>
                    </button>
                    <button class="edit-team-btn text-blue-400 hover:bg-blue-900/30" data-team-id="${team.id}" title="Edit Team">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="delete-team-btn text-red-400 hover:bg-red-900/30" data-team-id="${team.id}" title="Delete Team">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="team-players-list">
                ${team.players.length === 0
                    ? '<p class="team-empty-message">No players assigned</p>'
                    : team.players.map(playerId => {
                        const player = playerMap[playerId];
                        if (!player) return '';
                        return `
                            <div class="team-player-item">
                                <i class="fa-solid fa-user text-gray-400 flex-shrink-0"></i>
                                <span class="truncate" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</span>
                                <span class="flex-1"></span>
                                <button class="remove-player-btn text-red-400 hover:text-red-300 flex-shrink-0" data-team-id="${team.id}" data-player-id="${playerId}">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        `;
                    }).join('')
                }
            </div>
        </div>
    `).join('');

    // Attach event listeners
    container.querySelectorAll('.assign-players-btn').forEach(btn => {
        on(btn, 'click', () => openPlayerAssignmentModal(btn.dataset.teamId));
    });

    container.querySelectorAll('.edit-team-btn').forEach(btn => {
        on(btn, 'click', () => openEditTeamModal(btn.dataset.teamId));
    });

    container.querySelectorAll('.delete-team-btn').forEach(btn => {
        on(btn, 'click', () => {
            if (confirm('Are you sure you want to delete this team?')) {
                deleteTeam(btn.dataset.teamId);
            }
        });
    });

    container.querySelectorAll('.remove-player-btn').forEach(btn => {
        on(btn, 'click', () => {
            removePlayerFromTeam(btn.dataset.teamId, btn.dataset.playerId);
        });
    });
}

function openPlayerAssignmentModal(teamId) {
    assigningPlayersToTeamId = teamId;
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const titleEl = byId('teamPlayerAssignmentTitle');
    if (titleEl) {
        titleEl.textContent = `Assign Players to ${team.name}`;
    }

    const container = byId('teamPlayersList');
    if (!container) return;

    const allPlayers = playerManagerUpdates.lastPlayerFetch() || [];

    // Get players already in other teams
    const playersInOtherTeams = new Set();
    teams.forEach(t => {
        if (t.id !== teamId) {
            t.players.forEach(p => playersInOtherTeams.add(p));
        }
    });

    container.innerHTML = `
        <ul class="list no-space divide-y divide-gray-700/60">
            ${allPlayers.map(player => {
                const isInThisTeam = team.players.includes(player.id);
                const isInOtherTeam = playersInOtherTeams.has(player.id);
                const selectClasses = isInThisTeam
                    ? 'bg-green-100 dark:bg-green-900/30 border-green-500'
                    : isInOtherTeam
                        ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                        : 'hover:bg-purple-50 dark:hover:bg-purple-900/10 cursor-pointer';
                return `
                    <li id="team-player-${player.id}"
                        class="p-3 transition-colors ${selectClasses}"
                        data-player-id="${player.id}"
                        data-selected="${isInThisTeam}"
                        data-disabled="${isInOtherTeam}">
                        <div class="flex items-center gap-2 min-w-0">
                            <i class="fa-solid fa-user flex-shrink-0"></i>
                            <span class="truncate" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</span>
                            ${isInOtherTeam ? '<span class="ml-auto text-xs text-gray-400 flex-shrink-0">(in another team)</span>' : ''}
                        </div>
                    </li>
                `;
            }).join('')}
        </ul>
    `;

    // Attach click handlers
    container.querySelectorAll('li[data-player-id]').forEach(li => {
        if (li.dataset.disabled === 'true') return;

        on(li, 'click', () => {
            const playerId = li.dataset.playerId;
            const isSelected = li.dataset.selected === 'true';

            if (isSelected) {
                li.dataset.selected = 'false';
                li.classList.remove('bg-green-100', 'dark:bg-green-900/30', 'border-green-500');
                li.classList.add('hover:bg-purple-50', 'dark:hover:bg-purple-900/10');
            } else {
                li.dataset.selected = 'true';
                li.classList.add('bg-green-100', 'dark:bg-green-900/30', 'border-green-500');
                li.classList.remove('hover:bg-purple-50', 'dark:hover:bg-purple-900/10');
            }
        });
    });

    window.toggleModal?.('#teamPlayerAssignmentModal');
}

function openEditTeamModal(teamId) {
    editingTeamId = teamId;
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const nameInput = byId('teamName');
    if (nameInput) {
        nameInput.value = team.name;
    }

    const saveBtn = byId('saveTeamBtn');
    if (saveBtn) {
        saveBtn.textContent = 'Update Team';
    }

    window.toggleModal?.('#addTeamModal');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initTeamsPage() {
    // Add Team Button
    const addTeamBtn = byId('addTeamBtn');
    if (addTeamBtn) {
        on(addTeamBtn, 'click', () => {
            editingTeamId = null;
            const nameInput = byId('teamName');
            if (nameInput) nameInput.value = '';

            const saveBtn = byId('saveTeamBtn');
            if (saveBtn) saveBtn.textContent = 'Create Team';

            window.toggleModal?.('#addTeamModal');
        });
    }

    // Save/Update Team Button
    const saveTeamBtn = byId('saveTeamBtn');
    if (saveTeamBtn) {
        on(saveTeamBtn, 'click', () => {
            const nameInput = byId('teamName');
            const name = nameInput?.value?.trim();

            if (!name) {
                alert('Please enter a team name');
                return;
            }

            if (editingTeamId) {
                renameTeam(editingTeamId, name);
            } else {
                createTeam(name);
            }

            editingTeamId = null;
            window.toggleModal?.('#addTeamModal');
        });
    }

    // Assign Players Button
    const assignPlayersBtn = byId('assignPlayersBtn');
    if (assignPlayersBtn) {
        on(assignPlayersBtn, 'click', () => {
            if (!assigningPlayersToTeamId) return;

            const team = teams.find(t => t.id === assigningPlayersToTeamId);
            if (!team) return;

            // Collect selected players
            const selectedPlayers = [];
            document.querySelectorAll('#teamPlayersList li[data-selected="true"]').forEach(li => {
                selectedPlayers.push(li.dataset.playerId);
            });

            // Update team players
            team.players = selectedPlayers;
            renderTeamsList();

            // Notify backend
            sendMessage({
                cmd: 'setTeamPlayers',
                teamId: assigningPlayersToTeamId,
                playerIds: selectedPlayers
            });

            assigningPlayersToTeamId = null;
            window.toggleModal?.('#teamPlayerAssignmentModal');
        });
    }

    // Start Team Game Button
    const startTeamGameBtn = byId('startTeamGame');
    if (startTeamGameBtn) {
        on(startTeamGameBtn, 'click', (e) => {
            e.preventDefault();

            if (teams.length === 0) {
                alert('Please create at least one team');
                return;
            }

            const teamsWithPlayers = teams.filter(t => t.players.length > 0);
            if (teamsWithPlayers.length === 0) {
                alert('Please assign players to at least one team');
                return;
            }

            // Build the message with game mode specific options
            const message = {
                cmd: 'startTeamGame',
                teams: teamsWithPlayers,
                mode: currentTeamGameMode
            };

            // Add X01-specific options
            if (currentTeamGameMode === 'X01') {
                message.points = currentTeamGameModePoints;
            }

            sendMessage(message);
        });
    }

    // Initialize team game mode options handlers
    initTeamGameModeOptions();
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    initTeamsPage,
    createTeam,
    deleteTeam,
    renameTeam,
    addPlayerToTeam,
    removePlayerFromTeam,
    getTeams,
    getTeamPlayers,
    renderTeamsList,
    populateTeamGameModeGrid
};

export const teamManagerUpdates = {
    teams: () => teams,
    currentTeamGameMode: () => currentTeamGameMode,
    renderTeamsList
};
