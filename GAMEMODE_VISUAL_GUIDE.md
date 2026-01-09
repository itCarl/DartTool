# Game Mode Architecture - Visual Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Web Browser / Menu                         │
│              (User selects: "X01 - 501" game mode)              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    server.cpp (startGame)                        │
│                                                                   │
│  1. Extract mode from JSON: "X01"                              │
│  2. Extract points from JSON: 501                              │
│  3. Call: GameModeFactory::createGameMode("X01", 501)          │
│  4. Call: game.setGameMode(std::move(newGameMode))             │
│  5. Set status: DartGameStatus::running                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   GameModeFactory::createGameMode               │
│                                                                   │
│  if (mode == "X01") {                                           │
│    return std::make_unique<X01GameMode>(501);                 │
│  }                                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                        DartGame                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ String id = "game-123"                                   │   │
│  │ unique_ptr<GameMode> gameMode → [X01GameMode Instance]  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  processDartThrow(20)  ──┐                                      │
│                           ├→ gameMode->processDartThrow(20)     │
│  serialize()           ──┤   ↓                                  │
│  deserialize()         ──┤   Delegates to active mode           │
│  setStatus()           ──┘                                      │
│  getPlayerCount() ──────┘                                       │
│                                                                   │
└──────────────────────┬─────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌──────────────────┐         ┌──────────────────┐
│  X01GameMode     │         │ CricketGameMode  │
│  (Current)       │         │ (Future)         │
│                  │         │                  │
│  ✓ Implemented   │         │ - To be added    │
│  ✓ Working       │         │                  │
│  ✓ Tested        │         │ Add by:          │
│                  │         │ 1. Create class  │
│  Methods:        │         │ 2. Update factory│
│  - processDart   │         │ 3. Update menu   │
│  - serialize()   │         │                  │
│  - reset()       │         └──────────────────┘
│  - etc.          │
└──────────────────┘
```

## Class Hierarchy

```
GameMode (Abstract Base)
│
├── Pure Virtual Methods:
│   ├── reset()
│   ├── processDartThrow(int score)
│   ├── serialize(JsonObject& obj)
│   ├── serializeForDisplay(JsonObject& obj)
│   ├── deserialize(const JsonObject& obj)
│   ├── deserializePartial(const JsonObject& obj)
│   ├── getGameModeName()
│   └── getGameModeDescription()
│
├── Common Methods (inherited by all modes):
│   ├── getCurrentPlayer()
│   ├── nextPlayer()
│   ├── isPlayerTurnComplete()
│   ├── setPlayers()
│   ├── addThrowToCurrentPlayer()
│   ├── undoLastThrow()
│   └── ... (other common operations)
│
└── Concrete Implementations:
    ├── X01GameMode ✓
    │   ├── X01-specific state
    │   ├── X01 processDartThrow()
    │   └── X01 serialization
    │
    ├── CricketGameMode (to be added)
    │   ├── Cricket-specific state
    │   ├── Cricket processDartThrow()
    │   └── Cricket serialization
    │
    └── AroundTheClockGameMode (to be added)
        ├── AtC-specific state
        ├── AtC processDartThrow()
        └── AtC serialization
```

## Data Flow: Dart Throw Processing

```
┌─────────────────────────────────────────────────────┐
│ Web UI: User throws dart, sends score: 20           │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ server.cpp: handleDartThrow() receives {score: 20}  │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ DartGame::processDartThrow(20)                       │
│   (thin wrapper/facade)                              │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ gameMode->processDartThrow(20)                       │
│ (delegates to active game mode)                      │
└────────────────┬────────────────────────────────────┘
                 │
      ┌──────────┴──────────┐
      ▼                     ▼
┌──────────────┐   ┌──────────────────┐
│ X01GameMode  │   │ OtherGameMode    │
│              │   │                  │
│ X01 Logic:   │   │ Their Logic:     │
│ • Check bust │   │ • Apply rules    │
│ • Add points │   │ • Update state   │
│ • Check win  │   │ • Check win      │
│ • Next turn  │   │ • Next turn      │
└──────────────┘   └──────────────────┘
      │                    │
      └──────────┬─────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ DartThrowResult {                                    │
│   success: bool,                                    │
│   message: "Dart throw recorded",                   │
│   score: 20,                                        │
│   pointsRemaining: 481,                             │
│   playerName: "Alice",                              │
│   hasWon: false,                                    │
│   ...                                               │
│ }                                                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ server.cpp: Send result to Web UI as JSON           │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ Web UI: Update display with new game state          │
│  • Remaining points for Alice: 481                  │
│  • Current player: Bob                              │
│  • Turn counter: 1/3                                │
└─────────────────────────────────────────────────────┘
```

## Serialization Flow

```
DartGame Instance
│
├── id: "game-123"
└── gameMode: X01GameMode*
    │
    ├── status: running
    ├── players: [Alice, Bob, Charlie]
    ├── currentPlayerIndex: 0
    ├── throwCounter: 2
    ├── turn: 3
    └── points: 501
         │
         └─ Each Player:
            ├── id: "p1"
            ├── name: "Alice"
            ├── points: 65 (accumulated)
            └── turns: [Turn1, Turn2, Turn3]
                 │
                 └─ Each Turn:
                    ├── throwCount: 3
                    └── throws: [Throw1, Throw2, Throw3]
                         │
                         └─ Each Throw:
                            ├── value: 20
                            ├── field: 1 (multiplier)
                            └── ring: "single"

serialize() produces:
{
  "id": "game-123",
  "status": "running",
  "gameMode": "X01",
  "currentPlayerIndex": 0,
  "throwCounter": 2,
  "points": 501,
  "turn": 3,
  "players": [
    {
      "id": "p1",
      "name": "Alice",
      "points": 65,
      "remainingPoints": 436,
      "winPos": 0
    },
    ...
  ]
}

serializeForDisplay() produces (minimal):
{
  "status": "running",
  "gameMode": "X01",
  "points": 501,
  "turn": 3,
  "currentPlayerId": "p1",
  "players": [
    {
      "id": "p1",
      "name": "Alice",
      "remainingPoints": 436,
      "throws": [20, 20, 25]
    },
    ...
  ]
}
```

## Game State Transitions

```
                    ┌──────────────┐
                    │   unknown    │
                    └──────┬───────┘
                           │
                           │ Create game & select players
                           ▼
                    ┌──────────────┐
                    │ initialised  │
                    └──────┬───────┘
                           │
                           │ Start game
                           ▼
                    ┌──────────────┐
    ┌───────────────┤   running    │◄────────────────┐
    │               └──────┬───────┘                 │
    │                      │                        │
    │                      │ Dart throw             │
    │                      │ (processDartThrow)     │
    │                      │                        │
    │                      ├─ Win?  ────────────┐   │
    │                      │                    │   │
    │                      │ Next player thrown? │   │
    │                      │                    │   │
    │                      └────────────────────┘   │
    │                                               │
    │ Abort                                  Win detected
    │ Game                                         │
    │                                              ▼
    │                                       ┌──────────────┐
    └──────────────────────────────────────┤   done       │
                                           └──────┬───────┘
                                                  │
                                                  │ New game
                                                  │
                                                  ▼
                                       ┌──────────────────┐
                                       │   aborted        │
                                       └──────────────────┘

Or after abort:
running ──(abort)──> aborted ──(new game)──> unknown
```

## File Organization

```
src/dart/
│
├── Core Game Classes
│   ├── DartGame.h              ← Main API (unchanged externally)
│   ├── DartGame.cpp            ← Delegates to GameMode
│   ├── DartGameStatus.h        ← Game status enum
│   │
│   ├── GameMode.h              ← Abstract base class
│   ├── GameMode.cpp            ← Common implementations
│   │
│   ├── X01GameMode.h           ← X01 implementation
│   ├── X01GameMode.cpp         ← X01 logic
│   │
│   └── GameModeFactory.h       ← Factory for creating modes
│
├── Game Data Classes
│   ├── Player.h                ← Player state
│   ├── PlayerManager.h         ← Player management
│   ├── Throw.h                 ← Single dart throw
│   └── DartGameStatus.h        ← Status enum
│
└── Other
    ├── external/
    ├── server/
    └── web/
```

## Adding a New Game Mode - Visual Steps

```
Step 1: Design Mode
┌─────────────────┐
│ Understand      │
│ Game Rules      │
│ & Win           │
│ Conditions      │
└────────┬────────┘
         │
Step 2:  │  Create Files
         ▼
    ┌───────────────────┐
    │ Create            │
    │ [Mode]GameMode.h  │
    │ [Mode]GameMode.cpp│
    └────────┬──────────┘
             │
Step 3:      │  Implement Methods
             ▼
        ┌──────────────────────┐
        │ Implement all pure   │
        │ virtual methods      │
        │ from GameMode        │
        └────────┬─────────────┘
                 │
Step 4:         │  Add to Factory
                ▼
           ┌─────────────────┐
           │ Update          │
           │ GameModeFactory │
           │ .h              │
           └────────┬────────┘
                    │
Step 5:            │  Update UI
                   ▼
              ┌──────────────┐
              │ Add to web   │
              │ menu options │
              └──────────────┘

Done! The system automatically handles:
✓ Creating instances
✓ Loading/saving state
✓ Turn progression
✓ Player management
✓ Win detection
```

## Comparison: Before vs After

### Before (Monolithic)
```
DartGame
├── X01 game state (points, turns, etc.)
├── X01 game logic (processDartThrow with all X01 rules)
├── X01 serialization
├── X01 deserialization
└── Problem: Adding new mode requires modifying DartGame
```

### After (Strategy Pattern)
```
DartGame (controller)
└── gameMode: GameMode* ──→ X01GameMode
                         ├→ CricketGameMode (future)
                         └→ AroundTheClockGameMode (future)

Problem solved:
✓ Each mode is independent
✓ DartGame doesn't change when adding modes
✓ New modes only need to implement GameMode interface
✓ Factory handles instantiation
✓ Clean separation of concerns
```

---

**This architecture enables unlimited game modes without touching DartGame!**
