# We-Have-Nothing
Go is a traditional strategic game similar to chess that originates from China.

The traditional rules for Go actually contained a glaring mathematical error that could convert a winner into a loser when counting points, which was eventually remedied under the more modern ruleset that has been in use since the late 1980s. An official English translation of the new rules was later published in 1989. 

As for the board itself, it is made up of 19 parallel vertical and horizontal lines, making a total of 361 intersections, known as points. Nine points are marked with a prominent dot, and these are known as star points. The point in the center is referred to as the central star. 

The pieces are lens shaped stones, 180 of each type, black and white in color. The players are known as black and white, after the colors of their pieces that they play with. Black makes the first play, and then it alternates between players. 
Each player plays one stone per turn. Stones can only be played on points on the board and cannot be moved once placed. Either player may pass their turn if desired. 

Unoccupied intersections on the board are known as liberties. Stones of the same color that are placed vertically or horizontally adjacent to each other will count both of their liberties together. When a stone of an opposite color is placed horizontally or vertically adjacent to another stone, one liberty is taken from the opponent’s stone. If all of a stone’s liberties are taken, it is removed from the board entirely. If a play is made that makes it so both stones have no liberties, the opponent’s stone is removed in that circumstance. A player is forbidden from making a play on a point that has no liberties to claim and would not result in removal of any stones. These are known as forbidden points. If a player tries to make a play on a forbidden point, the play is considered invalid and the player loses their turn. Reappearance of the same board positions in the game is also forbidden. 

The game ends either when one side forfeits or if both sides agree that all possible moves have been exhausted. Stones that both sides agree could be inevitably captured are marked out as ‘dead’ and removed from the board while others are considered ‘alive’. These decisions must be made with the consent of both players. Then, one side’s score is counted and compared to 180-1/2, and if it is lower, the other side wins, if it’s higher, then they win, and if it is equal, it is considered a draw. 
In modern national competitions, 2-3/4 points are deducted from black’s score to counteract the advantage of black going first. The player may not move a stone once it is placed down on the board unless it slips out of the player’s hand by accident. 

Here’s a clean, professional **GitHub README.md** for your project — formatted for a repository like `GoGame-AI` or `FutureGo`.

---

# 🏯 Future Go (囲碁) — AI vs Human Web Game

An interactive **Go (囲碁)** web game built with **TypeScript**, featuring:

* Human vs Human (PVP)
* Human (Black) vs AI
* Human (White) vs AI
* AI vs AI Demo mode
  with real-time score tracking and a live leaderboard backed by a FastAPI backend.

---

## 🎮 Features

Human vs Human (Local PVP)

Human vs AI (Random AI logic)

AI vs AI Demo Mode

Online Multiplayer (via WebSockets)

Live Leaderboard (FastAPI + SQLite backend)

Smooth UI built with Canvas and CSS

Deployed live:

Frontend: https://we-have-nothing.netlify.app

Backend: https://we-have-nothing.onrender.com

## 🧩 Project Structure

```
project/
│
├── src/
│   ├── main.ts          # Core game logic (TypeScript)
│   ├── style.css        # Additional CSS styling (optional)
│
├── index.html           # UI and DOM layout
├── server.py            # FastAPI backend (records players/games)
├── requirements.txt     # Python dependencies
├── package.json         # Node.js frontend dependencies
└── README.md            # You are here
```

---

## ⚙️ Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/futurego.git
cd futurego
```

### 2. Backend Setup (Python / FastAPI)

Create a virtual environment and install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

Run the server:

```bash
uvicorn server:app --reload --port 8010
```

> The backend runs at `http://127.0.0.1:8010`

---

### 3. Frontend Setup (TypeScript / Vite)

```bash
cd frontend
npm install
npm run dev
```

Then open the local server (usually `http://localhost:5173`) to play.

---

## 💾 API Endpoints (FastAPI)

| Endpoint       | Method | Description                            |
| -------------- | ------ | -------------------------------------- |
| `/players`     | POST   | Add or register a player               |
| `/games`       | POST   | Record game results                    |
| `/leaderboard` | GET    | Fetch all players and their win counts |

---

## 🧠 Gameplay Summary

| Action          | Description                                            |
| --------------- | ------------------------------------------------------ |
| **Click board** | Place a stone on an empty intersection                 |
| **Pass**        | Skips your turn (two consecutive passes = end of game) |
| **New Game**    | Resets board and scoreboard                            |
| **Start Demo**  | Starts AI vs AI autoplay                               |
| **Stop Demo**   | Ends demo mode                                         |

---

## 🪄 Technical Highlights

* **Canvas Rendering:** Dynamic Go grid with live updates
* **Score Computation:** Uses BFS flood-fill to detect territory ownership
* **Sound Feedback:** Simple tone when placing stones
* **Leaderboard:** Fully dynamic, synced with backend database
* **TypeScript Architecture:** Class-based, modular, maintainable structure

---

## ✨ NEW FEATURES (2025 Update)

### Gameplay Enhancements
* **Board Size Selection**: Choose between 9x9 (Quick), 13x13 (Medium), or 19x19 (Standard) boards
* **AI Difficulty Levels**: Easy, Medium, and Hard AI opponents with different strategies
* **Move History & Undo**: Full move history tracking with ability to undo moves
* **Hover Preview**: See a preview of your stone before placing it
* **Last Move Highlight**: Visual indicator of the most recent move
* **Territory Preview Toggle**: View territory calculations during gameplay
* **Hint System**: Get AI suggestions for your next move
* **Game Replay**: Review completed games move-by-move

### Visual & Polish
* **Multiple Board Themes**:
  - Classic Wood (traditional)
  - Modern Blue (contemporary)
  - Dark Mode (night-friendly)
  - Bamboo Forest (nature-inspired)
* **Improved Stone Animations**: Smooth placement with realistic gradients
* **Star Points**: Traditional board markers for all board sizes
* **Enhanced Capture Effects**: Better visual feedback for captured stones

### Achievement System
* **12 Unique Achievements**: Track your progress and milestones
  - First Stone, First Blood, Territory Master
  - Combo Master, Speed Demon, Patient Player
  - Corner King, Perfect Victory, Comeback Kid
  - Getting Started, Veteran Player, Go Master
* **Achievement Notifications**: Beautiful pop-up notifications when unlocking achievements
* **Progress Tracking**: View all achievements and your completion percentage

### Game Features
* **Chess Clock Timer**: Optional 10-minute timer for each player
* **Game Statistics**: Track moves, history, and time remaining
* **Persistent Progress**: Achievements and stats saved locally

### Future Improvements
* Smarter AI using Monte Carlo Tree Search
* Daily challenges and puzzles
* Online multiplayer rankings
* Share game replays via URL
* Tutorial mode for beginners
* More board themes and customization

---

## 📸 Preview


---

## 🧾 License

This project is licensed under the **MIT License** — free to use and modify.

---

## 👥 Credits

**Developed by:** We Have Nothing

**Stack:** TypeScript · Vite · FastAPI · Canvas API

**Inspiration:** Traditional Go (囲碁) with modern web interactivity


