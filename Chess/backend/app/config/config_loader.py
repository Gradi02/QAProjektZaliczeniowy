import json
import yaml
from pathlib import Path

def load_chess_config():
    config_path = Path(__file__).resolve().parent / "chess_terms_pl.yaml"
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_vosk_grammar(config_data):
    vocabulary = set()

    def add_to_vocab(items):
        if not items:
            return
        for item in items:
            text = str(item).lower()
            words = text.split()
            vocabulary.update(words)

    for section in ['pieces_mapping', 'promotion_pieces_mapping']:
        data = config_data.get(section, {})
        for variants in data.values():
            add_to_vocab(variants)

    coords = config_data.get('coordinates', {})
    for group in coords.values():
        for variants in group.values():
            add_to_vocab(variants)

    intents = config_data.get('intents', {})
    for variants in intents.values():
        add_to_vocab(variants)

    special = config_data.get('special_moves_mapping', {})
    for variants in special.values():
        add_to_vocab(variants)

    simple_lists = ['action_verbs', 'filler_words', 'confirmation']
    for key in simple_lists:
        add_to_vocab(config_data.get(key, []))

    vocabulary.add("[unk]")

    return json.dumps(list(sorted(vocabulary)), ensure_ascii=False)