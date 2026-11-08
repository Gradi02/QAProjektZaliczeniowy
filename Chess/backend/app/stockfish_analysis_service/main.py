import chess
import chess.engine
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import shutil

STOCKFISH_PATH = shutil.which("stockfish")
print(f"Znaleziona ścieżka do Stockfisha: {STOCKFISH_PATH}")

if STOCKFISH_PATH is None:
    raise RuntimeError("Nie znaleziono pliku wykonywalnego 'stockfish' w systemowym PATH.")

try:
    engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    print("Silnik Stockfish został pomyślnie uruchomiony.")
except Exception as e:
    engine = None
    print(f"KRYTYCZNY BŁĄD: Nie można uruchomić silnika Stockfish pod ścieżką: {STOCKFISH_PATH}. Błąd: {e}")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class AnalysisRequest(BaseModel):
    fen: str = Field(..., description="Pozycja w notacji FEN do analizy.")
    think_time: float = Field(
        1.0,
        gt=0,
        le=10,
        description="Czas na analizę w sekundach."
    )

class AnalysisResponse(BaseModel):
    best_move_uci: str = Field(
        ...,
        description="Najlepszy ruch w formacie UCI."
    )
    best_move_san: str = Field(
        ...,
        description="Najlepszy ruch w notacji SAN."
    )
    score_cp: int | None = Field(
        None,
        description="Ocena pozycji w centipawnach (None, jeśli mat)."
    )
    score_human: str = Field(
        ...,
        description="Ocena czytelna dla człowieka, np. '+0.85' lub 'Mat w 3'."
    )
    principal_variation_uci: str = Field(
        ...,
        description="Główna linia wariantowa w notacji UCI jako jeden string, np. 'e2e4, e7e5, g1f3'."
    )
    principal_variation_san: str = Field(
        ...,
        description="Główna linia wariantowa w notacji SAN jako jeden string, np. 'e4, e5, Nf3'."
    )
    analysis_depth: int = Field(
        ...,
        description="Głębokość analizy osiągnięta przez silnik."
    )

class MoveRequest(BaseModel):
    fen: str
    depth: int = 10
    skill_level: int = 10
    think_time: float = 1.0


@app.post("/move")
def get_best_move(request: MoveRequest):
    if not engine:  # Fallback
        raise HTTPException(status_code=503, detail="Silnik szachowy jest niedostępny.")

    try:    # Obsługa wyjątku
        board = chess.Board(request.fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="Nieprawidłowy format FEN.")

    if board.is_game_over():    # Powrót, jeśli partia już się zakończyła
        raise HTTPException(status_code=400, detail="Nie można analizować zakończonej gry.")

    try:    # Obsługa wyjątku
        engine.set_fen_position(request.fen)        # Podanie aktualnej pozycji silnikowi
        engine.set_depth(request.depth)             # Ustawienie głębokości analizy
        engine.set_skill_level(request.skill_level) # Ustawienie poziomu mocy analizy

        # Wywołanie wyszukania najlepszego ruchu z maksymalnym ograniczeniem czasowym
        best_move = engine.get_best_move_time(int(request.think_time * 1000))
        return {"best_move_uci": best_move}
    except Exception as e:
        print(f"Błąd podczas analizy FEN {request.fen}: {e}")
        raise HTTPException(status_code=500, detail="Wewnętrzny błąd serwera podczas analizy.")

@app.post("/analyze", response_model=AnalysisResponse, tags=["Analysis"])
async def analyze_position(request: AnalysisRequest):
    if not engine:
        raise HTTPException(status_code=503, detail="Silnik szachowy jest niedostępny.")

    try:
        board = chess.Board(request.fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="Nieprawidłowy format FEN.")

    if board.is_game_over():
        raise HTTPException(status_code=400, detail="Nie można analizować zakończonej gry.")

    try:
        analysis = engine.analyse(board, chess.engine.Limit(time=request.think_time))

        score = analysis['score'].relative
        if score.is_mate():
            mate_in = score.mate()
            human_score = f"Mat w {abs(mate_in)}" if mate_in > 0 else f"Mat przeciwnika w {abs(mate_in)}"
            score_cp = None
        else:
            cp = score.score()
            human_score = f"{cp / 100:.2f}"
            score_cp = cp

        pv_moves_uci_list = [move.uci() for move in analysis.get("pv", [])]
        if not pv_moves_uci_list:
            raise HTTPException(status_code=400, detail="Pozycja nie ma legalnych ruchów do analizy.")

        temp_board = board.copy()
        pv_moves_san_list = []
        for uci in pv_moves_uci_list:
            move = chess.Move.from_uci(uci)
            pv_moves_san_list.append(temp_board.san(move))
            temp_board.push(move)

        best_move_uci = pv_moves_uci_list[0]
        best_move_san = pv_moves_san_list[0]

        pv_moves_uci = ", ".join(pv_moves_uci_list)
        pv_moves_san = ", ".join(pv_moves_san_list)

        return {
            "best_move_uci": best_move_uci,
            "best_move_san": best_move_san,
            "score_cp": score_cp,
            "score_human": human_score,
            "principal_variation_uci": pv_moves_uci,
            "principal_variation_san": pv_moves_san,
            "analysis_depth": analysis.get("depth", 0)
        }

    except Exception as e:
        print(f"Błąd podczas analizy FEN {request.fen}: {e}")
        raise HTTPException(status_code=500, detail="Wewnętrzny błąd serwera podczas analizy.")


@app.on_event("shutdown")
async def shutdown_event():
    if engine:
        print("Zamykanie silnika Stockfish...")
        await engine.quit()