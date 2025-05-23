#pragma once
#ifndef PlayerManager_h
#define PlayerManager_h

#include <Arduino.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

class PlayerManager
{
    public:
        PlayerManager() {
            //
        };

        static PlayerManager& instance()
        {
            static PlayerManager inst;
            return inst;
        }

        void addOrEditPlayer(const String& name)
        {
            JsonDocument doc;
            const char* filename = "/players.json";

            // Load existing players
            File file = LittleFS.open(filename, "r");
            if (file) {
                deserializeJson(doc, file);
                file.close();
            }

            // Check if name exists (case-insensitive)
            for (JsonObject obj : doc.as<JsonArray>()) {
                if (obj["name"] == name) {
                    obj["name"] = name; // Update if exists
                    save(doc);
                    return;
                }
            }

            // Add new player
            JsonObject newPlayer = doc.add<JsonObject>();
            newPlayer["id"] = generateUuid();
            newPlayer["name"] = name;
            save(doc);
            Serial.printf("[WS] Added player: %s\n", name);
        }

        void removePlayer(const String& id)
        {
            JsonDocument doc;
            const char* filename = "/players.json";

            File file = LittleFS.open(filename, "r");
            if (!file) return;
            deserializeJson(doc, file);
            file.close();

            JsonArray array = doc.as<JsonArray>();
            for (size_t i = 0; i < array.size(); i++) {
                if (array[i]["id"] == id) {
                    array.remove(i);
                    break;
                }
            }

            save(doc);
        }

        void getAllPlayers(JsonArray& outArray)
        {
            JsonDocument doc;
            File file = LittleFS.open("/players.json", "r");
            if (!file) return;

            deserializeJson(doc, file);
            file.close();

            for (JsonObject obj : doc.as<JsonArray>()) {
                JsonObject player = outArray.add<JsonObject>();
                player["id"] = obj["id"];
                player["name"] = obj["name"];
            }
        }

    private:
        String generateUuid() {
            char buf[37];
            snprintf(buf, sizeof(buf),
                "%04x%04x-%04x-%04x-%04x-%04x%04x%04x",
                random(0, 0xffff), random(0, 0xffff),
                random(0, 0xffff),
                (random(0, 0x0fff) | 0x4000), // version 4
                (random(0, 0x3fff) | 0x8000), // variant 1
                random(0, 0xffff), random(0, 0xffff), random(0, 0xffff)
            );
            return String(buf);
        }

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
