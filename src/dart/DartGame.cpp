
#include "DartGame.h"
#include "X01GameMode.h"
#include "DartTool.h"

/**
 * Constructor
 * Initializes DartGame with a unique ID and default X01 game mode
 */
DartGame::DartGame()
{
    id = generateUuid();
    // Initialize with default X01 game mode
    gameMode = std::unique_ptr<GameMode>(new X01GameMode());
}


String DartGame::listPlayers()
{
    if (!gameMode) return "";
    return gameMode->listPlayers();
}

void DartGame::setPlayers(std::vector<Player>& selectedPlayers)
{
    if (!gameMode) return;
    gameMode->setPlayers(selectedPlayers);
}

DartGameStatus DartGame::getStatus()
{
    if (!gameMode) return DartGameStatus::unknown;
    return gameMode->getStatus();
}

void DartGame::setStatus(DartGameStatus newStatus)
{
    if (!gameMode) return;
    gameMode->setStatus(newStatus);
}

void DartGame::reset()
{
    id = generateUuid();
    if (gameMode) {
        gameMode->reset();
    }
    DEBUG_PRINTLN("[DT] Game reset");
}

String DartGame::getStatusString()
{
    if (!gameMode) return "unknown";
    return gameMode->getStatusString();
}

DartGameStatus DartGame::stringToStatus(String statusString)
{
    if (!gameMode) return DartGameStatus::unknown;
    return gameMode->stringToStatus(statusString);
}

void DartGame::setGameMode(std::unique_ptr<GameMode> newGameMode)
{
    if (!newGameMode) {
        DEBUG_PRINTLN("[DT] Error: Cannot set null game mode");
        return;
    }
    gameMode = std::move(newGameMode);
    DEBUG_PRINT("[DT] Game mode changed to: ");
    DEBUG_PRINTLN(gameMode->getGameModeName());
}

String DartGame::getGameModeName()
{
    if (!gameMode) {
        return "unknown";
    }
    return gameMode->getGameModeName();
}

void DartGame::serialize(JsonObject& obj)
{
    obj["id"] = id;
    if (gameMode) {
        gameMode->serialize(obj);
    }
}

/**
 * Serialize only data needed for displaying current game state
 * Minimizes bandwidth by excluding internal state details
 * Includes: status, current player, game points, player names, throws, and remaining points
 */
void DartGame::serializeForDisplay(JsonObject& obj)
{
    if (gameMode) {
        gameMode->serializeForDisplay(obj);
    }
}

void DartGame::deserialize(const JsonObject& obj)
{
    if (obj["id"].is<String>()) {
        id = obj["id"].as<String>();
    } else if (obj["game_id"].is<String>()) {
        id = obj["game_id"].as<String>();
    }

    if (gameMode) {
        gameMode->deserialize(obj);
    }
}

void DartGame::deserializePartial(const JsonObject& obj)
{
    if (gameMode) {
        gameMode->deserializePartial(obj);
    }
}

/**
 * Add a throw to the current player
 * Delegated to game mode
 */
bool DartGame::addThrowToCurrentPlayer(const Throw& dartThrow)
{
    if (!gameMode) return false;
    return gameMode->addThrowToCurrentPlayer(dartThrow);
}

/**
 * Add a throw to a specific player by ID
 * Delegated to game mode
 */
bool DartGame::addThrowToPlayer(const String& playerId, const Throw& dartThrow)
{
    if (!gameMode) return false;
    return gameMode->addThrowToPlayer(playerId, dartThrow);
}

/**
 * Get throws of the current player
 * Delegated to game mode
 */
std::vector<Throw> DartGame::getCurrentPlayerThrows()
{
    if (!gameMode) return std::vector<Throw>();
    return gameMode->getCurrentPlayerThrows();
}

/**
 * Get throws of a specific player
 * Delegated to game mode
 */
std::vector<Throw> DartGame::getPlayerThrows(const String& playerId)
{
    if (!gameMode) return std::vector<Throw>();
    return gameMode->getPlayerThrows(playerId);
}

/**
 * Undo the last throw for the current player
 * Delegated to game mode
 */
bool DartGame::undoLastThrow()
{
    if (!gameMode) return false;
    return gameMode->undoLastThrow();
}

/**
 * Undo the last throw for a specific player
 * Delegated to game mode
 */
bool DartGame::undoLastThrowForPlayer(const String& playerId)
{
    if (!gameMode) return false;
    return gameMode->undoLastThrowForPlayer(playerId);
}

/**
 * Get remaining points for current player
 * Delegated to game mode
 */
uint16_t DartGame::getCurrentPlayerRemainingPoints()
{
    if (!gameMode) return 0;
    return gameMode->getCurrentPlayerRemainingPoints();
}

/**
 * Get remaining points for a specific player
 * Delegated to game mode
 */
uint16_t DartGame::getPlayerRemainingPoints(const String& playerId)
{
    if (!gameMode) return 0;
    return gameMode->getPlayerRemainingPoints(playerId);
}


/**
 * Process a dart throw
 * Delegated to active game mode
 */
DartThrowResult DartGame::processDartThrow(uint8_t value, uint8_t multiplier)
{
    if (!gameMode) {
        DartThrowResult result;
        result.success = false;
        result.message = "No game mode set";
        return result;
    }
    return gameMode->processDartThrow(value, multiplier);
}

uint8_t DartGame::getCurrentPlayerIndex()
{
    if (!gameMode) return 0;
    return gameMode->getCurrentPlayerIndex();
}

uint16_t DartGame::getGamePoints()
{
    if (!gameMode) return 0;
    return gameMode->getGamePoints();
}

void DartGame::setGamePoints(uint16_t pts)
{
    if (!gameMode) return;
    gameMode->setGamePoints(pts);
}

uint8_t DartGame::getThrowCounter()
{
    if (!gameMode) return 0;
    return gameMode->getThrowCounter();
}

void DartGame::setThrowCounter(uint8_t count)
{
    if (!gameMode) return;
    gameMode->setThrowCounter(count);
}

uint8_t DartGame::getWinCount()
{
    if (!gameMode) return 0;
    return gameMode->getWinCount();
}

void DartGame::setWinCount(uint8_t count)
{
    if (!gameMode) return;
    gameMode->setWinCount(count);
}

uint8_t DartGame::getTurn()
{
    if (!gameMode) return 0;
    return gameMode->getTurn();
}

void DartGame::setTurn(uint8_t t)
{
    if (!gameMode) return;
    gameMode->setTurn(t);
}

size_t DartGame::getPlayerCount()
{
    if (!gameMode) return 0;
    return gameMode->getPlayerCount();
}

Player& DartGame::getPlayerAt(size_t index)
{
    if (!gameMode) {
        static Player defaultPlayer;
        return defaultPlayer;
    }
    return gameMode->getPlayerAt(index);
}
