#include "CricketGameMode.h"
#include "DartTool.h"
#include <algorithm>

CricketGameMode::CricketGameMode()
{
    status = DartGameStatus::unknown;
    points = 0;
}

void CricketGameMode::initStateForPlayer(const String& playerId)
{
    if (playerState.find(playerId) != playerState.end()) {
        return;
    }

    PlayerCricketState state;
    for (uint8_t t : targets) {
        state.marks[t] = 0;
    }
    state.score = 0;
    playerState[playerId] = state;
}

bool CricketGameMode::isTarget(uint8_t value) const
{
    return std::find(targets.begin(), targets.end(), value) != targets.end();
}

bool CricketGameMode::opponentsClosed(uint8_t value, const String& playerId)
{
    for (Player& p : players) {
        if (p.getId() == playerId) continue;
        initStateForPlayer(p.getId());
        if (playerState[p.getId()].marks[value] < 3) {
            return false;
        }
    }
    return true;
}

void CricketGameMode::applyThrowToState(const String& playerId, const Throw& dartThrow)
{
    initStateForPlayer(playerId);

    uint8_t value = dartThrow.getValue();
    uint8_t multiplier = dartThrow.getField();

    if (!isTarget(value) || multiplier == 0) {
        return;
    }

    PlayerCricketState& state = playerState[playerId];
    uint8_t before = state.marks[value];
    uint8_t newMarks = before + multiplier;
    uint8_t scoringHits = 0;

    if (before >= 3) {
        scoringHits = multiplier;
    } else if (newMarks > 3) {
        scoringHits = newMarks - 3;
    }

    state.marks[value] = std::min<uint8_t>(newMarks, 3);

    if (scoringHits > 0 && !opponentsClosed(value, playerId)) {
        state.score += scoringHits * value;
    }
}

void CricketGameMode::rebuildStateFromHistory()
{
    playerState.clear();
    for (Player& p : players) {
        initStateForPlayer(p.getId());
    }

    for (const HistoryEntry& entry : history) {
        applyThrowToState(entry.playerId, entry.dartThrow);
    }
}

void CricketGameMode::recomputeTurnTracking()
{
    currentPlayerIndex = 0;
    throwCounter = 0;
    turn = 0;

    if (players.empty()) {
        return;
    }

    for (size_t i = 0; i < history.size(); ++i) {
        throwCounter++;
        if (isPlayerTurnComplete()) {
            nextPlayer();
        }
    }
}

bool CricketGameMode::allTargetsClosed(const String& playerId) const
{
    auto it = playerState.find(playerId);
    if (it == playerState.end()) return false;

    for (uint8_t t : targets) {
        auto mark = it->second.marks.find(t);
        uint8_t hits = (mark != it->second.marks.end()) ? mark->second : 0;
        if (hits < 3) {
            return false;
        }
    }
    return true;
}

uint16_t CricketGameMode::leadingScore() const
{
    uint16_t maxScore = 0;
    for (const auto& pair : playerState) {
        maxScore = std::max<uint16_t>(maxScore, pair.second.score);
    }
    return maxScore;
}

void CricketGameMode::reset()
{
    status = DartGameStatus::initialised;
    resetPlayersState();
    points = 0;
    history.clear();
    playerState.clear();
    for (Player& p : players) {
        initStateForPlayer(p.getId());
    }
    DEBUG_PRINTLN("[DT] CricketGameMode reset");
}

void CricketGameMode::setPlayers(std::vector<Player>& selectedPlayers)
{
    GameMode::setPlayers(selectedPlayers);
    history.clear();
    playerState.clear();
    for (Player& p : players) {
        initStateForPlayer(p.getId());
    }
    status = DartGameStatus::initialised;
}

DartGameStatus CricketGameMode::getStatus()
{
    return status;
}

void CricketGameMode::setStatus(DartGameStatus newStatus)
{
    status = newStatus;
}

String CricketGameMode::getStatusString()
{
    switch(status) {
        case DartGameStatus::initialised: return "initialised";
        case DartGameStatus::running:     return "running";
        case DartGameStatus::playerWon:   return "playerWon";
        case DartGameStatus::done:        return "done";
        case DartGameStatus::aborted:     return "aborted";
        case DartGameStatus::error:       return "error";
        default:
        case DartGameStatus::unknown:     return "unknown";
    }
}

DartGameStatus CricketGameMode::stringToStatus(String statusString)
{
    if (statusString == "initialised")    return DartGameStatus::initialised;
    else if (statusString == "running")   return DartGameStatus::running;
    else if (statusString == "playerWon") return DartGameStatus::playerWon;
    else if (statusString == "done")      return DartGameStatus::done;
    else if (statusString == "aborted")   return DartGameStatus::aborted;
    else if (statusString == "error")     return DartGameStatus::error;
    else if (statusString == "unknown")   return DartGameStatus::unknown;
    else                                   return DartGameStatus::unknown;
}

DartThrowResult CricketGameMode::processDartThrow(uint8_t value, uint8_t multiplier)
{
    DartThrowResult result;
    multiplier = multiplier == 0 ? 1 : multiplier;
    if (multiplier > 3) multiplier = 3;
    result.score = value * multiplier;
    result.hasWon = false;
    result.winner = "";
    result.winnerId = "";

    if (status != DartGameStatus::running) {
        result.success = false;
        result.message = "Game is not in running state";
        return result;
    }

    if (value > 25) {
        result.success = false;
        result.message = "Invalid score: must be 0-25";
        return result;
    }

    if (isPlayerTurnComplete()) {
        result.success = false;
        result.message = "Player turn is complete (3 throws already made)";
        return result;
    }

    Player& currentPlayer = getCurrentPlayer();
    result.playerName = currentPlayer.getName();
    result.playerId = currentPlayer.getId();

    Throw dartThrow;
    dartThrow.setValue(value);
    dartThrow.setField(multiplier);

    if (!currentPlayer.addThrowToTurn(turn, dartThrow)) {
        result.success = false;
        result.message = "Unable to record throw for current turn";
        return result;
    }

    throwCounter++;
    history.push_back({currentPlayer.getId(), dartThrow});
    applyThrowToState(currentPlayer.getId(), dartThrow);

    const PlayerCricketState& state = playerState[currentPlayer.getId()];
    bool closedAll = allTargetsClosed(currentPlayer.getId());
    bool leading = state.score >= leadingScore();

    if (closedAll && leading) {
        currentPlayer.setWinPos(1);
        status = DartGameStatus::playerWon;
        result.hasWon = true;
        result.winner = currentPlayer.getName();
        result.winnerId = currentPlayer.getId();
        result.message = "Cricket complete - winner: " + currentPlayer.getName();
        winCount++;
        result.pointsRemaining = 0;
        result.success = true;
        return result;
    }

    if (isPlayerTurnComplete()) {
        nextPlayer();
        result.message = "Dart recorded - next player";
    } else {
        result.message = "Dart recorded (" + String(throwCounter) + "/3)";
    }

    result.pointsRemaining = 0;
    result.success = true;
    return result;
}

bool CricketGameMode::undoLastThrow()
{
    if (history.empty()) {
        return false;
    }

    HistoryEntry last = history.back();
    history.pop_back();

    for (Player& p : players) {
        if (p.getId() == last.playerId) {
            p.undoLastThrow();
            break;
        }
    }

    rebuildStateFromHistory();
    recomputeTurnTracking();

    if (status == DartGameStatus::done || status == DartGameStatus::playerWon) {
        status = DartGameStatus::running;
    }

    return true;
}

void CricketGameMode::serialize(JsonObject& obj)
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

    JsonArray targetArray = obj["targets"].to<JsonArray>();
    for (uint8_t t : targets) {
        targetArray.add(t);
    }

    JsonArray jsonPlayers = obj["players"].to<JsonArray>();
    for (Player& p : players) {
        JsonObject player = jsonPlayers.add<JsonObject>();
        p.serialize(player);
        initStateForPlayer(p.getId());
        player["score"] = playerState[p.getId()].score;

        JsonArray marksArray = player["marks"].to<JsonArray>();
        for (uint8_t t : targets) {
            JsonObject markObj = marksArray.add<JsonObject>();
            markObj["target"] = t;
            markObj["marks"] = playerState[p.getId()].marks[t];
            markObj["closed"] = playerState[p.getId()].marks[t] >= 3;
        }
    }
}

void CricketGameMode::serializeForDisplay(JsonObject& obj)
{
    obj["status"] = getStatusString();
    obj["turn"] = turn;
    obj["gameMode"] = getGameModeName();
    if (!players.empty()) {
        obj["currentPlayerId"] = getCurrentPlayer().getId();
    }

    JsonArray targetArray = obj["targets"].to<JsonArray>();
    for (uint8_t t : targets) {
        targetArray.add(t);
    }

    JsonArray jsonPlayers = obj["players"].to<JsonArray>();
    for (const Player& p : players) {
        JsonObject playerObj = jsonPlayers.add<JsonObject>();
        playerObj["id"] = p.getId();
        playerObj["name"] = p.getName();
        initStateForPlayer(p.getId());
        playerObj["score"] = playerState[p.getId()].score;
        playerObj["winPos"] = p.hasWon() ? 1 : 0;

        JsonArray marksArray = playerObj["marks"].to<JsonArray>();
        for (uint8_t t : targets) {
            JsonObject markObj = marksArray.add<JsonObject>();
            markObj["target"] = t;
            markObj["marks"] = playerState[p.getId()].marks[t];
            markObj["closed"] = playerState[p.getId()].marks[t] >= 3;
        }
    }
}

void CricketGameMode::deserialize(const JsonObject& obj)
{
    if (obj["status"].is<String>()) {
        status = stringToStatus(obj["status"].as<String>());
    }

    if (obj["throwCounter"].is<uint8_t>()) {
        throwCounter = obj["throwCounter"].as<uint8_t>();
    }

    if (obj["turn"].is<uint8_t>()) {
        turn = obj["turn"].as<uint8_t>();
    }

    if (obj["currentPlayerIndex"].is<uint8_t>()) {
        currentPlayerIndex = obj["currentPlayerIndex"].as<uint8_t>();
    }

    players.clear();
    playerState.clear();

    if (obj["players"].is<JsonArray>()) {
        JsonArray jsonPlayers = obj["players"].as<JsonArray>();
        for (JsonObject playerObj : jsonPlayers) {
            Player player;
            if (playerObj["id"].is<String>()) {
                player.setId(playerObj["id"].as<String>());
            }
            if (playerObj["name"].is<String>()) {
                player.setName(playerObj["name"].as<String>());
            }
            if (playerObj["winPos"].is<uint8_t>()) {
                player.setWinPos(playerObj["winPos"].as<uint8_t>());
            }
            players.push_back(player);

            initStateForPlayer(player.getId());
            if (playerObj["score"].is<uint16_t>()) {
                playerState[player.getId()].score = playerObj["score"].as<uint16_t>();
            }
            if (playerObj["marks"].is<JsonArray>()) {
                for (JsonObject markObj : playerObj["marks"].as<JsonArray>()) {
                    uint8_t target = markObj["target"].as<uint8_t>();
                    uint8_t hits = markObj["marks"].as<uint8_t>();
                    playerState[player.getId()].marks[target] = hits;
                }
            }
        }
    }

    if (obj["currentPlayerId"].is<String>()) {
        String activeId = obj["currentPlayerId"].as<String>();
        for (size_t i = 0; i < players.size(); i++) {
            if (players[i].getId() == activeId) {
                currentPlayerIndex = i;
                break;
            }
        }
    }
}

void CricketGameMode::deserializePartial(const JsonObject& obj)
{
    if (obj["status"].is<String>()) {
        status = stringToStatus(obj["status"].as<String>());
    }
    if (obj["throwCounter"].is<uint8_t>()) {
        throwCounter = obj["throwCounter"].as<uint8_t>();
    }
    if (obj["turn"].is<uint8_t>()) {
        turn = obj["turn"].as<uint8_t>();
    }
    // Player partial updates are not needed for Cricket at the moment.
}
