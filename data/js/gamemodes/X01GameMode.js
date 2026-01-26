// ============================================================================
// X01 GAME MODE
// ============================================================================
// Handles rendering for X01 game mode (301, 501, 1001, etc.)

import { GameMode } from './GameMode.js';
import { byId, addClass } from '../utils.js';

export class X01GameMode extends GameMode {
    constructor() {
        super();
    }

    getGameModeName() {
        return 'X01';
    }

    getOptionsContainerId() {
        return 'x01Options';
    }

    /**
     * Render the player list for X01 game mode
     * Shows remaining points, last 3 throws, total throws, and average
     */
    populatePlayers(gameData) {
        const list = byId('activePlayerList');
        if (!list) return;

        const playerCount = gameData.players.length;

        // Calculate available height dynamically
        // Get the actual available height from the list container
        let availableVh = 38; // fallback to 38vh

        if (typeof window !== 'undefined') {
            // Estimate based on viewport if container not yet laid out
            // Assume 38vh is reasonable for the player list area
            availableVh = Math.min(50, (window.innerHeight * 0.39) / window.innerHeight * 100);
        }

        let cardHeight;
        if (playerCount <= 2) {
            // 1-2 players: max height of 12vh per card
            cardHeight = '12vh';
        } else if (playerCount === 3 || playerCount === 4) {
            // 3-4 players: divide available space equally
            const heightPerCard = Math.floor(availableVh / playerCount);
            cardHeight = `${heightPerCard}vh`;
        } else {
            // 5+ players: calculate for 4 players, enable scrolling
            const heightPerCard = Math.floor(availableVh / 4);
            cardHeight = `${heightPerCard}vh`;
        }


        list.innerHTML = '';
        gameData.players.forEach((player) => {
            const item = document.createElement('div');
            item.id = player.id;
            item.classList.add('mb-2', 'grid', 'grid-cols-3', 'bg-black/70', 'w-full', 'text-center');

            const throws = player.throws || [];
            const lastThrows = throws.slice(-3);
            const throwCount = throws.length;
            const startingPoints = gameData.points ?? 301;
            const remainingPoints = player.remainingPoints ?? startingPoints;
            const totalScored = Math.max(0, startingPoints - remainingPoints);
            const lastThrowValues = Array.from({ length: 3 }, (_, idx) => lastThrows[idx]?.points ?? 0);
            const lastRoundTotal = lastThrowValues.reduce((sum, val) => sum + val, 0);
            const averagePoints = player.averagePoints ?? (throwCount ? (totalScored / throwCount).toFixed(1) : 0);
            const isCurrentPlayer = this.isCurrentPlayer(gameData, player);

            const lastThrowsHTML = lastThrowValues.map((points, idx) => {
                const borderClass = idx < 2 ? 'border-r border-neutral-500' : '';
                return `<div class="${borderClass} flex justify-center items-center">${points > 0 ? points : '' }</div>`;
            }).join('');

            if (isCurrentPlayer) {
                item.classList.add('rounded-r-lg');
                item.style.boxShadow = '-6px 0 0 0 #dc2626';
            } else {
                item.classList.add('rounded-lg');
            }
            item.style.height = cardHeight;

            item.innerHTML = `
                <div class="flex flex-col border-r border-neutral-500">
                    <div class="flex flex-1 items-center justify-center font-bold p-1" data-size="main">${remainingPoints}</div>
                    <div class="border-t border-neutral-500 flex items-center justify-center py-0.5 px-1" >
                        ${player.name}
                    </div>
                </div>
                <div class="grid grid-cols-3 grid-rows-2 border-r border-neutral-500">
                    ${lastThrowsHTML}
                    <div class="col-span-3 border-t border-neutral-500 flex justify-center items-center">
                        ${lastRoundTotal}
                    </div>
                </div>
                <div class="grid grid-cols-2 grid-rows-2">
                    <div class="border-r border-neutral-500 flex flex-col justify-center items-center">
                        <span class="font-semibold" data-size="throw">${throwCount}</span>
                    </div>
                    <div class="flex flex-col justify-center items-center">
                        <span class="font-semibold" data-size="throw">${totalScored}</span>
                    </div>
                    <div class="col-span-2 border-t border-neutral-500 flex justify-center items-center">
                        &Oslash;&nbsp;<span class="averagePoints">${averagePoints}</span>
                    </div>
                </div>
            `;
            list.appendChild(item);
        });
    }

    /**
     * Update the game info display for X01 game mode
     * Shows current player, points remaining, and game status
     */
    updateGameInfo(gameData) {
        const infoMsg = byId('infoMsg');
        if (!infoMsg || !gameData) return;

        const status = gameData.status || 'unknown';
        const currentPlayer = this.getCurrentPlayer(gameData);
        const playerName = currentPlayer?.name || 'Unknown';
        const winner = this.getWinner(gameData);
        const winnerName = winner?.name || playerName;
        const points = gameData.points || 301;

        let statusText = '';
        switch(status) {
            case 'initialised':
                statusText = `Game Ready - ${points} Points`;
                break;
            case 'running':
                const remainingPoints = currentPlayer?.remainingPoints ?? points;
                statusText = `${playerName}'s Turn - ${remainingPoints} Points Remaining`;
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
}
