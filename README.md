# Ghost Grid: The Last Pellet (React + Phaser)

A modern and fun approach to the 1980s classic. Built with Vite + React and Phaser 3.
- 12 floors on each level
- 7 ghosts moving up and down in shafts with differing speeds/phases
- Sprint with Shift, Pause with Space/P
- Cryptogram line unlocks every 3 cleared levels (hidden 10th line in code)

## Quickstart

```bash
# Node 18+ recommended (works on 20+)
npm i
npm run dev
```

Open the printed local URL (default http://localhost:5173).

## Build
```bash
npm run build
npm run preview
```

## Notes
- Phaser is loaded **dynamically** in the React component to avoid SSR/bundler null export issues.
- No external assets required; visuals are procedural.

## Cryptogram (player guide)

- What it is: A 9-line cryptogram that reveals one new line each time you clear a level. There’s also a hidden 10th line tucked away in the source code as an easter egg.
- How to use it: Each line is either plain text or a simple substitution cipher.
	- ROT13 (A↔N, B↔O, …) appears as all-caps gibberish like “URYYB JBEYQ”. Apply ROT13 to read it.
	- Caesar shift (commonly ±3) shows up as strings like “QEB NRFZH …”. Shift letters forward/back by 3 to decode.
- Why: It’s a light puzzle that adds lore and a few playful hints. You can read lines in-game or decode outside the game.
- Tips: If a line looks readable, it probably is. If it looks scrambled, try ROT13 first, then a ±3 Caesar. Any online ROT/caesar tool works if you don’t want to do it by hand.
- Hidden line: After you’ve unlocked the visible lines, peek in the code to find the secret 10th line (search for “CRYPTOGRAM_HIDDEN”). It’s just for fun.

### In‑game viewer
- After every 3rd level clear, a toast shows the newly unlocked line.
- Press C anytime to open the Cryptogram panel and review all unlocked lines (Esc or C to close).
 - Restarting the game (Retry) resets cryptogram progress.
