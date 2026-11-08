import pytest
import sys
from unittest.mock import MagicMock, patch
import chess

def test_chess_config_is_valid_yaml():
    from app.config.config_loader import load_chess_config

    config = load_chess_config()

    assert {
        'pieces_mapping',
        'coordinates',
        'promotion_pieces_mapping',
        'special_moves_mapping',
        'intents',
        'action_verbs',
        'filler_words',
    } <= config.keys()

@pytest.fixture(scope="module")
def mock_config_data():
    return {
        'pieces_mapping': {
            'P': ['pion', 'pionek'],
            'N': ['skoczek', 'koń', 'konik'],
            'B': ['goniec', 'laufer'],
            'R': ['wieża'],
            'Q': ['hetman', 'królowa'],
            'K': ['król']
        },
        'coordinates': {
            'files': {'a': ['a', 'anna'], 'b': ['b', 'be'], 'e': ['e', 'ewa'], 'h': ['h', 'ha']},
            'ranks': {'1': ['jeden', 'raz'], '2': ['dwa'], '4': ['cztery'], '8': ['osiem']}
        },
        'promotion_pieces_mapping': {
            'Q': ['hetman', 'królowa'],
            'N': ['skoczek']
        },
        'special_moves_mapping': {
            'kingside_castle': ['krótka roszada', 'mała roszada'],
            'queenside_castle': ['długa roszada', 'duża roszada']
        },
        'intents': {'capture': ['bij', 'bije', 'zbij']},
        'action_verbs': ['przesuń', 'rusz'],
        'filler_words': ['proszę', 'poproszę', 'na']
    }

@pytest.fixture(scope="module")
def parser_module(mock_config_data):
    with patch('app.config.config_loader.load_chess_config', return_value=mock_config_data):
        import app.game_service.chess_parser as parser
        return parser

@pytest.mark.parametrize("input_text, expected", [
    ("nade", "na de"),
    ("carol", "król"),
    ("pionek na e4", "pionek na e4"),
    ("we", "w e"),
])
def test_preprocess_text(parser_module, input_text, expected):
    assert parser_module.preprocess_text(input_text) == expected

def test_normalize_words(parser_module):
    words = ["pionek", "ewa", "cztery"]
    normalized = parser_module.normalize_words(words)
    assert normalized == ["pionek", "e", "4"]

def test_detect_piece(parser_module):
    assert parser_module.detect_piece(["skoczek", "na", "e4"]) == "N"
    assert parser_module.detect_piece(["wieża", "a1"]) == "R"
    assert parser_module.detect_piece(["nieznane", "słowo"]) == "P"  # Default

def test_parse_kingside_castle(parser_module):
    text = "krótka roszada"
    intents = parser_module.parse_spoken_command_to_intent(text)
    assert len(intents) == 1
    assert intents[0]['is_kingside_castle'] is True
    assert intents[0]['piece'] == 'K'

def test_parse_queenside_castle(parser_module):
    text = "długa roszada"
    intents = parser_module.parse_spoken_command_to_intent(text)
    assert len(intents) == 1
    assert intents[0]['is_queenside_castle'] is True

def test_parse_simple_pawn_move(parser_module):
    text = "e cztery"
    intents = parser_module.parse_spoken_command_to_intent(text)

    assert len(intents) > 0
    cmd = intents[0]
    assert cmd['target_square'] == 'e4'
    assert cmd['piece'] == 'P'
    assert cmd['is_capture'] is False

def test_parse_piece_move(parser_module):
    text = "wieża na a jeden"
    intents = parser_module.parse_spoken_command_to_intent(text)

    assert len(intents) > 0
    cmd = intents[0]
    assert cmd['target_square'] == 'a1'
    assert cmd['piece'] == 'R'

def test_parse_source_and_target(parser_module):
    text = "e dwa na e cztery"
    intents = parser_module.parse_spoken_command_to_intent(text)

    assert len(intents) > 0
    cmd = intents[0]
    assert cmd['source_square'] == 'e2'
    assert cmd['target_square'] == 'e4'

def test_parse_capture_intent(parser_module):
    text = "pionek bije e cztery"
    intents = parser_module.parse_spoken_command_to_intent(text)

    assert len(intents) > 0
    assert intents[0]['is_capture'] is True
    assert intents[0]['target_square'] == 'e4'

def test_parse_promotion(parser_module):
    text = "a osiem hetman"
    intents = parser_module.parse_spoken_command_to_intent(text)

    assert len(intents) > 0
    assert intents[0]['promotion_piece'] == 'Q'
    assert intents[0]['target_square'] == 'a8'

def test_validate_legal_move(parser_module):
    board = chess.Board()
    text = "e cztery"

    intents = parser_module.parse_spoken_command_to_intent(text, board=board)

    assert len(intents) == 1
    assert intents[0]['uci'] == 'e2e4'
    assert intents[0]['piece'] == 'P'


def test_validate_illegal_move(parser_module):
    board = chess.Board()
    text = "wieża a cztery"  # Ra4

    intents = parser_module.parse_spoken_command_to_intent(text, board=board)
    assert len(intents) == 0

def test_validate_ambiguous_move(parser_module):
    board = chess.Board()
    board.clear()
    board.set_piece_at(chess.A1, chess.Piece(chess.ROOK, chess.WHITE))
    board.set_piece_at(chess.H1, chess.Piece(chess.ROOK, chess.WHITE))
    board.turn = chess.WHITE

    text = "wieża e jeden"
    intents = parser_module.parse_spoken_command_to_intent(text, board=board)

    assert len(intents) == 2
    ucis = sorted([i['uci'] for i in intents])
    assert ucis == ['a1e1', 'h1e1']

def test_validate_move_with_specified_source(parser_module):
    board = chess.Board()
    board.clear()
    board.set_piece_at(chess.A1, chess.Piece(chess.ROOK, chess.WHITE))
    board.set_piece_at(chess.H1, chess.Piece(chess.ROOK, chess.WHITE))
    board.turn = chess.WHITE

    text = "a jeden e jeden"  # a1 e1
    intents = parser_module.parse_spoken_command_to_intent(text, board=board)

    assert len(intents) == 1
    assert intents[0]['uci'] == 'a1e1'