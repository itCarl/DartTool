// ============================================================================
// BASE GAME MODE CLASS
// ============================================================================
// Abstract base class for game mode-specific rendering logic
// Similar to the backend GameMode.h structure

import { byId } from '../utils.js';

/**
 * Abstract base class for different game modes
 * Each game mode implementation handles:
 * - Player list rendering (game-specific display)
 * - Game info rendering (status messages, current state)
 * - Game mode options display
 */
export class GameMode {
    constructor() {
        if (new.target === GameMode) {
            throw new Error('Cannot instantiate abstract class GameMode');
        }
    }

    /**
     * Render the player list for this game mode
     * @param {Object} gameData - The game data object containing players and game state
     */
    populatePlayers(gameData) {
        throw new Error('Method populatePlayers() must be implemented by subclass');
    }

    /**
     * Update the game info display (status message, current player, etc.)
     * @param {Object} gameData - The game data object containing game state
     */
    updateGameInfo(gameData) {
        throw new Error('Method updateGameInfo() must be implemented by subclass');
    }

    /**
     * Get the game mode name
     * @returns {string} The name of the game mode
     */
    getGameModeName() {
        throw new Error('Method getGameModeName() must be implemented by subclass');
    }

    /**
     * Get the options container ID for this game mode
     * @returns {string} The ID of the options container element
     */
    getOptionsContainerId() {
        throw new Error('Method getOptionsContainerId() must be implemented by subclass');
    }

    /**
     * Show the options for this game mode
     */
    showOptions() {
        const optionsId = this.getOptionsContainerId();
        const optionsEl = byId(optionsId);
        if (optionsEl) {
            optionsEl.style.display = 'block';
        }
    }

    /**
     * Hide the options for this game mode
     */
    hideOptions() {
        const optionsId = this.getOptionsContainerId();
        const optionsEl = byId(optionsId);
        if (optionsEl) {
            optionsEl.style.display = 'none';
        }
    }

    /**
     * Helper method to get the current player from game data
     * @param {Object} gameData - The game data object
     * @returns {Object|null} The current player object or null
     */
    getCurrentPlayer(gameData) {
        if (!gameData || !gameData.players) return null;
        return gameData.players.find(p => p.id === gameData.currentPlayerId) || null;
    }

    /**
     * Helper method to get the winner from game data
     * @param {Object} gameData - The game data object
     * @returns {Object|null} The winner player object or null
     */
    getWinner(gameData) {
        if (!gameData || !gameData.players) return null;
        return gameData.players.find(p => p.winPos === 1) || null;
    }

    /**
     * Helper method to check if a player is the current player
     * @param {Object} gameData - The game data object
     * @param {Object} player - The player object to check
     * @returns {boolean} True if the player is the current player
     */
    isCurrentPlayer(gameData, player) {
        return gameData.currentPlayerId === player.id;
    }
}
