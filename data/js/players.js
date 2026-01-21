// ============================================================================
// PLAYER MANAGEMENT AND RENDERING
// ============================================================================

import { byId, hide, show, addClass, removeClass, on, isPage, escapeHtml } from './utils.js';
import { sendMessage } from './network.js';

let selectedPlayerId = null;
let selectedPlayerList = [];
let tempModalSelections = [];
let lastPlayerFetch = null;
let pendingPlayerToSelect = null;

function renderPlayersList(players) {
    const list = byId('playersList');
    if (!list) return;
    const isGamePage = isPage('/data/game.html', '/game');

    list.innerHTML = '';

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

    if (isGamePage) {
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
            <div class="max">
                <p>no player selected.</p>
            </div>
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

        setupDragHandlers(item, playerId);

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

function setupDragHandlers(item, playerId) {
    on(item, 'dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', playerId);
        addClass(item, 'dragging');
    });

    on(item, 'dragend', (e) => {
        removeClass(item, 'dragging');
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

    setupTouchHandlers(item, playerId);
}

function setupTouchHandlers(item, playerId) {
    let touchStartY = 0;
    let isDragging = false;

    const dragHandle = item.querySelector('.drag-handle');
    if (dragHandle) {
        dragHandle.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
            isDragging = true;
            item.style.opacity = '0.5';
        }, { passive: true });
    }

    item.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetItem = elementBelow?.closest('.selected-player-item');

        if (targetItem && targetItem !== item && targetItem.dataset.playerId) {
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

        document.querySelectorAll('.drag-over').forEach(el => removeClass(el, 'drag-over'));

        if (targetItem && targetItem !== item && targetItem.dataset.playerId) {
            reorderPlayers(playerId, targetItem.dataset.playerId);
        }
    }, { passive: true });
}

function reorderPlayers(draggedId, targetId) {
    const draggedIndex = selectedPlayerList.indexOf(draggedId);
    const targetIndex = selectedPlayerList.indexOf(targetId);

    if (draggedIndex > -1 && targetIndex > -1) {
        const [draggedItem] = selectedPlayerList.splice(draggedIndex, 1);
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
    const rows = document.querySelectorAll('#playersList li[role="listitem"]');
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
}

function addNewPlayer() {
    const nameInput = byId('newPlayerName');
    const name = nameInput?.value.trim();

    if (name && name.length > 0) {
        pendingPlayerToSelect = name;

        sendMessage({
            cmd: "addPlayer",
            name: name
        });

        sendMessage({
            cmd: "getAllPlayer"
        });

        if (window.ui) {
            window.ui('#addPlayerModal');
        }

        if (nameInput) nameInput.value = '';

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

    const openModalBtn = document.querySelector('[data-ui="#playerSelectionModal"]');
    if (openModalBtn) {
        on(openModalBtn, 'click', () => {
            populatePlayerSelectionModal();
        });
    }

    const addNewPlayerBtn = byId('addNewPlayerFromModal');
    if (addNewPlayerBtn) {
        on(addNewPlayerBtn, 'click', (e) => {
            if (window.ui) {
                window.ui('#playerSelectionModal');
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
