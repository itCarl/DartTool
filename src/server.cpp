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
        game.setStatus(DartGameStatus::created);
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
    { "rstCntlr", handleAddPlayer },
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

    server.on("/generate_204", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(200, "text/html", "<meta http-equiv='refresh' content='0; url=/' />");
    });

    server.on("/style.css", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(LittleFS, "/style.css", "text/css");
    });

    server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(LittleFS, "/script.js", "text/javascript");
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
        data[len] = '\0';
        DEBUG_PRINTLN("[WS] Message incoming.");

        JsonDocument doc;
        String out;
        DeserializationError error = deserializeJson(doc, data);
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

    if(game.getStatus() == DartGameStatus::created || game.getStatus() == DartGameStatus::running)
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
    std::vector<Player> selectedPlayers;

    for (String id : selectedIds) {
        Player player = PlayerManager::instance().getPlayerById(id);
        selectedPlayers.push_back(player);
        break;
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
    if (!name && strlen(name) <= 0)
        return false;

    PlayerManager::instance().addOrEditPlayer(name);
    return true;
}

bool handleDeletePlayer(JsonDocument& doc)
{
    const char* id = doc["id"];
    if (id && strlen(id) <= 0)
        return false;

    PlayerManager::instance().removePlayer(id);
    return true;
}

bool handleReset(JsonDocument& doc)
{
    DartTool::instance().reset();
    return false;
}
