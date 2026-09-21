from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_home():
    response = client.get("/")
    assert response.status_code == 200
    assert "Bubble Pop" in response.text

def test_health_shape():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] in {"ok", "degraded"}

def test_invalid_difficulty():
    response = client.post("/api/scores", json={
        "player_name": "Test",
        "score": 10,
        "difficulty": "Unknown"
    })
    assert response.status_code == 422
