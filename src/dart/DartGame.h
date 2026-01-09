#pragma once
#ifndef DartGame_h
#define DartGame_h

#include <Arduino.h>
#include <vector>
#include "DartGameStatus.h"
#include "Player.h"
#include "utils.h"

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

class DartGame
{
    protected:
        String id;
        DartGameStatus status = DartGameStatus::unknown;
        std::vector<Player> players;

        // Player *currentPlayer = nullptr;
        uint8_t currentPlayerIndex = 0; //use a pointer at a later point

        uint8_t throwCounter = 0;        // throws in current turn (0-3)
        uint8_t winCount = 0;
        uint16_t points = 301;           // starting points (X01 format: 301, 501, etc)
        uint8_t turn = 0;                // current round/turn number
        static const uint8_t THROWS_PER_TURN = 3;  // X01 standard: 3 throws per player per turn

        Player& getCurrentPlayer();
        void nextPlayer();  // to advance turn
        bool isPlayerTurnComplete();  // check if player has completed 3 throws

    public:
        DartGame();

        String listPlayers();
        void setPlayers(std::vector<Player> &selectedPlayers);

        DartGameStatus getStatus();
        void setStatus(DartGameStatus status);
        String getStatusString();
        DartGameStatus stringToStatus(String status);

        // Getters for game state
        String getId() { return id; }
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

        void reset();

        // Throw management methods
        bool addThrowToCurrentPlayer(const Throw& dartThrow);
        bool addThrowToPlayer(const String& playerId, const Throw& dartThrow);
        std::vector<Throw> getCurrentPlayerThrows();
        std::vector<Throw> getPlayerThrows(const String& playerId);
        bool undoLastThrow();
        bool undoLastThrowForPlayer(const String& playerId);
        uint16_t getCurrentPlayerRemainingPoints();
        uint16_t getPlayerRemainingPoints(const String& playerId);

        // Process a dart throw with full game logic
        DartThrowResult processDartThrow(int score);

        void serialize(JsonObject& obj);
        void serializeForDisplay(JsonObject& obj);
        void deserialize(const JsonObject& obj);
        void deserializePartial(const JsonObject& obj);

};

#endif
