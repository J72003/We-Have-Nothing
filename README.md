# We-Have-Nothing
Go is a traditional strategic game similar to chess that originates from China.

The traditional rules for Go actually contained a glaring mathematical error that could convert a winner into a loser when counting points, which was eventually remedied under the more modern ruleset that has been in use since the late 1980s. An official English translation of the new rules was later published in 1989. 

As for the board itself, it is made up of 19 parallel vertical and horizontal lines, making a total of 361 intersections, known as points. Nine points are marked with a prominent dot, and these are known as star points. The point in the center is referred to as the central star. 

The pieces are lens shaped stones, 180 of each type, black and white in color. The players are known as black and white, after the colors of their pieces that they play with. Black makes the first play, and then it alternates between players. 
Each player plays one stone per turn. Stones can only be played on points on the board and cannot be moved once placed. Either player may pass their turn if desired. 

Unoccupied intersections on the board are known as liberties. Stones of the same color that are placed vertically or horizontally adjacent to each other will count both of their liberties together. When a stone of an opposite color is placed horizontally or vertically adjacent to another stone, one liberty is taken from the opponent’s stone. If all of a stone’s liberties are taken, it is removed from the board entirely. If a play is made that makes it so both stones have no liberties, the opponent’s stone is removed in that circumstance. A player is forbidden from making a play on a point that has no liberties to claim and would not result in removal of any stones. These are known as forbidden points. If a player tries to make a play on a forbidden point, the play is considered invalid and the player loses their turn. Reappearance of the same board positions in the game is also forbidden. 

The game ends either when one side forfeits or if both sides agree that all possible moves have been exhausted. Stones that both sides agree could be inevitably captured are marked out as ‘dead’ and removed from the board while others are considered ‘alive’. These decisions must be made with the consent of both players. Then, one side’s score is counted and compared to 180-1/2, and if it is lower, the other side wins, if it’s higher, then they win, and if it is equal, it is considered a draw. 
In modern national competitions, 2-3/4 points are deducted from black’s score to counteract the advantage of black going first. The player may not move a stone once it is placed down on the board unless it slips out of the player’s hand by accident. 

---

# We-Have-Nothing — Go (囲碁) Capstone

A web-based **Go (囲碁)** game built by **Team We Have Nothing**.
This project combines a **TypeScript + Canvas + Vite** frontend with a **FastAPI + SQLite** backend that powers game recording, a live leaderboard, and multiplayer rooms via WebSockets.

## Live Demo

* **Frontend (Netlify):** [https://we-have-nothing.netlify.app](https://we-have-nothing.netlify.app)
* **Backend (Render):** [https://we-have-nothing.onrender.com](https://we-have-nothing.onrender.com)

---

## Features

* **19×19 Go board**
* **Local Player vs Player**
* **Player vs AI** (simple/random move logic)
* **AI vs AI Demo mode**
* **Live score UI**

  * placed stone count
  * territory preview logic
* **Leaderboard**

  * tracks players and wins
  * updates after game end
* **Multiplayer Rooms (WebSockets)**

  * join a room by name
  * moves broadcast to other clients

> This is a capstone implementation focused on interactive play and system integration rather than tournament-perfect Go rules.

---

## Tech Stack

**Frontend**

* TypeScript
* Vite
* HTML/CSS
* Canvas API

**Backend**

* FastAPI
* SQLite
* WebSockets (FastAPI)

---

## Project Structure

```
WE-HAVE-NOTHING/
│
├── index.html
├── src/
│   ├── main.ts
│   ├── style.css
│   └── chat-ui.ts (if used)
│
├── dist/                 # build output (auto-generated)
├── package.json
├── tsconfig.json
├── vite.config.ts
│
└── backend/
    ├── server.py
    ├── requirements.txt
    └── *.db
```

---

## Local Setup

### 1) Clone

```
git clone https://github.com/J72003/We-Have-Nothing.git
cd We-Have-Nothing
```

---

### 2) Backend (FastAPI)

```
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8010
```

Backend will run at:

```
http://localhost:8010
```

---

### 3) Frontend (Vite)

From project root:

```
npm install
npm run dev
```

Frontend will run at:

```
http://localhost:3000
```

---

## Environment Configuration (Recommended)

Right now the frontend is configured to use the production Render backend by default.
For clean local dev, create a `.env` in the project root:

```
VITE_API_BASE=http://localhost:8010
VITE_WS_BASE=ws://localhost:8010
```

Then update your `main.ts` to use:

```ts
const API_BASE =
  import.meta.env.VITE_API_BASE ?? "https://we-have-nothing.onrender.com";

const WS_BASE =
  import.meta.env.VITE_WS_BASE ?? "wss://we-have-nothing.onrender.com";
```

---

## API Endpoints

| Endpoint        | Method | Description                    |
| --------------- | ------ | ------------------------------ |
| `/players`      | POST   | Register/add a player          |
| `/players`      | GET    | List all players               |
| `/games`        | POST   | Record a completed game        |
| `/leaderboard`  | GET    | Get leaderboard sorted by wins |
| `/ws/{room_id}` | WS     | Multiplayer room channel       |

---


## Scoring Notes

This project uses a simplified scoring model suitable for a capstone demo:

* Counts placed stones
* Estimates territory using region/border detection
* Updates the UI live

---

## Credits

**Team:** We Have Nothing
**Capstone Project:** Go (囲碁) Web Game

---

## License

MIT


