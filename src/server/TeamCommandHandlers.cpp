#include "../DartTool.h"
#include "../dart/GameModeFactory.h"
#include "../dart/TeamManager.h"
#include "TeamCommandHandlers.h"

bool handleCreateTeam(JsonDocument& doc)
{
    // Create a new team with GUID and color
    String teamName = doc["team"]["name"].as<String>();
    if (teamName.isEmpty()) {
        teamName = "Team " + String(TeamManager::instance().getTeams().size() + 1);
    }

    Team newTeam = TeamManager::instance().createTeam(teamName);

    // Display team creation on LCD
    // printCentered("Team Created", 0);
    // printCentered(teamName, 1);
    // printCentered("Color: " + newTeam.getColor(), 2);

    doc["cmd"] = "createTeamResponse";
    doc["success"] = true;

    JsonObject teamObj = doc["team"].to<JsonObject>();
    newTeam.serialize(teamObj);

    return true;
}

bool handleDeleteTeam(JsonDocument& doc)
{
    // Delete a team by ID
    String teamId = doc["teamId"].as<String>();
    bool success = TeamManager::instance().deleteTeam(teamId);

    doc["cmd"] = "deleteTeamResponse";
    doc["success"] = success;

    if (!success) {
        doc["msg"] = "Team not found";
    }

    return true;
}

bool handleRenameTeam(JsonDocument& doc)
{
    // Rename a team
    String teamId = doc["teamId"].as<String>();
    String newName = doc["name"].as<String>();

    bool success = TeamManager::instance().renameTeam(teamId, newName);

    doc["cmd"] = "renameTeamResponse";
    doc["success"] = success;

    if (!success) {
        doc["msg"] = "Team not found";
    }

    return true;
}

bool handleAssignPlayerToTeam(JsonDocument& doc)
{
    // Assign a single player to a team
    String teamId = doc["teamId"].as<String>();
    String playerId = doc["playerId"].as<String>();

    bool success = TeamManager::instance().assignPlayerToTeam(teamId, playerId);

    doc["cmd"] = "assignPlayerToTeamResponse";
    doc["success"] = success;

    if (!success) {
        doc["msg"] = "Team not found";
    }

    return true;
}

bool handleRemovePlayerFromTeam(JsonDocument& doc)
{
    // Remove a player from a team
    String teamId = doc["teamId"].as<String>();
    String playerId = doc["playerId"].as<String>();

    bool success = TeamManager::instance().removePlayerFromTeam(teamId, playerId);

    doc["cmd"] = "removePlayerFromTeamResponse";
    doc["success"] = success;

    if (!success) {
        doc["msg"] = "Team not found";
    }

    return true;
}

bool handleSetTeamPlayers(JsonDocument& doc)
{
    // Assign multiple players to a team at once
    String teamId = doc["teamId"].as<String>();
    JsonArray playerIdsArray = doc["playerIds"].as<JsonArray>();

    std::vector<String> playerIds;
    for (JsonVariant v : playerIdsArray) {
        playerIds.push_back(v.as<String>());
    }

    bool success = TeamManager::instance().setTeamPlayers(teamId, playerIds);

    doc["cmd"] = "setTeamPlayersResponse";
    doc["success"] = success;

    if (!success) {
        doc["msg"] = "Team not found";
    }

    return true;
}

bool handleGetAllTeams(JsonDocument& doc)
{
    // Get all teams
    doc["cmd"] = "getAllTeamsResponse";
    doc["success"] = true;

    JsonArray teamsArray = doc["teams"].to<JsonArray>();
    TeamManager::instance().serializeAllTeams(teamsArray);

    return true;
}

bool handleStartTeamGame(JsonDocument& doc)
{
    // Start a team game - currently only supports X01
    DEBUG_PRINTLN("[Team] Start team game requested");

    // Validate teams array
    if (!doc["teams"].is<JsonArray>()) {
        doc["cmd"] = "startTeamGameResponse";
        doc["success"] = false;
        doc["msg"] = "Missing or invalid 'teams' array";
        return true;
    }

    JsonArray teamsArray = doc["teams"].as<JsonArray>();
    if (teamsArray.size() == 0) {
        doc["cmd"] = "startTeamGameResponse";
        doc["success"] = false;
        doc["msg"] = "No teams provided";
        return true;
    }

    // Get game mode (default to X01 for now)
    const char* gameModeParam = doc["mode"].as<const char*>();
    String gameModeType = gameModeParam ? String(gameModeParam) : "X01";

    // Validate game mode exists and supports team mode
    auto newGameMode = GameModeFactory::createGameMode(gameModeType, 501);
    if (!newGameMode) {
        doc["cmd"] = "startTeamGameResponse";
        doc["success"] = false;
        doc["msg"] = "Unknown game mode: " + gameModeType;
        return true;
    }

    // Check if this game mode supports team mode
    if (!newGameMode->isAvailableFor(GameType::TEAM)) {
        doc["cmd"] = "startTeamGameResponse";
        doc["success"] = false;
        doc["msg"] = "Game mode '" + gameModeType + "' does not support team play";
        return true;
    }

    uint16_t points = doc["points"].is<uint16_t>() ? doc["points"].as<uint16_t>() : 501;

    // Collect all player IDs from all teams, maintaining team order
    std::vector<String> allPlayerIds;
    std::vector<String> teamNames;
    std::vector<size_t> teamSizes;
    std::map<String, String> playerIdToTeamId; // Map player ID to team ID

    for (JsonObject team : teamsArray) {
        String teamName = team["name"].as<String>();
        String teamId = team["id"].as<String>();
        JsonArray playerIds = team["players"].as<JsonArray>();

        if (playerIds.size() == 0) {
            continue; // Skip empty teams
        }

        teamNames.push_back(teamName);
        teamSizes.push_back(playerIds.size());

        for (String playerId : playerIds) {
            allPlayerIds.push_back(playerId);
            playerIdToTeamId[playerId] = teamId.isEmpty() ? teamName : teamId;
        }
    }

    if (allPlayerIds.empty()) {
        doc["cmd"] = "startTeamGameResponse";
        doc["success"] = false;
        doc["msg"] = "No players assigned to any team";
        return true;
    }

    // Get all players from PlayerManager
    std::vector<Player> selectedPlayers = PlayerManager::instance().getPlayersByIds(allPlayerIds);

    if (selectedPlayers.empty()) {
        doc["cmd"] = "startTeamGameResponse";
        doc["success"] = false;
        doc["msg"] = "No valid players found";
        return true;
    }

    // Assign team IDs and colors to players
    for (auto& player : selectedPlayers) {
        String playerId = player.getId();
        if (playerIdToTeamId.find(playerId) != playerIdToTeamId.end()) {
            String teamId = playerIdToTeamId[playerId];
            player.setTeamId(teamId);

            // Get team color from TeamManager (safe version - returns by value)
            String teamColor = TeamManager::instance().getTeamColor(teamId);
            if (!teamColor.isEmpty()) {
                player.setTeamColor(teamColor);
                DEBUG_PRINT("[Team] Player ");
                DEBUG_PRINT(player.getName());
                DEBUG_PRINT(" assigned to team ");
                DEBUG_PRINT(player.getTeamId());
                DEBUG_PRINT(" with color ");
                DEBUG_PRINTLN(player.getTeamColor());
            } else {
                DEBUG_PRINT("[Team] Player ");
                DEBUG_PRINT(player.getName());
                DEBUG_PRINT(" assigned to team ");
                DEBUG_PRINT(player.getTeamId());
                DEBUG_PRINTLN(" (color not found)");
            }
        }
    }

    // Reset and create game mode
    GameMode* mode = game.getGameMode();
    if (mode) {
        mode->reset();
    }

    // Create game mode with specified points (recreate with correct points)
    auto finalGameMode = GameModeFactory::createGameMode(gameModeType, points);
    if (!finalGameMode) {
        doc["cmd"] = "startTeamGameResponse";
        doc["success"] = false;
        doc["msg"] = "Failed to create game mode";
        return true;
    }

    // Set the new game mode
    game.setGameMode(std::move(finalGameMode));

    // Set game type mode to TEAM
    GameMode* newMode = game.getGameMode();
    if (newMode) {
        newMode->setGameType(GameType::TEAM);
    }

    // Set players (this will initialize team points)
    game.setPlayers(selectedPlayers);

    DEBUG_PRINT("[Team] Starting team game with mode: X01 (");
    DEBUG_PRINT(points);
    DEBUG_PRINT(" points) with ");
    DEBUG_PRINT(teamNames.size());
    DEBUG_PRINT(" teams, ");
    DEBUG_PRINT(selectedPlayers.size());
    DEBUG_PRINTLN(" players total");

    // Set status to running
    game.setStatus(DartGameStatus::running);

    // Return success with team info
    doc["cmd"] = "startTeamGameResponse";
    doc["success"] = true;

    // Include team structure in response for frontend
    JsonArray respTeams = doc["teamInfo"].to<JsonArray>();
    size_t playerIndex = 0;
    for (size_t t = 0; t < teamNames.size(); t++) {
        JsonObject teamObj = respTeams.add<JsonObject>();
        teamObj["name"] = teamNames[t];
        JsonArray teamPlayerIds = teamObj["playerIds"].to<JsonArray>();
        for (size_t p = 0; p < teamSizes[t] && playerIndex < selectedPlayers.size(); p++) {
            teamPlayerIds.add(selectedPlayers[playerIndex].getId());
            playerIndex++;
        }
    }

    // Call handleGetGame to include game state in response
    extern bool handleGetGame(JsonDocument& doc);
    return handleGetGame(doc);
}
