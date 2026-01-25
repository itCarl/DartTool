#pragma once
#ifndef DartGame_h
#define DartGame_h

#include <Arduino.h>
#include <vector>
#include <memory>
#include "DartGameStatus.h"
#include "Player.h"
#include "../utils.h"
#include "GameMode.h"

/**
 * DartGame - Main game controller
 *
 * Responsibilities:
 * - Manages game lifecycle and unique game ID
 * - Holds and delegates to a GameMode implementation
 * - Provides a unified interface for game operations regardless of game mode
 * - Orchestrates state management and player operations
 *
 * The actual game logic (scoring rules, win conditions, etc.) is delegated
 * to the active GameMode instance (e.g., X01GameMode, CricketGameMode, etc.)
 */
class DartGame
{
    protected:
        String id;
        std::unique_ptr<GameMode> gameMode;  // Strategy pattern: holds the active game mode

    public:
        DartGame();
        ~DartGame() = default;

        // Game mode management
        void setGameMode(std::unique_ptr<GameMode> newGameMode);
        GameMode* getGameMode() { return gameMode.get(); }
        String getGameModeName();

        // Delegation methods that forward to the active game mode
        String listPlayers();
        void setPlayers(std::vector<Player> &selectedPlayers);

        DartGameStatus getStatus();
        void setStatus(DartGameStatus status);
        String getStatusString();
        DartGameStatus stringToStatus(String status);

        // Getters for game state (delegated to game mode)
        String getId() { return id; }
        uint8_t getCurrentPlayerIndex();
        uint16_t getGamePoints();
        void setGamePoints(uint16_t pts);
        uint8_t getThrowCounter();
        void setThrowCounter(uint8_t count);
        uint8_t getWinCount();
        void setWinCount(uint8_t count);
        uint8_t getTurn();
        void setTurn(uint8_t t);
        size_t getPlayerCount();
        Player& getPlayerAt(size_t index);

        void reset();

        // Throw management methods (delegated to game mode)
        bool addThrowToCurrentPlayer(const Throw& dartThrow);
        bool addThrowToPlayer(const String& playerId, const Throw& dartThrow);
        std::vector<Throw> getCurrentPlayerThrows();
        std::vector<Throw> getPlayerThrows(const String& playerId);
        bool undoLastThrow();
        bool undoLastThrowForPlayer(const String& playerId);
        uint16_t getCurrentPlayerRemainingPoints();
        uint16_t getPlayerRemainingPoints(const String& playerId);

        // Process a dart throw - delegated to active game mode
        DartThrowResult processDartThrow(uint8_t value, uint8_t multiplier = 1, double angle = 0.0, double radius = 0.0);

        // Display game-specific info on LCD
        void displayGameInfo();

        // Serialization methods - delegated to game mode
        void serialize(JsonObject& obj);
        void serializeForDisplay(JsonObject& obj);
        void deserialize(const JsonObject& obj);
        void deserializePartial(const JsonObject& obj);

};

#endif
