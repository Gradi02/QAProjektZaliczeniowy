import random
import time
import asyncio
from typing import Optional

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import chess
import httpx

from firebase_admin import auth, firestore
from .database import db
from .chess_logic import ChessGame, uci_to_san_history
from .chess_parser import parse_spoken_command_to_intent

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
security = HTTPBearer()


async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token['uid']
    except Exception:
        raise HTTPException(status_code=401, detail="Błąd autoryzacji / Zły token")




class NewGameResponse(BaseModel):
    game_id: str
    message: str
    w_type: str

class NewGameRequest(BaseModel):
    mode: str = "freeplay"  # 'freeplay' lub 'ai'
    player_color: str = "white"  # 'white' lub 'black'
    ai_level: Optional[int] = 1

class MoveRequest(BaseModel):
    command_text: str = Field(..., description="Rozpoznany tekst z mowy, np. 'e2 do e4'")

class GameStatusResponse(BaseModel):
    game_id: str
    fen: str
    turn: str
    is_game_over: bool
    result: Optional[str]
    history: list[str]
    white_player_type: str
    black_player_type: str
    mode: str

class CommandRequest(BaseModel):
    command_text: str

class AnalyzeSuccessResponse(BaseModel):
    success: bool = True
    message: str
    proposed_move_uci: str
    proposed_move_san: str
    possible_moves_uci: list[str]
    possible_moves_san: list[str]
    ifcheck: bool

class ExecuteMoveRequest(BaseModel):
    move_uci: str


ANALYSIS_SERVICE_URL = "http://stockfish_analysis_service:8002/analyze"
async def get_ai_move(fen: str, level: int) -> Optional[str]:
    think_time = max(0.1, min(3.0, level * 0.1))

    payload = {
        "fen": fen,
        "depth": level,
        "skill_level": level,
        "think_time": think_time
    }

    min_delay = 1.0 + (level * 0.2)
    max_delay = 2.0 + (level * 0.5)
    target_delay = random.uniform(min_delay, max_delay)

    start_time = time.time()
    best_move = None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(ANALYSIS_SERVICE_URL, json=payload, timeout=think_time + 5.0)

            if response.status_code == 200:
                data = response.json()
                best_move = data.get("best_move_uci")
            else:
                print(f"Błąd AI Service: {response.text}")
    except Exception as e:
        print(f"Nie udało się połączyć z serwisem AI: {e}")

    elapsed = time.time() - start_time
    remaining_wait = target_delay - elapsed

    if remaining_wait > 0:
        await asyncio.sleep(remaining_wait)

    return best_move


@app.post("/newgame", response_model=NewGameResponse, tags=["Game Lifecycle"])
async def create_new_game(settings: NewGameRequest, user_id: str = Depends(get_current_user_id)):
    w_type = "human" if settings.player_color == "white" else "ai"
    b_type = "human" if settings.player_color == "black" else "ai"
    if settings.mode == "freeplay":
        w_type, b_type = "human", "human"

    new_game_data = {
        "user_id": user_id,
        "mode": settings.mode,
        "white_player_type": w_type,
        "black_player_type": b_type,
        "ai_level": settings.ai_level,
        "fen": chess.STARTING_FEN,
        "history_uci": "",
        "is_game_over": False,
        "result": None,
        "created_at": firestore.SERVER_TIMESTAMP
    }

    update_time, doc_ref = db.collection("games").add(new_game_data)
    print(f"Utworzono nową grę: {doc_ref.id}")
    return {"game_id": doc_ref.id, "message": "Nowa gra utworzona.", "w_type": w_type}


@app.get("/game/history", tags=["Game Lifecycle"])
async def list_games(user_id: str = Depends(get_current_user_id)):
    print(f"DEBUG: Pobieranie historii dla: {user_id}")
    docs = db.collection("games") \
        .where("user_id", "==", user_id) \
        .order_by("created_at", direction=firestore.Query.DESCENDING) \
        .stream()

    games_list = []
    for doc in docs:
        g = doc.to_dict()
        games_list.append({
            "id": doc.id,
            "mode": g.get("mode"),
            "created_at": g.get("created_at")
        })
    return games_list


@app.get("/game/{game_id}", response_model=GameStatusResponse, tags=["Game Lifecycle"])
async def get_game_status(game_id: str, user_id: str = Depends(get_current_user_id)):
    doc_ref = db.collection("games").document(game_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Gra nie znaleziona")

    data = doc.to_dict()

    if data.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="To nie jest twoja gra")

    history_str = data.get("history_uci", "")
    history_list = history_str.split() if history_str else []

    san_history = uci_to_san_history(history_list)
    game_logic = ChessGame.from_uci_history(history_list)

    return {
        "game_id": doc.id,
        "fen": data.get("fen"),
        "turn": "WHITE" if " w " in data.get("fen") else "BLACK",
        "is_game_over": data.get("is_game_over"),
        "result": data.get("result"),
        "history": san_history,
        "white_player_type": data.get("white_player_type"),
        "black_player_type": data.get("black_player_type"),
        "mode": data.get("mode")
    }


@app.post("/game/{game_id}/analyze-command", response_model=AnalyzeSuccessResponse, tags=["Game Logic"])
async def analyze_command(game_id: str, request: CommandRequest, user_id: str = Depends(get_current_user_id)):
    doc_ref = db.collection("games").document(game_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(404, "Brak gry")

    data = doc.to_dict()
    if data.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="To nie jest twoja gra")

    history_str = data.get("history_uci", "")
    history_list = history_str.split() if history_str else []
    game_logic = ChessGame.from_uci_history(history_list)

    if data.get("is_game_over"):
        return {
            "success": False,
            "message": "Gra już się zakończyła.",
            "proposed_move_uci": "None",
            "proposed_move_san": "None",
            "possible_moves_uci": [],
            "possible_moves_san": [],
            "ifcheck": game_logic.board.is_check(),
        }

    intents = parse_spoken_command_to_intent(request.command_text, board=game_logic.board)

    if not intents:
        return {
            "success": False,
            "message": "Nie rozpoznano żadnego możliwego ruchu.",
            "proposed_move_uci": "None",
            "proposed_move_san": "None",
            "possible_moves_uci": [],
            "possible_moves_san": [],
            "ifcheck": game_logic.board.is_check(),
        }

    matching_moves_uci = []
    for intent in intents:
        if intent.get('uci'):
            matching_moves_uci.append(intent['uci'])
        elif intent.get('is_kingside_castle'):
            castle_move = game_logic.get_castling_uci(is_kingside=True)
            if castle_move: matching_moves_uci.append(castle_move)
        elif intent.get('is_queenside_castle'):
            castle_move = game_logic.get_castling_uci(is_queenside=True)
            if castle_move: matching_moves_uci.append(castle_move)

    matching_moves_uci = sorted(list(set(matching_moves_uci)))

    if not matching_moves_uci:
        return {
            "success": False,
            "message": "Brak pasujących legalnych ruchów do rozpoznanych intencji.",
            "proposed_move_uci": "None",
            "proposed_move_san": "None",
            "possible_moves_uci": [],
            "possible_moves_san": [],
            "ifcheck": game_logic.board.is_check(),
        }

    if len(matching_moves_uci) > 1:
        possible_moves_san = [
            game_logic.board.san(chess.Move.from_uci(m)) for m in matching_moves_uci
        ]
        return {
            "success": False,
            "message": "Ruch jest niejednoznaczny.",
            "possible_moves_uci": matching_moves_uci,
            "possible_moves_san": possible_moves_san,
            "proposed_move_uci": "None",
            "proposed_move_san": "None",
            "ifcheck": game_logic.board.is_check(),
        }

    final_move_uci = matching_moves_uci[0]
    final_move_san = game_logic.board.san(chess.Move.from_uci(final_move_uci))

    return {
        "success": True,
        "message": "Znaleziono ruch.",
        "proposed_move_uci": final_move_uci,
        "proposed_move_san": final_move_san,
        "possible_moves_uci": [],
        "possible_moves_san": [],
        "ifcheck": game_logic.board.is_check(),
    }


@app.post("/game/{game_id}/execute-move", tags=["Game Logic"])
async def execute_move(game_id: str, request: ExecuteMoveRequest, user_id: str = Depends(get_current_user_id)):
    doc_ref = db.collection("games").document(game_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(404, "Brak gry")

    data = doc.to_dict()
    if data.get("user_id") != user_id:
         raise HTTPException(status_code=403, detail="To nie jest twoja gra")

    if data.get("is_game_over"):
        raise HTTPException(400, "Gra zakończona")

    history_str = data.get("history_uci", "")
    history_list = history_str.split() if history_str else []
    game_logic = ChessGame.from_uci_history(history_list)

    try:
        if chess.Move.from_uci(request.move_uci) not in game_logic.board.legal_moves:
            raise HTTPException(status_code=400, detail="Ruch nielegalny.")
    except ValueError:
        raise HTTPException(status_code=400, detail="Błędny format UCI.")

    game_logic.make_move(request.move_uci)  # Wykonanie ruchu
    updates = {
        "history_uci": " ".join(game_logic.history_uci),
        "fen": game_logic.board.fen(),
        "is_game_over": game_logic.is_game_over(),
        "result": game_logic.get_game_result(),
        "updated_at": firestore.SERVER_TIMESTAMP
    }
    doc_ref.update(updates)     # Aktualizacja informacji w bazie danych

    # Obiekt statusu wysyłany do UI
    response_state = {
        "game_id": game_id,
        "fen": updates["fen"],
        "turn": "WHITE" if game_logic.board.turn == chess.WHITE else "BLACK",
        "is_game_over": updates["is_game_over"],
        "result": updates["result"],
        "history": uci_to_san_history(game_logic.history_uci),
        "white_player_type": data.get("white_player_type"),
        "black_player_type": data.get("black_player_type"),
        "mode": data.get("mode"),
        "ai_level": data.get("ai_level")
    }

    return {
        "success": True,
        "message": "Ruch wykonany",
        "current_state": response_state
    }


@app.post("/game/{game_id}/surrender", tags=["Game Logic"])
async def surrender_game(game_id: str, user_id: str = Depends(get_current_user_id)):
    doc_ref = db.collection("games").document(game_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(404, "Brak gry")

    data = doc.to_dict()
    if data.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="To nie jest twoja gra")

    if data.get("is_game_over"):
        raise HTTPException(400, "Gra zakończona")

    history_str = data.get("history_uci", "")
    history_list = history_str.split() if history_str else []
    game_logic = ChessGame.from_uci_history(history_list)

    current_turn = game_logic.board.turn
    result_str = "Partia Poddana: 0-1" if current_turn == chess.WHITE else "Partia Poddana: 1-0"
    winner_color = "black" if current_turn == chess.WHITE else "white"

    updates = {
        "is_game_over": True,
        "result": result_str,
        "updated_at": firestore.SERVER_TIMESTAMP
    }
    doc_ref.update(updates)

    return {
        "success": True,
        "message": f"Gracz {'Biały' if current_turn == chess.WHITE else 'Czarny'} poddał grę.",
        "winner": winner_color,
        "current_state": {
            "game_id": doc.id,
            "fen": data.get("fen"),
            "history_uci": data.get("history_uci"),
            "turn": "WHITE" if " w " in data.get("fen") else "BLACK",
            "is_game_over": True,
            "result": result_str,
            "history": uci_to_san_history(game_logic.history_uci),
            "white_player_type": data.get("white_player_type"),
            "black_player_type": data.get("black_player_type"),
            "mode": data.get("mode")
        }
    }

@app.post("/game/{game_id}/trigger-ai-move", tags=["Game Logic"])
async def trigger_ai_move(game_id: str, user_id: str = Depends(get_current_user_id)):
    doc_ref = db.collection("games").document(game_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(404, "Brak gry")

    data = doc.to_dict()
    if data.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="To nie jest twoja gra")

    if data.get("is_game_over"):
        raise HTTPException(400, "Gra zakończona")

    current_fen = data.get("fen")
    ai_level = data.get("ai_level") or 1

    board = chess.Board(current_fen)
    turn_color = "white" if board.turn == chess.WHITE else "black"

    white_type = data.get("white_player_type")
    black_type = data.get("black_player_type")

    is_ai_turn = (turn_color == "white" and white_type == "ai") or \
                 (turn_color == "black" and black_type == "ai")

    if not is_ai_turn or board.is_game_over():
        return {"success": False, "message": "To nie jest tura AI."}

    current_fen_start = doc.to_dict().get("fen")
    best_move = await get_ai_move(current_fen, ai_level)

    if not best_move:
        return {"success": False, "message": "AI nie znalazło ruchu."}

    latest_doc = doc_ref.get()
    latest_data = latest_doc.to_dict()

    if latest_data.get("fen") != current_fen_start:
        print("KOLIZJA: Stan gry zmienił się w trakcie myślenia AI. Anulowanie zapisu.")
        history_str = latest_data.get("history_uci", "")
        history_list = history_str.split() if history_str else []
        latest_game = ChessGame.from_uci_history(history_list)

        return {
            "success": True,
            "message": "Ruch AI został już wykonany przez inny proces.",
            "current_state": {
                "game_id": game_id,
                "fen": latest_data.get("fen"),
                "turn": "WHITE" if latest_game.board.turn == chess.WHITE else "BLACK",
                "is_game_over": latest_data.get("is_game_over"),
                "result": latest_data.get("result"),
                "history": uci_to_san_history(latest_game.history_uci)
            }
        }

    history_str = data.get("history_uci", "")
    history_list = history_str.split() if history_str else []

    logic_ai = ChessGame.from_uci_history(history_list)
    if best_move in [m.uci() for m in logic_ai.board.legal_moves]:
        logic_ai.make_move(best_move)

        updates = {
            "history_uci": " ".join(logic_ai.history_uci),
            "fen": logic_ai.board.fen(),
            "updated_at": firestore.SERVER_TIMESTAMP,
            "is_game_over": logic_ai.is_game_over(),
            "result": logic_ai.get_game_result()
        }
        doc_ref.update(updates)

        return {
            "success": True,
            "message": "AI wykonało ruch",
            "moved_uci": best_move,
            "current_state": {
                "game_id": game_id,
                "fen": updates["fen"],
                "turn": "WHITE" if logic_ai.board.turn == chess.WHITE else "BLACK",
                "is_game_over": updates["is_game_over"],
                "result": updates["result"],
                "history": uci_to_san_history(logic_ai.history_uci)
            }
        }
    else:
        return {"success": False, "message": "AI próbowało wykonać nielegalny ruch."}


@app.post("/game/{game_id}/delete", response_model=NewGameResponse, tags=["Game Lifecycle"])
async def delete_game(game_id: str):
    doc_ref = db.collection("games").document(game_id).delete()
    print(f"Usunięto grę z bazy danych: {game_id}")
    return {"game_id": game_id, "message": "Gra została usunięta.", "w_type": "none"}
