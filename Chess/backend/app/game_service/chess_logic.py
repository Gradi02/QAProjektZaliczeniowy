import chess
import sys



def uci_to_san_history(uci_moves):
    board = chess.Board()
    san_moves = []
    for uci in uci_moves:
        move = chess.Move.from_uci(uci)
        san_moves.append(board.san(move))
        board.push(move)
    return san_moves

class ChessGame:
    def __init__(self):
        self.board = chess.Board()
        self.history_uci: list[str] = []

    @classmethod
    def from_uci_history(cls, uci_moves: list[str]):
        instance = cls()
        for move in uci_moves:
            instance.make_move(move)
        return instance

    def make_move(self, uci_move_str: str) -> bool:
        try:
            move = chess.Move.from_uci(uci_move_str)
            if move in self.board.legal_moves:
                self.board.push(move)
                self.history_uci.append(uci_move_str)
                return True
        except Exception as e:
            print(f"Move Error: {e}", file=sys.stderr)

        return False

    def is_game_over(self) -> bool:
        return self.board.is_game_over()

    def get_game_result(self) -> str:
        if self.board.is_game_over():
            return self.board.result()

        return "In Play"

    def get_castling_uci(self, is_kingside: bool = False, is_queenside: bool = False) -> str | None:
        move = None
        if is_kingside:
            move = "e1g1" if self.board.turn == chess.WHITE else "e8g8"
        elif is_queenside:
            move = "e1c1" if self.board.turn == chess.WHITE else "e8c8"

        if move and chess.Move.from_uci(move) in self.board.legal_moves:
            return move
        return None