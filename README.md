# লেখকের গ্রহ — shenahamoin.com

A small walkable 3D planet that holds Moin's Bengali writing: satire, analysis, film reviews, essays and plain jokes.
Six keepers stand around the planet, each guarding one section and one lost page of a manuscript. Find all six, then go looking for the three hidden things on the far side.

## Publishing a piece

Everything you edit is in [`js/content.js`](js/content.js).

- Add a post: add an object to a section's `posts` array (`title`, `date`, `kind`, `excerpt`, `body`).
- `body` is a list of paragraphs. To link out instead (Facebook, Medium), leave `body` empty and set `url`.
- About and contact text are in `PROPS`; the three secrets in `SECRETS`; the closing note in `ENDING`.

## Running it locally

It is a static site with no build step. Serve the folder with any static server, for example:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765. Add `?nogl` to the address to see the list-only fallback used when WebGL is unavailable.

## How it is put together

| File | What it does |
|---|---|
| `index.html`, `css/site.css` | Page shell, HUD, dialogue bar, panels and reader |
| `js/content.js` | All text and posts |
| `js/world.js` | Planet, biomes, water, trees, sky (all generated in code) |
| `js/characters.js` | The six keepers, signboard, letterbox and secrets |
| `js/player.js` | Walking on a sphere, collision, follow camera |
| `js/ui.js` | Panels, reader, index list, keyboard and touch input |
| `js/main.js` | Renderer and game loop |

Three.js is loaded from a pinned CDN version. Controls: WASD or arrows to walk, drag to look, E to talk, M for the list of sections, Esc to go back.
