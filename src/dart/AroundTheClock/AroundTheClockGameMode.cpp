#include "AroundTheClockGameMode.h"
#include "../../DartTool.h"

AroundTheClockGameMode::AroundTheClockGameMode()
{
    initSequence();
    status = DartGameStatus::unknown;
    points = 0;
}

void AroundTheClockGameMode::initSequence()
{
    sequence.clear();
    for (uint8_t i = 1; i <= 20; ++i) {
        sequence.push_back(i);
    }
    sequence.push_back(25); // bull to finish
}

void AroundTheClockGameMode::initProgressForPlayer(const String& playerId)
{
    if (progress.find(playerId) == progress.end()) {
        progress[playerId] = 0;
    }
}

uint8_t AroundTheClockGameMode::currentTargetFor(const String& playerId) const
{
    auto it = progress.find(playerId);
    if (it == progress.end()) return sequence.empty() ? 0 : sequence.front();

    size_t idx = it->second;
    if (idx >= sequence.size()) return 0;
    return sequence[idx];
}

bool AroundTheClockGameMode::hasPlayerFinished(const String& playerId) const
{
    auto it = progress.find(playerId);
    if (it == progress.end()) return false;
    return it->second >= sequence.size();
}

void AroundTheClockGameMode::applyThrow(const String& playerId, const Throw& dartThrow)
{
    initProgressForPlayer(playerId);
    if (hasPlayerFinished(playerId)) return;

    uint8_t target = currentTargetFor(playerId);
    if (dartThrow.getValue() == target) {
        progress[playerId] += 1;
    }
}

void AroundTheClockGameMode::rebuildFromHistory()
{
    progress.clear();
    for (Player& p : players) {
        initProgressForPlayer(p.getId());
    }
    for (const HistoryEntry& entry : history) {
        applyThrow(entry.playerId, entry.dartThrow);
    }
}

void AroundTheClockGameMode::recomputeTurnTracking()
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

void AroundTheClockGameMode::reset()
{
    status = DartGameStatus::initialised;
    resetPlayersState();
    points = 0;
    progress.clear();
    for (Player& p : players) {
        initProgressForPlayer(p.getId());
    }
    history.clear();
    DEBUG_PRINTLN("[DT] AroundTheClockGameMode reset");
}

void AroundTheClockGameMode::setPlayers(std::vector<Player>& selectedPlayers)
{
    GameMode::setPlayers(selectedPlayers);
    progress.clear();
    history.clear();
    for (Player& p : players) {
        initProgressForPlayer(p.getId());
    }
    status = DartGameStatus::initialised;
}

DartGameStatus AroundTheClockGameMode::getStatus()
{
    return status;
}

void AroundTheClockGameMode::setStatus(DartGameStatus newStatus)
{
    status = newStatus;
}

String AroundTheClockGameMode::getStatusString()
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

DartGameStatus AroundTheClockGameMode::stringToStatus(String statusString)
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

DartThrowResult AroundTheClockGameMode::processDartThrow(uint8_t value, uint8_t multiplier, double angle, double radius)
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
    dartThrow.setAngle(angle);
    dartThrow.setRadius(radius);

    if (!currentPlayer.addThrowToTurn(turn, dartThrow)) {
        result.success = false;
        result.message = "Unable to record throw for current turn";
        return result;
    }

    throwCounter++;
    history.push_back({currentPlayer.getId(), dartThrow});
    applyThrow(currentPlayer.getId(), dartThrow);

    if (hasPlayerFinished(currentPlayer.getId())) {
        currentPlayer.setWinPos(1);
        status = DartGameStatus::playerWon;
        result.hasWon = true;
        result.winner = currentPlayer.getName();
        result.winnerId = currentPlayer.getId();
        result.message = "Around the Clock complete - winner: " + currentPlayer.getName();
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

bool AroundTheClockGameMode::undoLastThrow()
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

    rebuildFromHistory();
    recomputeTurnTracking();

    if (status == DartGameStatus::done || status == DartGameStatus::playerWon) {
        status = DartGameStatus::running;
    }

    return true;
}

void AroundTheClockGameMode::serialize(JsonObject& obj)
{
    obj["status"] = getStatusString();
    obj["currentPlayerIndex"] = currentPlayerIndex;
    if (!players.empty()) {
        obj["currentPlayerId"] = getCurrentPlayer().getId();
    }
    obj["throwCounter"] = throwCounter;
    obj["winCount"] = winCount;
    obj["turn"] = turn;
    obj["gameMode"] = getGameModeName();

    JsonArray seqArray = obj["sequence"].to<JsonArray>();
    for (uint8_t t : sequence) {
        seqArray.add(t);
    }

    JsonArray jsonPlayers = obj["players"].to<JsonArray>();
    for (Player& p : players) {
        JsonObject player = jsonPlayers.add<JsonObject>();
        p.serialize(player);
        initProgressForPlayer(p.getId());
        player["nextTarget"] = currentTargetFor(p.getId());
        player["progressIndex"] = progress[p.getId()];
    }
}

void AroundTheClockGameMode::serializeForDisplay(JsonObject& obj)
{
    addCommonDisplayFields(obj);  // Add gameType and other common fields
    obj["status"] = getStatusString();
    obj["turn"] = turn;
    obj["gameMode"] = getGameModeName();
    if (!players.empty()) {
        obj["currentPlayerId"] = getCurrentPlayer().getId();
    }

    JsonArray seqArray = obj["sequence"].to<JsonArray>();
    for (uint8_t t : sequence) {
        seqArray.add(t);
    }

    JsonArray jsonPlayers = obj["players"].to<JsonArray>();
    for (const Player& p : players) {
        JsonObject playerObj = jsonPlayers.add<JsonObject>();
        playerObj["id"] = p.getId();
        playerObj["name"] = p.getName();
        initProgressForPlayer(p.getId());
        playerObj["nextTarget"] = currentTargetFor(p.getId());
        playerObj["progressIndex"] = progress[p.getId()];
        playerObj["winPos"] = p.hasWon() ? 1 : 0;
    }
}

void AroundTheClockGameMode::deserialize(const JsonObject& obj)
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
    progress.clear();

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
            initProgressForPlayer(player.getId());
            if (playerObj["progressIndex"].is<uint8_t>()) {
                progress[player.getId()] = playerObj["progressIndex"].as<uint8_t>();
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

void AroundTheClockGameMode::deserializePartial(const JsonObject& obj)
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
}

void AroundTheClockGameMode::displayGameInfo()
{
    if (players.empty()) return;

    Player& currentPlayer = getCurrentPlayer();
    std::vector<Throw> throws = currentPlayer.getThrows();

    // Row 1: Current target number
    clearRow(1);
    uint8_t targetIdx = 0;
    if (progress.find(currentPlayer.getId()) != progress.end()) {
        targetIdx = progress[currentPlayer.getId()];
    }
    uint8_t target = (targetIdx < sequence.size()) ? sequence[targetIdx] : 0;
    String targetStr = "Target: " + String(target);
    printCentered(targetStr, 1);

    // Row 2: Last throw and progress
    clearRow(2);
    if (throws.size() > 0) {
        Throw lastThrow = throws.back();
        String throwStr = lastThrow.toString();
        // Add progress indicator
        throwStr += " (" + String(targetIdx) + "/" + String(sequence.size()) + ")";
        printCentered(throwStr, 2);
    } else {
        String progressStr = "Progress: " + String(targetIdx) + "/" + String(sequence.size());
        printCentered(progressStr, 2);
    }
}
