import os
import sys
import json
import wave
import io
import vosk
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.config.config_loader import load_chess_config, get_vosk_grammar

MODEL_PATH = os.getenv('VOSK_MODEL_PATH', '/vosk-model')
SAMPLE_RATE = 16000

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

if not os.path.exists(MODEL_PATH):
    print(f"Error: vosk model not found: '{MODEL_PATH}'")
    sys.exit(1)
model = vosk.Model(MODEL_PATH)

cfg = load_chess_config()
words = get_vosk_grammar(cfg)


@app.post("/recognize")     #Deklaracja Endpointu API
async def process_audio(audio_file: UploadFile = File(...)):      #Nagranie przekazane jako argument
    try:    #Blok Try/Except w calu obsługi wyjątków
        audio_content = await audio_file.read()     #Odczyt pliku audio

        #Przygotowanie danych dla modelu Vosk
        with io.BytesIO(audio_content) as bio:
            with wave.open(bio, 'rb') as wf:
                if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getcomptype() != "NONE":
                    raise HTTPException(status_code=400, detail="Bad audio format. Required: 16-bit PCM mono.")
                data = wf.readframes(wf.getnframes())

        #Inicjalizacja modelu oraz przekazanie danych wejściowych
        recognizer = vosk.KaldiRecognizer(model, SAMPLE_RATE, words)
        recognizer.AcceptWaveform(data)

        #Przechwycenie danych wyjściowych modelu
        result_dict = json.loads(recognizer.FinalResult())
        recognized_text = result_dict.get('text', '').strip()
        print(f"Recognized: '{recognized_text}'")   #Debug Log dla developmentu
        return {"text": recognized_text}    #Zwrot rozpoznanego polecenia w formie stringa

    except HTTPException:
        raise

    except Exception as e:
        print(f"Error during audio processing: {e}", file=sys.stderr)
        raise HTTPException(status_code=500, detail=str(e))

