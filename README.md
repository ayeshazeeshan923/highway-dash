# 🏎️ Highway Dash — Arcade Car Racing Game

A complete, production-ready 2D arcade car racing game built with pure **HTML5 Canvas, CSS3, and vanilla JavaScript**. No frameworks, no external assets, no backend — just open and play.

---

## 🎮 Live Demo

> After deploying to GitHub Pages, paste your URL here:
> `https://YOUR-USERNAME.github.io/highway-dash/`

---

## 📸 Features at a Glance

- 🚗 **Smooth player car** with keyboard and mobile touch controls
- 🚦 **Dynamic traffic** — cars and trucks in random lanes and colors
- 🔥 **Nitro boost** system with visual trail and speed lines
- 🪙 **Coins and pickups** scattered across the road
- 💥 **Particle system** — crash explosion, tyre smoke, coin burst, nitro trail
- 🏆 **9 Achievements** saved to localStorage
- 🎨 **6 car skins** to choose from
- 🔊 **Procedural audio** via Web Audio API (no audio files needed)
- 📱 **Fully responsive** — works on desktop and mobile
- 💾 **High score + total coins** saved across sessions
- ⚙️ **Easy / Normal / Hard** difficulty modes
- 📈 **Level progression** — speed and traffic increase every 30 seconds

---

## 📁 Project Structure

```
highway-dash/
├── index.html   ← Game shell, all screens (menu, pause, game over, settings)
├── style.css    ← All UI, HUD, and menu styles
├── script.js    ← Complete game engine (modular, well-commented)
└── README.md    ← This file
```

No build step. No npm. No dependencies.

---

## 🖥️ Run Locally

1. Download or clone this repo.
2. Open `index.html` in any modern browser.

```bash
git clone https://github.com/YOUR-USERNAME/highway-dash.git
cd highway-dash
# Just open index.html — no server needed
```

> Works in Chrome, Firefox, Edge, and Safari.

---

## 🚀 Deploy to GitHub Pages

1. Push all files to a GitHub repository.
2. Go to **Settings → Pages**.
3. Set *Source* to `main` branch, `/ (root)` folder.
4. Click **Save**.
5. Your game is live at `https://YOUR-USERNAME.github.io/REPO-NAME/` within ~60 seconds.

### Updating the game later

Just edit a file and commit — GitHub Pages republishes automatically.

```bash
git add .
git commit -m "Update game"
git push
```

---

## 🕹️ Controls

| Action | Keyboard | Mobile |
|---|---|---|
| Steer Left | `←` Arrow / `A` | ◀ button |
| Steer Right | `→` Arrow / `D` | ▶ button |
| Nitro Boost | `Space` / `Shift` | 🔥 button |
| Pause | `P` / `Esc` | ⏸ HUD button |

---

## 🏆 Achievements

| Icon | Name | Condition |
|---|---|---|
| 🏁 | First Race | Complete your first run |
| 🎯 | Score 1000 | Reach a score of 1000 |
| ⭐ | Score 5000 | Reach a score of 5000 |
| 🪙 | Coin Hoarder | Collect 50 coins in one run |
| ⏱️ | Survivor | Survive for 60 seconds |
| 🕐 | Endurance | Survive for 2 minutes |
| 🔥 | Nitro Junkie | Use nitro 5 times in one run |
| 🏆 | Level 3 Reached | Reach Level 3 |
| 💰 | Rich Driver | Collect 100 coins total (all-time) |

---

## ⚙️ Code Architecture

The entire game lives in `script.js` and is organized into focused modules:

| Module | Responsibility |
|---|---|
| `Save` | localStorage wrapper for scores, settings, achievements |
| `UI` | Screen transitions and menu stat updates |
| `Audio` | Procedural Web Audio API sounds (engine, crash, coin, nitro) |
| `Skins` | Car colour palette management |
| `Achievements` | Unlock tracking and toast notifications |
| `Particles` | Pooled particle system for effects |
| `Road` | Highway renderer — lanes, dashes, scenery, mountains, sky |
| `Player` | Player car physics, input, nitro, collision rect |
| `Traffic` | Traffic spawning, movement, collision detection |
| `Pickups` | Coins and nitro canisters — spawn, collect, animate |
| `MobileCtrl` | Touch button state bridge |
| `Game` | Main loop, difficulty scaling, level progression, game over |

---

## 🔊 Audio Notes

All sounds are generated in real-time using the **Web Audio API** — no `.mp3` or `.ogg` files are required. If you want to replace them with real audio files, add `<audio>` elements to `index.html` and swap out the relevant methods in the `Audio` module in `script.js`.

---

## 📱 Mobile Support

On touch devices, on-screen steering and nitro buttons appear automatically. The canvas scales to fill any screen size. No layout breaks on small screens.

---

## 📄 License

Free to use, modify, and deploy for personal or commercial projects.

---

> Built with ❤️ using pure HTML5, CSS3, and JavaScript — no libraries, no frameworks, no external assets.
