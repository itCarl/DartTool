// ============================================================================
// CRICKET GAME MODE
// ============================================================================
// Handles rendering for Cricket game mode

import { GameMode } from './GameMode.js';
import { byId, addClass } from '../utils.js';

export class CricketGameMode extends GameMode {
    constructor() {
        super();
    }

    getGameModeName() {
        return 'Cricket';
    }

    getOptionsContainerId() {
        return 'cricketOptions';
    }

    /**
     * Render the player list for Cricket game mode
     * Shows cricket marks/hits for each target (15-20, Bull), scores, and marks progress
     */
    populatePlayers(gameData) {
        const list = byId('activePlayerList');
        if (!list) return;

        list.innerHTML = '';

        // Cricket targets: 20, 19, 18, 17, 16, 15, Bull(25)
        const targets = [20, 19, 18, 17, 16, 15, 25];

        gameData.players.forEach((player) => {
            const item = document.createElement('article');
            item.id = player.id;

            const isCurrentPlayer = this.isCurrentPlayer(gameData, player);
            const cricketScore = player.cricketScore || 0;
            const cricketMarks = player.cricketMarks || {};

            // Build marks display for each target
            let marksHTML = '<div class="cricket-marks">';
            targets.forEach(target => {
                const marks = cricketMarks[target] || 0;
                const marksSymbol = this.getMarksSymbol(marks);
                marksHTML += `
                    <div class="cricket-target">
                        <span class="target-number">${target === 25 ? 'B' : target}</span>
                        <span class="marks">${marksSymbol}</span>
                    </div>
                `;
            });
            marksHTML += '</div>';

            const throws = player.throws || [];
            const lastThrows = throws.slice(-3);
            let throwsHTML = '';
            for (let i = 0; i < 3; i++) {
                const throwData = lastThrows[i];
                const throwPoints = throwData ? throwData.points : 0;
                const opacity = i < throws.length % 3 ? '1' : '0.3';
                throwsHTML += `<div style="opacity: ${opacity};">
                    <span class="s4 center-align">${throwPoints}</span>
                </div>`;
            }

            item.innerHTML = `
                <div class="grid no-space" style="${isCurrentPlayer ? 'outline: 3px solid gold;' : ''}">
                    <div class="s4 center-align">
                        <h4 class="cricketScore" style="padding:.25rem;"><b>${cricketScore}</b></h4>
                        <div style="padding:.5rem;">${player.name}</div>
                    </div>
                    <div class="s4 center-align">
                        ${marksHTML}
                    </div>
                    <div class="s4 center-align" style="display: flex;flex-direction:column;align-items: stretch;height: 100%;">
                        <div class="throwGroup">
                            ${throwsHTML}
                        </div>
                    </div>
                </div>
            `;
            list.appendChild(item);
        });
    }

    /**
     * Convert cricket marks count to display symbol
     * @param {number} marks - Number of marks (0-3+)
     * @returns {string} Display symbol for marks
     */
    getMarksSymbol(marks) {
        if (marks === 0) return '-';
        if (marks === 1) return '/';
        if (marks === 2) return 'X';
        if (marks >= 3) return '⊗'; // Closed
        return '-';
    }

    /**
     * Update the game info display for Cricket game mode
     * Shows current player and game status
     */
    updateGameInfo(gameData) {
        const infoMsg = byId('infoMsg');
        if (!infoMsg || !gameData) return;

        const status = gameData.status || 'unknown';
        const currentPlayer = this.getCurrentPlayer(gameData);
        const playerName = currentPlayer?.name || 'Unknown';
        const winner = this.getWinner(gameData);
        const winnerName = winner?.name || playerName;

        let statusText = '';
        switch(status) {
            case 'initialised':
                statusText = 'Cricket Game Ready';
                break;
            case 'running':
                const cricketScore = currentPlayer?.cricketScore || 0;
                statusText = `${playerName}'s Turn - Score: ${cricketScore}`;
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
