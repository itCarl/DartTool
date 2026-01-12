#include "X01GameMode.h"
#include "DartTool.h"

X01GameMode::X01GameMode()
{
    points = 501;  // Default X01 starting points
    status = DartGameStatus::unknown;
}

X01GameMode::X01GameMode(uint16_t startingPoints)
{
    points = startingPoints;
    status = DartGameStatus::unknown;
}

void X01GameMode::reset()
{
    status = DartGameStatus::initialised;
    resetPlayersState();
    // Keep configured starting points as-is
    DEBUG_PRINTLN("[DT] X01GameMode reset");
}

DartGameStatus X01GameMode::getStatus()
{
    return this->status;
}

void X01GameMode::setStatus(DartGameStatus newStatus)
{
    if(DartGameStatus::aborted == newStatus || DartGameStatus::done == newStatus ) {
        // Handle game end if needed
    }
    DEBUG_PRINT("[DT] X01 Status Change: ");
    DEBUG_PRINT(this->getStatusString());
    DEBUG_PRINT(" -> ");
    this->status = newStatus;
    DEBUG_PRINTLN(this->getStatusString());
}

String X01GameMode::getStatusString()
{
    switch(this->getStatus()) {
        case DartGameStatus::initialised: return "initialised"; break;
        case DartGameStatus::running:   return "running"; break;
        case DartGameStatus::playerWon: return "playerWon"; break;
        case DartGameStatus::done:      return "done"; break;
        case DartGameStatus::aborted:   return "aborted"; break;
        case DartGameStatus::error:     return "error"; break;
        default:
        case DartGameStatus::unknown:   return "unknown"; break;
    }
}

DartGameStatus X01GameMode::stringToStatus(String statusString)
{
    if (statusString == "initialised")    return DartGameStatus::initialised;
    else if (statusString == "running")   return DartGameStatus::running;
    else if (statusString == "playerWon") return DartGameStatus::playerWon;
    else if (statusString == "done")      return DartGameStatus::done;
    else if (statusString == "aborted")   return DartGameStatus::aborted;
    else if (statusString == "error")     return DartGameStatus::error;
    else if (statusString == "unknown")   return DartGameStatus::unknown;
    else                            return DartGameStatus::unknown;
}

DartThrowResult X01GameMode::processDartThrow(uint8_t value, uint8_t multiplier)
{
    DartThrowResult result;
    multiplier = (multiplier == 0) ? 1 : multiplier; // guard against zero
    if (multiplier > 3) {
        multiplier = 3;
    }
    const uint8_t dartValue = value;
    const uint8_t dartMultiplier = multiplier;
    const uint8_t dartPoints = dartValue * dartMultiplier;
    result.score = dartPoints;
    result.hasWon = false;
    result.winner = "";
    result.winnerId = "";

    if (status != DartGameStatus::running) {
        result.success = false;
        result.message = "Game is not in running state";
        return result;
    }

    if (dartValue > 25) {
        result.success = false;
        result.message = "Invalid score: must be 0-25";
        return result;
    }

    // Check if current player's turn is already complete
    if (isPlayerTurnComplete()) {
        result.success = false;
        result.message = "Player turn is complete (3 throws already made)";
        return result;
    }

    // Get current player info
    Player& currentPlayer = getCurrentPlayer();
    uint16_t currentScore = currentPlayer.getPoints();
    result.playerName = currentPlayer.getName();
    result.playerId = currentPlayer.getId();

    // X01 Logic: Check if throw would bust (exceed starting points)
    if (currentScore + dartPoints > points) {
        result.success = false;
        result.message = "Dart throw would exceed target - BUST";
        result.pointsRemaining = points - currentScore;

        // Still count this as a throw in the turn, but don't add points
        throwCounter++;

        // If player has completed 3 throws, advance to next player
        if (isPlayerTurnComplete()) {
            nextPlayer();
            DEBUG_PRINT("[Game] ");
            DEBUG_PRINT(currentPlayer.getName());
            DEBUG_PRINTLN(" turn complete (turn ended with bust)");
        }

        return result;
    }

    // Create and add throw
    Throw dartThrow;
    dartThrow.setValue(dartValue);
    dartThrow.setField(dartMultiplier);
    if (!currentPlayer.addThrowToTurn(turn, dartThrow)) {
        result.success = false;
        result.message = "Unable to record throw for current turn";
        return result;
    }
    throwCounter++;

    // Calculate remaining points after throw
    uint16_t newScore = currentPlayer.getPoints();
    result.pointsRemaining = points - newScore;

    // X01 Win Condition: Exactly reach target points
    if (newScore == points) {
        // In standard X01, must finish on a double
        // For now, allow any finish. Uncomment below to enforce double-out rule:
        // if (dartThrow.getField() < 2) {
        //     result.success = false;
        //     result.message = "Must finish on a double - BUST";
        //     currentPlayer.undoLastThrow();  // Remove invalid finishing throw
        //     return result;
        // }

        currentPlayer.setWinPos(1);  // Mark as winner
        status = DartGameStatus::playerWon;
        result.hasWon = true;
        result.winner = currentPlayer.getName();
        result.winnerId = currentPlayer.getId();
        result.message = "Game Won! " + currentPlayer.getName() + " reached exactly " + String(points) + " points!";

        winCount++;
        DEBUG_PRINT("[Game] Player ");
        DEBUG_PRINT(result.winner);
        DEBUG_PRINT(" won the game with ");
        DEBUG_PRINT(turn);
        DEBUG_PRINTLN(" turn(s)!");

        result.success = true;
        return result;
    }

    // Check if this throw completes the player's turn (3 throws)
    if (isPlayerTurnComplete()) {
        nextPlayer();
        result.message = "Dart throw recorded - Turn complete, advancing to next player";
        DEBUG_PRINT("[Game] ");
        DEBUG_PRINT(currentPlayer.getName());
        DEBUG_PRINT(" turn complete. Scores: ");
        for (size_t i = 0; i < players.size(); i++) {
            DEBUG_PRINT(players[i].getName());
            DEBUG_PRINT("=");
            DEBUG_PRINT(points - players[i].getPoints());
            if (i < players.size() - 1) DEBUG_PRINT(", ");
        }
        DEBUG_PRINTLN();
    } else {
        result.message = "Dart throw recorded (" + String(throwCounter) + "/3)";
    }

    result.success = true;
    return result;
}

void X01GameMode::serialize(JsonObject& obj)
{
    obj["status"] = getStatusString();
    obj["currentPlayerIndex"] = currentPlayerIndex;

    if (!players.empty()) {
        obj["currentPlayerId"] = getCurrentPlayer().getId();
    }

    obj["throwCounter"] = throwCounter;
    obj["winCount"] = winCount;
    obj["points"] = points;
    obj["turn"] = turn;
    obj["gameMode"] = getGameModeName();

    JsonArray jsonPlayers = obj["players"].to<JsonArray>();
    for(Player& p : players) {
        JsonObject player = jsonPlayers.add<JsonObject>();
        p.serialize(player);
        // Store remaining points (not accumulated points)
        player["remainingPoints"] = points - p.getPoints();
    }
}

void X01GameMode::serializeForDisplay(JsonObject& obj)
{
    obj["status"] = getStatusString();
    obj["points"] = points;
    obj["turn"] = turn;
    obj["gameMode"] = getGameModeName();

    if (!players.empty()) {
        obj["currentPlayerId"] = getCurrentPlayer().getId();
    }

    JsonArray jsonPlayers = obj["players"].to<JsonArray>();
    for(const Player& p : players) {
        JsonObject player = jsonPlayers.add<JsonObject>();
        player["id"] = p.getId();
        player["name"] = p.getName();
        player["remainingPoints"] = points - p.getPoints();  // Points needed to reach target
        player["averagePoints"] = p.getThrowCount() > 0 ? p.getPoints() / p.getThrowCount() : 0;
        player["winPos"] = p.hasWon() ? 1 : 0;  // Simple win indicator

        // Include throws from last turn for current round display
        JsonArray throwsArray = player["throws"].to<JsonArray>();
        if (p.getTurnCount() > 0) {
            std::vector<Throw> lastTurnThrows = p.getThrowsFromTurn(turn);
            for (const Throw& t : lastTurnThrows) {
                JsonObject throwObj = throwsArray.add<JsonObject>();
                throwObj["points"] = t.getPoints();
            }
        }
    }
}

void X01GameMode::deserialize(const JsonObject& obj)
{
    // Deserialize game mode
    if (obj["gameMode"].is<String>()) {
        String modeStr = obj["gameMode"].as<String>();
        if (modeStr != "X01") {
            DEBUG_PRINTLN("[DT] Warning: Deserializing X01GameMode but JSON indicates different mode");
        }
    }

    if (obj["status"].is<String>()) {
        String statusStr = obj["status"].as<String>();
        status = stringToStatus(statusStr);
    }

    if (obj["throwCounter"].is<uint8_t>()) {
        throwCounter = obj["throwCounter"].as<uint8_t>();
    } else if (obj["maxThrows"].is<uint8_t>()) {
        throwCounter = obj["maxThrows"].as<uint8_t>();
    }

    if (obj["points"].is<uint16_t>()) {
        points = obj["points"].as<uint16_t>();
    }

    if (obj["turn"].is<uint8_t>()) {
        turn = obj["turn"].as<uint8_t>();
    }

    // Track active player identifiers
    int activePlayerIdInt = -1;
    String activePlayerIdStr;
    if (obj["active_player_id"].is<int>() || obj["active_player_id"].is<String>()) {
        if (obj["active_player_id"].is<int>()) {
            activePlayerIdInt = obj["active_player_id"].as<int>();
        } else {
            activePlayerIdStr = obj["active_player_id"].as<String>();
        }
    }
    if (obj["currentPlayerId"].is<String>()) {
        activePlayerIdStr = obj["currentPlayerId"].as<String>();
    }

    // Deserialize players
    if (obj["players"].is<JsonArray>()) {
        JsonArray jsonPlayers = obj["players"].as<JsonArray>();
        players.clear();

        uint8_t idx = 0;
        for (JsonObject playerObj : jsonPlayers) {
            Player player;

            // Handle integer or string IDs
            String pid;
            if (playerObj["id"].is<int>() || playerObj["id"].is<String>()) {
                if (playerObj["id"].is<int>()) {
                    pid = String(playerObj["id"].as<int>());
                } else {
                    pid = playerObj["id"].as<String>();
                }
                player.setId(pid);
            }

            if (playerObj["name"].is<String>()) {
                player.setName(playerObj["name"].as<String>());
            }

            if (playerObj["points"].is<uint16_t>()) {
                player.setPoints(playerObj["points"].as<uint16_t>());
            } else if (playerObj["score"].is<uint16_t>()) {
                uint16_t score = playerObj["score"].as<uint16_t>();
                player.setPoints(score);
            }

            if (playerObj["winPos"].is<uint8_t>()) {
                player.setWinPos(playerObj["winPos"].as<uint8_t>());
            }

            players.push_back(player);
            idx++;
        }

        // Set current player index based on player ID if available
        if (!activePlayerIdStr.isEmpty()) {
            for (size_t i = 0; i < players.size(); i++) {
                if (players[i].getId() == activePlayerIdStr) {
                    currentPlayerIndex = i;
                    break;
                }
            }
        } else if (activePlayerIdInt >= 0 && activePlayerIdInt < (int)players.size()) {
            currentPlayerIndex = activePlayerIdInt;
        }
    }
}

void X01GameMode::deserializePartial(const JsonObject& obj)
{
    // Similar to deserialize but for partial updates
    if (obj["throwCounter"].is<uint8_t>()) {
        throwCounter = obj["throwCounter"].as<uint8_t>();
    }

    if (obj["points"].is<uint16_t>()) {
        points = obj["points"].as<uint16_t>();
    }

    if (obj["turn"].is<uint8_t>()) {
        turn = obj["turn"].as<uint8_t>();
    }

    if (obj["status"].is<String>()) {
        String statusStr = obj["status"].as<String>();
        status = stringToStatus(statusStr);
    }

    if (obj["winCount"].is<uint8_t>()) {
        winCount = obj["winCount"].as<uint8_t>();
    }

    // Update player partial data if provided
    if (obj["players"].is<JsonArray>()) {
        JsonArray jsonPlayers = obj["players"].as<JsonArray>();
        for (size_t i = 0; i < jsonPlayers.size() && i < players.size(); i++) {
            JsonObject playerObj = jsonPlayers[i];
            if (playerObj["points"].is<uint16_t>()) {
                players[i].setPoints(playerObj["points"].as<uint16_t>());
            }
            if (playerObj["winPos"].is<uint8_t>()) {
                players[i].setWinPos(playerObj["winPos"].as<uint8_t>());
            }
        }
    }
}
