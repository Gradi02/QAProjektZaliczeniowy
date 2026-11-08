import pytest
import chess
from app.game_service.chess_logic import ChessGame, uci_to_san_history


@pytest.fixture
def new_game():
    return ChessGame()

def test_initial_board_state(new_game):
    assert new_game.board.fen() == chess.STARTING_FEN
    assert len(new_game.history_uci) == 0
    assert new_game.is_game_over() is False

def test_make_valid_move(new_game):
    success = new_game.make_move("e2e4")

    assert success is True
    assert new_game.board.piece_at(chess.E4).symbol() == 'P'
    assert new_game.history_uci == ["e2e4"]
    assert new_game.board.turn == chess.BLACK

def test_make_invalid_move(new_game):
    success = new_game.make_move("g1e5")

    assert success is False
    assert len(new_game.history_uci) == 0
    assert new_game.board.turn == chess.WHITE

def test_scholars_mate(new_game):
    moves = ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"]

    for move in moves:
        new_game.make_move(move)

    assert new_game.is_game_over() is True
    assert new_game.get_game_result() == "1-0"

def test_castling_logic():
    game = ChessGame()
    assert game.get_castling_uci(is_kingside=True) is None
    setup_moves = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6"]
    for m in setup_moves:
        game.make_move(m)

    castle_move = game.get_castling_uci(is_kingside=True)
    assert castle_move == "e1g1"
    game.make_move(castle_move)
    assert game.board.king(chess.WHITE) == chess.G1

def test_uci_to_san_helper():
    moves = ["e2e4", "e7e5", "g1f3"]
    san_history = uci_to_san_history(moves)
    assert san_history == ["e4", "e5", "Nf3"]

def test_game_from_history():
    history = ["e2e4", "e7e5"]
    game = ChessGame.from_uci_history(history)
    assert len(game.history_uci) == 2
    assert game.board.piece_at(chess.E4).symbol() == 'P'
    assert game.board.piece_at(chess.E5).symbol() == 'p'