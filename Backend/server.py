from fastapi import FastAPI
from pydantic import BaseModel
from sqlite3 import connect, IntegrityError
from fastapi.middleware.cors import CORSMiddleware

# === App setup ===
app = FastAPI(title="Go Game Backend Demo")

# CORS: allow frontend on localhost or 127.0.0.1 to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for demo, allow all; tighten later if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Database setup ===
DB_NAME = "reversi.db"


def init_db():
    """Initialize database tables if they don't exist."""
    conn = connect(DB_NAME)
    cur = conn.cursor()

    # Players table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )
    """)

    # Games table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player1_id INTEGER NOT NULL,
            player2_id INTEGER NOT NULL,
            winner_id INTEGER,
            score_p1 INTEGER NOT NULL,
            score_p2 INTEGER NOT NULL,
            FOREIGN KEY (player1_id) REFERENCES players(id),
            FOREIGN KEY (player2_id) REFERENCES players(id),
            FOREIGN KEY (winner_id) REFERENCES players(id)
        )
    """)

    conn.commit()
    conn.close()


init_db()

# === Data models ===
class Player(BaseModel):
    name: str


class Game(BaseModel):
    player1: str
    player2: str
    score_p1: int
    score_p2: int


# === Routes ===
@app.post("/players")
def add_player(player: Player):
    """Add a player to the database if not already present."""
    conn = connect(DB_NAME)
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO players (name) VALUES (?)", (player.name,))
        conn.commit()
        return {"message": f"Added {player.name}"}
    except IntegrityError:
        return {"message": f"{player.name} already exists"}
    finally:
        conn.close()


@app.get("/players")
def get_players():
    """Return all players."""
    conn = connect(DB_NAME)
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM players")
    players = [{"id": row[0], "name": row[1]} for row in cur.fetchall()]
    conn.close()
    return players


@app.post("/games")
def record_game(game: Game):
    """Record a completed game and update leaderboard stats."""
    conn = connect(DB_NAME)
    cur = conn.cursor()

    # Ensure both players exist
    for name in (game.player1, game.player2):
        try:
            cur.execute("INSERT INTO players (name) VALUES (?)", (name,))
            conn.commit()
        except IntegrityError:
            pass  # already exists

    # Lookup player IDs
    cur.execute("SELECT id FROM players WHERE name = ?", (game.player1,))
    p1_id = cur.fetchone()[0]
    cur.execute("SELECT id FROM players WHERE name = ?", (game.player2,))
    p2_id = cur.fetchone()[0]

    # Determine winner
    winner_id = None
    if game.score_p1 > game.score_p2:
        winner_id = p1_id
    elif game.score_p2 > game.score_p1:
        winner_id = p2_id

    # Record game
    cur.execute("""
        INSERT INTO games (player1_id, player2_id, winner_id, score_p1, score_p2)
        VALUES (?, ?, ?, ?, ?)
    """, (p1_id, p2_id, winner_id, game.score_p1, game.score_p2))
    conn.commit()
    conn.close()

    return {"message": f"Game recorded between {game.player1} and {game.player2}"}


@app.get("/leaderboard")
def leaderboard():
    """Return player leaderboard sorted by number of wins."""
    conn = connect(DB_NAME)
    cur = conn.cursor()
    cur.execute("""
        SELECT p.name, COUNT(g.winner_id) AS wins
        FROM players p
        LEFT JOIN games g ON p.id = g.winner_id
        GROUP BY p.id
        ORDER BY wins DESC, p.name ASC
    """)
    results = [{"name": row[0], "wins": row[1]} for row in cur.fetchall()]
    conn.close()
    return results
