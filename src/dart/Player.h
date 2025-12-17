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

        uint16_t getPoints()
        {
            uint16_t sum = 0;
            for(Throw t : throws)
                sum += t.getPoints();

            return sum;
        }
        std::vector<Throw> getLastThrows(size_t amount);

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

        String getId()
        {
            return this->id;
        }

        String getName()
        {
            return name;
        }
};

#endif
