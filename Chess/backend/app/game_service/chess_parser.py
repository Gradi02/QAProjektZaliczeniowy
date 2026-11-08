from app.config.config_loader import load_chess_config
import chess

cfg = load_chess_config()

PIECES_INV = {name: symbol for symbol, names in cfg['pieces_mapping'].items() for name in names}
FILES_INV = {name: symbol for symbol, names in cfg['coordinates']['files'].items() for name in names}
RANKS_INV = {name: symbol for symbol, names in cfg['coordinates']['ranks'].items() for name in names}
WORD_TO_PROMO = {word: symbol for symbol, words in cfg['promotion_pieces_mapping'].items() for word in words}

KINGSIDE_CASTLE_TERMS = set(cfg['special_moves_mapping']['kingside_castle'])
QUEENSIDE_CASTLE_TERMS = set(cfg['special_moves_mapping']['queenside_castle'])

CAPTURE_TERMS = set(cfg['intents']['capture'])
ACTION_VERBS = set(cfg['action_verbs'])
FILLER_WORDS = set(cfg['filler_words'])

all_piece_names = sorted(PIECES_INV.keys(), key=len, reverse=True)



def preprocess_text(text: str) -> str:
    replacements = {
        "nade": "na de",
        "nage": "na ge",
        "nagie": "na ge",
        "nagi": "na ge",
        "wef": "w ef",
        "wgie": "w gie",
        "we": "w e",
        "nasza": "na ha",
        "chce": "ce",
        "swe": "ce",
        "gdy": "ge",
        "carol": "król",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    return text

def normalize_words(words: list[str]) -> list[str]:
    normalized = []
    for w in words:
        if w in FILES_INV:
            normalized.append(FILES_INV[w])
            continue

        if w in RANKS_INV:
            normalized.append(RANKS_INV[w])
            continue

        normalized.append(w)

    return normalized


def _find_square_in_words(words: list[str]) -> list[str]:
    squares = []
    i = 0
    n = len(words)

    while i < n - 1:
        w1 = words[i]
        w2 = words[i + 1]

        if w1 in FILES_INV.values() and w2 in RANKS_INV.values():
            squares.append(w1 + w2)
            i += 2
            continue

        if w1 in RANKS_INV.values() and w2 in FILES_INV.values():
            squares.append(w2 + w1)
            i += 2
            continue

        i += 1

    return squares

def detect_piece(words: list[str]) -> str:
    for w in words:
        if w in PIECES_INV:
            return PIECES_INV[w]
    return "P"

def parse_spoken_command_to_intent(text: str, board=None) -> list[dict]:
    text_clean = preprocess_text(text.lower().strip())
    words_raw = text_clean.split()
    words_filtered = [w for w in words_raw if w not in ACTION_VERBS and w not in FILLER_WORDS]
    words = normalize_words(words_filtered)
    print({"word": words_raw, "normalized": words})
    intents = []

    if any(term in text_clean for term in KINGSIDE_CASTLE_TERMS):
        intents.append({
            'piece': 'K',
            'is_kingside_castle': True,
            'is_queenside_castle': False,
            'is_capture': False,
            'target_square': None,
            'promotion_piece': None
        })

    if any(term in text_clean for term in QUEENSIDE_CASTLE_TERMS):
        intents.append({
            'piece': 'K',
            'is_kingside_castle': False,
            'is_queenside_castle': True,
            'is_capture': False,
            'target_square': None,
            'promotion_piece': None
        })

    if intents:
        return intents

    piece = detect_piece(words)
    is_capture = any(w in CAPTURE_TERMS for w in words_raw)
    detected_squares = _find_square_in_words(words)

    print([{
        "words_raw": words_raw,
        "words": words,
        "words_filtered": words_filtered,
        'is_capture': is_capture,
        "candidate_squares": detected_squares,
    }])

    if not detected_squares:
        return []

    target_squares = []
    source_square = None

    if len(detected_squares) >= 2:
        source_square = detected_squares[0]
        target_squares = [detected_squares[1]]

        if board:
            try:
                sq_idx = chess.parse_square(source_square)
                p = board.piece_at(sq_idx)
                if p:
                    piece = p.symbol().upper()
            except:
                pass
    else:
        target_squares = detected_squares

    promotion_piece = None
    if piece != 'P':
        sq = target_squares[0]
        rank = sq[-1]

        if rank in ['1', '8']:
            piece_word_index = -1
            for i, w in enumerate(words_filtered):
                if w in PIECES_INV and PIECES_INV[w] == piece:
                    piece_word_index = i
                    break

            square_indices = []
            for i, w in enumerate(words_filtered):
                is_part_of_square = False

                if w in FILES_INV and FILES_INV[w] in sq:
                    is_part_of_square = True
                elif w in RANKS_INV and RANKS_INV[w] in sq:
                    is_part_of_square = True
                elif w in sq:
                    is_part_of_square = True

                if is_part_of_square:
                    square_indices.append(i)

            if piece_word_index > -1 and square_indices:
                max_sq_idx = max(square_indices)

                if piece_word_index > max_sq_idx:
                    promotion_piece = piece
                    piece = 'P'

        if piece == 'P' and promotion_piece is None and words_filtered:
            last_word = words_filtered[-1]
            if last_word in WORD_TO_PROMO:
                potential_promo = WORD_TO_PROMO[last_word]
                if potential_promo != 'P':
                    promotion_piece = potential_promo



    candidates = []
    for sq in target_squares:
        candidates.append({
            'piece': piece,
            'target_square': sq,
            'source_square': source_square,
            'is_capture': is_capture,
            'promotion_piece': promotion_piece,
            'is_kingside_castle': False,
            'is_queenside_castle': False
        })

    print([{
        "candidates": candidates,
    }])

    if board:
        legal_intents = []
        print(f"DEBUG: Znaleziono pól: {detected_squares}")
        if candidates:
            print(f"DEBUG: Kandydat do sprawdzenia: Source={candidates[0].get('source_square')} -> Target={candidates[0].get('target_square')}")

        for intent in candidates:
            for move in board.legal_moves:
                uci = move.uci()
                if uci[2:4] != intent['target_square']:
                    continue

                if intent.get('source_square') and uci[0:2] != intent['source_square']:
                    continue

                board_piece = board.piece_at(move.from_square)
                if not board_piece:
                    continue

                board_piece_symbol = board_piece.symbol().upper()

                if intent['piece'] == 'P' and board_piece_symbol != 'P':
                    continue

                if intent['piece'] != 'P' and board_piece_symbol != intent['piece']:
                    continue

                is_promo_move = (len(uci) == 5)
                intent_promo = intent.get('promotion_piece')

                if intent_promo:
                    if not is_promo_move:
                        continue
                    if uci[-1].lower() != intent_promo.lower():
                        continue

                elif is_promo_move:
                    if uci[-1].lower() != 'q':
                        continue

                new_intent = intent.copy()
                new_intent['source_square'] = uci[0:2]
                new_intent['uci'] = uci

                legal_intents.append(new_intent)

        print(f"DEBUG: Wynik walidacji: {len(legal_intents)} pasujących ruchów.")
        return legal_intents
    return candidates
