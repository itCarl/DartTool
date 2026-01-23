// ============================================================================
// GAME MODE FACTORY
// ============================================================================
// Factory pattern for creating game mode-specific handlers
// Similar to the backend GameModeFactory.h

import { X01GameMode } from './X01GameMode.js';
import { CricketGameMode } from './CricketGameMode.js';
import { AroundTheClockGameMode } from './AroundTheClockGameMode.js';

/**
 * Factory class for creating game modes
 * Maps game mode names to their corresponding classes
 */
export class GameModeFactory {
    constructor() {
        // Map of game mode names to classes
        this.gameModeMap = {
            'X01': X01GameMode,
            'Cricket': CricketGameMode,
            'AroundTheClock': AroundTheClockGameMode,
            'Golf': X01GameMode, // Fallback to X01 handler for now
            'Tennis': X01GameMode, // Fallback to X01 handler for now
            'Highscore': X01GameMode // Fallback to X01 handler for now
        };

        // Cache of instantiated game modes
        this.gameModeCache = {};
    }

    /**
     * Get a handler for the specified game mode
     * @param {string} gameMode - The game mode name (e.g., 'X01', 'Cricket', 'AroundTheClock')
     * @returns {GameMode} The handler instance for the game mode
     */
    getGameMode(gameMode) {
        // Check if handler is already cached
        if (this.gameModeCache[gameMode]) {
            return this.gameModeCache[gameMode];
        }

        // Get the class for this game mode
        const GameModeClass = this.gameModeMap[gameMode];

        if (!GameModeClass) {
            console.warn(`No game mode handler found for: ${gameMode}, falling back to X01`);
            // Fallback to X01 handler
            if (!this.gameModeCache['X01']) {
                this.gameModeCache['X01'] = new X01GameMode();
            }
            return this.gameModeCache['X01'];
        }

        // Create and cache the handler
        this.gameModeCache[gameMode] = new GameModeClass();
        return this.gameModeCache[gameMode];
    }

    /**
     * Hide all game mode options
     */
    hideAllOptions() {
        Object.keys(this.gameModeMap).forEach(gameMode => {
            const mode = this.getGameMode(gameMode);
            mode.hideOptions();
        });
    }

    /**
     * Get a list of all supported game modes
     * @returns {string[]} Array of game mode names
     */
    getSupportedGameModes() {
        return Object.keys(this.gameModeMap);
    }

    /**
     * Check if a game mode is supported
     * @param {string} gameMode - The game mode name to check
     * @returns {boolean} True if the game mode is supported
     */
    isSupported(gameMode) {
        return gameMode in this.gameModeMap;
    }
}

// Export a singleton instance
export const gameModeFactory = new GameModeFactory();
