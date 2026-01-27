#pragma once

#include <ArduinoJson.h>

// Team management command handlers
bool handleCreateTeam(JsonDocument& doc);
bool handleDeleteTeam(JsonDocument& doc);
bool handleRenameTeam(JsonDocument& doc);
bool handleAssignPlayerToTeam(JsonDocument& doc);
bool handleRemovePlayerFromTeam(JsonDocument& doc);
bool handleSetTeamPlayers(JsonDocument& doc);
bool handleGetAllTeams(JsonDocument& doc);
bool handleStartTeamGame(JsonDocument& doc);
