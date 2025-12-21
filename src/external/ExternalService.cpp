#include "external/ExternalService.h"

#include "DartTool.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>

ExternalService& ExternalService::instance() {
    static ExternalService inst;
    return inst;
}

void ExternalService::setHost(const String& host) {
    host_ = host;
}

const String& ExternalService::getHost() const {
    return host_;
}

void ExternalService::setApiToken(const String& token) {
    apiToken_ = token;
}

bool ExternalService::hasApiToken() const {
    return !apiToken_.isEmpty();
}

void ExternalService::setPollInterval(unsigned long intervalMs) {
    pollInterval_ = intervalMs;
}

unsigned long ExternalService::getPollInterval() const {
    return pollInterval_;
}

void ExternalService::setEnabled(bool enabled) {
    enabled_ = enabled;
}

bool ExternalService::isEnabled() const {
    return enabled_;
}

void ExternalService::resetPollTimer() {
    lastPollTime_ = millis();
}

void ExternalService::pollGameState()
{
    if (!enabled_ || host_.isEmpty()) {
        return;
    }

    unsigned long currentTime = millis();
    if (currentTime - lastPollTime_ < pollInterval_) {
        return;
    }
    lastPollTime_ = currentTime;

    if (!WIFI_CONNECTED) {
        DEBUG_PRINTLN("[POLL] WiFi not connected, skipping poll");
        return;
    }

    String apiUrl = host_ + "/api/v2/dart/active";

    HTTPClient http;
    http.begin(apiUrl);
    http.setTimeout(5000);
    if (hasApiToken()) {
        http.addHeader("Authorization", String("Bearer ") + apiToken_);
    }

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
            JsonObject gameObj = doc.as<JsonObject>();

            if (!firstPollCompleted_) {
                DEBUG_PRINTLN("[POLL] First poll - deserializing full game state");
                game.deserialize(gameObj);
                firstPollCompleted_ = true;
                lastSyncedGameStatus_ = static_cast<int>(game.getStatus());
            } else {
                DartGameStatus newStatus = game.stringToStatus(gameObj["status"].as<String>());
                if (static_cast<int>(newStatus) != lastSyncedGameStatus_) {
                    DEBUG_PRINT("[POLL] Status change detected: ");
                    DEBUG_PRINT(game.getStatusString());
                    DEBUG_PRINT(" -> ");
                    DEBUG_PRINTLN(game.getStatusString());

                    game.deserialize(gameObj);
                    lastSyncedGameStatus_ = static_cast<int>(newStatus);
                } else {
                    game.deserializePartial(gameObj);
                }
            }

            DEBUG_PRINTLN("[POLL] Game state updated successfully");

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

bool ExternalService::fetchPlayers()
{
    if (!enabled_ || host_.isEmpty()) {
        DEBUG_PRINTLN("[EXTERNAL] Polling disabled or no external service host configured");
        return false;
    }

    if (!WIFI_CONNECTED) {
        DEBUG_PRINTLN("[EXTERNAL] WiFi not connected, cannot fetch players");
        return false;
    }

    String apiUrl = host_ + "/api/v2/dart/players";

    HTTPClient http;
    http.begin(apiUrl);
    http.setTimeout(5000);
    if (hasApiToken()) {
        http.addHeader("Authorization", String("Bearer ") + apiToken_);
    }

    DEBUG_PRINT("[EXTERNAL] Fetching players from: ");
    DEBUG_PRINTLN(apiUrl);

    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        DEBUG_PRINT("[EXTERNAL] Response received, size: ");
        DEBUG_PRINTLN(payload.length());

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (error) {
            DEBUG_PRINT("[EXTERNAL] JSON parsing error: ");
            DEBUG_PRINTLN(error.c_str());
            http.end();
            return false;
        }

        if (!doc.is<JsonArray>()) {
            DEBUG_PRINTLN("[EXTERNAL] Response is not a JSON array");
            http.end();
            return false;
        }

        JsonArray playersArray = doc.as<JsonArray>();
        int addedCount = 0;

        for (JsonObject playerObj : playersArray) {
            String playerId = playerObj["player_id"].is<String>()
                ? playerObj["player_id"].as<String>()
                : playerObj["id"].as<String>();

            String playerName = playerObj["player_name"].is<String>()
                ? playerObj["player_name"].as<String>()
                : playerObj["name"].as<String>();

            if (!playerId.isEmpty() && !playerName.isEmpty()) {
                // Pass both name and ID to preserve external IDs
                PlayerManager::instance().addOrEditPlayer(playerName, playerId);
                addedCount++;
            }
        }

        DEBUG_PRINT("[EXTERNAL] Successfully added/updated ");
        DEBUG_PRINT(addedCount);
        DEBUG_PRINTLN(" players from external service");

        http.end();
        return true;
    } else {
        DEBUG_PRINT("[EXTERNAL] HTTP request failed, code: ");
        DEBUG_PRINTLN(httpCode);
        http.end();
        return false;
    }
}
