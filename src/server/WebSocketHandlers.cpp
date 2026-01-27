#include "../DartTool.h"
#include "server.h"
#include "WebSocketHandlers.h"
#include "GameCommandHandlers.h"
#include "HardwareCommandHandlers.h"

extern unsigned long wsLastLiveTime;

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

            // This will use the command table from server.cpp
            extern CommandEntry commandTable[];

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
        }
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
    if(var == "VERSION") {
        return String(VERSION);
    } else if(var == "BUILD_TIME") {
        return String(BUILD_TIME);
    }

    return String();
}

void cleanupWs()
{
    if (millis() - wsLastLiveTime > 5000) {
        ws.cleanupClients(4);
        wsLastLiveTime = millis();
    }
}
