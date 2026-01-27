#ifndef Team_h
#define Team_h

#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>

/**
 * Team - Represents a team in team game modes
 *
 * Contains:
 * - Unique GUID identifier
 * - Team name
 * - Hex color code for visual identification
 * - List of player IDs belonging to this team
 */
class Team
{
    private:
        String id;          // GUID identifier
        String name;        // Team name
        String color;       // Hex color code (e.g., "#FF0000")
        std::vector<String> playerIds;  // Player IDs in this team

    public:
        Team() {}

        Team(const String& id, const String& name, const String& color)
            : id(id), name(name), color(color) {}

        // Getters
        String getId() const { return id; }
        String getName() const { return name; }
        String getColor() const { return color; }
        const std::vector<String>& getPlayerIds() const { return playerIds; }

        // Setters
        void setId(const String& newId) { id = newId; }
        void setName(const String& newName) { name = newName; }
        void setColor(const String& newColor) { color = newColor; }

        // Player management
        void addPlayer(const String& playerId) {
            // Avoid duplicates
            for (const auto& pid : playerIds) {
                if (pid == playerId) return;
            }
            playerIds.push_back(playerId);
        }

        void removePlayer(const String& playerId) {
            playerIds.erase(
                std::remove(playerIds.begin(), playerIds.end(), playerId),
                playerIds.end()
            );
        }

        void setPlayers(const std::vector<String>& players) {
            playerIds = players;
        }

        void clearPlayers() {
            playerIds.clear();
        }

        bool hasPlayer(const String& playerId) const {
            for (const auto& pid : playerIds) {
                if (pid == playerId) return true;
            }
            return false;
        }

        size_t getPlayerCount() const {
            return playerIds.size();
        }

        // Serialization
        void serialize(JsonObject& obj) const {
            obj["id"] = id;
            obj["name"] = name;
            obj["color"] = color;

            JsonArray playersArray = obj["players"].to<JsonArray>();
            for (const String& playerId : playerIds) {
                playersArray.add(playerId);
            }
        }

        static Team deserialize(const JsonObject& obj) {
            Team team(
                obj["id"].as<String>(),
                obj["name"].as<String>(),
                obj["color"].as<String>()
            );

            if (obj["players"].is<JsonArray>()) {
                JsonArray playersArray = obj["players"].as<JsonArray>();
                for (JsonVariant playerVar : playersArray) {
                    team.addPlayer(playerVar.as<String>());
                }
            }

            return team;
        }
};

#endif
