# Vector Fleet!

A projector game for practicing vector addition and projectile motion. Eight ships share a 100 m × 100 m grid. Each round, students read the vectors on the left, type an elevation and a direction for their ship, and press **Start**. The ten-second animation is the answer check.

Built for [physicsy.com](https://www.physicsy.com/).

Play: [https://www.physicsy.com/Vector-Fleet/](https://www.physicsy.com/Vector-Fleet/)

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
- Muzzle speed is **28.00 m/s**. It is relative to the water, not the ship.
- A shell that meets the water within **0.01 m** of another ship is a hit. The shooter gains **0.50** hit points and the target loses **1.00**.
- Hit points change as each shell lands. A ship leaves the game after the round if its hit points are **0 or below**. Shells already in the air still count, so a ship that is hit and also scores on a later shell keeps the net result.
- When one ship is left, it wins. **New Fleet** starts a fresh match.

## Coordinate system

The origin is the center of the grid. Coordinates run from −50 m to 50 m, with a black line every 10 m.

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
v_horizontal = 28 cos α
v_x = v_horizontal cos φ + v_wind,x
v_y = v_horizontal sin φ + v_wind,y
v_z = 28 sin α
z(t) = v_z t − ½ (9.80) t²
```

An elevated shell returns to the water at

```
t = 2 (28 sin α) / 9.80
```

and its map position at that time is `(x0 + v_x t, y0 + v_y t)`. A hit means that point is within 0.01 m of the target's position at the same t. Elevation 0 stays on the water for the whole 10 s.

On the map, the dashed shadow is the shell's true map position. The curve above it is height, drawn so the parabola is visible. Do not measure range off the curve.

## A 40 m check

No wind, no current, neither ship moving.

- Red at `(0.00, 0.00) m`, velocity `0.00@0.00°`
- Blue at `(40.00, 0.00) m`, velocity `0.00@0.00°`
- Red fires elevation **15°** or **75°**, direction **0°**

```
range = (28² sin 2α) / 9.80
sin 30° = sin 150° = 0.5
range = 784 × 0.5 / 9.80 = 40.00 m
```

Red becomes 5.50. Blue becomes 4.00. An elevation of 14° falls short and misses.

## Precision

The hit window is one centimeter. That is about a hundredth of a degree on a long shot, and rounding an otherwise correct angle to the hundredth can miss. Enter the calculator's angle with more than two decimal places.

Use the hundredths printed on the board as the inputs. After that, keep full calculator precision through the components and the time. Rounding a component to the hundredth, then multiplying by several seconds, can move the landing by about 2 cm.

`g = 9.80 m/s²`.

## Local setup

```bash
git clone https://github.com/Mr-JOlson/Vector-Fleet.git
cd Vector-Fleet
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
