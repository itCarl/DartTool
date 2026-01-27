#pragma once

#include <ESPAsyncWebServer.h>

// WebSocket event handlers
void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len);
void handleWebSocketMessage(AsyncWebSocketClient *client, void *arg, uint8_t *data, size_t len);
void notify();
void cleanupWs();
String processor(const String& var);
