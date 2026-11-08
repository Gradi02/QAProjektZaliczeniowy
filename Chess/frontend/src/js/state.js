import * as api from './api.js';

export const appState = {
    currentGameId: null,
    isListening: false,
    board: null,
    gameCounter: 0,
    allGames: new Map(),
    currentGameHistory: [],
    pendingMove: null,
    currentGameMode: 'freeplay',
    playerColor: 'white',
    currentTurn: 'white',
};



function formatDate(isoDate) {
    const d = new Date(isoDate);
    return d.toISOString().split("T")[0];
}

export async function loadSessionGames() {
    const games = await api.getGameHistory();
    appState.allGames.clear();

    games.forEach((game, index) => {
        const date = formatDate(game.created_at);
        const friendlyName = `${date} / gra ${index + 1}`;
        appState.allGames.set(game.id, {
            name: friendlyName,
            mode: game.mode || 'zapis',
            createdAt: game.created_at
        });
    });

    appState.gameCounter = games.length;
}

export function setCurrentGameId(id) {
    appState.currentGameId = id;
}

export function addGameToSession(id, createdAt, index, mode) {
    const date = formatDate(createdAt);
    const friendlyName = `${date} / gra ${index}`;

    appState.allGames.set(id, {
        name: friendlyName,
        mode: mode || 'zapis',
        createdAt: createdAt
    });
}

export function setListening(status) {
    appState.isListening = status;
}

export function setBoard(boardInstance) {
    appState.board = boardInstance;
}

export function setCurrentGameHistory(history) {
    appState.currentGameHistory = history || [];
}