import {appState} from "./state.js";
import * as api from "./api.js";
import {loadAndDisplayGame} from "./main.js";

export const elements = {
    listenButton: document.getElementById('listenButton'),
    voiceLevel: document.getElementById('voiceLevel'),
    moveHistory: document.getElementById('moveHistory'),
    analysisScore: document.getElementById('analysisScore'),
    bestMove: document.getElementById('bestMove'),
    pvLine: document.getElementById('pvLine'),
    analysisDepth: document.getElementById('analysisDepth'),
    newGameButton: document.getElementById('newGameButton'),
    activeGamesList: document.getElementById('activeGamesList'),

    recognizedTextDisplay: document.getElementById('recognized-text-display'),
    statusResultContainer: document.getElementById('statusResultContainer'),
    statusHeader: document.getElementById('status-header'),
    statusMain: document.getElementById('status-main'),
    statusDetails: document.getElementById('status-details'),
    playerColorButton: document.getElementById('playerColor'),

    currentGameInfo: document.getElementById('currentGameInfo'),
    currentTurnInfo: document.getElementById('currentTurnInfo'),
    newGameModeSelect: document.getElementById('newGameMode'),
    aiLevelInput: document.getElementById('aiLevelInput'),
    panelAnalysis: document.getElementById('panel-analysis'),
    surrenderBtn: document.getElementById('surrenderBtn'),
    aiSettingsPanel: document.getElementById('aiSettingsPanel'),
    flipBoardBtn: document.getElementById('flipBoardBtn'),
    colorSelectionPanel: document.getElementById('colorSelectionPanel'),
};

export function initializeBoard() {
    return Chessboard('myBoard', {
        responsive: true,
        position: 'start',
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });
}

export let stateSave = "default"

export function updateNewGameForm() {
    const mode = elements.newGameModeSelect.value;

    if (mode === 'ai') {
        elements.aiSettingsPanel.classList.remove('hidden');
        elements.colorSelectionPanel.classList.remove('hidden');
    } else {
        elements.aiSettingsPanel.classList.add('hidden');
        elements.colorSelectionPanel.classList.add('hidden');
    }
}

export function createModeBadge(mode) {
    const badge = document.createElement('span');
    badge.className = 'game-badge';
    const m = (mode || 'freeplay').toLowerCase();

    if (m === 'ai' || m === 'pvc') {
        badge.textContent = 'AI';
        badge.classList.add('badge-ai');
    } else if (m === 'freeplay') {
        badge.textContent = 'Freeplay';
        badge.classList.add('badge-freeplay');
    } else {
        badge.textContent = 'Zapis';
        badge.classList.add('badge-inactive');
    }
    return badge;
}

export function setInputsButtonState(disabled) {
    if (elements.listenButton) {
        elements.listenButton.disabled = disabled;
        if (disabled) {
            elements.listenButton.classList.add('disabled-processing');
            elements.listenButton.style.opacity = '0.5';
            elements.listenButton.style.cursor = 'not-allowed';
        } else {
            elements.listenButton.classList.remove('disabled-processing');
            elements.listenButton.style.opacity = '1';
            elements.listenButton.style.cursor = 'pointer';
        }
    }

    if (elements.surrenderBtn) {
        elements.surrenderBtn.disabled = disabled;
        if (disabled) {
            elements.surrenderBtn.classList.add('disabled-processing');
            elements.surrenderBtn.style.opacity = '0.5';
            elements.surrenderBtn.style.cursor = 'not-allowed';
        } else {
            elements.surrenderBtn.classList.remove('disabled-processing');
            elements.surrenderBtn.style.opacity = '1';
            elements.surrenderBtn.style.cursor = 'pointer';
        }
    }
}

export function updateTurnUIInfo(turn) {
    const headerTurnInfo = elements.currentTurnInfo;

    if(headerTurnInfo) {
        headerTurnInfo.innerHTML = '';

        const textSpan = document.createElement('span');

        if(turn === "WHITE") {
            textSpan.textContent = `Ruch Białego`;
        } else {
            textSpan.textContent = `Ruch Czarnego`;
        }

        headerTurnInfo.appendChild(textSpan);
    }
}

export function updateGameUIForMode(gameState) {
    appState.gameMode = gameState.mode;
    const headerInfo = elements.currentGameInfo;

    if (headerInfo) {
        headerInfo.innerHTML = '';

        const badge = createModeBadge(gameState.mode);
        headerInfo.appendChild(badge);

        const textSpan = document.createElement('span');
        textSpan.style.marginLeft = '10px';

        if (gameState.mode === 'ai') {
            const playerColor = gameState.white_player_type === 'human' ? 'Biały' : 'Czarny';
            textSpan.textContent = `Gra z AI (Ty: ${playerColor})`;
        } else {
            textSpan.textContent = `Analiza dowolna`;
        }

        headerInfo.appendChild(textSpan);
    }

    if (gameState.mode === 'freeplay') {
        if(elements.panelAnalysis) elements.panelAnalysis.classList.remove('hidden');
    } else {
        elements.panelAnalysis.classList.add('hidden');
    }
}

export function getNewGameSettings() {
    return {
        mode: elements.newGameModeSelect.value,
        aiLevel: parseInt(elements.aiLevelInput.value) || 5,
        color: elements.playerColorButton.dataset.color
    };
}

export function updateActiveGamesList() {
    elements.activeGamesList.innerHTML = '';

    if (appState.allGames.size === 0) {
        elements.activeGamesList.innerHTML = '<p class="empty-state">(Rozpocznij nową grę)</p>';
        return;
    }

    // Przejście po wszystkich grach z historii
    appState.allGames.forEach((gameData, id) => {
        const gameItem = document.createElement('div');
        gameItem.className = 'history-item';
        gameItem.dataset.gameId = id;   // Przypisanie elementowi kafelka id jego gry

        let badge = createModeBadge(gameData.mode); // Tworzenie badgetu
        if (id === appState.currentGameId) {
            gameItem.classList.add('active-game');
        }
        // Element nazwy gry wyświetlany obok badgetu
        const nameSpan = document.createElement('span');
        nameSpan.textContent = gameData.name;
        nameSpan.className = 'game-name';
        nameSpan.title = gameData.name;
        // Przycisk usuwania gry z historii
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-game-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Usuń grę';

        // Dalej pełna obsługa akcji przycisku usuwania gry
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if(!confirm("Czy na pewno usunąć tę grę?")) return;

            try {
                await api.deleteGame(id);
                appState.allGames.delete(id);
                if (appState.currentGameId === id) {
                    if (appState.allGames.size > 0) {
                        await loadAndDisplayGame(Array.from(appState.allGames.keys())[0]);
                    } else {
                        window.location.reload();
                    }
                } else {
                    updateActiveGamesList();
                }
            } catch (error) {
                console.error('Nie udało się usunąć gry:', error);
            }
        });

        gameItem.addEventListener('click', async () => {
            await loadAndDisplayGame(id);
        })

        gameItem.appendChild(badge);
        gameItem.appendChild(nameSpan);
        gameItem.appendChild(deleteBtn);
        elements.activeGamesList.appendChild(gameItem);
    });
}

export function updateRecognizedText(text = '---') {
    elements.recognizedTextDisplay.textContent = text;
}

export function updateVoiceStatusPanel(state, data = {}) {
    if (data.recognizedText) {
        elements.recognizedTextDisplay.textContent = data.recognizedText;
    } else if (state === 'listening' || state === 'default') {
        elements.recognizedTextDisplay.textContent = '---';
    }

    stateSave = state;
    let headerHtml = '';
    let mainHtml = '';
    let detailsHtml = '';

    elements.statusHeader.className = 'status-line';

    switch (state) {
        case 'listening':
            headerHtml = 'Status: Nasłuchuję...';
            mainHtml = 'Powiedz swój ruch, np. "koń f3".';
            break;

        case 'recognizing':
            headerHtml = 'Status: Przetwarzam...';
            mainHtml = 'Analizuję Twoje polecenie.';
            break;

        case 'confirmation':
            headerHtml = '🔍 Potwierdź ruch';
            mainHtml = `Czy na pewno chcesz wykonać ruch: <strong>${data.move}</strong>?`;
            detailsHtml = `
                <p class="confirmation-prompt">Powiedz "tak", "potwierdź" lub użyj przycisków.</p>
                <div class="confirmation-buttons">
                    <button id="confirmMoveBtn">✅ Tak, wykonaj</button>
                    <button id="rejectMoveBtn">❌ Nie, spróbuj ponownie</button>
                </div>
            `;
            break;

        case 'success':
            elements.statusHeader.classList.add('status-header-success');
            headerHtml = '✅ Zrozumiano polecenie';
            mainHtml = `<strong>Wykonano ruch:</strong> ${data.move || 'B/D'}`;
            break;

        case 'ambiguous':
            elements.statusHeader.classList.add('status-header-warning');
            headerHtml = '⚠️ Wykryto niejednoznaczny ruch';
            mainHtml = 'Możliwe opcje:';
            const movesList = data.moves && data.moves.length > 0
                ? `<ul>${data.moves.map(move => `<li>${move}</li>`).join('')}</ul>`
                : 'Brak dostępnych opcji.';
            detailsHtml = `<p class="confirmation-prompt">Doprecyzuj, np. "skoczek z g na f3".</p>`;
            mainHtml += movesList;
            break;

        case 'king_attacked':
            elements.statusHeader.classList.add('status-header-error');
            headerHtml = '🚫 Ruch niedozwolony';
            mainHtml = 'Nie można wykonać takiego ruchu, twój król jest atakowany.';
            detailsHtml = '<p class="confirmation-prompt">Musisz obronić króla lub nim uciec.</p>';
            break;

        case 'error':
            elements.statusHeader.classList.add('status-header-error');
            headerHtml = '❌ Błąd';
            mainHtml = data.message || 'Wystąpił nieznany błąd.';
            detailsHtml = '<p class="confirmation-prompt">Spróbuj ponownie.</p>';
            break;

        case 'default':
        default:
            headerHtml = 'Status: Gotowy';
            mainHtml = data.message || 'Wydaj polecenie głosowe, aby rozpocząć.';
            break;
    }

    elements.statusHeader.innerHTML = headerHtml;
    elements.statusMain.innerHTML = mainHtml;
    elements.statusDetails.innerHTML = detailsHtml;
}

export function updateBoardPosition(board, fen) {
    board.position(fen);
}

export function updateMoveHistory(historySan) {
    const container = elements.moveHistory;
    if (!container) return;
    if (!historySan || historySan.length === 0) {
        container.innerHTML = '<p class="empty-state">(Brak ruchów)</p>';
        return;
    }
    container.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'move-history-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const tbody = document.createElement('tbody');

    for (let i = 0; i < historySan.length; i += 2) {
        const moveNum = (i / 2) + 1;
        const whiteMove = historySan[i];
        const blackMove = historySan[i + 1] || '';

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #333';

        const numCell = document.createElement('td');
        numCell.className = 'move-number';
        numCell.textContent = `${moveNum}.`;
        numCell.style.padding = '4px';
        numCell.style.color = '#888';

        const whiteCell = document.createElement('td');
        whiteCell.className = 'move-san';
        whiteCell.textContent = whiteMove;
        whiteCell.style.padding = '4px';

        const blackCell = document.createElement('td');
        blackCell.className = 'move-san';
        blackCell.textContent = blackMove;
        blackCell.style.padding = '4px';

        row.appendChild(numCell);
        row.appendChild(whiteCell);
        row.appendChild(blackCell);
        tbody.appendChild(row);
    }

    table.appendChild(tbody);
    container.appendChild(table);
    container.scrollTop = container.scrollHeight;
}

export function setTemporaryAnalysisInfo() {
    const infoText = "Obliczam...";

    elements.analysisScore.textContent = infoText;
    elements.bestMove.textContent = infoText;
    elements.pvLine.textContent = infoText;
    elements.analysisDepth.textContent = infoText;
}

export function updateAnalysisPanel(analysis) {
    if (!analysis) {
        elements.analysisScore.textContent = '---';
        elements.bestMove.textContent = '---';
        elements.pvLine.textContent = '---';
        elements.analysisDepth.textContent = '---';
        return;
    }
    elements.analysisScore.textContent = analysis.score_human;
    elements.bestMove.textContent = analysis.best_move_san;
    elements.pvLine.textContent = analysis.principal_variation_san;
    elements.analysisDepth.textContent = analysis.analysis_depth;
}

export function setListeningUI(isListening) {
    const textSpan = elements.listenButton.querySelector('span:last-child');
    const iconSpan = elements.listenButton.querySelector('span:first-child');

    if (isListening) {
        elements.listenButton.classList.add('listening');
        if (iconSpan) iconSpan.textContent = '🛑';
        if (textSpan) textSpan.textContent = 'Stop Listening';
    } else {
        elements.listenButton.classList.remove('listening');
        if (iconSpan) iconSpan.textContent = '🎤';
        if (textSpan) textSpan.textContent = 'Start Listening';
    }
}

elements.playerColorButton.addEventListener('click', (e) => {
    const btn = elements.playerColorButton;
    const current = btn.dataset.color;

    if (current === "white") {
        btn.dataset.color = "black";
        btn.style.background = "var(--black)";
        btn.style.color = "var(--white)";
        btn.textContent = "Graj jako Czarny";
    }
    else {
        btn.dataset.color = "white";
        btn.style.background = "var(--white)";
        btn.style.color = "var(--black)";
        btn.textContent = "Graj jako Biały";
    }
});

elements.surrenderBtn.addEventListener('click', async () => {
    if(!confirm("Czy na pewno poddać te partie?")) return;

    const gameState = await api.surrenderGame(appState.currentGameId);

    updateVoiceStatusPanel('default', { message: `Koniec gry! ${gameState.current_state.result}` });
    setInputsButtonState(true);
});

export function clearHighlights() {
    const boardEl = document.getElementById('myBoard');
    if (!boardEl) return;

    const highlights = boardEl.querySelectorAll('.highlight-source, .highlight-target, .highlight-check');
    highlights.forEach(el => {
        el.classList.remove('highlight-source', 'highlight-target', 'highlight-check');
    });
}

export function highlightMoveIntent(uciMove) {
    clearHighlights();
    if (!uciMove || uciMove.length < 4) return;

    const source = uciMove.substring(0, 2);
    const target = uciMove.substring(2, 4);

    const boardEl = document.getElementById('myBoard');
    const sourceSq = boardEl.querySelector(`.square-${source}`);
    const targetSq = boardEl.querySelector(`.square-${target}`);

    if (sourceSq) sourceSq.classList.add('highlight-source');
    if (targetSq) targetSq.classList.add('highlight-target');
}

export function updateCheckHighlighting(fen, currentTurn, history) {
    const boardEl = document.getElementById('myBoard');
    if (boardEl) {
        boardEl.querySelectorAll('.highlight-check').forEach(el => el.classList.remove('highlight-check'));
    }

    if (!history || history.length === 0) return;

    const lastMove = history[history.length - 1];

    if (lastMove.includes('+') || lastMove.includes('#')) {
        console.log(`[UI] Wykryto szach (${lastMove}). Czekam na planszę...`);
        setTimeout(() => {
            highlightKingCheck(fen, currentTurn);
        }, 300);
    }
}

export function highlightKingCheck(fenPosition, turnColor) {
    clearHighlights();

    const normalizedColor = (turnColor || '').toLowerCase();
    const charToFind = (normalizedColor === 'white' || normalizedColor === 'w') ? 'K' : 'k';

    console.log(`[Highlight] Szukam króla: '${charToFind}' dla tury: '${normalizedColor}'`);

    const kingSquare = findSquareFromFen(fenPosition, charToFind);

    if (kingSquare) {
        console.log(`[Highlight] Król znaleziony na polu: ${kingSquare}`);
        const boardEl = document.getElementById('myBoard');
        const kingSqEl = boardEl.querySelector(`.square-${kingSquare}`);

        if (kingSqEl) {
            kingSqEl.classList.add('highlight-check');
        } else {
            console.warn(`[Highlight] Nie znaleziono elementu DOM dla pola ${kingSquare}`);
        }
    } else {
        console.warn(`[Highlight] Nie znaleziono króla '${charToFind}' w FEN: ${fenPosition}`);
    }
}

function findSquareFromFen(fen, pieceChar) {
    const rows = fen.split('/');
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (let r = 0; r < 8; r++) {
        let colIndex = 0;
        const rowString = rows[r];

        for (let i = 0; i < rowString.length; i++) {
            const char = rowString[i];

            if (!isNaN(char)) {
                colIndex += parseInt(char);
            } else {
                if (char === pieceChar) {
                    const rank = 8 - r;
                    const file = files[colIndex];
                    return file + rank;
                }
                colIndex++;
            }
        }
    }
    return null;
}