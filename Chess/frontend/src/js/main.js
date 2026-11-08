import './auth.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as audio from './audio.js';
import {
    appState,
    setCurrentGameId,
    addGameToSession,
    setListening,
    setBoard,
    setCurrentGameHistory,
    loadSessionGames
} from './state.js';

function handleFlipBoard() {
    if (appState.board) {
        appState.board.flip();
    }
}

export async function startNewGame() {
    if (appState.currentGameId && appState.currentGameHistory.length === 0) {
        alert('Aktualna gra nie ma żadnych ruchów. Wykonaj pierwszy ruch, zanim stworzysz nową grę.');
        return;
    }

    try {
        const settings = ui.getNewGameSettings();
        if (settings.mode === 'freeplay') {
            settings.color = 'white';
        }

        const newGamePayload = {
            mode: settings.mode,
            player_color: settings.color,
            ai_level: settings.aiLevel
        };

        const newGameData = await api.createNewGame(newGamePayload);

        appState.gameCounter++;
        addGameToSession(newGameData.game_id, new Date().toISOString(), appState.gameCounter, settings.mode);

        await loadAndDisplayGame(newGameData.game_id);

        if(newGameData.w_type === "ai") {
            await handleAiTurn(appState.currentGameId);
        }

    } catch (error) {
        console.error('Błąd podczas tworzenia nowej gry:', error);
        ui.updateRecognizedText();
        ui.updateVoiceStatusPanel('error', { message: `Błąd tworzenia gry: ${error.message}` });
    }
}

export async function loadAndDisplayGame(gameId) {
    try {
        const gameState = await api.getGameState(gameId);

        if(appState.currentGameId && appState.currentGameHistory) {
            await deleteIfEmptyGame(appState.currentGameId, appState.currentGameHistory);
        }

        setCurrentGameId(gameState.game_id);
        setCurrentGameHistory(gameState.history);
        appState.currentTurn = gameState.turn;

        let orientation = 'white';
        if (gameState.mode === 'ai') {
             if (gameState.black_player_type === 'human') {
                 orientation = 'black';
             }
             if (appState.board) appState.board.orientation(orientation);
        }
        else
        {
            if (appState.board) {
                 appState.board.orientation('white');
            }
        }

        if (appState.isListening) {
            audio.stopListening();
            setListening(false);
            ui.setListeningUI(false);
        }

        ui.updateBoardPosition(appState.board, gameState.fen);
        ui.updateCheckHighlighting(gameState.fen, gameState.turn, gameState.history);
        ui.clearHighlights();

        const isAiTurn = !gameState.is_game_over && (
            (gameState.turn === 'white' && gameState.white_player_type === 'ai') ||
            (gameState.turn === 'black' && gameState.black_player_type === 'ai')
        );

        if (isAiTurn) {
            console.log("Wczytano grę w trakcie tury AI. Ponawiam żądanie ruchu...");
            await handleAiTurn(gameState.game_id);
        }

        ui.updateMoveHistory(gameState.history);
        ui.updateGameUIForMode(gameState);
        ui.updateTurnUIInfo(gameState.turn);

        if (gameState.mode === 'freeplay' && !gameState.is_game_over) {
            triggerAnalysis(gameState.fen);
        } else {
            ui.updateAnalysisPanel(null);
        }

        ui.updateActiveGamesList();
        appState.pendingMove = null;

        ui.setInputsButtonState(gameState.is_game_over);
        if(gameState.is_game_over) {
            ui.updateVoiceStatusPanel('default', { message: `Koniec gry! ${gameState.result}` });
        } else {
            ui.updateVoiceStatusPanel('default', {message: `Wczytano grę.`});
        }
    } catch (error) {
        console.error('Błąd podczas wczytywania gry:', error);
        alert(`Nie udało się wczytać gry. ${error.message}`);
        ui.updateRecognizedText();
        ui.updateVoiceStatusPanel('error', { message: 'Błąd wczytywania gry.' });
    }
}

async function deleteIfEmptyGame(gameId, history) {
    if (!history || history.length === 0) {
        await api.deleteGame(gameId);
        appState.allGames.delete(gameId);
        ui.updateActiveGamesList();
    }
}

async function handleAiTurn(gameId) {
    ui.updateVoiceStatusPanel('default', { message: 'AI myśli...' });
    ui.setInputsButtonState(true);

    const gameIdInProgress = gameId;

    try {
        const aiResult = await api.triggerAiMove(gameId);

        if (appState.currentGameId !== gameIdInProgress) {
            console.log(`Odebrano ruch AI dla gry ${gameIdInProgress}, ale aktywna jest ${appState.currentGameId}. Ignorowanie.`);
            return;
        }

        if (aiResult.success) {
            const aiState = aiResult.current_state;
            setCurrentGameHistory(aiState.history);
            appState.currentTurn = aiState.turn;
            ui.updateCheckHighlighting(aiState.fen, aiState.turn, aiState.history);
            ui.updateBoardPosition(appState.board, aiState.fen);
            ui.updateMoveHistory(aiState.history);

            const lastMoveSan = aiState.history[aiState.history.length - 1];
            ui.updateVoiceStatusPanel('default', { message: `AI zagrało: ${lastMoveSan}` });
            ui.updateTurnUIInfo(aiState.turn);

            if (aiState.is_game_over) {
                ui.setInputsButtonState(true);
                ui.updateVoiceStatusPanel('default', { message: `Koniec gry! ${aiState.result}` });
            } else {
                ui.setInputsButtonState(false);
                triggerAnalysis(aiState.fen);
            }
        } else {
             console.error("AI error:", aiResult.message);
             ui.updateVoiceStatusPanel('error', { message: "Błąd AI." });
             ui.setInputsButtonState(false);
        }
    } catch (error) {
        if (appState.currentGameId === gameIdInProgress) {
            ui.updateVoiceStatusPanel('error', { message: "Błąd połączenia z AI." });
            ui.setInputsButtonState(false);
        }
    }
}

export async function handleRecognizedSpeech(wavBlob) {
    if (appState.pendingMove) {
        try {
            const recognitionResult = await api.recognizeSpeech(wavBlob);
            const recognizedText = recognitionResult.text || '';
            ui.updateVoiceStatusPanel(null, { recognizedText });

            const intent = getConfirmationIntent(recognizedText);

            if (intent === 'confirm') {
                console.log("Potwierdzenie głosowe otrzymane.");
                handleConfirmMove();
            } else if (intent === 'reject') {
                console.log("Odrzucenie głosowe otrzymane.");
                handleRejectMove();
            } else {
                ui.updateVoiceStatusPanel('confirmation', {
                    move: appState.pendingMove.san,
                    message: `Nie zrozumiałem. Powiedz "tak" lub "nie".`
                });
                const header = document.getElementById('status-header');
                header.innerHTML = `⚠️ Nieznane polecenie`;
            }
        } catch (error) {
            console.error('Błąd podczas rozpoznawania mowy potwierdzającej:', error);
            ui.updateVoiceStatusPanel('error', { message: 'Błąd rozpoznawania potwierdzenia.' });
        }

        return;
    }

    if (!appState.currentGameId) {
        ui.updateVoiceStatusPanel('error', { message: "Najpierw rozpocznij lub wczytaj grę!" });
        return;
    }

    try {
        ui.updateVoiceStatusPanel('recognizing');
        const recognitionResult = await api.recognizeSpeech(wavBlob);
        const recognizedText = recognitionResult.text || '[nie rozpoznano]';

        ui.updateVoiceStatusPanel(null, { recognizedText });

        if (!recognitionResult.text) {
            ui.updateVoiceStatusPanel('error', { message: 'Nie udało się rozpoznać mowy.' });
            return;
        }

        const analysisResult = await api.analyzeCommand(appState.currentGameId, recognitionResult.text);

        if (analysisResult.success) {
            appState.pendingMove = {
                uci: analysisResult.proposed_move_uci,
                san: analysisResult.proposed_move_san,
            };
            ui.highlightMoveIntent(analysisResult.proposed_move_uci);
            ui.updateVoiceStatusPanel('confirmation', {
                move: appState.pendingMove.san
            });
        } else {
            if (analysisResult.ifcheck === true) {
                const currentFen = appState.board.fen();
                ui.highlightKingCheck(currentFen, appState.currentTurn);
                ui.updateVoiceStatusPanel('king_attacked', { moves: analysisResult.possible_moves_san });
            } else if (analysisResult.possible_moves_san && analysisResult.possible_moves_san.length > 0) {
                ui.clearHighlights();
                ui.updateVoiceStatusPanel('ambiguous', { moves: analysisResult.possible_moves_san });
            } else {
                ui.clearHighlights();
                ui.updateVoiceStatusPanel('error', { message: analysisResult.message || "Nieznany błąd analizy." });
            }
        }
    } catch (error) {
        ui.clearHighlights();
        console.error('Error during speech recognition or move analysis:', error);
        ui.updateVoiceStatusPanel('error', { message: `Błąd: ${error.message}` });
    }
}

async function triggerAnalysis(fen) {
    ui.setTemporaryAnalysisInfo();
    try {
        let requestGameId = appState.currentGameId;
        const analysisData = await api.getAnalysis(fen);

        if(appState.currentGameId === requestGameId)
            ui.updateAnalysisPanel(analysisData);
    } catch (error) {
        console.error('Analysis error:', error);
        ui.updateAnalysisPanel(null);
    }
}

function toggleListening() {
    if (appState.isListening) {
        audio.stopListening();
        setListening(false);
    } else {
        try {
            audio.startListening(handleRecognizedSpeech);
            setListening(true);
            if(ui.stateSave === "default" || ui.stateSave === "error") {
                ui.updateRecognizedText();
                ui.updateVoiceStatusPanel('listening');
            }
        } catch (err) {
            console.error('Failed to start listening:', err);
            ui.updateVoiceStatusPanel('error', { message: 'Błąd mikrofonu. Sprawdź uprawnienia.' });
            setListening(false);
        }
    }
    ui.setListeningUI(appState.isListening);
}

function handleConfirmationClick(event) {
    if (event.target.id === 'confirmMoveBtn') {
        handleConfirmMove();
    } else if (event.target.id === 'rejectMoveBtn') {
        handleRejectMove();
    }
}

export async function handleConfirmMove() {
    if (!appState.pendingMove || !appState.currentGameId) return;

    const gameIdAtStart = appState.currentGameId;
    const moveUciToExecute = appState.pendingMove.uci;
    const moveSanToDisplay = appState.pendingMove.san;
    appState.pendingMove = null;
    let is_game_over = null;

    const wasListening = appState.isListening;
    if (wasListening) {
        toggleListening();
    }
    ui.setInputsButtonState(true);

    try {
        ui.updateVoiceStatusPanel('recognizing', { message: 'Wykonywanie ruchu...' });
        const executionResult = await api.executeMove(appState.currentGameId, moveUciToExecute);

        if (appState.currentGameId !== gameIdAtStart) {
            console.log("Ignorowanie odpowiedzi ruchu gracza - zmieniono grę.");
            return;
        }

        if (executionResult.success) {
            ui.clearHighlights();
            const gameState = executionResult.current_state;
            is_game_over = gameState.is_game_over;

            setCurrentGameHistory(gameState.history);
            ui.updateBoardPosition(appState.board, gameState.fen);
            appState.currentTurn = gameState.turn;
            ui.updateMoveHistory(gameState.history);
            ui.updateGameUIForMode(gameState);
            ui.updateTurnUIInfo(gameState.turn);
            ui.updateCheckHighlighting(gameState.fen, gameState.turn, gameState.history);

            if (gameState.is_game_over) {
                ui.updateVoiceStatusPanel('default', { message: `Koniec gry! ${gameState.result}` });
                ui.setInputsButtonState(true);
                return;
            }

            ui.updateVoiceStatusPanel('success', { move: moveSanToDisplay });

            const isAiGame = gameState.mode === 'ai';
            const currentTurn = gameState.turn.toLowerCase();
            const aiPlaysWhite = gameState.white_player_type === 'ai';
            const aiPlaysBlack = gameState.black_player_type === 'ai';
            const isAiTurn = (currentTurn === 'white' && aiPlaysWhite) || (currentTurn === 'black' && aiPlaysBlack);

            if (isAiGame && isAiTurn) {
                await handleAiTurn(appState.currentGameId);
            } else {
                triggerAnalysis(gameState.fen);
            }

        } else {
            ui.updateVoiceStatusPanel('error', { message: "Nie udało się wykonać ruchu." });
        }
    } catch (error) {
        console.error('Error during move execution:', error);
        ui.updateVoiceStatusPanel('error', { message: `Błąd: ${error.message}` });
    } finally {
        ui.setInputsButtonState(false);
        const isStillSameGame = appState.currentGameId === gameIdAtStart;

        if (wasListening && isStillSameGame && !is_game_over) {
             setTimeout(() => {
                 if (!appState.isListening) {
                     toggleListening();
                 }
             }, 300);
        }
    }
}

function handleRejectMove() {
    appState.pendingMove = null;
    ui.clearHighlights();

    if (appState.board && appState.currentGameHistory) {
        ui.updateCheckHighlighting(
            appState.board.fen(),
            appState.currentTurn,
            appState.currentGameHistory
        );
    }

    ui.updateVoiceStatusPanel('default', { message: 'Anulowano. Spróbuj ponownie.' });
}

function getConfirmationIntent(text) {
    const command = text.toLowerCase().trim();

    const confirmKeywords = ['tak', 'potwierdź', 'potwierdzam', 'zgadza się', 'wykonaj', 'ok', 'dobrze'];
    const rejectKeywords = ['nie', 'anuluj', 'odrzuć', 'stop', 'źle', 'ponownie'];

    if (confirmKeywords.some(keyword => command.includes(keyword))) {
        return 'confirm';
    }
    if (rejectKeywords.some(keyword => command.includes(keyword))) {
        return 'reject';
    }

    return null;
}




async function onUserLoggedIn() {
    console.log("Main: Wykryto logowanie -> pobieram gry...");
    ui.updateVoiceStatusPanel('default', { message: "Wczytywanie gier..." });

    try {
        await loadSessionGames();

        if (appState.allGames.size > 0) {
            const firstGameId = Array.from(appState.allGames.keys())[0];
            await loadAndDisplayGame(firstGameId);
        } else {
             ui.updateVoiceStatusPanel('default', { message: "Witaj! Kliknij 'Nowa Gra', aby rozpocząć." });
        }

        ui.updateActiveGamesList();

    } catch (e) {
        console.error("Błąd pobierania danych po zalogowaniu:", e);
        ui.updateVoiceStatusPanel('error', { message: "Nie udało się pobrać listy gier." });
    }
}

function onUserLoggedOut() {
    console.log("Main: Wykryto wylogowanie -> czyszczę UI");
    appState.currentGameId = null;
    appState.allGames.clear();
    appState.board.clear();
    ui.updateMoveHistory([]);
    ui.updateActiveGamesList();
    ui.updateVoiceStatusPanel('default', { message: "Zaloguj się, aby zagrać." });
}

async function init() {
    setBoard(ui.initializeBoard());
    window.addEventListener('resize', function() {
        appState.board.resize();
    });

    ui.elements.newGameButton.onclick = startNewGame;
    ui.elements.listenButton.onclick = toggleListening;

    if (ui.elements.flipBoardBtn) {
        ui.elements.flipBoardBtn.onclick = handleFlipBoard;
    }

    if (ui.elements.newGameModeSelect) {
        ui.elements.newGameModeSelect.addEventListener('change', () => {
            ui.updateNewGameForm();
        });
        ui.updateNewGameForm();
    }

    ui.elements.statusResultContainer.addEventListener('click', handleConfirmationClick);
    window.addEventListener('user-logged-in', onUserLoggedIn);
    window.addEventListener('user-logged-out', onUserLoggedOut);

    ui.updateVoiceStatusPanel('default', { message: "Zaloguj się, aby rozpocząć." });
}

init();