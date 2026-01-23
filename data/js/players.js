// ============================================================================
// PLAYER MANAGEMENT AND RENDERING
// ============================================================================

import { byId, hide, show, addClass, removeClass, on, isPage, escapeHtml } from './utils.js';
import { sendMessage } from './network.js';
import Sortable from './libs/sortable.js';

let selectedPlayerId = null;
let selectedPlayerList = [];
let tempModalSelections = [];
let lastPlayerFetch = null;
let pendingPlayerToSelect = null;
let selectedListSortable = null;

function createPlayerListItemHTML(player, isSelected, selectClasses, options = {}) {
    const { isGamePage = false, isModal = false } = options;
    const playerId = isModal ? `modal-${player.id}` : player.id;

    return `
        <li id="${playerId}" role="listitem" class="${isGamePage ? 'cursor-pointer transition-colors ' + selectClasses : ''}" aria-pressed="${isSelected}">
            <div class='max'>
                <div>${escapeHtml(player.name)}</div>
                <small class="id-ellipsis" title="${escapeHtml(player.id)}">ID: ${escapeHtml(player.id)}</small>
            </div>
        </li>
    `;
}

function renderPlayersList(players) {
    const container = byId('playersList');
    if (!container) return;
    const isGamePage = isPage('/data/index.html', '/', '/index');

    container.innerHTML = '';

    if (!players || players.length === 0) {
        hide('playersList');
        show('playersEmpty');
        return;
    }

    if (isGamePage) {
        const availableIds = players.map(p => p.id);
        selectedPlayerList = selectedPlayerList.filter(id => availableIds.includes(id));
    }

    show('playersList');
    hide('playersEmpty');
    hide('playersError');

    const ul = document.createElement('ul');
    ul.className = 'list no-space divide-y divide-gray-700/60';

    players.forEach((player) => {
        const isSelected = selectedPlayerList.includes(player.id);
        const selectClasses = isSelected
            ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500'
            : 'hover:bg-purple-50 dark:hover:bg-purple-900/10';
        ul.innerHTML += createPlayerListItemHTML(player, isSelected, selectClasses, { isGamePage });
    });

    container.appendChild(ul);

    if (isGamePage) {
        const rows = ul.querySelectorAll('li[role="listitem"]');
        rows.forEach(row => {
            row.addEventListener('click', e => {
                if (e.target.closest('.player-buttons')) return;
                togglePlayerSelection(row.id);
            });
        });
        updateSelectablePlayersUI();
        updateSelectedPlayersUI();
    }
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
            <p class="w-full p-4">
                Add players by pressing the "Select Players" button
            </p>
        `;
        list.appendChild(emptyItem);
        return;
    }

    const playerMap = {};
    lastPlayerFetch.forEach(p => playerMap[p.id] = p);

    selectedPlayerList.forEach((playerId, index) => {
        const player = playerMap[playerId];
        if (!player) return;

        const item = document.createElement('li');
        item.id = `selected-player-${playerId}`;
        item.className = 'flex items-center gap-3 p-3 mb-2 bg-gray-100 dark:bg-gray-800 rounded-lg transition-all';
        item.dataset.playerId = playerId;
        item.innerHTML = `
            <i class="fa-solid fa-user"></i>
            <div class='max'>${player.name}</div>
            <span class="flex-1"></span>
            <button class="circle transparent small remove-player-btn " data-player-id="${playerId}" >
                <i class="fa-solid fa-xmark"></i>
            </button>
            <i class="fa-solid fa-grip-vertical drag-handle cursor-move text-gray-400 ml-3"></i>
        `;
        list.appendChild(item);

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

    // Initialize Sortable for list reordering via drag handle
    if (selectedListSortable) {
        try { selectedListSortable.destroy(); } catch {}
        selectedListSortable = null;
    }
    if (list && list.children.length > 0) {
        selectedListSortable = new Sortable(list, {
            handle: '.drag-handle',
            placeholder: 'border border-purple-600 border-dashed rounded-lg',
            draggingClass: 'opacity-50',
            onSort: (newOrder) => {
                const newIds = newOrder
                    .map(o => o.element?.dataset?.playerId)
                    .filter(Boolean);
                // Update order and notify backend
                selectedPlayerList = newIds;
                sendPlayerOrder();
            }
        });
    }
}

function sendPlayerOrder() {
    sendMessage({
        cmd: 'selectPlayers',
        playerIds: selectedPlayerList
    });
}

function updateSelectablePlayersUI() {
    if (!isPage('/data/index.html', '/', '/index')) return;
    const rows = document.querySelectorAll('#playersList li[role="listitem"]');
    rows.forEach(row => {
            const isSelected = selectedPlayerList.includes(row.id);

            if(isSelected) {
                addClass(row, 'bg-purple-100');
                addClass(row, 'dark:bg-purple-900/30');
                addClass(row, 'border-purple-500');
                removeClass(row, 'hover:bg-purple-50');
                removeClass(row, 'dark:hover:bg-purple-900/10');
            } else {
                removeClass(row, 'bg-purple-100');
                removeClass(row, 'dark:bg-purple-900/30');
                removeClass(row, 'border-purple-500');
                addClass(row, 'hover:bg-purple-50');
                addClass(row, 'dark:hover:bg-purple-900/10');
            }
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

function initPlayersPage() {
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

    const saveBtn = byId('savePlayerBtn');
    if (saveBtn) {
        on(saveBtn, 'click', (e) => {
            e.preventDefault();
            addNewPlayer();
        });
    }
}

function addNewPlayer() {
    const nameInput = byId('playerName');
    const name = nameInput?.value.trim();

    if (name && name.length > 0) {
        pendingPlayerToSelect = name;

        sendMessage({
            cmd: "addPlayer",
            name: name,
        });

        sendMessage({
            cmd: "getAllPlayer"
        });

        if (window.ui) {
            window.ui('#addPlayerModal');
        }

        if (nameInput) nameInput.value = '';
        if (colorInput) colorInput.value = '#9333ea';

        console.log(`Player "${name}" added successfully`);
    } else {
        console.error('Player name is required');
    }
}

function initPlayerSelectionModal() {
    const addBtn = byId('addPlayersBtn');
    if (addBtn) {
        on(addBtn, 'click', (e) => {
            e.preventDefault();
            applyPlayerSelection();
            if (window.ui) window.ui('#playerSelectionModal');
        });
    }

    const modal = byId('playerSelectionModal');
    if (modal) {
        on(modal, 'show', () => {
            populatePlayerSelectionModal();
        });
    }

    const openModalBtn = document.getElementById('openPlayerSelectionBtn');
    if (openModalBtn) {
        on(openModalBtn, 'click', () => {
            populatePlayerSelectionModal();
        });
    }

    const addNewPlayerBtn = byId('addNewPlayerFromModal');
    if (addNewPlayerBtn) {
        on(addNewPlayerBtn, 'click', (e) => {
            e.preventDefault();
            if (window.ui) {
                window.ui('#playerSelectionModal'); // Close selection modal
                window.ui('#addPlayerModal');        // Open add player modal
            }
        });
    }
}

function populatePlayerSelectionModal() {
    if (!lastPlayerFetch) return;

    const availablePlayers = lastPlayerFetch.filter(player => !selectedPlayerList.includes(player.id));
    tempModalSelections = [];
    renderPlayersListForModal(availablePlayers);
}

function renderPlayersListForModal(players) {
    const container = byId('playersList');
    if (!container) return;

    container.innerHTML = '';

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

    const ul = document.createElement('ul');
    ul.className = 'list no-space divide-y divide-gray-700/60';

    players.forEach((player) => {
        const isSelected = tempModalSelections.includes(player.id);
        const selectClasses = isSelected
            ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500'
            : 'hover:bg-purple-50 dark:hover:bg-purple-900/10';
        ul.innerHTML += createPlayerListItemHTML(player, isSelected, selectClasses, { isGamePage: true, isModal: true });
    });

    container.appendChild(ul);

    const rows = ul.querySelectorAll('li[role="listitem"]');
    rows.forEach(row => {
        row.addEventListener('click', e => {
            if (e.target.closest('.player-buttons')) return;
            const playerId = row.id.replace('modal-', '');
            toggleModalPlayerSelection(playerId);
        });
    });
}

function toggleModalPlayerSelection(playerId) {
    if (tempModalSelections.includes(playerId)) {
        tempModalSelections = tempModalSelections.filter(id => id !== playerId);
    } else {
        tempModalSelections = [...tempModalSelections, playerId];
    }

    const row = byId(`modal-${playerId}`);
    if (row) {
        const isSelected = tempModalSelections.includes(playerId);
        if (isSelected) {
            addClass(row, 'bg-purple-100');
            addClass(row, 'dark:bg-purple-900/30');
            addClass(row, 'border-purple-500');
            removeClass(row, 'hover:bg-purple-50');
            removeClass(row, 'dark:hover:bg-purple-900/10');
        } else {
            removeClass(row, 'bg-purple-100');
            removeClass(row, 'dark:bg-purple-900/30');
            removeClass(row, 'border-purple-500');
            addClass(row, 'hover:bg-purple-50');
            addClass(row, 'dark:hover:bg-purple-900/10');
        }
    }
}

function applyPlayerSelection() {
    selectedPlayerList = [...selectedPlayerList, ...tempModalSelections];
    tempModalSelections = [];

    updateSelectedPlayersUI();

    sendMessage({
        cmd: 'selectPlayers',
        playerIds: selectedPlayerList
    });
}

const playerManagerUpdates = {
    renderPlayersList,
    updateSelectedPlayersUI,
    updateSelectablePlayersUI,
    lastPlayerFetch: () => lastPlayerFetch,
    setLastPlayerFetch: (players) => { lastPlayerFetch = players; },
    selectedPlayerList: () => selectedPlayerList,
    setSelectedPlayerList: (list) => { selectedPlayerList = [...list]; },
    setPendingPlayerToSelect: (name) => { pendingPlayerToSelect = name; }
};

export {
    selectedPlayerId,
    selectedPlayerList,
    lastPlayerFetch,
    pendingPlayerToSelect,
    renderPlayersList,
    showPlayersError,
    updateSelectedPlayersUI,
    updateSelectablePlayersUI,
    togglePlayerSelection,
    initPlayersPage,
    initAddPlayerModal,
    addNewPlayer,
    initPlayerSelectionModal,
    applyPlayerSelection,
    playerManagerUpdates
};

// Make them available globally for message handlers
window.playerManagerUpdates = playerManagerUpdates;
