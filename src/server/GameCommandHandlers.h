#pragma once

#include <ArduinoJson.h>

// Game-related command handlers
bool handleGetGame(JsonDocument& doc);
bool handleSetGameModeSelection(JsonDocument& doc);
bool handleSelectPlayers(JsonDocument& doc);
bool handleGetAllPlayer(JsonDocument& doc);
bool handleAddPlayer(JsonDocument& doc);
bool handleDeletePlayer(JsonDocument& doc);
bool handleReset(JsonDocument& doc);
bool handleDartThrow(JsonDocument& doc);
bool handleDartUndo(JsonDocument& doc);
bool handleFetchExternalPlayers(JsonDocument& doc);
bool handleGetModeConfig(JsonDocument& doc);
bool handleSetModeConfig(JsonDocument& doc);
bool handleGetSystemInfo(JsonDocument& doc);
