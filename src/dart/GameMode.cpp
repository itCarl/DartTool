#include "GameMode.h"
#include "../DartTool.h"

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
    // If in team mode, reorder players to alternate teams up-front
    if (gameType == GameType::TEAM) {
        std::vector<String> teamOrder;
        std::map<String, std::vector<Player>> teamBuckets;

        // Preserve first-seen team order and bucket players per team
        for (const auto& player : selectedPlayers) {
            String teamId = player.getTeamId();
            if (teamId.isEmpty()) {
                teamId = "__no_team__";  // fallback bucket
            }
            if (teamBuckets.find(teamId) == teamBuckets.end()) {
                teamOrder.push_back(teamId);
            }
            teamBuckets[teamId].push_back(player);
        }

        // Find the maximum team size to determine how many rotations we need
        size_t maxTeamSize = 0;
        for (const auto& tid : teamOrder) {
            if (teamBuckets[tid].size() > maxTeamSize) {
                maxTeamSize = teamBuckets[tid].size();
            }
        }

        // Dynamic round-robin: alternate between teams, each team cycles through its players
        // For uneven teams, smaller teams will repeat their players
        // Example: Team A (1 player), Team B (3 players)
        // Result: A1, B1, A1, B2, A1, B3, A1, B1, ...
        std::vector<Player> reordered;
        std::map<String, size_t> teamPlayerIndex; // Track current player index for each team
        
        // Initialize player indices for each team
        for (const auto& tid : teamOrder) {
            teamPlayerIndex[tid] = 0;
        }

        // Create the player order by alternating teams
        // Continue for enough cycles to ensure all players are included
        size_t totalPlayers = selectedPlayers.size();
        size_t teamIndex = 0;
        
        for (size_t i = 0; i < totalPlayers; i++) {
            // Get current team in rotation
            String currentTeamId = teamOrder[teamIndex % teamOrder.size()];
            
            // Get current player index for this team
            size_t playerIdx = teamPlayerIndex[currentTeamId];
            
            // Add the player from this team
            reordered.push_back(teamBuckets[currentTeamId][playerIdx]);
            
            // Advance to next player in this team (wrap around if needed)
            teamPlayerIndex[currentTeamId] = (playerIdx + 1) % teamBuckets[currentTeamId].size();
            
            // Move to next team
            teamIndex++;
        }

        players = reordered;

        // Initialize team points
        teamPoints.clear();
        for (const auto& tid : teamOrder) {
            if (!tid.isEmpty()) {
                teamPoints[tid] = points;
            }
        }
    } else {
        players = selectedPlayers;
    }

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
            // Team mode: use shared team points
            if (gameType == GameType::TEAM) {
                String teamId = player.getTeamId();
                if (teamPoints.find(teamId) != teamPoints.end()) {
                    return teamPoints[teamId];
                }
                // If team points not initialized, return starting points
                return points;
            }
            // Standard mode: use individual player points
            else {
                return points - player.getPoints();
            }
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
