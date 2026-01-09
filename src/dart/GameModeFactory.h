#pragma once
#ifndef GameModeFactory_h
#define GameModeFactory_h

#include <Arduino.h>
#include <memory>
#include "GameMode.h"
#include "X01GameMode.h"
#include "CricketGameMode.h"
#include "AroundTheClockGameMode.h"

/**
 * GameModeFactory
 *
 * Factory class for creating game mode instances based on user selection.
 * This allows the web menu to easily instantiate different game modes.
 *
 * Usage:
 *   String selectedMode = "X01";
 *   uint16_t startingPoints = 501;
 *   auto gameMode = GameModeFactory::createGameMode(selectedMode, startingPoints);
 *   dartGame.setGameMode(std::move(gameMode));
 *
 * To add a new game mode:
 *   1. Create a new class inheriting from GameMode (e.g., CricketGameMode)
 *   2. Implement all pure virtual methods
 *   3. Add a case statement in createGameMode() method
 */
class GameModeFactory
{
    public:
        /**
         * Create a game mode instance by name
         * @param modeName The name of the game mode (e.g., "X01", "Cricket", "Around the Clock")
         * @param startingPoints Optional starting points for modes that use it (e.g., X01)
         * @return A unique_ptr to the created GameMode, or nullptr if mode not found
         */
        static std::unique_ptr<GameMode> createGameMode(const String& modeName, uint16_t startingPoints = 501)
        {
            // Normalize mode name (convert to lowercase and strip spaces/underscores for case-insensitive matching)
            String normalizedName = modeName;
            normalizedName.toLowerCase();
            normalizedName.replace(" ", "");
            normalizedName.replace("_", "");

            if (normalizedName == "x01") {
                DEBUG_PRINT("[DT] Creating X01GameMode with starting points: ");
                DEBUG_PRINTLN(startingPoints);
                return std::unique_ptr<GameMode>(new X01GameMode(startingPoints));
            }
            if (normalizedName == "cricket") {
                DEBUG_PRINTLN("[DT] Creating CricketGameMode");
                return std::unique_ptr<GameMode>(new CricketGameMode());
            }
            if (normalizedName == "aroundtheclock" || normalizedName == "atc") {
                DEBUG_PRINTLN("[DT] Creating AroundTheClockGameMode");
                return std::unique_ptr<GameMode>(new AroundTheClockGameMode());
            }

            DEBUG_PRINT("[DT] Error: Unknown game mode: ");
            DEBUG_PRINTLN(modeName);
            return nullptr;
        }

        /**
         * Get a list of available game modes
         * Useful for populating the web menu with available options
         * @return Array of game mode names
         */
        static void getAvailableGameModes(String** modeNames, size_t* count)
        {
            static const String modes[] = {"X01", "Cricket", "AroundTheClock"};
            static const size_t modeCount = 3;

            *modeNames = (String*)modes;
            *count = modeCount;
        }

        /**
         * Get description of a game mode
         * @param modeName The name of the game mode
         * @return A human-readable description of the game mode
         */
        static String getGameModeDescription(const String& modeName)
        {
            String normalizedName = modeName;
            normalizedName.toLowerCase();

            if (normalizedName == "x01") {
                return "Classic X01 - Reduce your score to exactly zero";
            }
            if (normalizedName == "cricket") {
                return "Cricket - Close 20,19,18,17,16,15 and Bull";
            }
            if (normalizedName == "aroundtheclock" || normalizedName == "atc") {
                return "Around the Clock - Hit 1 through 20 then Bull";
            }

            return "Unknown game mode";
        }

    private:
        // Factory is a utility class with static methods only
        GameModeFactory() = delete;
};

#endif
