#pragma once
#ifndef X01GameMode_h
#define X01GameMode_h

#include "../GameMode.h"
#include "../DartGameStatus.h"

/**
 * X01 Game Mode Implementation
 *
 * Classic dart game where players start with a target score (301, 501, 1001)
 * and must reduce it to exactly zero.
 *
 * Rules:
 * - Players take turns throwing up to 3 darts per turn
 * - Throws are subtracted from the starting points
 * - If a throw would make the score negative or zero (without exact finish), it's a BUST
 * - Win condition: Reach exactly 0 points
 *
 * Implementation:
 * - Contains the original DartGame X01 game logic
 * - Handles turn progression, bust logic, win condition checking
 * - Provides JSON serialization for game state display
 */
class X01GameMode : public GameMode
{
    private:
        DartGameStatus status = DartGameStatus::unknown;

    public:
        X01GameMode();
        X01GameMode(uint16_t startingPoints);

        void reset() override;

        // Game status management
        DartGameStatus getStatus();
        void setStatus(DartGameStatus newStatus);
        String getStatusString();
        DartGameStatus stringToStatus(String status);

        // Core game logic
        DartThrowResult processDartThrow(uint8_t value, uint8_t multiplier = 1, double angle = 0.0, double radius = 0.0) override;

        // Serialization methods
        void serialize(JsonObject& obj) override;
        void serializeForDisplay(JsonObject& obj) override;
        void deserialize(const JsonObject& obj) override;
        void deserializePartial(const JsonObject& obj) override;

        // Game mode identification
        String getGameModeName() override { return "X01"; }
        String getGameModeDescription() override { return "Classic X01 - Reduce your score to exactly zero"; }

        // X01 is available for all game types
        GameModeAvailability getAvailability() override {
            return GameModeAvailability(true, true, true); // standard, team, tournament
        }

        void displayGameInfo() override;
};

#endif
