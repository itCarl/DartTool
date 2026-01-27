#pragma once
#ifndef GameMode_h
#define GameMode_h

#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>
#include <map>
#include "Player.h"
#include "Throw.h"
#include "DartGameStatus.h"

// Game type enum for Standard, Team, Tournament modes
enum class GameType : uint8_t {
    STANDARD = 0,
    TEAM = 1,
    TOURNAMENT = 2
};

// Structure to hold game mode availability flags
struct GameModeAvailability {
    bool standard;
    bool team;
    bool tournament;

    // Default constructor
    GameModeAvailability() : standard(true), team(false), tournament(false) {}

    // Parameterized constructor
    GameModeAvailability(bool std, bool tm, bool tourn)
        : standard(std), team(tm), tournament(tourn) {}
};

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
        GameType gameType = GameType::STANDARD;  // Current game type
        std::map<String, uint16_t> teamPoints;  // Team ID -> shared points (for team mode)
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
        GameType getGameType() { return gameType; }
        void setGameType(GameType type) { gameType = type; }

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
        virtual DartThrowResult processDartThrow(uint8_t value, uint8_t multiplier = 1, double angle = 0.0, double radius = 0.0) = 0;

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

        // Helper method for child classes to add common fields to serializeForDisplay
        void addCommonDisplayFields(JsonObject& obj) const {
            obj["gameType"] = static_cast<uint8_t>(gameType);  // 0=STANDARD, 1=TEAM, 2=TOURNAMENT
        }

        // Game mode identification
        virtual String getGameModeName() = 0;
        virtual String getGameModeDescription() = 0;

        // Game mode availability for different game types
        // Returns which game types (standard, team, tournament) this mode supports
        virtual GameModeAvailability getAvailability() = 0;

        // Check if this game mode is available for a specific game type
        bool isAvailableFor(GameType type) {
            GameModeAvailability avail = getAvailability();
            switch (type) {
                case GameType::STANDARD:
                    return avail.standard;
                case GameType::TEAM:
                    return avail.team;
                case GameType::TOURNAMENT:
                    return avail.tournament;
                default:
                    return false;
            }
        }

        // Display method for game-specific LCD content (rows 1-2)
        // Row 0 and Row 3 are handled by common display logic
        virtual void displayGameInfo() = 0;

        // List players
        virtual String listPlayers();
};

#endif
