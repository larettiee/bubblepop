from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.db import connect, get_scores, init_db, save_score

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Bubble Pop", version="1.0.1")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


class ScoreIn(BaseModel):
    player_name: str = Field(min_length=1, max_length=100)
    score: int = Field(ge=0)
    difficulty: str


@app.on_event("startup")
def startup():
    try:
        init_db()
    except Exception:
        # The UI can still start if PostgreSQL is temporarily unavailable.
        pass


@app.get("/")
def index():
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/api/health")
def health():
    try:
        with connect() as conn:
            conn.execute("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        # Keep the API response simple, but log the actual problem in the server console.
        print(f"[DB HEALTH ERROR] {type(exc).__name__}: {exc}")
        return {"status": "degraded", "database": "unavailable"}


@app.get("/api/scores")
def scores():
    try:
        return get_scores()
    except Exception as exc:
        print(f"[GET SCORES ERROR] {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc


@app.post("/api/scores", status_code=201)
def create_score(payload: ScoreIn):
    player_name = payload.player_name.strip()

    if not player_name:
        raise HTTPException(status_code=422, detail="Player name cannot be empty")

    if payload.difficulty not in {"Легко", "Средний", "Сложно"}:
        raise HTTPException(status_code=422, detail="Invalid difficulty")

    try:
        row = save_score(player_name, payload.score, payload.difficulty)

        # created_at is TEXT in the current PostgreSQL schema,
        # so return it as a string instead of calling .isoformat().
        created_at = str(row[1]) if row[1] is not None else ""

        return {
            "id": row[0],
            "player_name": player_name,
            "score": payload.score,
            "difficulty": payload.difficulty,
            "created_at": created_at,
        }
    except Exception as exc:
        print(f"[SAVE SCORE ERROR] {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=503, detail="Database is unavailable") from exc
