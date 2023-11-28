#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Color {
    Black(PColor),
    White(PColor),
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum PColor {
    Strong,
    Weak,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub enum PlayerKind {
    Black,
    White,
}

pub struct Player {
    kind: PlayerKind,
    next_stone: PColor,
}

impl From<Color> for u8 {
    fn from(value: Color) -> Self {
        match value {
            Color::Black(color) => match color {
                PColor::Strong => 90,
                PColor::Weak => 70,
            },
            Color::White(color) => match color {
                PColor::Strong => 10,
                PColor::Weak => 30,
            },
        }
    }
}

impl Player {
    pub fn new(kind: PlayerKind, init_stone: PColor) -> Player {
        Player {
            kind,
            next_stone: init_stone,
        }
    }

    pub fn consume_stone(&mut self) -> PColor {
        let stone = self.next_stone;
        self.next_stone = match self.next_stone {
            PColor::Strong => PColor::Weak,
            PColor::Weak => PColor::Strong,
        };
        stone
    }
}

impl Color {
    pub fn as_player_kind(&self) -> PlayerKind {
        match self {
            Color::Black(_) => PlayerKind::Black,
            Color::White(_) => PlayerKind::White,
        }
    }
}

impl ToString for PlayerKind {
    fn to_string(&self) -> String {
        match self {
            PlayerKind::Black => "black",
            PlayerKind::White => "white",
        }
        .to_string()
    }
}
