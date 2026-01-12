#pragma once
#ifndef PlayerManager_h
#define PlayerManager_h

#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include "utils.h"

class PlayerManager
{
    private:
        PlayerManager() {
            //
        };

    protected:
        std::vector<Player> players;

    public:
        static PlayerManager& instance()
        {
            static PlayerManager inst;
            return inst;
        }

        void init()
        {
            PlayerManager::instance().loadPlayers();
        }

        void addOrEditPlayer(const String& name, const String& id = "")
        {
            if (name.isEmpty()) return;

            // If ID is provided, check if player with that ID exists
            if (!id.isEmpty()) {
                for (Player& player : players) {
                    if (player.getId() == id) {
                        player.setName(name);
                        savePlayers();
                        Serial.printf("[WS] Updated player: %s (ID: %s)\n", name.c_str(), id.c_str());
                        return;
                    }
                }
            }

            // Check if player with same name already exists (for backward compatibility)
            for (Player& player : players) {
                if (player.getName().equalsIgnoreCase(name)) {
                    player.setName(name);
                    savePlayers();
                    Serial.printf("[WS] Updated player: %s\n", name.c_str());
                    return;
                }
            }

            // Create new player with provided ID or generate new one
            String playerId = !id.isEmpty() ? id : generateUuid();
            Player newPlayer(playerId, name);
            players.push_back(newPlayer);
            savePlayers();

            Serial.printf("[WS] Added player: %s (ID: %s)\n", name.c_str(), playerId.c_str());
        }

        void removePlayer(const String& id)
        {
            if (id.isEmpty()) return;

            Player target = getPlayerById(id);
            if (target.getId().isEmpty()) {
                Serial.printf("[WS] Player with ID %s not found.\n", id.c_str());
                return;
            }

            for (size_t i = 0; i < players.size(); ++i) {
                if (players[i].getId() == target.getId()) {
                    players.erase(players.begin() + i);
                    Serial.printf("[WS] Removed player with ID: %s\n", id.c_str());
                    savePlayers();
                    break;
                }
            }
        }

        std::vector<Player> getPlayersByIds(const std::vector<String>& ids)
        {
            std::vector<Player> selected;
            // Iterate through IDs in order to maintain selection order
            for (const String& id : ids) {
                for (Player& p : players) {
                    if (p.getId() == id) {
                        selected.push_back(p);
                        break;  // Found this player, move to next ID
                    }
                }
            }
            return selected;
        }

        // Player* getPlayerById(const String& id)
        // {
        //     for (Player& player : players) {
        //         if (player.getId() == id) {
        //             return &player;
        //         }
        //     }
        //     return nullptr;
        // }

        Player getPlayerById(const String& id)
        {
            for (Player& player : players) {
                if (player.getId() == id) {
                    return player;
                }
            }

            return Player();
        }

        void serializeAllPlayers(JsonArray& outArray)
        {
            for (Player& player : players) {
                JsonObject obj = outArray.add<JsonObject>();
                player.serialize(obj);
            }
        }

        void loadPlayers() {
            players.clear();
            File file = LittleFS.open("/players.json", "r");
            if (!file) return;

            JsonDocument doc;
            deserializeJson(doc, file);
            file.close();

            for (JsonObject obj : doc.as<JsonArray>()) {
                players.push_back(Player::deserialize(obj));
            }
        }

        void savePlayers() {
            JsonDocument doc;
            JsonArray arr = doc.to<JsonArray>();

            for (Player& p : players) {
                JsonObject obj = arr.add<JsonObject>();
                p.serialize(obj);
            }

            File file = LittleFS.open("/players.json", "w");
            serializeJson(doc, file);
            file.close();
        }

    private:
        void save(JsonDocument& doc)
        {
            File file = LittleFS.open("/players.json", "w");
            if (!file) {
                Serial.println("Failed to open players.json for writing");
                return;
            }
            serializeJson(doc, file);
            file.close();
        }
};

#endif
