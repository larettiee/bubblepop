import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
SCHEMA_PATH = BASE_DIR / "database" / "schema.sql"


def connect():
    return psycopg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "bubble_pop"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
    )


def init_db():
    with connect() as conn:
        conn.execute(SCHEMA_PATH.read_text(encoding="utf-8"))


def save_score(player_name: str, score: int, difficulty: str):
    with connect() as conn:
        return conn.execute(
            """
            INSERT INTO scores
                (player_name, score, difficulty, created_at)
            VALUES
                (%s, %s, %s, CURRENT_TIMESTAMP)
            RETURNING id, created_at
            """,
            (player_name, score, difficulty),
        ).fetchone()


def get_scores(limit: int = 10):
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT
                id,
                player_name,
                score,
                difficulty,
                to_char(created_at::timestamp, 'DD.MM.YYYY HH24:MI')
            FROM scores
            ORDER BY score DESC, created_at ASC
            LIMIT %s
            """,
            (limit,),
        ).fetchall()

    return [
        {
            "id": r[0],
            "player_name": r[1],
            "score": r[2],
            "difficulty": r[3],
            "created_at": r[4],
        }
        for r in rows
    ]
    
def get_statistics():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT COUNT(*) AS total_games,
               COALESCE(MAX(score), 0) AS best_score
        FROM scores
    """)

    result = cursor.fetchone()

    cursor.close()
    conn.close()

    return {
        "total_games": result[0],
        "best_score": result[1]
    }    

