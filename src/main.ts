import { invoke } from "@tauri-apps/api/tauri";
import { listen } from '@tauri-apps/api/event';


const canvas = document.getElementById('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const observeButton = document.getElementById('observeButton') as HTMLButtonElement;
const turnDisplay = document.getElementById('turn') as HTMLParagraphElement;
const gridSize = 30;
const stoneRadius = 14;
let boardSize = 18;

class GameController {
    static shared = new GameController();
    
    isObserving = false;
    board = new Array(boardSize).fill(null).map(() => new Array(boardSize).fill(null));
    currentPlayer = Player.BLACK;
    currentStoneP = Color.P_90;
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
        boardSize = size as number;
    });
    initEventListeners();
    initObserveButton();
    drawGrid();
    setTurnDisplay();

    invoke("init_game");
    
}

init();



await listen("turn", (e) => {
    const data = e.payload as {player: string, p: number};
    
    GameController.shared.currentPlayer = playerFromString(data.player);
    GameController.shared.currentStoneP = data.p;
    

    setTurnDisplay();
});

await listen("winner", (e) => {
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
        case "black":
                return Player.BLACK;
        case "white":
                return Player.WHITE;
        default:
                return Player.BLACK;
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

        const { x, y } = getMousePosition(event);
        const { row, col } = positionToCoordinate(x, y);
        const controller = GameController.shared;
        if (isValidMove(row, col)) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawGrid();
            controller.board.forEach((row, rowIndex) =>
                    row.forEach((stone, colIndex) => {
                            if (stone) {
                                    drawStone(gridSize + colIndex * gridSize, gridSize + rowIndex * gridSize, stone);
                            }
            }));
            
            drawStone(gridSize + col * gridSize, gridSize + row * gridSize, playerToColor(controller.currentPlayer), 0.5);
        }
    });
    
    canvas.addEventListener('click', (event) => {
        if (GameController.shared.isObserving) return;

        const { x, y } = getMousePosition(event);
        const { row, col } = positionToCoordinate(x, y);
        // const controller = GameController.shared;
        if (isValidMove(row, col)) {
            placeStoneProbability(row, col);
            let debugCount = 0;
            for (let i = 0; i < boardSize; i++) {
                for (let j = 0; j < boardSize; j++) {
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


function drawGrid() {
    ctx.fillStyle = '#dcb35c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'black';
    for (let i = 0; i < boardSize; i++) {
        ctx.beginPath();
        ctx.moveTo(gridSize + i * gridSize, gridSize);
        ctx.lineTo(gridSize + i * gridSize, canvas.height - gridSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(gridSize, gridSize + i * gridSize);
        ctx.lineTo(canvas.width - gridSize, gridSize + i * gridSize);
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
    ctx.arc(x, y, stoneRadius, 0, 2 * Math.PI);

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
function getMousePosition(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x, y };
}

/**
 * 座標を盤面の座標に変換する
 * @param {number} x 
 * @param {number} y 
 * @returns 
 */
function positionToCoordinate(x: number, y: number) {
    return {
        row: Math.round((y - gridSize) / gridSize),
        col: Math.round((x - gridSize) / gridSize),
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
        drawStone(gridSize + col * gridSize, gridSize + row * gridSize, color);
    }).catch(() => {
        invoke("get_board").then((board) => {
            console.log(board);
        });
    });
}



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
    drawStone(gridSize + col * gridSize, gridSize + row * gridSize, color);
}

/**
 * 石を置けるかどうかを判定する
 * @param {number} row 
 * @param {number} col 
 * @returns 
 */
function isValidMove(row: number, col: number) {
    return row >= 0 && col >= 0 && row < boardSize && col < boardSize && GameController.shared.board[row][col] == null;
}

function setTurnDisplay() {
    turnDisplay.innerHTML = "どちらかといえば<strong>"  + (GameController.shared.currentPlayer === Player.BLACK ? '黒' : '白') + "</strong>い方の番です";
}

function initObserveButton() {
    if (!observeButton) return;
    observeButton.innerHTML = "観測！";
    observeButton.disabled = false;
}


// let isObserving = false;

class ObserveController {
    static shared = new ObserveController();
    prevBoard = Array.from(GameController.shared.board, (row) => Array.from(row));
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
            drawGrid();
            gameC.board.forEach((row, rowIndex) =>
                    row.forEach((stone, colIndex) => {
                            if (stone) {
                                    drawStone(gridSize + colIndex * gridSize, gridSize + rowIndex * gridSize, stone);
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
 * 
 * @param {Set<Player>} winners 
 */
function winnerIsDecided(winner: Player) {
    const msg = winner === Player.BLACK ? '黒の勝ちです！' : '白の勝ちです！';
    
    turnDisplay.innerHTML = `${msg}<br><button onclick="javascript:restart();">もう一度</button>`;
    observeButton.disabled = true;
    console.log(msg);
}

declare global {
    interface Window {
        restart: () => void;
    }
}
window.restart = restart;

function restart() {
    const gameC = GameController.shared;

    gameC.board = new Array(boardSize).fill(null).map(() => new Array(boardSize).fill(null));
    gameC.currentPlayer = Player.BLACK;
    gameC.isObserving = false;
    init();
}