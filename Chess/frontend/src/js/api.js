import { GAME_SERVICE_URL, ANALYSIS_SERVICE_URL, SPEECH_SERVICE_URL } from './config.js';

//Game Service

export async function createNewGame(settings) {
    return await window.apiCall(`${GAME_SERVICE_URL}/newgame`, 'POST', settings);
}

export async function deleteGame(gameId) {
    return await window.apiCall(`${GAME_SERVICE_URL}/game/${gameId}/delete`, 'POST');
}

export async function analyzeCommand(gameId, commandText) {
    return await window.apiCall(`${GAME_SERVICE_URL}/game/${gameId}/analyze-command`, 'POST', {
        command_text: commandText
    });
}

export async function executeMove(gameId, moveUci) {
    return await window.apiCall(`${GAME_SERVICE_URL}/game/${gameId}/execute-move`, 'POST', {
        move_uci: moveUci
    });
}

export async function getGameState(gameId) {
    return await window.apiCall(`${GAME_SERVICE_URL}/game/${gameId}`);
}

export async function getGameHistory() {
    return await window.apiCall(`${GAME_SERVICE_URL}/game/history`);
}

export async function triggerAiMove(gameId) {
    return await window.apiCall(`${GAME_SERVICE_URL}/game/${gameId}/trigger-ai-move`, 'POST');
}

export async function surrenderGame(gameId){
    return await window.apiCall(`${GAME_SERVICE_URL}/game/${gameId}/surrender`, 'POST');
}


//Analysis Service

export async function getAnalysis(fen) {
    const response = await fetch(`${ANALYSIS_SERVICE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen: fen, think_time: 1.5 })
    });
    if (!response.ok) throw new Error('Failed to get analysis.');
    return response.json();
}

//Speech Service

export async function recognizeSpeech(wavBlob) {
    //ui.setInputsButtonState(true);

    const formData = new FormData();
    formData.append('audio_file', wavBlob, 'recording.wav');

    const response = await fetch(`${SPEECH_SERVICE_URL}/recognize`, {
        method: 'POST',
        body: formData
    });
    if (!response.ok) throw new Error('Speech recognition failed.');

    // setTimeout(() => {
    //   ui.setInputsButtonState(false);
    // }, 1000);
    return response.json();
}