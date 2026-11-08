import sys
import io
import wave
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

patcher_os = patch('os.path.exists', return_value=True)
patcher_os.start()

mock_vosk = MagicMock()
sys.modules['vosk'] = mock_vosk

mock_config_loader = MagicMock()
sys.modules['app.config.config_loader'] = mock_config_loader
mock_config_loader.load_chess_config.return_value = {}
mock_config_loader.get_vosk_grammar.return_value = "[]"

from app.speech_service.main import app
patcher_os.stop()
client = TestClient(app)


def create_dummy_wav(channels=1, sampwidth=2, framerate=16000, duration_sec=0.1):
    bio = io.BytesIO()
    with wave.open(bio, 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sampwidth)
        wf.setframerate(framerate)
        num_frames = int(framerate * duration_sec)
        data = b'\x00' * (num_frames * channels * sampwidth)
        wf.writeframes(data)

    bio.seek(0)
    return bio

def test_recognize_success():
    mock_recognizer_instance = MagicMock()
    mock_recognizer_instance.FinalResult.return_value = '{"text": "e2 e4"}'

    with patch('vosk.KaldiRecognizer', return_value=mock_recognizer_instance):
        wav_file = create_dummy_wav(channels=1, sampwidth=2)

        response = client.post(
            "/recognize",
            files={"audio_file": ("test.wav", wav_file, "audio/wav")}
        )

    assert response.status_code == 200
    assert response.json() == {"text": "e2 e4"}

def test_recognize_invalid_channels():
    wav_file = create_dummy_wav(channels=2, sampwidth=2)

    response = client.post(
        "/recognize",
        files={"audio_file": ("stereo.wav", wav_file, "audio/wav")}
    )

    assert response.status_code == 400
    assert "Bad audio format" in response.json()["detail"]

def test_recognize_invalid_width():
    wav_file = create_dummy_wav(channels=1, sampwidth=1)

    response = client.post(
        "/recognize",
        files={"audio_file": ("8bit.wav", wav_file, "audio/wav")}
    )

    assert response.status_code == 400
    assert "Bad audio format" in response.json()["detail"]

def test_recognize_corrupt_file():
    corrupt_file = io.BytesIO(b"To nie jest plik wav")

    response = client.post(
        "/recognize",
        files={"audio_file": ("corrupt.wav", corrupt_file, "audio/wav")}
    )

    assert response.status_code == 500
    assert "Error during audio processing" not in response.text
    assert response.json()["detail"]

def test_recognize_vosk_error():
    mock_recognizer_instance = MagicMock()
    mock_recognizer_instance.AcceptWaveform.side_effect = Exception("Vosk crash")

    with patch('vosk.KaldiRecognizer', return_value=mock_recognizer_instance):
        wav_file = create_dummy_wav()

        response = client.post(
            "/recognize",
            files={"audio_file": ("test.wav", wav_file, "audio/wav")}
        )

    assert response.status_code == 500
    assert "Vosk crash" in response.json()["detail"]