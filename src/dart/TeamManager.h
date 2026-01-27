#pragma once
#ifndef TeamManager_h
#define TeamManager_h

#include <Arduino.h>
#include <ArduinoJson.h>
#include <vector>
#include "../utils.h"
#include "Team.h"

/**
 * TeamManager - Singleton manager for teams
 *
 * Handles:
 * - Creating teams with GUID and color assignment
 * - Team CRUD operations
 * - Transient in-memory storage (no filesystem persistence)
 * - Player-to-team mappings
 */
class TeamManager
{
    private:
        std::vector<Team> teams;

        // Default team colors (hex codes)
        static const std::vector<String> DEFAULT_COLORS;

        TeamManager() = default;

        // Get next available color (finds first unused color, or cycles through)
        String getNextColor() {
            // Track which colors are already in use
            std::vector<bool> colorUsed(DEFAULT_COLORS.size(), false);

            for (const auto& team : teams) {
                String teamColor = team.getColor();
                for (size_t i = 0; i < DEFAULT_COLORS.size(); i++) {
                    if (DEFAULT_COLORS[i] == teamColor) {
                        colorUsed[i] = true;
                        break;
                    }
                }
            }

            // Return first unused color
            for (size_t i = 0; i < DEFAULT_COLORS.size(); i++) {
                if (!colorUsed[i]) {
                    return DEFAULT_COLORS[i];
                }
            }

            // All colors used, cycle back to start
            return DEFAULT_COLORS[teams.size() % DEFAULT_COLORS.size()];
        }

    private:
        /**
         * Find team index by ID. Returns -1 if not found.
         * SAFER THAN returning pointer since indices are stable even after reallocation.
         */
        int findTeamIndex(const String& teamId) const {
            for (size_t i = 0; i < teams.size(); i++) {
                if (teams[i].getId() == teamId) {
                    return static_cast<int>(i);
                }
            }
            return -1;
        }

    public:
        // Singleton instance
        static TeamManager& instance() {
            static TeamManager inst;
            return inst;
        }

        // Delete copy constructor and assignment operator
        TeamManager(const TeamManager&) = delete;
        TeamManager& operator=(const TeamManager&) = delete;

        // Create a new team with GUID and color
        Team createTeam(const String& name) {
            String id = generateUuid();
            String color = getNextColor();

            Team team(id, name, color);
            teams.push_back(team);
            return team;
        }

        // Create a team with specific color (for deserialization or custom colors)
        Team createTeamWithColor(const String& id, const String& name, const String& color) {
            Team team(id, name, color);
            teams.push_back(team);
            return team;
        }

        // Get all teams
        std::vector<Team>& getTeams() {
            return teams;
        }

        /**
         * Get team by ID (safe version - returns by value).
         * Returns empty Team object if not found.
         * 
         * SAFETY NOTE: Returns by value to avoid dangling pointers.
         * This is the preferred way to read team data.
         */
        Team getTeamById(const String& teamId) const {
            int idx = findTeamIndex(teamId);
            if (idx >= 0) {
                return teams[idx];  // Safe copy
            }
            return Team();  // Return empty team if not found
        }

        /**
         * Get team color by ID (convenience method).
         * Returns empty string if team not found.
         */
        String getTeamColor(const String& teamId) const {
            int idx = findTeamIndex(teamId);
            if (idx >= 0) {
                return teams[idx].getColor();
            }
            return "";
        }

        /**
         * Get team name by ID (convenience method).
         * Returns empty string if team not found.
         */
        String getTeamName(const String& teamId) const {
            int idx = findTeamIndex(teamId);
            if (idx >= 0) {
                return teams[idx].getName();
            }
            return "";
        }

        // Delete a team
        bool deleteTeam(const String& teamId) {
            int idx = findTeamIndex(teamId);
            if (idx >= 0) {
                teams.erase(teams.begin() + idx);
                return true;
            }
            return false;
        }

        // Rename a team
        bool renameTeam(const String& teamId, const String& newName) {
            int idx = findTeamIndex(teamId);
            if (idx >= 0) {
                teams[idx].setName(newName);
                return true;
            }
            return false;
        }

        // Set players for a team
        bool setTeamPlayers(const String& teamId, const std::vector<String>& playerIds) {
            int idx = findTeamIndex(teamId);
            if (idx >= 0) {
                teams[idx].setPlayers(playerIds);
                return true;
            }
            return false;
        }

        // Add a player to a team (removes from other teams first)
        bool assignPlayerToTeam(const String& teamId, const String& playerId) {
            // Remove player from all other teams
            for (auto& team : teams) {
                team.removePlayer(playerId);
            }

            // Add to specified team
            int idx = findTeamIndex(teamId);
            if (idx >= 0) {
                teams[idx].addPlayer(playerId);
                return true;
            }
            return false;
        }

        // Remove a player from a team
        bool removePlayerFromTeam(const String& teamId, const String& playerId) {
            int idx = findTeamIndex(teamId);
            if (idx >= 0) {
                teams[idx].removePlayer(playerId);
                return true;
            }
            return false;
        }

        // Get team ID for a player
        String getTeamIdForPlayer(const String& playerId) {
            for (const auto& team : teams) {
                if (team.hasPlayer(playerId)) {
                    return team.getId();
                }
            }
            return "";
        }

        // Clear all teams
        void clearAllTeams() {
            teams.clear();
        }

        // Serialize all teams to JSON array
        void serializeAllTeams(JsonArray& outArray) {
            for (const Team& team : teams) {
                JsonObject obj = outArray.add<JsonObject>();
                team.serialize(obj);
            }
        }

        /**
         * IMPORTANT: Teams are transient and stored ONLY in RAM.
         * They are NOT persisted to flash/SPIFFS.
         * All teams are cleared on device reset.
         */
        bool load() { return true; }
        bool save() { return true; }
};

#endif
