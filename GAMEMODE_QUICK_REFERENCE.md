# Quick Reference: Game Mode Development Guide

## Quick Start: Adding a New Game Mode

### 1️⃣ Create the Header File
**File: `src/dart/MyGameMode.h`**

```cpp
#pragma once
#ifndef MyGameMode_h
#define MyGameMode_h

#include "GameMode.h"
#include "DartGameStatus.h"

class MyGameMode : public GameMode
{
    private:
        DartGameStatus status = DartGameStatus::unknown;
        // Add your game-specific member variables here

    public:
        MyGameMode();
        
        void reset() override;
        DartGameStatus getStatus();
        void setStatus(DartGameStatus newStatus);
        String getStatusString();
        
        DartThrowResult processDartThrow(int score) override;
        
        void serialize(JsonObject& obj) override;
        void serializeForDisplay(JsonObject& obj) override;
        void deserialize(const JsonObject& obj) override;
        void deserializePartial(const JsonObject& obj) override;
        
        String getGameModeName() override { return "MyGame"; }
        String getGameModeDescription() override { return "Description of your game"; }
};

#endif
```

### 2️⃣ Create the Implementation File
**File: `src/dart/MyGameMode.cpp`**

```cpp
#include "MyGameMode.h"
#include "DartTool.h"

MyGameMode::MyGameMode()
{
    status = DartGameStatus::unknown;
    // Initialize any mode-specific variables
}

void MyGameMode::reset()
{
    status = DartGameStatus::unknown;
    players.clear();
    currentPlayerIndex = 0;
    throwCounter = 0;
    turn = 0;
}

DartGameStatus MyGameMode::getStatus()
{
    return this->status;
}

void MyGameMode::setStatus(DartGameStatus newStatus)
{
    DEBUG_PRINT("[DT] MyGame Status: ");
    DEBUG_PRINT(this->getStatusString());
    DEBUG_PRINT(" -> ");
    this->status = newStatus;
    DEBUG_PRINTLN(this->getStatusString());
}

String MyGameMode::getStatusString()
{
    switch(this->getStatus()) {
        case DartGameStatus::initialised: return "initialised";
        case DartGameStatus::running:     return "running";
        case DartGameStatus::done:        return "done";
        case DartGameStatus::aborted:     return "aborted";
        case DartGameStatus::error:       return "error";
        default:
        case DartGameStatus::unknown:     return "unknown";
    }
}

DartThrowResult MyGameMode::processDartThrow(int score)
{
    DartThrowResult result;
    result.score = score;
    result.hasWon = false;
    
    // YOUR GAME LOGIC HERE
    // Example for X01: Check bust, add points, check win condition
    
    result.success = true;
    return result;
}

void MyGameMode::serialize(JsonObject& obj)
{
    obj["status"] = getStatusString();
    obj["gameMode"] = getGameModeName();
    obj["currentPlayerIndex"] = currentPlayerIndex;
    obj["turn"] = turn;
    
    // Serialize player data
    JsonArray jsonPlayers = obj["players"].to<JsonArray>();
    for(Player& p : players) {
        JsonObject player = jsonPlayers.add<JsonObject>();
        p.serialize(player);
    }
}

void MyGameMode::serializeForDisplay(JsonObject& obj)
{
    obj["status"] = getStatusString();
    obj["gameMode"] = getGameModeName();
    obj["turn"] = turn;
    
    if (!players.empty()) {
        obj["currentPlayerId"] = getCurrentPlayer().getId();
    }
    
    // Serialize only display-relevant data
    JsonArray jsonPlayers = obj["players"].to<JsonArray>();
    for(const Player& p : players) {
        JsonObject player = jsonPlayers.add<JsonObject>();
        player["id"] = p.getId();
        player["name"] = p.getName();
    }
}

void MyGameMode::deserialize(const JsonObject& obj)
{
    if (obj["status"].is<String>()) {
        String statusStr = obj["status"].as<String>();
        // Convert string to status
    }
    // Deserialize player and game data
}

void MyGameMode::deserializePartial(const JsonObject& obj)
{
    // Handle partial updates during game
}
```

### 3️⃣ Update the Factory
**File: `src/dart/GameModeFactory.h`**

**Step 1:** Add the include at the top
```cpp
#include "MyGameMode.h"
```

**Step 2:** Update `createGameMode()` method
```cpp
static std::unique_ptr<GameMode> createGameMode(const String& modeName, uint16_t startingPoints = 501)
{
    String normalizedName = modeName;
    normalizedName.toLowerCase();

    if (normalizedName == "x01") {
        return std::make_unique<X01GameMode>(startingPoints);
    }
    else if (normalizedName == "mygame") {  // ← ADD THIS
        return std::make_unique<MyGameMode>();
    }

    DEBUG_PRINT("[DT] Error: Unknown game mode: ");
    DEBUG_PRINTLN(modeName);
    return nullptr;
}
```

**Step 3:** Update `getAvailableGameModes()` method
```cpp
static void getAvailableGameModes(String** modeNames, size_t* count)
{
    static const String modes[] = {"X01", "MyGame"};  // ← ADD YOUR MODE
    static const size_t modeCount = 2;

    *modeNames = (String*)modes;
    *count = modeCount;
}
```

**Step 4:** Update `getGameModeDescription()` method
```cpp
static String getGameModeDescription(const String& modeName)
{
    String normalizedName = modeName;
    normalizedName.toLowerCase();

    if (normalizedName == "x01") {
        return "Classic X01 - Reduce your score to exactly zero";
    }
    else if (normalizedName == "mygame") {  // ← ADD THIS
        return "My Game - Description of your game mode";
    }

    return "Unknown game mode";
}
```

## Important Methods to Implement

### `processDartThrow(int score)` 
**This is the core game logic method**

Your implementation should:
1. Validate the score (0-25)
2. Check if current player's turn is complete
3. Apply game-specific rules
4. Update player score/state
5. Check for win condition
6. Advance to next player if turn is complete
7. Return a `DartThrowResult` with status and message

### `serialize()` vs `serializeForDisplay()`
- **`serialize()`**: Complete game state (for saving/loading)
- **`serializeForDisplay()`**: Only what's needed for UI (optimized for bandwidth)

### `reset()`
Clear all game state and prepare for a fresh game

## Base Class Methods Available

These are inherited from `GameMode` and can be used:

```cpp
// Player management
Player& getCurrentPlayer();
void nextPlayer();
bool isPlayerTurnComplete();
void setPlayers(std::vector<Player>& selectedPlayers);

// State getters/setters
uint8_t getCurrentPlayerIndex();
uint16_t getGamePoints();
void setGamePoints(uint16_t pts);
uint8_t getThrowCounter();
void setThrowCounter(uint8_t count);
uint8_t getTurn();
void setTurn(uint8_t t);

// Throw management
bool addThrowToCurrentPlayer(const Throw& dartThrow);
bool addThrowToPlayer(const String& playerId, const Throw& dartThrow);
std::vector<Throw> getCurrentPlayerThrows();
std::vector<Throw> getPlayerThrows(const String& playerId);
bool undoLastThrow();
bool undoLastThrowForPlayer(const String& playerId);

// Score calculation
uint16_t getCurrentPlayerRemainingPoints();
uint16_t getPlayerRemainingPoints(const String& playerId);
```

## Example: Cricket Game Mode Skeleton

```cpp
// CricketGameMode.h
class CricketGameMode : public GameMode {
    private:
        DartGameStatus status = DartGameStatus::unknown;
        uint8_t numNumbers = 7;  // 20, 19, 18, 17, 16, 15, Bull
        std::vector<uint8_t> playerScores;  // Marks for each player
        
    public:
        CricketGameMode();
        void reset() override;
        DartThrowResult processDartThrow(int score) override;
        void serialize(JsonObject& obj) override;
        void serializeForDisplay(JsonObject& obj) override;
        void deserialize(const JsonObject& obj) override;
        void deserializePartial(const JsonObject& obj) override;
        
        String getGameModeName() override { return "Cricket"; }
        String getGameModeDescription() override { 
            return "Cricket - Hit 20, 19, 18, 17, 16, 15, Bullseye";
        }
};
```

## Testing Your New Mode

1. **Add the includes to your test**:
   ```cpp
   #include "dart/MyGameMode.h"
   #include "dart/GameModeFactory.h"
   ```

2. **Test factory creation**:
   ```cpp
   auto mode = GameModeFactory::createGameMode("MyGame");
   assert(mode != nullptr);
   assert(mode->getGameModeName() == "MyGame");
   ```

3. **Test game flow**:
   ```cpp
   std::vector<Player> players;
   players.push_back(Player("1", "Alice"));
   players.push_back(Player("2", "Bob"));
   
   mode->setPlayers(players);
   mode->setStatus(DartGameStatus::running);
   
   // Test throws
   DartThrowResult result = mode->processDartThrow(20);
   assert(result.success);
   ```

## Debugging Tips

1. **Enable debug output**: Check that `DEBUG_PRINTLN()` calls show your game mode's actions
2. **Log player state**: After each throw, log player scores and game status
3. **Check turn progression**: Verify players advance correctly
4. **Validate serialization**: Ensure JSON output is correct
5. **Test edge cases**: Bust conditions, win conditions, turn boundaries

## Common Pitfalls to Avoid

❌ **Don't:**
- Modify `players` array directly (use `setPlayers()`)
- Forget to advance turn when player has thrown 3 times
- Not implement all pure virtual methods
- Return success without validating input

✅ **Do:**
- Use inherited methods like `nextPlayer()` and `getCurrentPlayer()`
- Check `isPlayerTurnComplete()` before advancing
- Validate all input in `processDartThrow()`
- Provide meaningful error messages in `DartThrowResult`
- Test with multiple players

## Reference: DartThrowResult Structure

```cpp
struct DartThrowResult {
    bool success;              // Was the throw accepted?
    String message;            // Human-readable message
    int score;                 // The score thrown
    uint16_t pointsRemaining;  // Points/targets left
    String playerName;         // Player who threw
    String playerId;           // Player's ID
    bool hasWon;               // Did this throw win the game?
    String winner;             // Winner's name
    String winnerId;           // Winner's ID
};
```

---

**Need more help? See [GAMEMODE_ARCHITECTURE.md](GAMEMODE_ARCHITECTURE.md) for detailed documentation!**
