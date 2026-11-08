import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import chess.engine

mock_engine = MagicMock()
mock_analysis_result = {
    "score": MagicMock(),
    "pv": [chess.Move.from_uci("e2e4"), chess.Move.from_uci("e7e5")],
    "depth": 15
}

mock_analysis_result["score"].relative.score.return_value = 150
mock_analysis_result["score"].relative.is_mate.return_value = False
mock_engine.analyse.return_value = mock_analysis_result
mock_engine.get_best_move_time.return_value = "e2e4"

with patch("shutil.which", return_value="/fake/path/to/stockfish"):
    with patch("chess.engine.SimpleEngine.popen_uci", return_value=mock_engine):
        from app.stockfish_analysis_service.main import app
        import app.stockfish_analysis_service.main as app_module
        app_module.engine = mock_engine

client = TestClient(app)

def test_analyze_endpoint_success():
    payload = {
        "fen": chess.STARTING_FEN,
        "think_time": 0.1
    }

    response = client.post("/analyze", json=payload)

    assert response.status_code == 200
    data = response.json()

    assert data["best_move_uci"] == "e2e4"
    assert data["score_cp"] == 150
    assert data["score_human"] == "1.50"
    assert "e2e4" in data["principal_variation_uci"]

def test_analyze_endpoint_mate():
    mock_mate_result = mock_analysis_result.copy()
    mock_mate_result["score"].relative.is_mate.return_value = True
    mock_mate_result["score"].relative.mate.return_value = 3
    mock_mate_result["pv"] = [chess.Move.from_uci("g8f6")]
    mock_engine.analyse.return_value = mock_mate_result

    payload = {
        "fen": "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
        "think_time": 0.1
    }

    response = client.post("/analyze", json=payload)

    assert response.status_code == 200
    data = response.json()

    assert data["score_cp"] is None
    assert "Mat w 3" in data["score_human"]

def test_analyze_invalid_fen():
    payload = {
        "fen": "to nie jest fen",
        "think_time": 0.1
    }

    response = client.post("/analyze", json=payload)
    assert response.status_code == 400
    assert "Nieprawidłowy format FEN" in response.json()["detail"]

def test_move_endpoint_success():
    payload = {
        "fen": chess.STARTING_FEN,
        "depth": 10,
        "think_time": 0.1
    }

    response = client.post("/move", json=payload)
    assert response.status_code == 200
    assert response.json() == {"best_move_uci": "e2e4"}

def test_analyze_game_over():
    mate_fen = "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4"

    payload = {
        "fen": mate_fen,
        "think_time": 0.1
    }

    response = client.post("/analyze", json=payload)
    assert response.status_code == 400
    assert "zakończonej gry" in response.json()["detail"]