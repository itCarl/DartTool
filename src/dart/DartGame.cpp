
#include "DartGame.h"
#include "DartTool.h"


/**
 *  Constructor
 */
DartGame::DartGame()
{
    id = generateUuid();
}

String DartGame::listPlayers()
{
    String result = "";
    for (size_t i = 0; i < players.size(); i++) {
        if (i > 0) result += ", ";
        result += players[i].getName();
    }
    return result;
}

DartGameStatus DartGame::getStatus()
{
    return this->status;
}

void DartGame::setStatus(DartGameStatus newStatus)
{
    if(DartGameStatus::aborted == newStatus || DartGameStatus::done == newStatus ) {
        // this->reset();
    }
    DEBUG_PRINT("[DT] Status Change: ");
    DEBUG_PRINT(this->getStatusString());
    DEBUG_PRINT(" -> ");
    this->status = newStatus;
    DEBUG_PRINTLN(this->getStatusString());
}

void DartGame::reset()
{
    id = generateUuid();
    status = DartGameStatus::unknown;
    players.clear();
    currentPlayerIndex = 0;
    throwCounter = 0;
    winCount = 0;
    points = 501;  // Default X01 starting points
    turn = 0;
    DEBUG_PRINTLN("[DT] Game reset");
}

void DartGame::setPlayers(std::vector<Player>& selectedPlayers)
{
    players = selectedPlayers;
    currentPlayerIndex = 0;
}

Player& DartGame::getCurrentPlayer()
{
    if (players.empty()) {
        DEBUG_PRINTLN("[DT] Error: No players in game");
        // Return a reference to a static default player (not ideal, but necessary for returning a reference)
        static Player defaultPlayer;
        return defaultPlayer;
    }
    if (currentPlayerIndex >= players.size()) {
        currentPlayerIndex = 0;  // Reset to first player if index is out of bounds
    }
    return players[currentPlayerIndex];
}

void DartGame::nextPlayer()
{
    if (players.size() <= 1) {
        throwCounter = 0;
        turn++;  // Single-player: advance turn after each completed round
        return;
    }
    currentPlayerIndex = (currentPlayerIndex + 1) % players.size();
    throwCounter = 0;  // Reset throw counter for new player
    if (currentPlayerIndex == 0) {
        turn++;  // Increment turn after all players completed a round
    }
}

bool DartGame::isPlayerTurnComplete()
{
    return throwCounter >= THROWS_PER_TURN;
}

String DartGame::getStatusString()
{
    switch(this->getStatus()) {
        case DartGameStatus::initialised: return "initialised"; break;
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
    if (statusString == "initialised")    return DartGameStatus::initialised;
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
    obj["status"] = getStatusString();
    obj["currentPlayerIndex"] = currentPlayerIndex;

    if (!players.empty()) {
        obj["currentPlayerId"] = getCurrentPlayer().getId();
    }

    obj["throwCounter"] = throwCounter;
    obj["winCount"] = winCount;
    obj["points"] = points;
    obj["turn"] = turn;

    JsonArray jsonPlayers = obj["players"].to<JsonArray>();
    for(Player& p : players) {
        JsonObject player = jsonPlayers.add<JsonObject>();
        p.serialize(player);
        // Store remaining points (not accumulated points)
        player["remainingPoints"] = points - p.getPoints();
    }
}

/**
 * Serialize only data needed for displaying current game state
 * Minimizes bandwidth by excluding internal state details
 * Includes: status, current player, game points, player names, throws, and remaining points
 */
void DartGame::serializeForDisplay(JsonObject& obj)
{
    obj["status"] = getStatusString();
    obj["points"] = points;
    obj["turn"] = turn;

    if (!players.empty()) {
        obj["currentPlayerId"] = getCurrentPlayer().getId();
    }

    JsonArray jsonPlayers = obj["players"].to<JsonArray>();
    for(const Player& p : players) {
        JsonObject player = jsonPlayers.add<JsonObject>();
        player["id"] = p.getId();
        player["name"] = p.getName();
        player["remainingPoints"] = points - p.getPoints();  // Points needed to reach target
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

void DartGame::deserialize(const JsonObject& obj)
{
    // Deserialize basic game properties
    // Handle both game_id (external format) and id (internal format)
    if (obj["game_id"].is<String>()) {
        id = obj["game_id"].as<String>();
    } else if (obj["id"].is<String>()) {
        id = obj["id"].as<String>();
    }

    if (obj["status"].is<String>()) {
        String statusStr = obj["status"].as<String>();
        status = stringToStatus(statusStr);
    }

    // Handle both throwCounter and maxThrows
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

    // Track active player identifiers that might come in different formats
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

            // Handle both score (external) and points (internal)
            if (playerObj["points"].is<uint16_t>()) {
                player.setPoints(playerObj["points"].as<uint16_t>());
            } else if (playerObj["score"].is<uint16_t>()) {
                uint16_t score = playerObj["score"].as<uint16_t>();
                // Assuming Player::points stores accumulated score
                player.setPoints(score);
            }

            players.push_back(player);

            // Set current player index based on active identifiers if available
            if (!pid.isEmpty()) {
                if (activePlayerIdInt >= 0 && pid == String(activePlayerIdInt)) {
                    currentPlayerIndex = idx;
                } else if (activePlayerIdStr.length() && pid == activePlayerIdStr) {
                    currentPlayerIndex = idx;
                }
            }
            idx++;
        }
    }

    // Fallbacks for current player selection
    if (obj["currentPlayerIndex"].is<uint8_t>()) {
        currentPlayerIndex = obj["currentPlayerIndex"].as<uint8_t>();
    } else if (activePlayerIdStr.length() && !players.empty()) {
        for (uint8_t i = 0; i < players.size(); i++) {
            if (players[i].getId() == activePlayerIdStr) {
                currentPlayerIndex = i;
                break;
            }
        }
    } else if (activePlayerIdInt >= 0 && !players.empty()) {
        for (uint8_t i = 0; i < players.size(); i++) {
            if (players[i].getId() == String(activePlayerIdInt)) {
                currentPlayerIndex = i;
                break;
            }
        }
    }
}
/**
 * Deserialize only relevant game state updates based on current game status
 * - During game "running" state: Only update points and throws, skip player roster
 * - During other states: Update status and throw counter, skip player details
 * This optimizes network traffic and prevents unnecessary updates
 */
void DartGame::deserializePartial(const JsonObject& obj)
{
    // Always update game status if present
    if (obj["status"].is<String>()) {
        String statusStr = obj["status"].as<String>();
        status = stringToStatus(statusStr);
    }

    // During running state, only update game progress (points, throws, current player)
    if (status == DartGameStatus::running) {
        // Update throw counter if present
        if (obj["throwCounter"].is<uint8_t>()) {
            throwCounter = obj["throwCounter"].as<uint8_t>();
        } else if (obj["maxThrows"].is<uint8_t>()) {
            throwCounter = obj["maxThrows"].as<uint8_t>();
        }

        // Update points if present
        if (obj["points"].is<uint16_t>()) {
            points = obj["points"].as<uint16_t>();
        }

        // Update current player index if present
        if (obj["active_player_id"].is<int>()) {
            int activePlayerId = obj["active_player_id"].as<int>();
            for (uint8_t i = 0; i < players.size(); i++) {
                if (players[i].getId() == String(activePlayerId)) {
                    currentPlayerIndex = i;
                    break;
                }
            }
        } else if (obj["currentPlayerIndex"].is<uint8_t>()) {
            currentPlayerIndex = obj["currentPlayerIndex"].as<uint8_t>();
        }

        // Update turn counter if present
        if (obj["turn"].is<uint8_t>()) {
            turn = obj["turn"].as<uint8_t>();
        }

        // Update individual player scores only (not entire roster)
        if (obj["players"].is<JsonArray>()) {
            JsonArray jsonPlayers = obj["players"].as<JsonArray>();
            for (JsonObject playerObj : jsonPlayers) {
                String playerId;
                if (playerObj["id"].is<int>() || playerObj["id"].is<String>()) {
                    if (playerObj["id"].is<int>()) {
                        playerId = String(playerObj["id"].as<int>());
                    } else {
                        playerId = playerObj["id"].as<String>();
                    }
                }

                // Find and update only the score/points for existing player
                for (Player& p : players) {
                    if (p.getId() == playerId) {
                        if (playerObj["score"].is<uint16_t>()) {
                            // Score update - recalculate remaining points
                            uint16_t score = playerObj["score"].as<uint16_t>();
                            // Note: Adjust based on how you track player points
                        } else if (playerObj["points"].is<uint16_t>()) {
                            uint16_t playerPoints = playerObj["points"].as<uint16_t>();
                            p.setPoints(playerPoints);
                        }
                        break;
                    }
                }
            }
        }
    } else {
        // For non-running states, update status and turn info
        if (obj["turn"].is<uint8_t>()) {
            turn = obj["turn"].as<uint8_t>();
        }

        // Only deserialize players and other data on state transitions (created, done, aborted)
        if (status != DartGameStatus::running && obj["players"].is<JsonArray>()) {
            deserialize(obj);  // Full deserialize for state changes
        }
    }
}

/**
 * Add a throw to the current player
 * X01 Logic: Each player gets exactly 3 throws per turn
 * @param dartThrow The throw to add
 * @return true if successful, false if player has already thrown 3 times
 */
bool DartGame::addThrowToCurrentPlayer(const Throw& dartThrow)
{
    if (players.empty()) {
        DEBUG_PRINTLN("[DT] Error: Cannot add throw - no players in game");
        return false;
    }

    // Check if player already has 3 throws in this turn
    if (isPlayerTurnComplete()) {
        DEBUG_PRINT("[DT] Error: ");
        DEBUG_PRINT(getCurrentPlayer().getName());
        DEBUG_PRINTLN(" has already thrown 3 times this turn");
        return false;
    }

    getCurrentPlayer().addThrow(dartThrow);
    throwCounter++;
    DEBUG_PRINT("[DT] Throw added to ");
    DEBUG_PRINT(getCurrentPlayer().getName());
    DEBUG_PRINT(" (");
    DEBUG_PRINT(throwCounter);
    DEBUG_PRINTLN("/3)");
    return true;
}

/**
 * Add a throw to a specific player by ID
 * X01 Logic: Each player gets exactly 3 throws per turn
 * @param playerId The ID of the player
 * @param dartThrow The throw to add
 * @return true if player found and throw added, false otherwise
 */
bool DartGame::addThrowToPlayer(const String& playerId, const Throw& dartThrow)
{
    if (playerId.isEmpty()) {
        DEBUG_PRINTLN("[DT] Error: Player ID is empty");
        return false;
    }

    for (Player& p : players) {
        if (p.getId() == playerId) {
            // Check if this is the current player and if they already have 3 throws
            if (p.getId() == getCurrentPlayer().getId() && isPlayerTurnComplete()) {
                DEBUG_PRINT("[DT] Error: ");
                DEBUG_PRINT(p.getName());
                DEBUG_PRINTLN(" has already thrown 3 times this turn");
                return false;
            }

            p.addThrow(dartThrow);
            if (p.getId() == getCurrentPlayer().getId()) {
                throwCounter++;
            }
            DEBUG_PRINT("[DT] Throw added to ");
            DEBUG_PRINT(p.getName());
            DEBUG_PRINT(" (Total throws: ");
            DEBUG_PRINT(p.getThrowCount());
            DEBUG_PRINTLN(")");
            return true;
        }
    }

    DEBUG_PRINT("[DT] Error: Player with ID ");
    DEBUG_PRINT(playerId);
    DEBUG_PRINTLN(" not found");
    return false;
}

/**
 * Get throws of the current player
 * @return vector of throws for current player
 */
std::vector<Throw> DartGame::getCurrentPlayerThrows()
{
    if (players.empty()) {
        return std::vector<Throw>();
    }
    return getCurrentPlayer().getThrows();
}

/**
 * Get throws of a specific player
 * @param playerId The ID of the player
 * @return vector of throws for the player, or empty vector if not found
 */
std::vector<Throw> DartGame::getPlayerThrows(const String& playerId)
{
    for (const Player& p : players) {
        if (p.getId() == playerId) {
            return p.getThrows();
        }
    }

    DEBUG_PRINT("[DT] Error: Player with ID ");
    DEBUG_PRINT(playerId);
    DEBUG_PRINTLN(" not found");
    return std::vector<Throw>();
}

/**
 * Undo the last throw for the current player
 * @return true if throw was removed, false if no throws to undo
 */
bool DartGame::undoLastThrow()
{
    if (players.empty()) {
        DEBUG_PRINTLN("[DT] Error: Cannot undo - no players in game");
        return false;
    }

    Player& currentPlayer = getCurrentPlayer();
    if (currentPlayer.getThrowCount() == 0) {
        DEBUG_PRINT("[DT] No throws to undo for ");
        DEBUG_PRINTLN(currentPlayer.getName());
        return false;
    }

    if (currentPlayer.undoLastThrow()) {
        if (throwCounter > 0) throwCounter--;
        DEBUG_PRINT("[DT] Last throw undone for ");
        DEBUG_PRINT(currentPlayer.getName());
        DEBUG_PRINT(" (Remaining: ");
        DEBUG_PRINT(throwCounter);
        DEBUG_PRINTLN("/3)");
        return true;
    }
    return false;
}

/**
 * Undo the last throw for a specific player
 * @param playerId The ID of the player
 * @return true if throw was removed, false if player not found or no throws to undo
 */
bool DartGame::undoLastThrowForPlayer(const String& playerId)
{
    if (playerId.isEmpty()) {
        DEBUG_PRINTLN("[DT] Error: Player ID is empty");
        return false;
    }

    for (Player& p : players) {
        if (p.getId() == playerId) {
            if (p.getThrowCount() == 0) {
                DEBUG_PRINT("[DT] No throws to undo for ");
                DEBUG_PRINTLN(p.getName());
                return false;
            }

            if (p.undoLastThrow()) {
                if (p.getId() == getCurrentPlayer().getId() && throwCounter > 0) {
                    throwCounter--;
                }
                DEBUG_PRINT("[DT] Last throw undone for ");
                DEBUG_PRINT(p.getName());
                DEBUG_PRINT(" (Remaining throws: ");
                DEBUG_PRINT(p.getThrowCount());
                DEBUG_PRINTLN(")");
                return true;
            }
            return false;
        }
    }

    DEBUG_PRINT("[DT] Error: Player with ID ");
    DEBUG_PRINT(playerId);
    DEBUG_PRINTLN(" not found");
    return false;
}

/**
 * Get remaining points for current player
 * @return remaining points needed to reach target
 */
uint16_t DartGame::getCurrentPlayerRemainingPoints()
{
    if (players.empty()) {
        return points;
    }

    uint16_t currentScore = getCurrentPlayer().getPoints();
    return (currentScore >= points) ? 0 : (points - currentScore);
}

/**
 * Get remaining points for a specific player
 * @param playerId The ID of the player
 * @return remaining points needed to reach target, or 0 if player not found
 */
uint16_t DartGame::getPlayerRemainingPoints(const String& playerId)
{
    for (const Player& p : players) {
        if (p.getId() == playerId) {
            uint16_t currentScore = p.getPoints();
            return (currentScore >= points) ? 0 : (points - currentScore);
        }
    }

    DEBUG_PRINT("[DT] Error: Player with ID ");
    DEBUG_PRINT(playerId);
    DEBUG_PRINTLN(" not found");
    return 0;
}

/**
 * Process a dart throw with X01 game logic
 * - Each player gets exactly 3 throws per turn
 * - Points are subtracted from starting score
 * - Player must finish on a double (value * field multiplier)
 * - Bust (going below 0) ends turn without adding points
 * @param score The dart score (0-50 in single ring, higher with multipliers)
 * @return DartThrowResult containing success status and game state details
 */
DartThrowResult DartGame::processDartThrow(int score)
{
    DartThrowResult result;
    result.score = score;
    result.hasWon = false;
    result.winner = "";
    result.winnerId = "";

    if (status != DartGameStatus::running) {
        result.success = false;
        result.message = "Game is not in running state";
        return result;
    }

    if (score < 0 || score > 25) {
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
    if (currentScore + score > points) {
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
    dartThrow.setValue(score);
    dartThrow.setField(1);  // Default: single ring (no multiplier)
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
        status = DartGameStatus::done;
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
