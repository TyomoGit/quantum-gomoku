import { invoke } from "@tauri-apps/api/tauri";
import { listen } from '@tauri-apps/api/event';


const canvas = document.getElementById('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const observeButton = document.getElementById('observeButton') as HTMLButtonElement;
const turnDisplay = document.getElementById('turn') as HTMLParagraphElement;
const GRID_SIZE = 30;
const STONE_RAD = 14;
let BOARD_SIZE = 18;

class GameController {
    static shared = new GameController();

    isObserving = false;
    board = new Array(BOARD_SIZE).fill(null).map(() => new Array(BOARD_SIZE).fill(null));
    currentPlayer = Player.BLACK;
    currentStoneP = Color.P_90;
}

class ObserveController {
    static shared = new ObserveController();
    prevBoard = Array.from(GameController.shared.board, (row) => Array.from(row));
}

enum Color {
    P_10 = 10,
    P_30 = 30,
    P_70 = 70,
    P_90 = 90,
    BLACK = 100,
    WHITE = 0,
}

enum Player {
    BLACK,
    WHITE,
}

function init() {
    invoke("get_board_size").then((size) => {
        BOARD_SIZE = size as number;
    });
    initEventListeners();
    initObserveButton();
    drawBoardGrid();
    setTurnDisplay();

    invoke("init_game");
    
}

init();


listen("turn", (e) => {
    const data = e.payload as {player: string, p: number};
    
    console.log(playerFromString(data.player), data.player);
    
    GameController.shared.currentPlayer = playerFromString(data.player);
    GameController.shared.currentStoneP = data.p;

    setTurnDisplay();
    
});

listen("winner", (e) => {
    const winner = e.payload as string;

    if (!winner) return;
    
    winnerIsDecided(playerFromString(winner));
});

function strToColor(str: string): Color {
    switch(str) {
        case "10":
                return Color.P_10;
        case "30":
                return Color.P_30;
        case "70":
                return Color.P_70;
        case "90":
                return Color.P_90;
        default:
                return Color.P_10;
    }
}

function numberToPlayer(num: number): Player {
    switch(num) {
        default:
            case 100:
                return Player.BLACK;
            case 0:
                return Player.WHITE;
    }
}

function playerFromString(str: string): Player {
    switch(str) {
        default:
        case "black":
                return Player.BLACK;
        case "white":
                return Player.WHITE;
    }
}

function playerToColor(player: Player): Color {
    switch(player) {
        case Player.BLACK:
                return Color.BLACK;
        case Player.WHITE:
                return Color.WHITE;
    }
}

async function initEventListeners() {
    canvas.addEventListener('mousemove', (event) => {
        if (GameController.shared.isObserving) return;

        const { x, y } = getCursorCoordinate(event);
        const { row, col } = positionToCoordinate(x, y);
        const controller = GameController.shared;
        if (isValidMove(row, col)) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawBoardGrid();
            controller.board.forEach((row, rowIndex) =>
                    row.forEach((stone, colIndex) => {
                            if (stone) {
                                    drawStone(GRID_SIZE + colIndex * GRID_SIZE, GRID_SIZE + rowIndex * GRID_SIZE, stone);
                            }
            }));
            
            drawStone(GRID_SIZE + col * GRID_SIZE, GRID_SIZE + row * GRID_SIZE, playerToColor(controller.currentPlayer), 0.5);
        }
    });
    
    canvas.addEventListener('click', (event) => {
        if (GameController.shared.isObserving) return;

        const { x, y } = getCursorCoordinate(event);
        const { row, col } = positionToCoordinate(x, y);
        // const controller = GameController.shared;
        if (isValidMove(row, col)) {
            placeStoneProbability(row, col);
            let debugCount = 0;
            for (let i = 0; i < BOARD_SIZE; i++) {
                for (let j = 0; j < BOARD_SIZE; j++) {
                    if (GameController.shared.board[i][j] != null) {
                        debugCount++;
                    }
                }
            }
            console.log(debugCount);
        }
    });

    observeButton?.addEventListener('click', (_) => {
        observe();
    });
}


function drawBoardGrid() {
    ctx.fillStyle = '#dcb35c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'black';
    for (let i = 0; i < BOARD_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(GRID_SIZE + i * GRID_SIZE, GRID_SIZE);
        ctx.lineTo(GRID_SIZE + i * GRID_SIZE, canvas.height - GRID_SIZE);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(GRID_SIZE, GRID_SIZE + i * GRID_SIZE);
        ctx.lineTo(canvas.width - GRID_SIZE, GRID_SIZE + i * GRID_SIZE);
        ctx.stroke();
    }
}

/**
 * 石を描画する
 * @param {number} x 
 * @param {number} y 
 * @param {Color} color 
 * @param {number} opacity 
 */
function drawStone(x: number, y: number, color: Color, opacity = 1) {
    ctx.beginPath();
    ctx.arc(x, y, STONE_RAD, 0, 2 * Math.PI);

    let stoneText = "";
    let textColor = "";
    let colorString = "";
    switch(color) {
        case Color.P_10:
            colorString = '#EEEEEE';
            // opacity = 0.1;
            stoneText = "10";
            textColor = '#000000';
            break;
        case Color.P_30:
            colorString = '#CCCCCC';
            // opacity = 0.3;
            stoneText = "30";
            textColor = '#000000';
            break;
        case Color.P_70:
            colorString = '#333333';
            // opacity = 0.7;
            stoneText = "70";
            textColor = '#FFFFFF';
            break;
        case Color.P_90:
            colorString = '#000000';
            // opacity = 0.9;
            stoneText = "90";
            textColor = '#FFFFFF';
            break;
        case Color.BLACK:
            colorString = '#000000';
            textColor = '#FFFFFF';
            break;
        case Color.WHITE:
            colorString = '#FFFFFF';
            textColor = '#000000';
            break;
        default:
            break;
    }
    ctx.fillStyle = colorString;
    ctx.globalAlpha = opacity;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.font = "15px monospace";
    ctx.fillStyle = textColor;
    ctx.fillText(stoneText, x - 9, y + 6);
}

/**
 * マウスカーソルの座標を取得する
 * @param {MouseEvent} event 
 * @returns {x: number, y: number} - マウスカーソルの座標
 */
function getCursorCoordinate(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x, y };
}

/**
 * キャンバスの座標を盤面の位置に変換する
 * @param {number} x 
 * @param {number} y 
 * @returns 盤面の座標
 */
function positionToCoordinate(x: number, y: number) {
    return {
        row: Math.round((y - GRID_SIZE) / GRID_SIZE),
        col: Math.round((x - GRID_SIZE) / GRID_SIZE),
    };
}

/**
 * 確率の石を置く
 * @param {number} row 
 * @param {number} col 
 * @param {Player} player 
 */
function placeStoneProbability(row: number, col: number) {

    invoke("place_stone", { x: col, y: row}).then((p) => {
        const color = strToColor(`${p as number}`);
        GameController.shared.board[row][col] = color;
        drawStone(GRID_SIZE + col * GRID_SIZE, GRID_SIZE + row * GRID_SIZE, color);
    }).catch(() => {
        invoke("get_board").then((board) => {
            console.log(board);
        });
    });
}

/**
 * 強制的に石を置く
 * @param row 
 * @param col 
 * @param value 
 */
function placeStoneForce(row: number, col: number, value: Player) {
    const controller = GameController.shared;
    controller.board[row][col] = value;
    
    let color;
    switch(value) {
        default:
        case Player.BLACK:
            color = Color.BLACK;
            break;
        case Player.WHITE:
            color = Color.WHITE;
            break;
    }
    drawStone(GRID_SIZE + col * GRID_SIZE, GRID_SIZE + row * GRID_SIZE, color);
}

/**
 * 石を置けるかどうかを判定する
 * @param {number} row 
 * @param {number} col 
 * @returns 
 */
function isValidMove(row: number, col: number) {
    return row >= 0 && col >= 0 && row < BOARD_SIZE && col < BOARD_SIZE && GameController.shared.board[row][col] == null;
}

/**
 * 現在のターンを表示する
 */
function setTurnDisplay() {
    turnDisplay.innerHTML = "どちらかといえば<strong>"  + (GameController.shared.currentPlayer === Player.BLACK ? '黒' : '白') + "</strong>い方の番です";
}

/**
 * 観測ボタンを初期化する
 */
function initObserveButton() {
    if (!observeButton) return;
    observeButton.innerHTML = "観測！";
    observeButton.disabled = false;
}

/**
 * 観測を実行する
 */
function observe() {
    const gameC = GameController.shared;
    const observeC = ObserveController.shared;

    if (gameC.isObserving) {
            gameC.isObserving = false;
            observeButton.innerHTML = "観測！";
            gameC.board = observeC.prevBoard;
            drawBoardGrid();
            gameC.board.forEach((row, rowIndex) =>
                    row.forEach((stone, colIndex) => {
                            if (stone) {
                                    drawStone(GRID_SIZE + colIndex * GRID_SIZE, GRID_SIZE + rowIndex * GRID_SIZE, stone);
                            }
                    })
            );
            return;
    }

    // takeTurn();
    // setTurnDisplay();

    gameC.isObserving = true;
    observeC.prevBoard = Array.from(gameC.board, (row) => Array.from(row));

    invoke("observe").then((_board) => {
        const board = _board as number[][];
        console.log(board);
        
        board.forEach((row, rowIndex) =>
            row.forEach((stone, colIndex) => {
                if (stone != null) {
                    placeStoneForce(rowIndex, colIndex, numberToPlayer(stone));
                }
            })
        );
    });

    observeButton.innerHTML = "観測を終わる";
}

/**
 * 勝者が決定したときの処理
 * @param {Set<Player>} winners 
 */
function winnerIsDecided(winner: Player) {
    const msg = winner === Player.BLACK ? '黒の勝ちです！' : '白の勝ちです！';
    
    turnDisplay.innerHTML = `${msg}<br><button onclick="javascript:restart();">もう一度</button>`;
    observeButton.disabled = true;
    console.log(msg);
}

/**
 * restart関数をグローバルに登録する
 */
declare global {
    interface Window {
        restart: () => void;
    }
}
window.restart = restart;

/**
 * ゲームをリスタートする
 */
function restart() {
    const gameC = GameController.shared;

    gameC.board = new Array(BOARD_SIZE).fill(null).map(() => new Array(BOARD_SIZE).fill(null));
    gameC.currentPlayer = Player.BLACK;
    gameC.isObserving = false;
    init();
}