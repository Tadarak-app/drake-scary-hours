# Drake: Scary Hours

A browser-based, offline-capable 3D first-person tactical shooter by **Zohaib Qaiser**. This is a new, independent project and does not modify the earlier GitHub or Vercel projects.

## Game modes

- **Operation Black Tide:** an original solo campaign wrapper with briefing, radio callouts, five weapon slots and the terminal defense arc.
- **Terminal Hold:** eight escalating survival waves, stackable field augments and a three-phase powered-exosuit boss called the Warden.
- **Kill House Free-for-All:** six AI combatants, respawns and a 20-elimination target.

The harbor terminal, rain, equipment, enemy silhouettes and synthesized soundtrack are procedurally assembled at runtime. The cover image is the user-provided `dsh.PNG`; the portrait-derived app icon is made from the user-provided portrait. The application makes no network calls during play.

## Run locally

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Build and preview

```sh
pnpm build
pnpm preview
```

The production static site is written to `dist/` and can be hosted on Vercel as a Vite project. Its manifest and service worker support installable, standalone landscape play and offline caching after the first visit.

## Controls

| Action | Keyboard / mouse | Touch / gamepad |
| --- | --- | --- |
| Move and look | WASD + mouse | Left virtual stick + right-side swipe / left and right sticks |
| Fire / aim | Left click / right click | FIRE / ADS / RT / LT |
| Sprint / jump / slide | Shift / Space / C | Movement plus action buttons / L3 / A / B |
| Reload / grenade / melee | R / G / F | R / G / F touch buttons |
| Swap weapon / Overdrive | Q / 1–5 / V | X / d-pad / action button |
| Pause | Esc | OS back or Esc |

## Attribution

**A game by Zohaib Qaiser.** The visible in-game credit, browser author and copyright metadata, PWA identity, and social preview all name Zohaib Qaiser.
