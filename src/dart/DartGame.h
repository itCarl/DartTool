#pragma once
#ifndef DartGame_h
#define DartGame_h

#include <Arduino.h>
#include <vector>
#include "DartGameStatus.h"
#include "Player.h"
#include "utils.h"

class DartGame
{
    protected:
        String id;
        DartGameStatus status = DartGameStatus::unknown;
        std::vector<Player> players;

        // Player *currentPlayer = nullptr;
        uint8_t currentPlayerIndex = 0; //use a pointer at a later point

        uint8_t throwCounter = 0;
        uint8_t winCount = 0;
        uint16_t points = 301;
        uint8_t turn = 0;   // current turn

        Player& getCurrentPlayer();
        void nextPlayer();  // to advance turn

    public:
        DartGame();

        String listPlayers();
        void setPlayers(std::vector<Player> &selectedPlayers);

        DartGameStatus getStatus();
        void setStatus(DartGameStatus status);
        String getStatusString();
        DartGameStatus stringToStatus(String status);

        void serialize(JsonObject& obj);
        void deserialize(const JsonObject& obj);

};

#endif
