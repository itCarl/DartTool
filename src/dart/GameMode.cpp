#include "GameMode.h"
#include "DartTool.h"

Player& GameMode::getCurrentPlayer()
{
    if (players.empty()) {
        DEBUG_PRINTLN("[DT] Error: No players in game");
        static Player defaultPlayer;
        return defaultPlayer;
    }
    if (currentPlayerIndex >= players.size()) {
        currentPlayerIndex = 0;
    }
    return players[currentPlayerIndex];
}

void GameMode::nextPlayer()
{
    if (players.size() <= 1) {
        throwCounter = 0;
        turn++;
        return;
    }
    currentPlayerIndex = (currentPlayerIndex + 1) % players.size();
    throwCounter = 0;
    if (currentPlayerIndex == 0) {
        turn++;
    }
}

bool GameMode::isPlayerTurnComplete()
{
    return throwCounter >= THROWS_PER_TURN;
}

void GameMode::setPlayers(std::vector<Player>& selectedPlayers)
{
    players = selectedPlayers;
    currentPlayerIndex = 0;
}

void GameMode::resetPlayersState()
{
    for (auto& player : players) {
        player.resetGameState();
    }
    currentPlayerIndex = 0;
    throwCounter = 0;
    winCount = 0;
    turn = 0;
}

bool GameMode::addThrowToCurrentPlayer(const Throw& dartThrow)
{
    return addThrowToPlayer(getCurrentPlayer().getId(), dartThrow);
}

bool GameMode::addThrowToPlayer(const String& playerId, const Throw& dartThrow)
{
    for (auto& player : players) {
        if (player.getId() == playerId) {
            return player.addThrowToTurn(turn, dartThrow);
        }
    }
    return false;
}

std::vector<Throw> GameMode::getCurrentPlayerThrows()
{
    return getCurrentPlayer().getThrows();
}

std::vector<Throw> GameMode::getPlayerThrows(const String& playerId)
{
    for (const auto& player : players) {
        if (player.getId() == playerId) {
            return player.getThrows();
        }
    }
    return std::vector<Throw>();
}

bool GameMode::undoLastThrow()
{
    bool undone = undoLastThrowForPlayer(getCurrentPlayer().getId());
    if (undone && throwCounter > 0) {
        throwCounter--;
    }
    return undone;
}

bool GameMode::undoLastThrowForPlayer(const String& playerId)
{
    for (auto& player : players) {
        if (player.getId() == playerId) {
            return player.undoLastThrow();
        }
    }
    return false;
}

uint16_t GameMode::getCurrentPlayerRemainingPoints()
{
    return getPlayerRemainingPoints(getCurrentPlayer().getId());
}

uint16_t GameMode::getPlayerRemainingPoints(const String& playerId)
{
    for (const auto& player : players) {
        if (player.getId() == playerId) {
            return points - player.getPoints();
        }
    }
    return 0;
}

String GameMode::listPlayers()
{
    String result = "";
    for (size_t i = 0; i < players.size(); i++) {
        if (i > 0) result += ", ";
        result += players[i].getName();
    }
    return result;
}
