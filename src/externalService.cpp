#include "DartTool.h"
#include <HTTPClient.h>

/**
 * Poll external service for game state updates
 * Called periodically from main loop
 * Non-blocking implementation using millis() timing
 */
void DartTool::pollExternalGameState()
{
    if (!externalPollingEnabled || externalServiceHost.isEmpty()) {
        return;
    }

    unsigned long currentTime = millis();

    // Check if it's time to poll (accounting for overflow)
    if (currentTime - lastPollTime < pollInterval) {
        return;
    }

    lastPollTime = currentTime;

    if (!WIFI_CONNECTED) {
        DEBUG_PRINTLN("[POLL] WiFi not connected, skipping poll");
        return;
    }

    // Construct API endpoint: {host}/api/v2/dart/active
    String apiUrl = externalServiceHost + "/api/v2/dart/active";

    HTTPClient http;
    http.begin(apiUrl);
    http.setTimeout(5000); // 5 second timeout

    DEBUG_PRINT("[POLL] Fetching game state from: ");
    DEBUG_PRINTLN(apiUrl);

    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        DEBUG_PRINT("[POLL] Response: ");
        DEBUG_PRINTLN(payload);

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (error) {
            DEBUG_PRINT("[POLL] JSON parsing error: ");
            DEBUG_PRINTLN(error.c_str());
        } else {
            // Update game state from external service
            JsonObject gameObj = doc.as<JsonObject>();
            game.deserialize(gameObj);

            DEBUG_PRINTLN("[POLL] Game state updated successfully");

            // Broadcast updated state to connected WebSocket clients
            JsonDocument wsDoc;
            JsonObject wsObj = wsDoc.to<JsonObject>();
            wsObj["type"] = "gameUpdate";
            JsonObject gameData = wsObj["data"].to<JsonObject>();
            game.serialize(gameData);

            String wsMessage;
            serializeJson(wsDoc, wsMessage);
            ws.textAll(wsMessage);
        }
    } else {
        DEBUG_PRINT("[POLL] HTTP request failed, code: ");
        DEBUG_PRINTLN(httpCode);
    }

    http.end();
}
