# Decomp List

A clean, searchable page for [Luna's Decompilation List](https://github.com/ooooorion/Luna-s-Decompilation-List), with every game in one list (no human-made / AI-made split).

**How it stays current**

- The page reads the upstream README live on every visit, so new entries show up right away.
- An hourly GitHub Action also copies it into `list.md`, which the page falls back to if the live fetch fails.

Plain HTML, CSS and JS, no build step. Served by GitHub Pages from `main`.
