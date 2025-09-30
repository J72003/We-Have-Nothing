from sqlite3 import connect, IntegrityError

DB_NAME = "reversi.db"

# Setup database and add example players
def init_db():
    conn = connect(DB_NAME)
    cur = conn.cursor()

    # Create tables
    cur.execute("""
    CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )
    """)
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

    # Add example players
    example_players = ["Austin", "Donna"]
    for name in example_players:
        try:
            cur.execute("INSERT INTO players (name) VALUES (?)", (name,))
        except IntegrityError:
            print(f"Player '{name}' already exists.")

    conn.commit()
    conn.close()

# Add player by name
def add_player(name):
    conn = connect(DB_NAME)
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO players (name) VALUES (?)", (name,))
        conn.commit()
        print(f"Added player: {name}")
    except IntegrityError:
        print(f"Player '{name}' already exists.")
    conn.close()

# Record a game between two players
def record_game(player1_id, player2_id, score_p1, score_p2):
    winner_id = None
    if score_p1 > score_p2:
        winner_id = player1_id
    elif score_p2 > score_p1:
        winner_id = player2_id

    conn = connect(DB_NAME)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO games (player1_id, player2_id, winner_id, score_p1, score_p2)
        VALUES (?, ?, ?, ?, ?)""",
        (player1_id, player2_id, winner_id, score_p1, score_p2))
    conn.commit()
    conn.close()
    print("Game recorded.")

# Show leaderboard
def leaderboard():
    conn = connect(DB_NAME)
    cur = conn.cursor()
    cur.execute("""
        SELECT p.name, COUNT(g.winner_id) as wins
        FROM players p
        LEFT JOIN games g ON p.id = g.winner_id
        GROUP BY p.id
        ORDER BY wins DESC
    """)
    results = cur.fetchall()
    conn.close()
    print("\n Leaderboard:")
    for name, wins in results:
        print(f"{name}: {wins} wins")

# Print current players with their IDs
def show_players():
    conn = connect(DB_NAME)
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM players")
    players = cur.fetchall()
    conn.close()
    print("\n Players:")
    for player_id, name in players:
        print(f"ID {player_id}: {name}")

# Show results of games
# Show all recorded games with scores
def show_games():
    conn = connect(DB_NAME)
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            g.id,
            p1.name AS player1,
            p2.name AS player2,
            g.score_p1,
            g.score_p2,
            pw.name AS winner
        FROM games g
        JOIN players p1 ON g.player1_id = p1.id
        JOIN players p2 ON g.player2_id = p2.id
        LEFT JOIN players pw ON g.winner_id = pw.id
        ORDER BY g.id
    """)
    games = cur.fetchall()
    conn.close()

    print("\nRecorded Games:")
    for game_id, player1, player2, score_p1, score_p2, winner in games:
        print(f"Game {game_id}: {player1} ({score_p1}) vs {player2} ({score_p2}) - Winner: {winner or 'Draw'}")


# Example
if __name__ == "__main__":
    # Step 1: Set up the database and tables
    init_db()

    # Step 2: Add more players
    add_player("Jay")
    add_player("Kimberly")

    # Step 3: Show current players
    show_players()

    # Step 4: Record some games
    record_game(1, 2, 35, 30)  # Austin vs Donna
    record_game(3, 1, 25, 40)  # Charlie vs Austin
    record_game(7, 4, 20, 45)  # Eve vs Dana
    record_game(9, 8, 33, 32)  # Izzy vs Adrian

    # Step 5: Show games with scores
    show_games()

    # Step 6: Show leaderboard
    leaderboard()
