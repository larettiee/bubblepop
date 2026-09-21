from pathlib import Path

BASE = Path(__file__).resolve().parents[1]

def test_frontend_files_exist():
    assert (BASE / "app" / "static" / "index.html").exists()
    assert (BASE / "app" / "static" / "styles.css").exists()
    assert (BASE / "app" / "static" / "app.js").exists()

def test_required_routes_are_declared():
    source = (BASE / "app" / "main.py").read_text(encoding="utf-8")
    assert '/api/health' in source
    assert '/api/scores' in source
