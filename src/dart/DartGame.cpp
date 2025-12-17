
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
