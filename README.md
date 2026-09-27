# Vector Fleet!

A projector game for practicing vector addition and projectile motion. Eight ships share a 200 m × 200 m grid. Each round, students read the vectors on the left, type an elevation and a direction for their ship, and press **Start**. The ten-second animation is the answer check.

Built for [physicsy.com](https://www.physicsy.com/).

Play: [https://www.physicsy.com/vector-fleet-game/](https://www.physicsy.com/vector-fleet-game/)

## Play

Open `index.html`, or serve the folder and visit it. The board is a fixed 16:10 stage, scaled to the window, so it fills a 16:10 projector and letterboxes on a 16:9 screen.

Each ship needs both boxes filled in order to fire.

- **Elev °** — angle above the horizontal, from 0 to 90.
- **Dir °** — direction of the shot in the same system as the ship vectors.

Leave both boxes blank and that ship still sails, but it does not fire. Press Enter in a box to start the round.

## Rules

- Eight ships, one color each, all the same size. Each starts at **5.00** hit points. The number on the icon is that score.
- A round lasts **10.00 s**. The program picks a new heading for every ship at the start of the round, and another after the animation.
- Ship headings are at most **3.00 m/s**. Current is at most **1.00 m/s** and is the same for every ship. Wind is at most **2.00 m/s** and affects shells only.
- The program keeps every ship inside the grid and at least 6.5 m from the other ships.
- Muzzle speed is **35.00 m/s**, relative to the ship. The shell also carries the ship’s actual velocity.
- A shell that meets the water within **1 m** of another ship is a hit. The shooter gains **0.50** hit points and the target loses **1.00**.
- Hit points change as each shell lands. A ship leaves the game after the round if its hit points are **0 or below**. Shells already in the air still count, so a ship that is hit and also scores on a later shell keeps the net result.
- When one ship is left, it wins. **New Fleet** starts a fresh match.

## Coordinate system

The origin is the center of the grid. Coordinates run from −100 m to 100 m, with a black line every 10 m and a label every 20 m.

- **0°** points along **+x** (right).
- **90°** points along **+y** (up).
- Components are `vx = v cos θ` and `vy = v sin θ`.
- Vectors are written `magnitude@direction`, such as `2.35@18.00°`.

Positions, headings, wind, and current are shown to the nearest hundredth, and the round uses those displayed values.

## What to add

Ship path:

```
v_ship = v_heading + v_current
position(t) = position_0 + v_ship · t
```

Shell, with elevation α and direction φ:

```
v_horizontal = 35 cos α
v_x = v_horizontal cos φ + v_ship,x + v_wind,x
v_y = v_horizontal sin φ + v_ship,y + v_wind,y
v_z = 35 sin α
z(t) = v_z t − ½ (9.80) t²
```

An elevated shell returns to the water at

```
t = 2 (35 sin α) / 9.80
```

and its map position at that time is `(x0 + v_x t, y0 + v_y t)`. A hit means that point is within 1 m of the target's position at the same t. Elevation 0 stays on the water for the whole 10 s.

On the map, the dashed shadow is the shell's true map position. The curve above it is height, drawn so the parabola is visible. Do not measure range off the curve.

## A 62.50 m check

No wind, no current, neither ship moving.

- Red at `(0.00, 0.00) m`, velocity `0.00@0.00°`
- Blue at `(62.50, 0.00) m`, velocity `0.00@0.00°`
- Red fires elevation **15°** or **75°**, direction **0°**

```
range = (35² sin 2α) / 9.80
sin 30° = sin 150° = 0.5
range = 1225 × 0.5 / 9.80 = 62.50 m
```

Red becomes 5.50. Blue becomes 4.00. An elevation of 14° falls short and misses.

## Precision

The hit window is 1 m. On this 200 m board with a 35 m/s gun, a correct first pass of the class procedure lands inside that window about 9 times in 10. About 1 in 10 correct first passes still miss, mostly when the time guess is poor. A second pass of the correction covers most of those. Skipping the vectors lands inside 1 m only about 1 time in 20.

Angles kept to the hundredth of a degree are fine inside this window.

`g = 9.8 m/s²`. Half of that, 4.9, is the number in the time formula on the class spreadsheet.

The shell carries the ship’s actual velocity, heading plus current, and the wind is added as well. On the class calculation sheet, your movement and the wind are entered as the opposite components because those velocities are already in the shell. The separate `vector-fleet` command-line solver uses g = 9.81. This board uses 9.8, the same value as the spreadsheet.

The student steps are in `Vector-Fleet-Firing-Angles.docx`.

## Local setup

```bash
git clone https://github.com/Mr-JOlson/vector-fleet-game.git
cd vector-fleet-game
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Physics checks:

```bash
node --test
```

## Project structure

```
index.html          16:10 board
css/style.css       Grey stats panel, white grid, ship boxes
js/physics.js       Vectors, motion, hits, and round generation
js/draw.js          Grid, ships, parabolic trails, explosions
js/audio.js         Hit explosion
js/game.js          Round flow and the Start button
test/physics.test.js
```
