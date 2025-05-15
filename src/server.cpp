#include "DartTool.h"


void initServer()
{
    // Websocket
    ws.onEvent(onEvent);
    server.addHandler(&ws);

    // root route
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        // request->send(200, "text/plain", "Hello, world");
        request->send(LittleFS, "/index.html", "text/html", false, processor);
    });

    server.serveStatic("/", LittleFS, "/");

    // style route
    server.on("/style.css", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(LittleFS, "/style.css", "text/css");
    });

    // script route
    server.on("/script.js", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(LittleFS, "/script.js", "text/javascript");
    });

    // not found route
    server.onNotFound([](AsyncWebServerRequest *request){
        request->send(404, "text/plain", "Not found");
    });

    escapedMac = WiFi.macAddress();
    escapedMac.replace(":", "");
    escapedMac.toLowerCase();

    // Set up mDNS responder:
    if (strlen(cmDNS) > 0) {
        MDNS.end();
        MDNS.begin(cmDNS);

        MDNS.addService("http", "tcp", 80);
        MDNS.addService("DartTool", "tcp", 80);
        MDNS.addServiceTxt("DartTool", "tcp", "mac", escapedMac.c_str());
    }

    ElegantOTA.begin(&server);
    server.begin();
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

void handleWebSocketMessage(void *arg, uint8_t *data, size_t len)
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

        // get command
        const char* cmd = doc["cmd"];

        if (strcmp(cmd, "upt") == 0) {
            DEBUG_PRINTLN("[WS] Update command received");

            sendResponse = true; // necessary for fast UI updates

        } else if (strcmp(cmd, "getCfg") == 0) {
            DEBUG_PRINTLN("[WS] getConfig command received");

            sendResponse = true;

        } else if (strcmp(cmd, "rstCntlr") == 0) {
            DartTool::instance().reset();
        }

        if(!sendResponse)
            return;

        serializeJson(doc, out);
        ws.textAll(out);
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
            handleWebSocketMessage(arg, data, len);
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

void cleanupWs()
{
    if (millis() - wsLastLiveTime > 5000) {
        ws.cleanupClients(4);
        wsLastLiveTime = millis();
    }
}
