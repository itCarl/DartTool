#pragma once
#ifndef AroundTheClockGameMode_h
#define AroundTheClockGameMode_h

#include <map>
#include <vector>
#include "../GameMode.h"
#include "../DartGameStatus.h"

class AroundTheClockGameMode : public GameMode
{
    private:
        DartGameStatus status = DartGameStatus::unknown;

        struct HistoryEntry {
            String playerId;
            Throw dartThrow;
        };

        std::vector<uint8_t> sequence;
        std::map<String, size_t> progress; // index into sequence for next target
        std::vector<HistoryEntry> history;

        void initSequence();
        void initProgressForPlayer(const String& playerId);
        uint8_t currentTargetFor(const String& playerId) const;
        void applyThrow(const String& playerId, const Throw& dartThrow);
        void rebuildFromHistory();
        void recomputeTurnTracking();
        bool hasPlayerFinished(const String& playerId) const;

    public:
        AroundTheClockGameMode();

        void reset() override;
        void setPlayers(std::vector<Player>& selectedPlayers) override;

        DartGameStatus getStatus() override;
        void setStatus(DartGameStatus newStatus) override;
        String getStatusString() override;
        DartGameStatus stringToStatus(String status) override;

        DartThrowResult processDartThrow(uint8_t value, uint8_t multiplier = 1) override;
        bool undoLastThrow() override;

        void serialize(JsonObject& obj) override;
        void serializeForDisplay(JsonObject& obj) override;
        void deserialize(const JsonObject& obj) override;
        void deserializePartial(const JsonObject& obj) override;

        String getGameModeName() override { return "AroundTheClock"; }
        String getGameModeDescription() override { return "Around the Clock - Hit 1 through 20 then Bull"; }
        void displayGameInfo() override;
};

#endif
