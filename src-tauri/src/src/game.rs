use std::{collections::HashSet, fmt::Display};

use rand::random;

use crate::player::{Color, PColor, Player, PlayerKind};

pub const BOARD_SIZE: usize = 18;

pub type ProbabilityBoard = [[Option<Color>; BOARD_SIZE]; BOARD_SIZE];
pub type ObservedBoard = [[Option<PlayerKind>; BOARD_SIZE]; BOARD_SIZE];

pub struct Game {
    p_board: ProbabilityBoard,

    turn: PlayerKind,

    black: Player,
    white: Player,

    winner: Option<PlayerKind>,
}

impl Game {
    pub fn new() -> Game {
        Game {
            p_board: [[None; BOARD_SIZE]; BOARD_SIZE],
            turn: PlayerKind::Black,
            black: Player::new(PlayerKind::Black, PColor::Weak),
            white: Player::new(PlayerKind::White, PColor::Strong),
            winner: None,
        }
    }

    pub fn get_p_board(&self) -> &[[Option<Color>; BOARD_SIZE]; BOARD_SIZE] {
        &self.p_board
    }

    pub fn is_valid_position(&self, x: usize, y: usize) -> bool {
        self.check_position(x, y, None)
    }

    pub fn turn(&self) -> PlayerKind {
        self.turn
    }

    fn check_position(&self, x: usize, y: usize, value: Option<Color>) -> bool {
        (0..BOARD_SIZE).contains(&x) && (0..BOARD_SIZE).contains(&y) && self.p_board[y][x] == value
    }

    fn take_turn(&mut self) {
        self.turn = match self.turn {
            PlayerKind::Black => PlayerKind::White,
            PlayerKind::White => PlayerKind::Black,
        };
    }

    pub fn place_stone_prohibitly(&mut self, x: usize, y: usize) -> Result<(), GameError> {
        if self.winner.is_some() {
            return Err(GameError::GameIsAlreadyOver);
        }

        if !self.is_valid_position(x, y) {
            return Err(GameError::InvalidPosition);
        }

        let color = match self.turn {
            PlayerKind::Black => Color::Black(self.black.consume_stone()),
            PlayerKind::White => Color::White(self.white.consume_stone()),
        };

        if self.p_board[y][x].is_some() {
            return Err(GameError::InvalidPosition);
        }

        self.p_board[y][x] = Some(color);

        self.take_turn();

        Ok(())
    }

    pub fn get_winners(&mut self) -> HashSet<PlayerKind> {
        const DIRECTIONS: [(isize, isize); 4] = [(1, 0), (0, 1), (1, 1), (1, -1)];

        let mut winners = HashSet::new();

        for y in 0..BOARD_SIZE {
            for x in 0..BOARD_SIZE {
                if self.p_board[y][x].is_none() {
                    continue;
                }
                for d in DIRECTIONS {
                    if self.check_win_dfs(x, y, d, 1) {
                        winners.insert(self.p_board[y][x].unwrap().as_player_kind());
                    }
                }
            }
        }

        winners
    }

    fn check_win_dfs(&self, x: usize, y: usize, direction: (isize, isize), count: usize) -> bool {
        if count >= 5 {
            return true;
        }

        let new_x = x as isize + direction.0;
        let new_y = y as isize + direction.1;

        if new_x < 0 || new_x >= BOARD_SIZE as isize || new_y < 0 || new_y >= BOARD_SIZE as isize {
            return false;
        }

        let new_x = new_x as usize;
        let new_y = new_y as usize;

        if self.p_board[new_y][new_x] == self.p_board[y][x] {
            self.check_win_dfs(new_x, new_y, direction, count + 1)
        } else {
            false
        }
    }

    pub fn observe(&mut self) -> ObservedBoard {
        let mut observed_board = [[None; BOARD_SIZE]; BOARD_SIZE];

        #[warn(clippy::needless_range_loop)]
        for y in 0..BOARD_SIZE {
            for x in 0..BOARD_SIZE {
                observed_board[y][x] = self.p_board[y][x].map(|color| {
                    let random_number: usize = (random::<f64>() * 100.0).floor() as usize;
                    let p: u8 = color.into();

                    if random_number < p.into() {
                        PlayerKind::Black
                    } else {
                        PlayerKind::White
                    }
                });
            }
        }

        self.take_turn();

        observed_board
    }
}

pub enum GameError {
    GameIsAlreadyOver,
    InvalidPosition,
}

impl Display for GameError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GameError::GameIsAlreadyOver => write!(f, "Game is already over"),
            GameError::InvalidPosition => write!(f, "Invalid position"),
        }
    }
}
