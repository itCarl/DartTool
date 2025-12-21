#include "DartTool.h"

#include "web/CaptiveRequestHandler.h"
#include "web/GameMasterMiddleware.h"

using WsCommandHandler = std::function<bool(JsonDocument&)>; //typedef bool (*WsCommandHandler)(JsonDocument& doc);
struct CommandEntry {
    const char* cmd;
    WsCommandHandler handler;
};

bool handleGetGameStatus(JsonDocument& doc);
bool handleSelectPlayers(JsonDocument& doc);
bool handleGetAllPlayer(JsonDocument& doc);
bool handleAddPlayer(JsonDocument& doc);
bool handleDeletePlayer(JsonDocument& doc);
bool handleReset(JsonDocument& doc);
bool handleSetServo(JsonDocument& doc);
bool handleServoSequence(JsonDocument& doc);
bool handleInitServo(JsonDocument& doc);
bool handleSetServoByDistance(JsonDocument& doc);
bool handleLaserControl(JsonDocument& doc);
bool handleDartThrow(JsonDocument& doc);
bool handleDartUndo(JsonDocument& doc);
bool handleFetchExternalPlayers(JsonDocument& doc);

CommandEntry commandTable[] = {
    { "upt", [](JsonDocument& doc) {
        return true;
    }},
    { "getGameStatus", handleGetGameStatus },
    { "setGameStatus", [](JsonDocument& doc) {
        String newStatus = doc["s"].as<String>();
        game.setStatus(game.stringToStatus(newStatus));

        return handleGetGameStatus(doc);
    }},
    { "startGame", [](JsonDocument& doc) {
        // Extract game configuration from frontend
        const char* gameName = doc["name"].as<const char*>();
        const char* gameMode = doc["mode"].as<const char*>();

        // Set game points based on mode
        uint16_t points = 301;  // Default
        if (gameMode) {
            String modeStr(gameMode);
            if (modeStr == "201") points = 201;
            else if (modeStr == "301") points = 301;
            else if (modeStr == "401") points = 401;
            else if (modeStr == "601") points = 601;
            else if (modeStr == "801") points = 801;
        }

        DEBUG_PRINT("[Game] Starting game: ");
        DEBUG_PRINT(gameName ? gameName : "Unnamed Game");
        DEBUG_PRINT(" Mode: ");
        DEBUG_PRINTLN(points);

        // TODO: Store game configuration (name, points) in game object
        // For now, we just set the status to running
        game.setStatus(DartGameStatus::running);
        doc["cmd"] = "getGameStatus";

        return handleGetGameStatus(doc);
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
    { "rstCntlr", handleAddPlayer },
    { "dartThrow", handleDartThrow },
    { "dartUndo", handleDartUndo },
    { "setServo", handleSetServo },
    { "servoSequence", handleServoSequence },
    { "initServo", handleInitServo },
    { "setServoByDistance", handleSetServoByDistance },
    { "laserControl", handleLaserControl },
    { nullptr, nullptr }
};


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
    // if(apActive) server.addHandler(new CaptiveRequestHandler()).setFilter(CP_FILTER);

    // add a global middleware to the server
    server.addMiddleware(new GameMasterMiddleware());

    // root route
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
        // if(captivePortal(request)) return;
        handleFileRead(request, "/index.html");
        // request->send(LittleFS, "/index.html", "text/html", request->hasArg(F("download")), processor);
    });

    server.serveStatic("/", LittleFS, "/"); // /fs

    server.on("/game", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(handleFileRead(request, "/game.html")) return;
        request->send(LittleFS, "/game.html", "text/html");
    });

    server.on("/players", HTTP_GET, [](AsyncWebServerRequest *request) {
        if(handleFileRead(request, "/players.html")) return;
        request->send(LittleFS, "/players.html", "text/html");
    });

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
            WiFi.disconnect(true); // Disconnect and turn off WiFi
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
        doc["endpoint"] = "";  // Will be retrieved from storage
        doc["enabled"] = false;  // Will be retrieved from storage

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

            // TODO: Save to persistent storage
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
        // TODO: Process queue and send to external endpoint
        JsonDocument doc;
        doc["success"] = true;
        doc["count"] = 0;  // Number of synced items
        doc["message"] = "Sync completed";

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/datasync/queue", HTTP_GET, [](AsyncWebServerRequest *request) {
        // TODO: Return current queue items
        JsonDocument doc;
        JsonArray queue = doc["queue"].to<JsonArray>();
        // queue items will be populated here

        String response;
        serializeJson(doc, response);
        request->send(200, "application/json", response);
    });

    server.on("/api/datasync/add", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        if (index == 0) {
            data[len] = '\0';
            // TODO: Add dart throw to queue
            JsonDocument doc;
            DeserializationError error = deserializeJson(doc, data);

            if (error) {
                DEBUG_PRINT("[API] JSON parsing error: ");
                DEBUG_PRINTLN(error.c_str());
                request->send(400, "application/json", "{\"success\": false, \"message\": \"Invalid JSON\"}");
                return;
            }

            // Add to internal queue
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
        doc["mode"] = "display";  // Will be retrieved from storage
        doc["gameEndpoint"] = "";  // Will be retrieved from storage
        doc["refreshInterval"] = 5;  // Will be retrieved from storage

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

            // TODO: Save to persistent storage
            // TODO: If mode is display, start polling mechanism for external API
            DEBUG_PRINTLN("[API] Display mode updated");

            JsonDocument respDoc;
            respDoc["success"] = true;
            respDoc["message"] = "Display mode saved";

            String response;
            serializeJson(respDoc, response);
            request->send(200, "application/json", response);
        }
    });

    server.on("/api/mode/poll", HTTP_GET, [](AsyncWebServerRequest *request) {
        // TODO: Poll external API for game data when in display mode
        // TODO: Return game state from external endpoint
        JsonDocument doc;
        doc["status"] = "unknown";
        // Game data will be populated here from external API

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

            // Update API token (optional)
            if (doc["token"].is<String>()) {
                String token = doc["token"].as<String>();
                ExternalService::instance().setApiToken(token);
                DEBUG_PRINTLN("[API] External service token updated");
            }

            // Update external service host
            if (doc["host"].is<String>()) {
                String host = doc["host"].as<String>();
                ExternalService::instance().setHost(host);
                DEBUG_PRINT("[API] External service host: ");
                DEBUG_PRINTLN(host);
            }

            // Update polling interval (in milliseconds)
            if (doc["interval"].is<unsigned long>()) {
                unsigned long interval = doc["interval"].as<unsigned long>();
                ExternalService::instance().setPollInterval(interval);
                DEBUG_PRINT("[API] Poll interval: ");
                DEBUG_PRINT(interval);
                DEBUG_PRINTLN("ms");
            }

            // Update polling enabled status
            if (doc["enabled"].is<bool>()) {
                bool enabled = doc["enabled"].as<bool>();
                ExternalService::instance().setEnabled(enabled);
                DEBUG_PRINT("[API] External polling enabled: ");
                DEBUG_PRINTLN(enabled ? "true" : "false");

                // Reset poll timer when enabling/disabling
                ExternalService::instance().resetPollTimer();
            }

            // Persist configuration
            String curHost = ExternalService::instance().getHost();
            unsigned long curInterval = ExternalService::instance().getPollInterval();
            bool curEnabled = ExternalService::instance().isEnabled();
            // We cannot read back the token value; persist last provided token if any, else keep existing by passing nullptr
            const char* tokenPtr = nullptr;
            if (doc["token"].is<String>()) {
                tokenPtr = doc["token"].as<const char*>(); // may be empty string to clear
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

    // ============================================================================
    // COMMAND API ENDPOINT (WebSocket Fallback)
    // ============================================================================
    // This endpoint provides a REST API fallback when WebSocket is unavailable
    // Accepts same JSON commands as WebSocket messages
    server.on("/api/command", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
        if (index == 0) {
            // Do not write past provided buffer; parse with explicit length
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

            // Process command through same command table as WebSocket
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

    server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(LittleFS, "/script.js", "text/javascript");
    });

    server.on("/app.js", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(LittleFS, "/app.js", "text/javascript");
    });

    // health / availability check route
    server.on("/ping", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "text/plain", "pong");
    });

    server.on("/uptime", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "text/plain", (String)millis());
    });

    server.on("/freeheap", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "text/plain", (String)ESP.getFreeHeap());
    });

    // not found route
    server.onNotFound([](AsyncWebServerRequest *request) {
        // if(captivePortal(request)) return;

        request->send(404, "text/plain", "Not found");
        // request->redirect("/");
    });

    ElegantOTA.begin(&server);
    server.begin();
    DEBUG_PRINTLN("Web Server started");
}

void notify()
{
    JsonDocument doc;
    String out;
    // out.reserve(2048);

    JsonObject meta = doc["meta"].to<JsonObject>();
    meta["freeHeap"] = ESP.getFreeHeap();
    meta["cc"] = ws.count();

    serializeJson(doc, out);
    ws.textAll(out);
}

void handleWebSocketMessage(AsyncWebSocketClient *client, void *arg, uint8_t *data, size_t len)
{
    AwsFrameInfo *info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
        DEBUG_PRINTLN("[WS] Message incoming.");

        JsonDocument doc;
        String out;
        DeserializationError error = deserializeJson(doc, data, len);
        bool sendResponse = false;

        if (error) {
            DEBUG_PRINT("[WS] json parsing error: ");
            DEBUG_PRINTLN(error.c_str());
            return;
        }

        const char* cmd = doc["cmd"];

        if (cmd) {
            DEBUG_PRINT("[WS] Command received: ");
            DEBUG_PRINTLN(cmd);

            bool foundCmd = false;
            for (int i = 0; commandTable[i].cmd != nullptr; ++i) {
                if (strcmp(cmd, commandTable[i].cmd) == 0) {
                    sendResponse = commandTable[i].handler(doc);
                    foundCmd = true;
                }
            }
            if(!foundCmd) {
                DEBUG_PRINTLN("[WS] Unknown command");
                doc["msg"] = "Error: unknown command";
                sendResponse = true;
            }

            if(!sendResponse)
                return;

            serializeJson(doc, out);
            client->text(out);
            // ws.textAll(out);
        }

        // if(!sendResponse)
        //     return;

        // serializeJson(doc, out);
        // ws.textAll(out);
    }
}

void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len)
{
    switch(type)
    {
        case WS_EVT_CONNECT:
            DEBUG_PRINTF("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
            break;
        case WS_EVT_DISCONNECT:
            DEBUG_PRINTF("WebSocket client #%u disconnected\n", client->id());
            break;
        case WS_EVT_DATA:
            handleWebSocketMessage(client, arg, data, len);
            break;
        case WS_EVT_PONG:
        case WS_EVT_PING:
        case WS_EVT_ERROR:
            DEBUG_PRINTF("WebSocket client #%u Error\n", client->id());
            break;
    }
}

String processor(const String& var)
{
  // return "no data.";

    if(var == "VERSION") {
        return String(VERSION);
    } else if(var == "BUILD_TIME") {
        return String(BUILD_TIME);
    }

    return String();
}

bool captivePortal(AsyncWebServerRequest *request)
{
    if(!apActive) return false;

    // AsyncWebServerResponse *response = request->beginResponse(302);
    // response->addHeader(F("Location"), F("http://4.3.2.1"));
    // request->send(response);
    return true;
}

bool handleFileRead(AsyncWebServerRequest* request, String path)
{
    DEBUG_PRINT(F("WS FileRead: "));
    DEBUG_PRINTLN(path);

    // if(LittleFS.exists(path) || LittleFS.exists(path + ".gz")) {
        DEBUG_PRINTLN(F("Exists."));
        request->send(LittleFS, path, "text/html", request->hasArg(F("download")), processor);
        // request->send(request->beginResponse(LittleFS, path, "text/html", request->hasArg(F("download")), {}));
        return true;
    // }
    return false;
}

void cleanupWs()
{
    if (millis() - wsLastLiveTime > 5000) {
        ws.cleanupClients(4);
        wsLastLiveTime = millis();
    }
}
bool handleGetGameStatus(JsonDocument& doc)
{
    JsonObject resp = doc["game"].to<JsonObject>();
    resp["status"] = game.getStatusString();

    if(game.getStatus() == DartGameStatus::running)
    {
        game.serialize(resp);
    }

    return true;
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
        return true;
    }

    game.setPlayers(selectedPlayers);
    doc["msg"] = "Players selected successfully.";
    return true;
}

bool handleGetAllPlayer(JsonDocument& doc)
{
    JsonArray players = doc["players"].to<JsonArray>();
    PlayerManager::instance().getAllPlayers(players);
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

bool handleSetServo(JsonDocument& doc)
{
    int position = doc["pos"].as<int>();

    if (!servoIsValidPosition(position)) {
        doc["msg"] = "Invalid position: must be 0-180";
        doc["cmd"] = "servoResponse";
        return true;
    }

    servoSetPosition(position);

    doc["cmd"] = "servoResponse";
    doc["pos"] = position;
    doc["msg"] = "Servo position set";

    return true;
}

bool handleServoSequence(JsonDocument& doc)
{
    int sequence = doc["seq"].as<int>();

    switch(sequence) {
        case 1:
            servoSequence1();
            break;
        case 2:
            servoSequence2();
            break;
        case 3:
            servoSequence3();
            break;
        default:
            doc["msg"] = "Unknown sequence number";
            doc["cmd"] = "servoResponse";
            return true;
    }

    doc["cmd"] = "servoResponse";
    doc["seq"] = sequence;
    doc["msg"] = "Sequence executed";

    return true;
}

bool handleInitServo(JsonDocument& doc)
{
    servoInitSequence();

    doc["cmd"] = "servoResponse";
    doc["pos"] = 90;
    doc["msg"] = "Servo initialized";

    return true;
}

bool handleSetServoByDistance(JsonDocument& doc)
{
    double distance = doc["dis"].as<double>();
    double height = doc["height"].as<double>();

    // Use default height if not provided (assuming some default mounting height)
    if (height == 0) {
        height = 100.0; // Default height in cm, adjust as needed
    }

    // Calculate angle based on height and distance
    int theta = servoAngleByDistance(height, distance);
    int servoPos = round(theta + 40.5);

    if (!servoIsValidPosition(servoPos)) {
        doc["msg"] = "Calculated angle out of range (0-180)";
        doc["cmd"] = "servoResponse";
        doc["theta"] = theta;
        doc["pos"] = servoPos;
        return true;
    }

    servoSetPosition(servoPos);

    doc["cmd"] = "servoResponse";
    doc["theta"] = theta;
    doc["pos"] = servoPos;
    doc["distance"] = distance;
    doc["height"] = height;
    doc["msg"] = "Servo position set by distance";

    return true;
}

bool handleLaserControl(JsonDocument& doc)
{
    String action = doc["action"].as<String>();

    if (action == "on") {
        laserOn();
        doc["state"] = true;
        doc["msg"] = "Laser ON";
    } else if (action == "off") {
        laserOff();
        doc["state"] = false;
        doc["msg"] = "Laser OFF";
    } else if (action == "toggle") {
        laserToggle();
        doc["state"] = laserGetState();
        doc["msg"] = laserGetState() ? "Laser ON" : "Laser OFF";
    } else {
        doc["msg"] = "Invalid action. Use 'on', 'off', or 'toggle'";
        doc["state"] = laserGetState();
        return true;
    }

    doc["cmd"] = "laserResponse";
    return true;
}
bool handleDartThrow(JsonDocument& doc)
{
    // Validate score input
    int score = doc["score"].as<int>();

    // Delegate all game logic to DartGame
    DartThrowResult result = game.processDartThrow(score);

    // Prepare response from game result
    doc["msg"] = result.message;
    doc["cmd"] = "dartThrowResponse";
    doc["success"] = result.success;

    if (result.success) {
        doc["score"] = result.score;
        doc["pointsRemaining"] = result.pointsRemaining;
        doc["playerName"] = result.playerName;
        doc["playerId"] = result.playerId;

        if (result.hasWon) {
            doc["winner"] = result.winner;
            doc["winnerId"] = result.winnerId;
        }
    }

    // Return updated game status
    return handleGetGameStatus(doc);
}

bool handleDartUndo(JsonDocument& doc)
{
    // TODO: Implement dart undo logic
    // This will revert the last dart throw for current player

    doc["msg"] = "Last dart throw undone";
    doc["cmd"] = "dartUndoResponse";
    return true;
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

