#pragma once
#ifndef CricketGameMode_h
#define CricketGameMode_h

#include <map>
#include <vector>
#include "GameMode.h"
#include "DartGameStatus.h"

class CricketGameMode : public GameMode
{
    private:
        DartGameStatus status = DartGameStatus::unknown;

        struct PlayerCricketState {
            std::map<uint8_t, uint8_t> marks;
            uint16_t score = 0;
        };

        struct HistoryEntry {
            String playerId;
            Throw dartThrow;
        };

        std::vector<uint8_t> targets = {20, 19, 18, 17, 16, 15, 25};
        std::map<String, PlayerCricketState> playerState;
        std::vector<HistoryEntry> history;

        void initStateForPlayer(const String& playerId);
        bool isTarget(uint8_t value) const;
        bool opponentsClosed(uint8_t value, const String& playerId);
        void applyThrowToState(const String& playerId, const Throw& dartThrow);
        void rebuildStateFromHistory();
        void recomputeTurnTracking();
        bool allTargetsClosed(const String& playerId) const;
        uint16_t leadingScore() const;

    public:
        CricketGameMode();

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

        String getGameModeName() override { return "Cricket"; }
        String getGameModeDescription() override { return "Cricket - Close 15-20 and Bull to win"; }
};

#endif
