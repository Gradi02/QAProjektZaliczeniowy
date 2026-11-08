jest.mock('../js/auth.js', () => ({
    checkLoginStatus: jest.fn(),
    currentUser: null,
}));
jest.mock('../js/api.js');
jest.mock('../js/audio.js');
jest.mock('../js/state.js', () => {
    const localMockState = {
        currentGameId: null,
        currentGameHistory: [],
        gameCounter: 0,
        board: { flip: jest.fn(), orientation: jest.fn() },
        pendingMove: null,
        isListening: false,
        allGames: new Map(),
        currentGameMode: 'freeplay',
        playerColor: 'white',
        currentTurn: 'white'
    };

    return {
        appState: localMockState,
        setCurrentGameId: jest.fn((id) => { localMockState.currentGameId = id; }),
        setCurrentGameHistory: jest.fn(),
        addGameToSession: jest.fn(),
        setListening: jest.fn(),
        setBoard: jest.fn(),
        loadSessionGames: jest.fn(),
        setGameDetails: jest.fn()
    };
});
jest.mock('../js/ui.js', () => ({
    elements: {
        listenButton: {
            addEventListener: jest.fn(),
            classList: { add: jest.fn(), remove: jest.fn() },
            querySelector: jest.fn(),
            style: {}
        },
        voiceLevel: {},
        moveHistory: { scrollTop: 0, scrollHeight: 0 },
        analysisScore: {},
        statusResultContainer: { addEventListener: jest.fn() },
        newGameButton: { addEventListener: jest.fn() },
        activeGamesList: {},
        recognizedTextDisplay: {},
        statusHeader: { classList: { add: jest.fn(), remove: jest.fn() }, innerHTML: '' },
        statusMain: { innerHTML: '' },
        statusDetails: { innerHTML: '' },
        playerColorButton: {
            addEventListener: jest.fn(),
            dataset: { color: 'white' },
            style: {},
            textContent: ''
        },
        surrenderBtn: {
            addEventListener: jest.fn(),
            classList: { add: jest.fn(), remove: jest.fn() },
            style: {},
            disabled: false
        },
        newGameModeSelect: {
            value: 'standard',
            addEventListener: jest.fn()
        },
        aiLevelInput: { value: '1' },
        panelAnalysis: { classList: { add: jest.fn(), remove: jest.fn() } },
        currentGameInfo: { innerHTML: '', appendChild: jest.fn() },
        currentTurnInfo: { innerHTML: '', appendChild: jest.fn() },
        flipBoardBtn: { addEventListener: jest.fn() },
        aiSettingsPanel: { classList: { add: jest.fn(), remove: jest.fn() } },
        colorSelectionPanel: { classList: { add: jest.fn(), remove: jest.fn() } }
    },
    initializeBoard: jest.fn(() => ({
        position: jest.fn(),
        orientation: jest.fn(),
        flip: jest.fn(),
        start: jest.fn()
    })),
    updateMoveHistory: jest.fn(),
    updateAnalysisPanel: jest.fn(),
    updateRecognizedText: jest.fn(),
    createModeBadge: jest.fn(),
    getNewGameSettings: jest.fn(),
    updateVoiceStatusPanel: jest.fn(),
    updateBoardPosition: jest.fn(),
    updateTurnUIInfo: jest.fn(),
    showAudioVisualizer: jest.fn(),
    hideAudioVisualizer: jest.fn(),
    updateActiveGamesList: jest.fn(),
    updateGameUIForMode: jest.fn(),
    setInputsButtonState: jest.fn(),
    updateNewGameForm: jest.fn(),
    setTemporaryAnalysisInfo: jest.fn(),
    clearHighlights: jest.fn(),
    highlightMoveIntent: jest.fn(),
    highlightKingCheck: jest.fn(),
    updateCheckHighlighting: jest.fn()
}));

import * as main from '../js/main.js';
import * as api from '../js/api.js';
import * as ui from '../js/ui.js';
import { appState, setCurrentGameId, addGameToSession } from '../js/state.js';

global.alert = jest.fn();
global.confirm = jest.fn(() => true);
global.console.error = jest.fn();
global.console.log = jest.fn();

describe('Główny kontroler gry (Main Controller)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        appState.currentGameId = null;
        appState.pendingMove = null;
        appState.isListening = false;
        appState.allGames = new Map();
        appState.board = { flip: jest.fn(), orientation: jest.fn(), position: jest.fn() };
    });

    describe('startNewGame', () => {
        it('powinien utworzyć nową grę i załadować ją, gdy API odpowie sukcesem', async () => {
            const mockSettings = { mode: 'standard', color: 'white', aiLevel: 1 };
            const mockNewGameData = { game_id: 'game_123', w_type: 'human' };
            const mockGameState = {
                game_id: 'game_123',
                fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPP1PPP/RNBQKBNR',
                history: [],
                turn: 'white'
            };

            ui.getNewGameSettings.mockReturnValue(mockSettings);
            api.createNewGame.mockResolvedValue(mockNewGameData);
            api.getGameState.mockResolvedValue(mockGameState);
            await main.startNewGame();

            expect(ui.getNewGameSettings).toHaveBeenCalled();
            expect(api.createNewGame).toHaveBeenCalledWith({
                mode: 'standard',
                player_color: 'white',
                ai_level: 1
            });
            expect(addGameToSession).toHaveBeenCalledWith('game_123', expect.anything(), expect.anything(), 'standard');
            expect(api.getGameState).toHaveBeenCalledWith('game_123');
        });

        it('powinien wyświetlić błąd w UI, gdy tworzenie gry się nie powiedzie', async () => {
            ui.getNewGameSettings.mockReturnValue({ mode: 'standard' });
            api.createNewGame.mockRejectedValue(new Error('Network error'));

            await main.startNewGame();

            expect(ui.updateVoiceStatusPanel).toHaveBeenCalledWith('error', expect.objectContaining({
                message: expect.stringContaining('Network error')
            }));
        });
    });

    describe('loadAndDisplayGame', () => {
        it('powinien poprawnie ustawić stan gry i zaktualizować planszę', async () => {
            const gameId = 'game_abc';
            const mockGameState = {
                game_id: gameId,
                history: ['e2e4'],
                fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
                mode: 'standard',
                turn: 'black',
                is_game_over: false,
                white_player_type: 'human'
            };

            api.getGameState.mockResolvedValue(mockGameState);

            await main.loadAndDisplayGame(gameId);

            expect(api.getGameState).toHaveBeenCalledWith(gameId);
            expect(setCurrentGameId).toHaveBeenCalledWith(gameId);
            expect(ui.updateBoardPosition).toHaveBeenCalledWith(appState.board, mockGameState.fen);
            expect(ui.updateTurnUIInfo).toHaveBeenCalledWith('black');
            expect(ui.updateVoiceStatusPanel).toHaveBeenCalledWith('default', expect.anything());
        });
    });

    describe('handleRecognizedSpeech', () => {
        it('powinien zanalizować komendę i ustawić pendingMove, gdy rozpoznano ruch', async () => {
            appState.currentGameId = 'game_123';

            const mockBlob = new Blob([], { type: 'audio/wav' });
            const recognizedText = 'pionek na e4';
            const analysisResult = {
                success: true,
                proposed_move_uci: 'e2e4',
                proposed_move_san: 'e4'
            };

            api.recognizeSpeech.mockResolvedValue({ text: recognizedText });
            api.analyzeCommand.mockResolvedValue(analysisResult);

            await main.handleRecognizedSpeech(mockBlob);

            expect(ui.updateVoiceStatusPanel).toHaveBeenCalledWith('recognizing');
            expect(api.analyzeCommand).toHaveBeenCalledWith('game_123', recognizedText);

            expect(appState.pendingMove).toEqual({
                uci: 'e2e4',
                san: 'e4'
            });

            expect(ui.highlightMoveIntent).toHaveBeenCalledWith('e2e4');
            expect(ui.updateVoiceStatusPanel).toHaveBeenCalledWith('confirmation', expect.objectContaining({
                move: 'e4'
            }));
        });

        it('powinien obsłużyć potwierdzenie ruchu ("tak")', async () => {
            appState.currentGameId = 'game_123';
            appState.pendingMove = { uci: 'e2e4', san: 'e4' };
            api.executeMove.mockResolvedValue({
                success: true,
                current_state: { fen: 'abc', history: [], turn: 'w', is_game_over: false }
            });

            api.recognizeSpeech.mockResolvedValue({ text: 'tak potwierdzam' });
            await main.handleRecognizedSpeech(new Blob());

            expect(api.executeMove).toHaveBeenCalledWith('game_123', 'e2e4');
        });
    });

    describe('handleConfirmMove', () => {
        it('powinien wykonać ruch przez API i zaktualizować planszę po sukcesie', async () => {
            appState.currentGameId = 'game_123';
            appState.pendingMove = { uci: 'e2e4', san: 'e4' };

            const mockExecutionResult = {
                success: true,
                current_state: {
                    fen: 'new_fen_string',
                    history: ['e2e4'],
                    turn: 'black',
                    is_game_over: false
                }
            };

            api.executeMove.mockResolvedValue(mockExecutionResult);

            await main.handleConfirmMove();
            expect(ui.updateVoiceStatusPanel).toHaveBeenCalledWith('recognizing', expect.anything());

            expect(api.executeMove).toHaveBeenCalledWith('game_123', 'e2e4');
            expect(appState.pendingMove).toBeNull();
            expect(ui.updateBoardPosition).toHaveBeenCalledWith(appState.board, 'new_fen_string');
            expect(ui.updateVoiceStatusPanel).toHaveBeenCalledWith('success', { move: 'e4' });
        });
    });
});