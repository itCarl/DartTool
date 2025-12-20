
#include "DartGame.h"
#include "DartTool.h"


/**
 *  Constructor
 */
DartGame::DartGame()
{
    id = generateUuid();
}

DartGameStatus DartGame::getStatus()
{
    return this->status;
}

void DartGame::setStatus(DartGameStatus newStatus)
{
    if(DartGameStatus::created == newStatus) {
        // this->currentPlayer = &this->players.front();
        currentPlayerIndex = 0;
        DEBUG_PRINTLN("[DT] Game created");

        // display.setPlayerIndicator(this->currentPlayer->getColor());
        // display.setPoints((this->points - this->currentPlayer->getPoints()));
        // display.setThrowIndicator(3);
    } else if(DartGameStatus::aborted == newStatus || DartGameStatus::done == newStatus ) {
        // this->reset();
    }
    DEBUG_PRINT("[DT] Status Change: ");
    DEBUG_PRINT(this->getStatusString());
    DEBUG_PRINT(" -> ");
    this->status = newStatus;
    DEBUG_PRINTLN(this->getStatusString());
}

void DartGame::setPlayers(std::vector<Player>& selectedPlayers)
{
    players = selectedPlayers;
    currentPlayerIndex = 0;
}

Player& DartGame::getCurrentPlayer()
{
    return players[currentPlayerIndex];
}

void DartGame::nextPlayer()
{
    if (players.size() <= 1) return;
    currentPlayerIndex = (currentPlayerIndex + 1) % players.size();
}

String DartGame::getStatusString()
{
    switch(this->getStatus()) {
        case DartGameStatus::created:   return "created"; break;
        case DartGameStatus::running:   return "running"; break;
        case DartGameStatus::done:      return "done"; break;
        case DartGameStatus::aborted:   return "aborted"; break;
        case DartGameStatus::error:     return "error"; break;
        default:
        case DartGameStatus::unknown:   return "unknown"; break;
    }
}

DartGameStatus DartGame::stringToStatus(String statusString)
{
    if (statusString == "created")        return DartGameStatus::created;
    else if (statusString == "running")   return DartGameStatus::running;
    else if (statusString == "done")      return DartGameStatus::done;
    else if (statusString == "aborted")   return DartGameStatus::aborted;
    else if (statusString == "error")     return DartGameStatus::error;
    else if (statusString == "unknown")   return DartGameStatus::unknown;
    else                            return DartGameStatus::unknown;
}

void DartGame::serialize(JsonObject& obj)
{
    obj["id"] = id;
    obj["currentPlayerId"] = getCurrentPlayer().getId();
    obj["throwCounter"] = throwCounter;
    obj["points"] = points;

    JsonArray jsonPlayers = obj["players"].to<JsonArray>();
    for(Player& p : players) {
        JsonObject player = jsonPlayers.add<JsonObject>();
        p.serialize(player);
        player["points"] = points - player["points"].as<uint16_t>();
    }
}

void DartGame::deserialize(const JsonObject& obj)
{
    // Deserialize basic game properties
    // Handle both game_id (external format) and id (internal format)
    if (obj.containsKey("game_id")) {
        id = obj["game_id"].as<String>();
    } else if (obj.containsKey("id")) {
        id = obj["id"].as<String>();
    }

    if (obj.containsKey("status")) {
        String statusStr = obj["status"].as<String>();
        status = stringToStatus(statusStr);
    }

    // Handle both throwCounter and maxThrows
    if (obj.containsKey("throwCounter")) {
        throwCounter = obj["throwCounter"].as<uint8_t>();
    } else if (obj.containsKey("maxThrows")) {
        throwCounter = obj["maxThrows"].as<uint8_t>();
    }

    if (obj.containsKey("points")) {
        points = obj["points"].as<uint16_t>();
    }

    if (obj.containsKey("turn")) {
        turn = obj["turn"].as<uint8_t>();
    }

    // Deserialize players
    if (obj.containsKey("players")) {
        JsonArray jsonPlayers = obj["players"].as<JsonArray>();
        players.clear();

        int activePlayerId = -1;
        if (obj.containsKey("active_player_id")) {
            activePlayerId = obj["active_player_id"].as<int>();
        }

        for (JsonObject playerObj : jsonPlayers) {
            Player player;

            // Handle integer or string IDs
            if (playerObj.containsKey("id")) {
                if (playerObj["id"].is<int>()) {
                    player.setId(String(playerObj["id"].as<int>()));
                } else {
                    player.setId(playerObj["id"].as<String>());
                }
            }

            if (playerObj.containsKey("name")) {
                player.setName(playerObj["name"].as<String>());
            }

            // Handle both score (external) and points (internal)
            if (playerObj.containsKey("score")) {
                // External format: score is current points
                // We need to calculate remaining points: target - score
                uint16_t score = playerObj["score"].as<uint16_t>();
                // Note: Player points represent total scored, not remaining
                // This might need adjustment based on your display logic
            } else if (playerObj.containsKey("points")) {
                // Internal format: already handled by deserialize
            }

            players.push_back(player);

            // Set current player index based on active_player_id
            if (activePlayerId >= 0 && playerObj["id"].as<int>() == activePlayerId) {
                currentPlayerIndex = players.size() - 1;
            }
        }
    }

    // Fallback: handle currentPlayerId or currentPlayerIndex
            if (players[i].getId() == currentPlayerId) {
                currentPlayerIndex = i;
                break;
            }
        }
    } else if (obj.containsKey("currentPlayerIndex")) {
        currentPlayerIndex = obj["currentPlayerIndex"].as<uint8_t>();
    }
}
