// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{borrow::BorrowMut, sync::Mutex};

use crate::game::BOARD_SIZE;
use game::Game;
use player::{Color, PlayerKind};

use tauri::{LogicalSize, Manager, Runtime};

mod game;
mod player;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            init_game,
            get_board_size,
            greet,
            get_board,
            place_stone,
            observe
        ])
        .setup(|app| {
            let main_window = app.get_window("main").unwrap();
            main_window
                .set_title("量子五目並べ")
                .expect("failed to set title");
            main_window
                .set_size(LogicalSize::new(610.0, 850.0))
                .expect("failed to set size");
            Ok(())
        })
        .manage(MyState::new())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

struct MyState {
    game: Mutex<Game>,
}

impl MyState {
    fn new() -> Self {
        Self {
            game: Mutex::new(Game::new()),
        }
    }
}

#[tauri::command]
async fn init_game<R: Runtime>(
    state: tauri::State<'_, MyState>,
    window: tauri::Window<R>,
) -> Result<(), String> {
    let mut game = state.game.lock().unwrap();
    game.borrow_mut().reset();

    window
        .emit("turn", game.turn().to_string())
        .map_err(|err| err.to_string())?;

    Ok(())
}

#[tauri::command]
async fn get_board_size() -> usize {
    BOARD_SIZE
}

type PBoardJS = [[Option<u8>; BOARD_SIZE]; BOARD_SIZE];

#[tauri::command]
async fn get_board(state: tauri::State<'_, MyState>) -> Result<PBoardJS, String> {
    let game = state.game.lock().unwrap();
    let board = game.get_p_board();

    Ok(convert_board(board))
}

fn convert_board(board: &[[Option<Color>; BOARD_SIZE]; BOARD_SIZE]) -> PBoardJS {
    let mut result = [[None; BOARD_SIZE]; BOARD_SIZE];

    for y in 0..BOARD_SIZE {
        for x in 0..BOARD_SIZE {
            result[y][x] = board[y][x].map(|color| color.into());
        }
    }

    result
}

#[derive(serde::Serialize, Clone)]
struct TurnInfo {
    player: String,
    p: u8,
}

#[tauri::command]
async fn place_stone<R: Runtime>(
    x: usize,
    y: usize,
    state: tauri::State<'_, MyState>,
    window: tauri::Window<R>,
) -> Result<u8, String> {
    let mut game = state.game.lock().unwrap();
    let color = game
        .borrow_mut()
        .place_stone_prohibitly(x, y)
        .map_err(|err| err.to_string())?;

    window
        .emit(
            "turn",
            TurnInfo {
                player: game.turn().to_string(),
                p: game.get_turn_p(),
            },
        )
        .map_err(|err| err.to_string())?;

    Ok(u8::from(color))
}

type ObservedBoardJS = [[Option<u8>; BOARD_SIZE]; BOARD_SIZE];

#[tauri::command]
async fn observe<R: Runtime>(
    window: tauri::Window<R>,
    state: tauri::State<'_, MyState>,
) -> Result<ObservedBoardJS, String> {
    let mut game = state.game.lock().unwrap();

    let board = game.observe();

    let result = board.map(|row| {
        row.map(|color| {
            color.map(|color| match color {
                PlayerKind::Black => 100,
                PlayerKind::White => 0,
            })
        })
    });

    window
        .emit("turn", TurnInfo {
            player: game.turn().to_string(),
            p: game.get_turn_p(),
        })
        .map_err(|err| err.to_string())?;

    let winners = game.get_winners();
    dbg!(winners.clone());
    match winners.len() {
        1 => {
            let winner = winners.iter().next().unwrap();
            window
                .emit("winner", winner.to_string())
                .map_err(|err| err.to_string())?;
        }

        2 => {
            let who_observed = match game.turn() {
                PlayerKind::Black => PlayerKind::White,
                PlayerKind::White => PlayerKind::Black,
            };
            window
                .emit("winner", who_observed.to_string())
                .map_err(|err| err.to_string())?;
        }

        _ => (),
    }

    Ok(result)
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
