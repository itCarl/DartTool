// ============================================================================
// AROUND THE CLOCK GAME MODE
// ============================================================================
// Handles rendering for Around The Clock game mode

import { GameMode } from './GameMode.js';
import { byId, addClass } from '../utils.js';

export class AroundTheClockGameMode extends GameMode {
    constructor() {
        super();
    }

    getGameModeName() {
        return 'AroundTheClock';
    }

    getOptionsContainerId() {
        return 'aroundTheClockOptions';
    }

    /**
     * Render the player list for Around The Clock game mode
     * Shows current target number and progress through the sequence
     */
    populatePlayers(gameData) {
        const list = byId('activePlayerList');
        if (!list) return;

        list.innerHTML = '';

        gameData.players.forEach((player) => {
            const item = document.createElement('article');
            item.id = player.id;

            const isCurrentPlayer = this.isCurrentPlayer(gameData, player);
            const currentTarget = player.currentTarget || 1;
            const completedTargets = player.completedTargets || 0;
            const totalTargets = gameData.totalTargets || 20; // 1-20, or 1-20+Bull if includeBull is true

            const throws = player.throws || [];
            const lastThrows = throws.slice(-3);
            let throwsHTML = '';
            for (let i = 0; i < 3; i++) {
                const throwData = lastThrows[i];
                const throwValue = throwData ? throwData.value : '-';
                const opacity = i < throws.length % 3 ? '1' : '0.3';
                throwsHTML += `<div style="opacity: ${opacity};">
                    <span class="s4 center-align">${throwValue}</span>
                </div>`;
            }

            // Progress bar
            const progressPercent = totalTargets > 0 ? (completedTargets / totalTargets) * 100 : 0;
            const progressHTML = `
                <div class="progress-container" style="width: 100%; background-color: #ddd; border-radius: 4px; margin: 0.5rem 0;">
                    <div class="progress-bar" style="width: ${progressPercent}%; height: 20px; background-color: var(--primary); border-radius: 4px; transition: width 0.3s;"></div>
                </div>
            `;

            item.innerHTML = `
                <div class="grid no-space" style="${isCurrentPlayer ? 'outline: 3px solid gold;' : ''}">
                    <div class="s4 center-align">
                        <h4 class="currentTarget" style="padding:.25rem;"><b>${currentTarget}</b></h4>
                        <div style="padding:.5rem;">${player.name}</div>
                    </div>
                    <div class="s4 center-align" style="display: flex;flex-direction:column;align-items: stretch;height: 100%;">
                        <div class="throwGroup">
                            ${throwsHTML}
                        </div>
                    </div>
                    <div class="s4 center-align" style="display: flex;flex-direction:column;align-items: stretch;height: 100%;">
                        <div style="padding: 0.5rem;">
                            <div>Progress: ${completedTargets}/${totalTargets}</div>
                            ${progressHTML}
                        </div>
                    </div>
                </div>
            `;
            list.appendChild(item);
        });
    }

    /**
     * Update the game info display for Around The Clock game mode
     * Shows current player and their target
     */
    updateGameInfo(gameData) {
        const infoMsg = byId('infoMsg');
        if (!infoMsg || !gameData) return;

        const status = gameData.status || 'unknown';
        const currentPlayer = this.getCurrentPlayer(gameData);
        const playerName = currentPlayer?.name || 'Unknown';
        const currentTarget = currentPlayer?.currentTarget || 1;
        const winner = this.getWinner(gameData);
        const winnerName = winner?.name || playerName;

        let statusText = '';
        switch(status) {
            case 'initialised':
                statusText = 'Around The Clock - Game Ready';
                break;
            case 'running':
                statusText = `${playerName}'s Turn - Target: ${currentTarget}`;
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
