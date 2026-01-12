#pragma once
#ifndef GameMode_h
#define GameMode_h

#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>
#include "Player.h"
#include "Throw.h"
#include "DartGameStatus.h"

// Result structure for dart throw processing
struct DartThrowResult {
    bool success;
    String message;
    int score;
    uint16_t pointsRemaining;
    String playerName;
    String playerId;
    bool hasWon;
    String winner;
    String winnerId;
};

/**
 * Abstract base class for different dart game modes
 * Each game mode implementation handles:
 * - Game logic and rules (scoring, win conditions, etc.)
 * - Game state management (turn progression, player advancement)
 * - Serialization for display (JSON serialization of game state)
 */
class GameMode
{
    protected:
        uint8_t currentPlayerIndex = 0;
        uint8_t throwCounter = 0;        // throws in current turn (0-3)
        uint8_t winCount = 0;
        uint16_t points = 301;           // starting points
        uint8_t turn = 0;                // current round/turn number
        std::vector<Player> players;
        static const uint8_t THROWS_PER_TURN = 3;

        void resetPlayersState();

        Player& getCurrentPlayer();
        void nextPlayer();
        bool isPlayerTurnComplete();

    public:
        virtual ~GameMode() = default;

        // Game setup methods
        virtual void setPlayers(std::vector<Player>& selectedPlayers);
        virtual void reset() = 0;

        // Getters for game state
        uint8_t getCurrentPlayerIndex() { return currentPlayerIndex; }
        uint16_t getGamePoints() { return points; }
        void setGamePoints(uint16_t pts) { points = pts; }
        uint8_t getThrowCounter() { return throwCounter; }
        void setThrowCounter(uint8_t count) { throwCounter = count; }
        uint8_t getWinCount() { return winCount; }
        void setWinCount(uint8_t count) { winCount = count; }
        uint8_t getTurn() { return turn; }
        void setTurn(uint8_t t) { turn = t; }
        size_t getPlayerCount() { return players.size(); }
        Player& getPlayerAt(size_t index) { return players[index]; }

        // Throw management methods
        virtual bool addThrowToCurrentPlayer(const Throw& dartThrow);
        virtual bool addThrowToPlayer(const String& playerId, const Throw& dartThrow);
        virtual std::vector<Throw> getCurrentPlayerThrows();
        virtual std::vector<Throw> getPlayerThrows(const String& playerId);
        virtual bool undoLastThrow();
        virtual bool undoLastThrowForPlayer(const String& playerId);
        virtual uint16_t getCurrentPlayerRemainingPoints();
        virtual uint16_t getPlayerRemainingPoints(const String& playerId);

        // Pure virtual methods - each game mode implements its own logic
        // Process a dart throw according to game mode rules
        virtual DartThrowResult processDartThrow(uint8_t value, uint8_t multiplier = 1) = 0;

        // Game status management (must be implemented by each game mode)
        virtual DartGameStatus getStatus() = 0;
        virtual void setStatus(DartGameStatus newStatus) = 0;
        virtual String getStatusString() = 0;
        virtual DartGameStatus stringToStatus(String status) = 0;

        // Serialization methods
        virtual void serialize(JsonObject& obj) = 0;
        virtual void serializeForDisplay(JsonObject& obj) = 0;
        virtual void deserialize(const JsonObject& obj) = 0;
        virtual void deserializePartial(const JsonObject& obj) = 0;

        // Game mode identification
        virtual String getGameModeName() = 0;
        virtual String getGameModeDescription() = 0;

        // Display method for game-specific LCD content (rows 1-2)
        // Row 0 and Row 3 are handled by common display logic
        virtual void displayGameInfo() = 0;

        // List players
        virtual String listPlayers();
};

#endif
