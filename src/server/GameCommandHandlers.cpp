#include "../DartTool.h"
#include "../dart/GameModeFactory.h"
#include "../external/ExternalService.h"
#include "GameCommandHandlers.h"

bool handleGetGame(JsonDocument& doc)
{
    JsonObject resp = doc["game"].to<JsonObject>();
    resp["status"] = game.getStatusString();
    game.serializeForDisplay(resp);

    GameMode* mode = game.getGameMode();
    if (mode && mode->getGameType() == GameType::TEAM) {
        JsonArray teamsArray = resp["teams"].to<JsonArray>();
        TeamManager::instance().serializeAllTeams(teamsArray);
    }

    return true;
}

bool handleSetGameModeSelection(JsonDocument& doc)
{
    const char* gameModeParam = doc["mode"].as<const char*>();
    uint16_t points = doc["points"].is<uint16_t>() ? doc["points"].as<uint16_t>() : 501;

    if (game.getStatus() == DartGameStatus::running) {
        doc["cmd"] = "setGameModeResponse";
        doc["success"] = false;
        doc["msg"] = "Cannot change game mode while a game is running";
        return true;
    }

    // Helper function for resolving game mode
    auto resolveGameModeType = [](const char* gameModeParam, uint16_t& points) -> String {
        String gameModeType = "X01";

        auto isNumeric = [](const String& value) {
            if (value.isEmpty()) return false;
            for (size_t i = 0; i < value.length(); ++i) {
                if (!isDigit(value.charAt(i))) return false;
            }
            return true;
        };

        if (gameModeParam) {
            String modeStr(gameModeParam);
            String normalized = modeStr;
            normalized.toLowerCase();

            if (isNumeric(modeStr)) {
                points = modeStr.toInt();
                gameModeType = "X01";
            } else if (normalized == "x01") {
                gameModeType = "X01";
            } else if (normalized == "cricket") {
                gameModeType = "Cricket";
            } else if (normalized == "aroundtheclock" || normalized == "around_the_clock" || normalized == "atc") {
                gameModeType = "AroundTheClock";
            } else {
                gameModeType = modeStr;
            }
        }

        return gameModeType;
    };

    auto resetPlayersForNewGame = []() {
        GameMode* mode = game.getGameMode();
        if (mode) {
            mode->reset();
        }
    };

    auto snapshotCurrentPlayers = []() -> std::vector<Player> {
        std::vector<Player> currentPlayers;
        for (size_t i = 0; i < game.getPlayerCount(); ++i) {
            currentPlayers.push_back(game.getPlayerAt(i));
        }
        return currentPlayers;
    };

    resetPlayersForNewGame();
    std::vector<Player> existingPlayers = snapshotCurrentPlayers();
    String gameModeType = resolveGameModeType(gameModeParam, points);

    auto newGameMode = GameModeFactory::createGameMode(gameModeType, points);
    if (!newGameMode) {
        doc["cmd"] = "setGameModeResponse";
        doc["success"] = false;
        doc["msg"] = "Failed to create game mode: " + gameModeType;
        DEBUG_PRINTLN("[Game] Failed to preview game mode");
        return true;
    }

    game.setGameMode(std::move(newGameMode));

    if (!existingPlayers.empty()) {
        game.setPlayers(existingPlayers);
    }

    game.setStatus(DartGameStatus::initialised);

    doc["cmd"] = "setGameModeResponse";
    doc["success"] = true;
    doc["mode"] = game.getGameModeName();
    doc["points"] = game.getGamePoints();

    return handleGetGame(doc);
}

bool handleSelectPlayers(JsonDocument& doc)
{
    if (!doc["playerIds"].is<JsonArray>()) {
        doc["msg"] = "Missing or invalid 'playerIds' array.";
        return true;
    }

    JsonArray selectedIds = doc["playerIds"].as<JsonArray>();
    std::vector<String> idList;

    // Convert JsonArray to vector<String>
    for (String id : selectedIds) {
        idList.push_back(id);
    }

    // Get all players with the selected IDs
    std::vector<Player> selectedPlayers = PlayerManager::instance().getPlayersByIds(idList);

    if (selectedPlayers.empty()) {
        doc["msg"] = "No valid players found with provided IDs.";
        // Clear display when no players selected
        printCentered("No players selected", 2);
        return true;
    }

    game.setPlayers(selectedPlayers);

    // Display selected players on LCD
    displaySelectedPlayers(selectedPlayers);

    doc["msg"] = "Players selected successfully.";
    return true;
}

bool handleGetAllPlayer(JsonDocument& doc)
{
    JsonArray players = doc["players"].to<JsonArray>();
    PlayerManager::instance().serializeAllPlayers(players);

    return true;
}

bool handleAddPlayer(JsonDocument& doc)
{
    const char* name = doc["name"];
    if (!name || strlen(name) <= 0)
        return false;

    // Optional: accept ID from client (for external service sync)
    const char* id = doc["id"];
    String playerId = (id && strlen(id) > 0) ? String(id) : "";

    PlayerManager::instance().addOrEditPlayer(name, playerId);
    doc["msg"] = "Player added successfully";
    return true;
}

bool handleDeletePlayer(JsonDocument& doc)
{
    const char* id = doc["id"];
    if (!id || strlen(id) <= 0)
        return false;

    PlayerManager::instance().removePlayer(id);
    doc["msg"] = "Player deleted successfully";
    return true;
}

bool handleReset(JsonDocument& doc)
{
    DartTool::instance().reset();
    return false;
}

bool handleDartThrow(JsonDocument& doc)
{
    // Validate score input
    uint8_t value = doc["score"].as<uint8_t>();
    uint8_t multiplier = 1;
    if (doc["multiplier"].is<uint8_t>()) {
        multiplier = doc["multiplier"].as<uint8_t>();
    }

    // Extract polar coordinates if provided
    double angle = 0.0;
    double radius = 0.0;
    if (doc["polar"].is<JsonObject>()) {
        JsonObject polar = doc["polar"].as<JsonObject>();
        if (polar["angle"].is<double>()) {
            angle = polar["angle"].as<double>();
        }
        if (polar["radius"].is<double>()) {
            radius = polar["radius"].as<double>();
        }
    }

    // Delegate all game logic to DartGame
    DartThrowResult result = game.processDartThrow(value, multiplier, angle, radius);

    // Prepare response from game result
    doc["msg"] = result.message;
    doc["cmd"] = "dartThrowResponse";
    doc["success"] = result.success;

    // Include throw details in response
    if (result.success) {
        doc["score"] = result.score;
        doc["playerName"] = result.playerName;
        doc["playerId"] = result.playerId;

        if (result.hasWon) {
            doc["winner"] = result.winner;
            doc["winnerId"] = result.winnerId;
        }
    }

    return handleGetGame(doc);
}

bool handleDartUndo(JsonDocument& doc)
{
    bool undone = game.undoLastThrow();

    doc["cmd"] = "dartUndoResponse";
    doc["success"] = undone;
    doc["msg"] = undone ? "Last dart throw undone" : "No throw to undo";

    return handleGetGame(doc);
}

bool handleFetchExternalPlayers(JsonDocument& doc)
{
    // Call the external player fetch function via ExternalService
    bool success = ExternalService::instance().fetchPlayers();

    if (success) {
        doc["msg"] = "Players fetched from external service";
        doc["status"] = "success";
        // Return the updated player list
        return handleGetAllPlayer(doc);
    } else {
        doc["msg"] = "Failed to fetch players from external service";
        doc["status"] = "error";
        return false;
    }
}

bool handleGetModeConfig(JsonDocument& doc)
{
    char mode[33] = {0};
    char gameEndpoint[257] = {0};
    int refreshInterval = 5;

    loadModeConfig(mode, gameEndpoint, refreshInterval);

    doc["cmd"] = "getModeConfigResponse";
    doc["mode"] = mode;
    doc["gameEndpoint"] = gameEndpoint;
    doc["refreshInterval"] = refreshInterval;
    doc["success"] = true;

    return true;
}

bool handleSetModeConfig(JsonDocument& doc)
{
    const char* mode = doc["mode"].as<const char*>();
    const char* gameEndpoint = doc["serverApiUrl"].as<const char*>();
    int refreshInterval = doc["refreshInterval"].as<int>();

    if (!mode || strlen(mode) == 0) {
        doc["cmd"] = "setModeConfigResponse";
        doc["success"] = false;
        doc["msg"] = "Mode is required";
        return true;
    }

    // Save to persistent storage
    saveModeConfig(mode, gameEndpoint ? gameEndpoint : "", refreshInterval > 0 ? refreshInterval : 5);

    DEBUG_PRINTLN("[WS] Mode config saved via WebSocket");

    doc["cmd"] = "setModeConfigResponse";
    doc["success"] = true;
    doc["msg"] = "Mode config saved";

    return true;
}

bool handleGetSystemInfo(JsonDocument& doc)
{
    doc["cmd"] = "getSystemInfoResponse";
    doc["heap"] = ESP.getFreeHeap();
    doc["uptime"] = millis();

    return true;
}
