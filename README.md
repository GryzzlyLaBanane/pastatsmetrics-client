# PA Stats Metrics

A Planetary Annihilation: Titans mod that records your matches and ships them to **[pastatsmetrics.com](https://pastatsmetrics.com)** so you can browse your stats, replays and rankings whenever you want.

A homemade upgrade to the old SuperStats. Works on ranked, custom, private, sandbox, and Galactic War games.

---

## The website

Everything the mod records ends up on **[pastatsmetrics.com](https://pastatsmetrics.com)**:

- Profile page with full match history
- 3D match replay (sphere view of bases, fights, kill feed)
- Per-game economy graph + APM curve
- Build-order timeline
- Per-mode leaderboards (1v1 / Team / FFA) *(TO BE DONE)*
- ELO, OpenSkill, and a custom skill-score ranking *(TO BE DONE)*

No account creation needed — the mod identifies you by your Uber ID automatically.
*(I may include Steam login in the future for profile personalization + custom achievements.)*

---

## What the mod records

### Once per game
- Lobby info: players, colors, system, planets/biomes, game mode (1v1, Team, FFA, Galactic War, Sandbox, Ranked, Public/Private, ListenToSpec, LandAnywhere, DynamicAlliance)
- Bounty mode + bounty value
- Server mods, match start/end timestamps, winners

### Every 5 seconds during the match
- **Economy** — energy & metal: gain, spend, net, efficiency %, current/max storage, wasted, produced
- **APM** — real APM, rolling 60s window (same formula as SuperStats)
- **Camera position** (planet, x/y/z, zoom)
- **Kills** — who killed whom and when

### Per unit event
- Unit/building **created** / **destroyed** / **idle** / **arrival** / **target destroyed** (kill credit) / **sight** (enemy spotted) / **allied death**
- Unit type, position (x/y/z), owner, HP for important units
- Damage events (opt-in, off by default — very spammy)

### Every 10–15 seconds
- **Building positions snapshot** — full sweep of your own buildings so the 3D base view stays complete

### About you
- Uber ID, current player name, name history

### Faction support
- Vanilla units & buildings
- Legion / 2nd Wave / Bugs / *(SOON: Thorosmen / S17)*

### What it does NOT record
- Anything before your commander spawns
- Anything after you're defeated (win or lose)
- Anything while spectating

---

## In-game controls

### Bottom-right buttons (during a match)

Two buttons appear in the options bar next to PA's standard icons:

| Button | What it does |
|---|---|
| **PS** | Master toggle. Cyan = recording. Grey = paused. Skip recording a specific game without disabling the mod. |
| **LITE** | Performance mode. Skips camera capture and drops most unit events. Use on low-end machines or 32-player FFAs. |

Both buttons can be hidden via the settings page.

### Settings page — Settings → "PA Stats Metrics" tab

A dedicated tab in PA's main Settings menu. Casual view shows ~14 rows; toggle **"Show advanced settings" → ON**, click **Save & Exit**, then reopen Settings to reveal the rest (~12 more advanced rows).

#### Master toggles
- **Mod enabled** — same as the PS button.
- **Lite (performance) mode** — same as the LITE button.
- **Show advanced settings** — reveals advanced rows on next reopen. *(Does not work yet.)*

#### Data collection
Pick which event types to record. Turning things off shrinks payloads and DB usage at the cost of less detailed stats.
- Unit creation / death / idle / sight / target destroyed / arrival / allied death
- **Building position snapshot** — keeps the 3D base view complete
- **Early-game / late-game poll intervals + cutoff** *(advanced)* — how often we poll your buildings (default: every 10s for the first 15 min, then every 15s)

#### Performance
- **Watchlist buffer cap (events / cycle)** — max unit events buffered between each 5s send. Lower = lighter on RAM and network. Higher = better stats fidelity in big battles. Default 300, range 0–1000.
- **Enrich alive units with order/HP** *(advanced)* — fetches order type + HP for spotted units. Extra engine calls.
- **Watchlist unit categories** *(advanced)* — All / Mobile / Buildings / Recon only.

**If you encounter performance issues, try in this order:**

1. Reduce the watchlist buffer cap from 300 to 100–50 and test.
2. Disable IDLE events and test.
3. If still not enough, disable IDLE, SIGHT, ARRIVAL, ALLIED DEATH, UNIT DEATH, UNIT CREATION and test.
4. Disable everything except **Record Kill Credit Events** — it's a cool stat and costs nothing (triggers only once per kill).

#### In-game UI
- **Show PS / LITE buttons in options bar** — hide them if you don't want them in your view.

#### Network / privacy *(advanced)*
- **Backend URL** — Default (pastatsmetrics.com) or Local dev (127.0.0.1).

### Live reload

Change any setting mid-match → press **F5** to make sure changes are applied.

---

## Wishlist

- Default settings record everything needed to compute stats over anything — it's stats paradise.
- Will include **SOON** the 126,000 matches from 2018 to 2021 recorded by the old SuperStats.

**What stats do you want to see? Share!**
