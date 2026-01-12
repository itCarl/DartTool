#ifndef Player_h
#define Player_h

#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>
#include "Throw.h"


class Player
{
    private:
        struct Turn {
            uint8_t turnNumber;
            Throw throws[3];
            uint8_t throwCount;

            Turn() : turnNumber(0), throwCount(0) {}
            Turn(uint8_t num) : turnNumber(num), throwCount(0) {}
        };

    protected:
        String id;
        String name;
        uint16_t points = 0;
        uint8_t winPos = 0;
        std::vector<Turn> turns;

    public:
        Player()
        {
            //
        }

        Player(String id, const String& name) : id(id), name(name) {}

        void addThrow(Throw t)
        {
            // Create new turn if needed or add to current turn
            if (turns.empty() || turns.back().throwCount >= 3) {
                turns.push_back(Turn(turns.size()));
            }
            turns.back().throws[turns.back().throwCount] = t;
            turns.back().throwCount++;
        }

        // Add a throw to a specific turn number (creates the turn if missing)
        // Returns false if the target turn already has 3 throws
        bool addThrowToTurn(uint8_t turnNumber, const Throw& t)
        {
            // Try to find existing turn
            for (auto &turn : turns) {
                if (turn.turnNumber == turnNumber) {
                    if (turn.throwCount >= 3) return false; // turn full
                    turn.throws[turn.throwCount] = t;
                    turn.throwCount++;
                    return true;
                }
            }

            // Turn not found: create a new one
            Turn newTurn(turnNumber);
            newTurn.throws[0] = t;
            newTurn.throwCount = 1;
            turns.push_back(newTurn);
            return true;
        }

        bool hasWon() const
        {
            return this->winPos > 0 ? true : false;
        }

        uint16_t getPoints() const
        {
            if (turns.empty())
                return this->points;

            uint16_t sum = 0;
            for(const Turn& turn : turns) {
                for(uint8_t i = 0; i < turn.throwCount; i++) {
                    sum += turn.throws[i].getPoints();
                }
            }
            return sum;
        }

        void setPoints(uint16_t points)
        {
            this->points = points;
        }

        std::vector<Throw> getThrows() const
        {
            std::vector<Throw> result;
            for(const Turn& turn : turns) {
                for(uint8_t i = 0; i < turn.throwCount; i++) {
                    result.push_back(turn.throws[i]);
                }
            }
            return result;
        }

        std::vector<Throw> getThrowsFromTurn(uint8_t turnNumber) const
        {
            std::vector<Throw> result;
            for(const Turn& turn : turns) {
                if (turn.turnNumber == turnNumber) {
                    for(uint8_t i = 0; i < turn.throwCount; i++) {
                        result.push_back(turn.throws[i]);
                    }
                    break;
                }
            }
            return result;
        }

        size_t getThrowCount() const
        {
            if(this->turns.empty())
                return 0;

            size_t count = 0;
            for(const Turn& turn : turns) {
                count += turn.throwCount;
            }
            return count;
        }

        size_t getTurnCount() const
        {
            return turns.size();
        }

        // Undo the last throw (from the current/last turn)
        bool undoLastThrow()
        {
            if (this->turns.empty() || this->turns.back().throwCount == 0) {
                return false;
            }
            turns.back().throwCount--;
            return true;
        }

        // Remove the last turn completely (e.g., after a bust rollback)
        // Returns false if no turns are available to remove
        bool removeLastTurn()
        {
            if (turns.empty()) return false;
            turns.pop_back();
            return true;
        }

        // Clear all turns
        void clearTurns()
        {
            turns.clear();
        }

        // Reset all per-game state so the player can start a new match
        void resetGameState()
        {
            points = 0;
            winPos = 0;
            clearTurns();
        }

        void serialize(JsonObject& obj) {
            obj["id"] = this->id;
            obj["name"] = this->name;
            obj["winPos"] = this->winPos;
            obj["points"] = this->getPoints();
            obj["totalThrows"] = this->getThrowCount();

            // Serialize turns array with turn numbers
            JsonArray turnsArray = obj["turns"].to<JsonArray>();
            for (const Turn& turn : turns) {
                JsonObject turnObj = turnsArray.add<JsonObject>();
                turnObj["turnNumber"] = turn.turnNumber;

                JsonArray throwsArray = turnObj["throws"].to<JsonArray>();
                for(uint8_t i = 0; i < turn.throwCount; i++) {
                    JsonObject throwObj = throwsArray.add<JsonObject>();
                    throwObj["value"] = turn.throws[i].getValue();
                    throwObj["field"] = turn.throws[i].getField();
                    throwObj["points"] = turn.throws[i].getPoints();
                }
            }
        }

        static Player deserialize(const JsonObject& obj) {
            Player player(obj["id"], obj["name"].as<String>());
            return player;
        }

        void setId(String id)
        {
            this->id = id;
        }

        void setName(String name)
        {
            this->name = name;
        }

        void setWinPos(uint8_t pos)
        {
            this->winPos = pos;
        }

        String getId() const
        {
            return this->id;
        }

        String getName() const
        {
            return name;
        }
};

#endif
