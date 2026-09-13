# Doomsday — Full Recode

This is a clean replacement frontend for `zcarypricington.github.io`.

## Preserved functionality

- Hidden educational landing screen
- `E` key archive activation
- Search and category filtering
- Game cards generated from `games.json`
- Local and remote game URLs
- Fullscreen game player
- Request modal + existing Google Apps Script endpoint
- Local request fallback
- Persistent local settings
- 8 themes
- Grid size controls
- Rain / snow / matrix / stars / constellation / particle effects
- Reduce-motion setting
- Fullscreen-on-play
- Confirm-before-close
- Tab title/favicon cloaking
- Cloaked `about:blank` window
- Background music toggle
- Responsive layout

## Deployment

Replace the existing `index.html`, `styles.css`, and `script.js` in the repository with these files.

Keep the existing `g/` directory and `games.json`, because the game HTML files and thumbnails live there.

No build step is required. It remains a static GitHub Pages site.

## Notes

The game data currently remains externalized in `games.json`, so adding/removing games does not require changing the JavaScript.
