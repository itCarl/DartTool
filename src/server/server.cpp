#include "../DartTool.h"

#include "../web/CaptiveRequestHandler.h"
#include "../web/GameMasterMiddleware.h"
#include "../dart/GameModeFactory.h"
#include "../dart/TeamManager.h"

#include "server.h"
#include "GameCommandHandlers.h"
#include "HardwareCommandHandlers.h"
#include "TeamCommandHandlers.h"
#include "WebSocketHandlers.h"
#include "../external/ExternalService.h"

static String resolveGameModeType(const char* gameModeParam, uint16_t& points)
{
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
}

static std::vector<Player> snapshotCurrentPlayers()
{
    std::vector<Player> currentPlayers;
    for (size_t i = 0; i < game.getPlayerCount(); ++i) {
        currentPlayers.push_back(game.getPlayerAt(i));
    }
    return currentPlayers;
}

static void resetPlayersForNewGame()
{
    GameMode* mode = game.getGameMode();
    if (mode) {
        mode->reset();
    }
}

CommandEntry commandTable[] = {
    { "upt", [](JsonDocument& doc) {
        return true;
    }},
    { "getGame", handleGetGame },
    { "setGameStatus", [](JsonDocument& doc) {
        String newStatus = doc["s"].as<String>();
        DartGameStatus parsedStatus = game.stringToStatus(newStatus);

        if (parsedStatus == DartGameStatus::initialised) {
            resetPlayersForNewGame();
        }

        game.setStatus(parsedStatus);

        // When game is finished, reset it for a new game
        if (parsedStatus == DartGameStatus::done) {
            game.reset();
            game.setStatus(DartGameStatus::initialised);
        }

        return handleGetGame(doc);
    }},
    { "setGameMode", handleSetGameModeSelection },
    { "startGame", [](JsonDocument& doc) {
        // Validate that players are selected
        if (game.getPlayerCount() == 0) {
            doc["cmd"] = "startGameResponse";
            doc["success"] = false;
            doc["msg"] = "Cannot start game: No players selected";
            DEBUG_PRINTLN("[Game] Cannot start: No players selected");
            return true;
        }

        // Extract game configuration from frontend
        const char* gameModeParam = doc["mode"].as<const char*>();
        uint16_t points = doc["points"].is<uint16_t>() ? doc["points"].as<uint16_t>() : 501;
        resetPlayersForNewGame();
        std::vector<Player> existingPlayers = snapshotCurrentPlayers();
        String gameModeType = resolveGameModeType(gameModeParam, points);

        // Create the game mode using the factory
        auto newGameMode = GameModeFactory::createGameMode(gameModeType, points);
        if (!newGameMode) {
            doc["cmd"] = "startGameResponse";
            doc["success"] = false;
            doc["msg"] = "Failed to create game mode: " + gameModeType;
            DEBUG_PRINTLN("[Game] Failed to create game mode");
            return true;
        }

        // Set the new game mode
        game.setGameMode(std::move(newGameMode));

        // Re-attach selected players to the new mode
        if (!existingPlayers.empty()) {
            game.setPlayers(existingPlayers);
        }

        DEBUG_PRINT("[Game] Starting game with mode: ");
        DEBUG_PRINT(game.getGameModeName());
        if (game.getGameModeName() == "X01") {
            DEBUG_PRINT(" (");
            DEBUG_PRINT(points);
            DEBUG_PRINT(" points)");
        }
        DEBUG_PRINT(" with ");
        DEBUG_PRINT(game.getPlayerCount());
        DEBUG_PRINTLN(" players");

        // Set status to running
        game.setStatus(DartGameStatus::running);
        doc["cmd"] = "getGameStatus";

        return handleGetGame(doc);
    }},
    { "abortGame", [](JsonDocument& doc) {
        game.setStatus(DartGameStatus::aborted);
        doc["cmd"] = "getGameStatus";
        return true;
    }},
    { "selectPlayers", handleSelectPlayers },
    { "getAllPlayer", handleGetAllPlayer },
    { "addPlayer", handleAddPlayer },
    { "deletePlayer", handleDeletePlayer },
    { "fetchExternalPlayers", handleFetchExternalPlayers },
    { "dartThrow", handleDartThrow },
    { "dartUndo", handleDartUndo },
    { "setServo", handleSetServo },
    { "servoSequence", handleServoSequence },
    { "initServo", handleInitServo },
    { "setServoByDistance", handleSetServoByDistance },
    { "laserControl", handleLaserControl },
    { "getModeConfig", handleGetModeConfig },
    { "setModeConfig", handleSetModeConfig },
    { "getSystemInfo", handleGetSystemInfo },
    { "createTeam", handleCreateTeam },
    { "deleteTeam", handleDeleteTeam },
    { "renameTeam", handleRenameTeam },
    { "assignPlayerToTeam", handleAssignPlayerToTeam },
    { "removePlayerFromTeam", handleRemovePlayerFromTeam },
    { "setTeamPlayers", handleSetTeamPlayers },
    { "getAllTeams", handleGetAllTeams },
    { "startTeamGame", handleStartTeamGame },
    { nullptr, nullptr }
};

bool handleFileRead(AsyncWebServerRequest* request, String path)
{
    DEBUG_PRINT(F("WS FileRead: "));
    DEBUG_PRINTLN(path);

    DEBUG_PRINTLN(F("Exists."));
    request->send(LittleFS, path, "text/html", request->hasArg(F("download")), processor);
    return true;
}

bool captivePortal(AsyncWebServerRequest *request)
{
    if(!apActive) return false;
    return true;
}

bool CP_FILTER(AsyncWebServerRequest *request)
{
    return WiFi.localIP() != request->client()->localIP();
}

void initServer()
{
    //CORS compatiblity
    DefaultHeaders::Instance().addHeader(F("Access-Control-Allow-Origin"), "*");
    DefaultHeaders::Instance().addHeader(F("Access-Control-Allow-Methods"), "*");
    DefaultHeaders::Instance().addHeader(F("Access-Control-Allow-Headers"), "*");

    // Websocket
    ws.onEvent(onEvent);
    server.addHandler(&ws);
    if (apActive) {
        CaptiveRequestHandler* captiveHandler = new CaptiveRequestHandler();
        captiveHandler->setFilter(CP_FILTER);
        server.addHandler(captiveHandler);
    }

    // add a global middleware to the server
    server.addMiddleware(new GameMasterMiddleware());

    // root route
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
        handleFileRead(request, "/index.html");
    });

    server.serveStatic("/", LittleFS, "/");

    server.on("/settings", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(handleFileRead(request, "/settings.html")) return;
        request->send(LittleFS, "/settings.html", "text/html");
    });

    server.on("/debug", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(handleFileRead(request, "/debug.html")) return;
        request->send(LittleFS, "/debug.html", "text/html");
    });

    server.on("/api/settings", HTTP_GET, [](AsyncWebServerRequest *request) {
        char ssid[33], password[65], hostname[33];
        getWifiSettings(ssid, password, hostname);

        JsonDocument doc;
        doc["ssid"] = ssid;
        doc["password"] = password;
        doc["hostname"] = hostname;
        doc["version"] = VERSION;
        doc["buildTime"] = BUILD_TIME;

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/ap_settings", HTTP_GET, [](AsyncWebServerRequest *request) {
        char ssid[33], password[65], opens[33];
        uint8_t channel;
        bool hidden;
        getAPSettings(ssid, password, &channel, opens, &hidden);

        JsonDocument doc;
        doc["apSsid"] = ssid;
        doc["apPassword"] = password;
        doc["apChannel"] = channel;
        doc["apOpens"] = opens;
        doc["apHidden"] = hidden;

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/ap_settings", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        if (index == 0) {
            data[len] = '\0';
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data);

            if (error) {
                DEBUG_PRINT("[API] JSON parsing error: ");
                DEBUG_PRINTLN(error.c_str());
                request->send(400, "application/json", "{\"success\": false, \"message\": \"Invalid JSON\"}");
                return;
            }

            const char* ssid = doc["apSsid"].as<const char*>();
            const char* password = doc["apPassword"].as<const char*>();
            uint8_t channel = doc["apChannel"] | 1;
            const char* opens = doc["apOpens"].as<const char*>();
            bool hidden = doc["apHidden"] | false;

            if (!ssid || strlen(ssid) == 0) {
                request->send(400, "application/json", "{\"success\": false, \"message\": \"AP SSID is required\"}");
                return;
            }

            if (password && strlen(password) > 0 && strlen(password) < 8) {
                request->send(400, "application/json", "{\"success\": false, \"message\": \"AP password must be at least 8 characters\"}");
                return;
            }

            // Save AP settings
            saveAPSettings(ssid, password ? password : "", channel, opens ? opens : "noConnectionAfterBoot", hidden);

            DEBUG_PRINTLN("[API] AP settings updated");

            JsonDocument respDoc;
            respDoc["success"] = true;
            respDoc["message"] = "AP settings saved successfully";

            String response;
            serializeJson(respDoc, response);
            request->send(200, "application/json", response);
        }
    });

    server.on("/api/settings", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        if (index == 0) {
            data[len] = '\0';
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data);

            if (error) {
                DEBUG_PRINT("[API] JSON parsing error: ");
                DEBUG_PRINTLN(error.c_str());
                request->send(400, "application/json", "{\"success\": false, \"message\": \"Invalid JSON\"}");
                return;
            }

            const char* ssid = doc["ssid"].as<const char*>();
            const char* password = doc["password"].as<const char*>();
            const char* hostname = doc["hostname"].as<const char*>();

            if (!ssid || strlen(ssid) == 0) {
                request->send(400, "application/json", "{\"success\": false, \"message\": \"SSID is required\"}");
                return;
            }

            // Save settings
            saveWifiSettings(ssid, password ? password : "", hostname ? hostname : "DartTool");

            // Update global variables
            strncpy(clientSSID, ssid, 32);
            clientSSID[32] = '\0';
            strncpy(clientPass, password ? password : "", 64);
            clientPass[64] = '\0';

            if (hostname && strlen(hostname) > 0) {
                strncpy(apSSID, hostname, 32);
                apSSID[32] = '\0';
            }

            DEBUG_PRINTLN("[API] WiFi settings updated, reconnecting...");

            // Reconnect WiFi with new settings
            WiFi.disconnect(true);
            delay(1000);
            WiFi.mode(WIFI_STA);
            WiFi.setHostname(apSSID);
            WiFi.begin(clientSSID, clientPass);

            JsonDocument respDoc;
            respDoc["success"] = true;
            respDoc["message"] = "Settings saved successfully";

            String response;
            serializeJson(respDoc, response);
            request->send(200, "application/json", response);
        }
    });

    server.on("/api/reboot", HTTP_POST, [](AsyncWebServerRequest *request) {
        request->send(200, "application/json", "{\"success\": true, \"message\": \"Device rebooting...\"}");
        delay(500);
        ESP.restart();
    });

    // Data Sync API Endpoints
    server.on("/api/datasync/config", HTTP_GET, [](AsyncWebServerRequest *request) {
        JsonDocument doc;
        doc["endpoint"] = "";
        doc["enabled"] = false;

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/datasync/config", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        if (index == 0) {
            data[len] = '\0';
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data);

            if (error) {
                DEBUG_PRINT("[API] JSON parsing error: ");
                DEBUG_PRINTLN(error.c_str());
                request->send(400, "application/json", "{\"success\": false, \"message\": \"Invalid JSON\"}");
                return;
            }

            const char* endpoint = doc["url"].as<const char*>();
            bool enabled = doc["enabled"].as<bool>();

            DEBUG_PRINTLN("[API] Data Sync config updated");

            JsonDocument respDoc;
            respDoc["success"] = true;
            respDoc["message"] = "Data Sync config saved";

            String response;
            serializeJson(respDoc, response);
            request->send(200, "application/json", response);
        }
    });

    server.on("/api/datasync/sync", HTTP_POST, [](AsyncWebServerRequest *request) {
        JsonDocument doc;
        doc["success"] = true;
        doc["count"] = 0;
        doc["message"] = "Sync completed";

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/datasync/queue", HTTP_GET, [](AsyncWebServerRequest *request) {
        JsonDocument doc;
        JsonArray queue = doc["queue"].to<JsonArray>();

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/datasync/add", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        if (index == 0) {
            data[len] = '\0';
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data);

            if (error) {
                DEBUG_PRINT("[API] JSON parsing error: ");
                DEBUG_PRINTLN(error.c_str());
                request->send(400, "application/json", "{\"success\": false, \"message\": \"Invalid JSON\"}");
                return;
            }

            DEBUG_PRINTLN("[API] Dart throw added to queue");

            JsonDocument respDoc;
            respDoc["success"] = true;
            respDoc["message"] = "Dart throw added to queue";

            String response;
            serializeJson(respDoc, response);
            request->send(200, "application/json", response);
        }
    });

    // Operation Mode API Endpoints
    server.on("/api/mode/config", HTTP_GET, [](AsyncWebServerRequest *request) {
        JsonDocument doc;
        char mode[33] = {0};
        char gameEndpoint[257] = {0};
        int refreshInterval = 5;

        loadModeConfig(mode, gameEndpoint, refreshInterval);

        doc["mode"] = mode;
        doc["gameEndpoint"] = gameEndpoint;
        doc["refreshInterval"] = refreshInterval;

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/mode/config", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        if (index == 0) {
            data[len] = '\0';
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data);

            if (error) {
                DEBUG_PRINT("[API] JSON parsing error: ");
                DEBUG_PRINTLN(error.c_str());
                request->send(400, "application/json", "{\"success\": false, \"message\": \"Invalid JSON\"}");
                return;
            }

            const char* mode = doc["mode"].as<const char*>();
            const char* gameEndpoint = doc["serverApiUrl"].as<const char*>();
            int refreshInterval = doc["refreshInterval"].as<int>();

            if (!mode || strlen(mode) == 0) {
                request->send(400, "application/json", "{\"success\": false, \"message\": \"Mode is required\"}");
                return;
            }

            saveModeConfig(mode, gameEndpoint ? gameEndpoint : "", refreshInterval > 0 ? refreshInterval : 5);
            DEBUG_PRINTLN("[API] Display mode updated and saved");

            JsonDocument respDoc;
            respDoc["success"] = true;
            respDoc["message"] = "Display mode saved";

            String response;
            serializeJson(respDoc, response);
            request->send(200, "application/json", response);
        }
    });

    server.on("/api/mode/poll", HTTP_GET, [](AsyncWebServerRequest *request) {
        JsonDocument doc;
        doc["status"] = "unknown";

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    // External Service API Endpoints
    server.on("/api/external/config", HTTP_GET, [](AsyncWebServerRequest *request) {
        JsonDocument doc;
        doc["host"] = ExternalService::instance().getHost();
        doc["interval"] = ExternalService::instance().getPollInterval();
        doc["enabled"] = ExternalService::instance().isEnabled();
        doc["hasToken"] = ExternalService::instance().hasApiToken();

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/external/config", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        if (index == 0) {
            data[len] = '\0';
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data);

            if (error) {
                DEBUG_PRINT("[API] JSON parsing error: ");
                DEBUG_PRINTLN(error.c_str());
                request->send(400, "application/json", "{\"success\": false, \"message\": \"Invalid JSON\"}");
                return;
            }

            if (doc["token"].is<String>()) {
                String token = doc["token"].as<String>();
                ExternalService::instance().setApiToken(token);
                DEBUG_PRINTLN("[API] External service token updated");
            }

            if (doc["host"].is<String>()) {
                String host = doc["host"].as<String>();
                ExternalService::instance().setHost(host);
                DEBUG_PRINT("[API] External service host: ");
                DEBUG_PRINTLN(host);
            }

            if (doc["interval"].is<unsigned long>()) {
                unsigned long interval = doc["interval"].as<unsigned long>();
                ExternalService::instance().setPollInterval(interval);
                DEBUG_PRINT("[API] Poll interval: ");
                DEBUG_PRINT(interval);
                DEBUG_PRINTLN("ms");
            }

            if (doc["enabled"].is<bool>()) {
                bool enabled = doc["enabled"].as<bool>();
                ExternalService::instance().setEnabled(enabled);
                DEBUG_PRINT("[API] External polling enabled: ");
                DEBUG_PRINTLN(enabled ? "true" : "false");

                ExternalService::instance().resetPollTimer();
            }

            String curHost = ExternalService::instance().getHost();
            unsigned long curInterval = ExternalService::instance().getPollInterval();
            bool curEnabled = ExternalService::instance().isEnabled();
            const char* tokenPtr = nullptr;
            if (doc["token"].is<String>()) {
                tokenPtr = doc["token"].as<const char*>();
            }
            saveExternalServiceConfig(curHost.c_str(), tokenPtr, curEnabled, curInterval);

            DEBUG_PRINTLN("[API] External polling config updated and saved");

            JsonDocument respDoc;
            respDoc["success"] = true;
            respDoc["message"] = "External polling configuration saved";

            String response;
            serializeJson(respDoc, response);
            request->send(200, "application/json", response);
        }
    });

    // COMMAND API ENDPOINT (WebSocket Fallback)
    server.on("/api/command", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        if (index == 0) {
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data, len);

            if (error) {
                DEBUG_PRINT("[API] Command JSON parsing error: ");
                DEBUG_PRINTLN(error.c_str());
                request->send(400, "application/json", "{\"success\": false, \"message\": \"Invalid JSON\"}");
                return;
            }

            const char* cmd = doc["cmd"];

            if (!cmd) {
                request->send(400, "application/json", "{\"success\": false, \"message\": \"Missing 'cmd' field\"}");
                return;
            }

            DEBUG_PRINT("[API] Command received: ");
            DEBUG_PRINTLN(cmd);

            extern CommandEntry commandTable[];
            bool foundCmd = false;
            for (int i = 0; commandTable[i].cmd != nullptr; ++i) {
                if (strcmp(cmd, commandTable[i].cmd) == 0) {
                    if (commandTable[i].handler(doc)) {
                        String response;
                        serializeJson(doc, response);
                        request->send(200, "application/json", response);
                    } else {
                        request->send(200, "application/json", "{\"success\": true}");
                    }
                    foundCmd = true;
                    break;
                }
            }

            if (!foundCmd) {
                DEBUG_PRINTLN("[API] Unknown command");
                request->send(400, "application/json", "{\"success\": false, \"message\": \"Unknown command\"}");
            }
        }
    });

    server.on("/generate_204", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "text/html", "<meta http-equiv='refresh' content='0; url=/' />");
    });

    server.on("/style.css", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(LittleFS, "/style.css", "text/css");
    });

    server.on("/app.js", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(LittleFS, "/app.js", "text/javascript");
    });

    server.on("/ping", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "text/plain", "pong");
    });

    server.on("/uptime", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "text/plain", (String)millis());
    });

    server.on("/freeheap", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "text/plain", (String)ESP.getFreeHeap());
    });

    // FILESYSTEM API ENDPOINTS
    server.on("/api/filesystem/list", HTTP_GET, [](AsyncWebServerRequest *request) {
        String path = "/";
        if (request->hasParam("path")) {
            path = request->getParam("path")->value();
        }

        JsonDocument doc;
        JsonArray items = doc["items"].to<JsonArray>();

        File root = LittleFS.open(path);
        if (!root) {
            doc["success"] = false;
            doc["error"] = "Failed to open directory";
            String response;
            serializeJson(doc, response);
            request->send(404, "application/json", response);
            return;
        }

        if (!root.isDirectory()) {
            root.close();
            doc["success"] = false;
            doc["error"] = "Not a directory";
            String response;
            serializeJson(doc, response);
            request->send(400, "application/json", response);
            return;
        }

        File file = root.openNextFile();
        while (file) {
            JsonObject item = items.add<JsonObject>();
            item["name"] = String(file.name());
            item["path"] = String(file.path());
            item["isDirectory"] = file.isDirectory();
            if (!file.isDirectory()) {
                item["size"] = file.size();
            }
            file.close();
            file = root.openNextFile();
        }
        root.close();

        doc["success"] = true;
        doc["path"] = path;

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/filesystem/read", HTTP_GET, [](AsyncWebServerRequest *request) {
        if (!request->hasParam("path")) {
            request->send(400, "application/json", "{\"success\": false, \"error\": \"Missing 'path' parameter\"}");
            return;
        }

        String path = request->getParam("path")->value();

        if (!LittleFS.exists(path)) {
            JsonDocument doc;
            doc["success"] = false;
            doc["error"] = "File not found";
            String response;
            serializeJson(doc, response);
            request->send(404, "application/json", response);
            return;
        }

        File file = LittleFS.open(path, "r");
        if (!file) {
            JsonDocument doc;
            doc["success"] = false;
            doc["error"] = "Failed to open file";
            String response;
            serializeJson(doc, response);
            request->send(500, "application/json", response);
            return;
        }

        if (file.isDirectory()) {
            file.close();
            JsonDocument doc;
            doc["success"] = false;
            doc["error"] = "Path is a directory, not a file";
            String response;
            serializeJson(doc, response);
            request->send(400, "application/json", response);
            return;
        }

        String content = file.readString();
        file.close();

        JsonDocument doc;
        doc["success"] = true;
        doc["path"] = path;
        doc["content"] = content;
        doc["size"] = content.length();

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/filesystem/stats", HTTP_GET, [](AsyncWebServerRequest *request) {
        JsonDocument doc;
        doc["success"] = true;
        doc["total"] = (uint32_t)LittleFS.totalBytes();
        doc["used"] = (uint32_t)LittleFS.usedBytes();
        doc["free"] = (uint32_t)(LittleFS.totalBytes() - LittleFS.usedBytes());

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.onNotFound([](AsyncWebServerRequest *request) {
        request->send(404, "text/plain", "Not found");
    });

    ElegantOTA.begin(&server);
    server.begin();
    DEBUG_PRINTLN("Web Server started");
}