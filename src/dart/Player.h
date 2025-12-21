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
            Throw throws[3];
        };

    protected:
        String id;
        String name;
        uint16_t points = 0;
        uint8_t winPos = 0;
        std::vector<Throw> throws;


    public:
        Player()
        {
            //
        }

        Player(String id, const String& name) : id(id), name(name) {}

        void addThrow(Throw t)
        {
            this->throws.push_back(t);
        }

        bool hasWon()
        {
            return this->winPos > 0 ? true : false;
        }

        uint16_t getPoints() const
        {
            if (throws.empty())
                return this->points;

            uint16_t sum = 0;
            for(const Throw& t : throws)
                sum += t.getPoints();

            return sum;
        }

        void setPoints(uint16_t points)
        {
            this->points = points;
        }
        std::vector<Throw> getLastThrows(size_t amount);

        std::vector<Throw>& getThrows()
        {
            return throws;
        }

        const std::vector<Throw>& getThrows() const
        {
            return throws;
        }

        size_t getThrowCount() const
        {
            return throws.size();
        }

        void serialize(JsonObject& obj) {
            obj["id"] = id;
            obj["name"] = name;
            obj["winPos"] = winPos;
            obj["points"] = getPoints();
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
