# Romantic Halloween LDR asset pack

Prepared from the supplied LDR lobby design reference. The optimized artwork is used by `src/components/ldr/LdrLobbyArtwork.jsx` and styled by `src/styles/ldr-lobby.css`. The scene is scoped to the LDR lobby; the existing room/camera interface and Premium gate keep their current behavior.

## Design analysis

The image uses a cinematic, romantic Halloween setting. The interface stays centered in a quiet, almost-black plum area. Environmental detail frames the outside: moon and branches above-right, pumpkins and candles below-left, and an ivy-covered fence with a lantern below-right. The wet stone floor catches low amber reflections and gives the scene depth.

The two lighting sources establish the mood: muted rose moonlight from above-right, and amber candlelight from the lower corners. Burgundy foliage ties those colors together. Hearts are small romantic accents; bats and leaves remain peripheral so the room controls are readable.

Approximate palette: charcoal plum `#170f14`, deep oxblood `#2a1820`, rose `#ad3156`, pink accents `#e77997`, warm amber `#f2913c`, ivory text `#f9e9ee`.

The frosted center card, header/logo, typography, inputs and buttons should use the existing HTML/CSS/components. The double-heart emblem is provided as artwork. Small bats, hearts and embers use SVG assets consistent with the app's existing vector icon style.

## Generated artwork

All eight illustrations were generated with the **built-in imagegen tool**, using the attachment as a style and composition reference. The six foreground illustrations have genuine alpha transparency. PNG masters are retained locally in `masters/` and in the exported asset ZIP; they are not part of the production source commit. Optimized website files are WebP. Exact final prompts are in [generation-prompts.json](generation-prompts.json).

| Web asset | Size | Placement and purpose |
| --- | --- | --- |
| [forest-desktop.webp](forest-desktop.webp) | 1672 × 941 | Landscape background: fog, edge trees and wet paving; clear center |
| [forest-mobile.webp](forest-mobile.webp) | 900 × 1599 | Portrait background with a larger quiet central region |
| [pumpkins-candles.webp](pumpkins-candles.webp) | 1100 × 733 | Heart-eyed pumpkin pair, two candles and maple leaves; lower-left |
| [fence-lantern.webp](fence-lantern.webp) | 900 × 1125 | Wooden fence, hanging lantern and ivy; lower-right |
| [maple-branch.webp](maple-branch.webp) | 1200 × 800 | Overhead branch framing the upper-right edge |
| [rose-moon.webp](rose-moon.webp) | 640 × 427 | Full rose moon with a transparent halo, behind the branch |
| [crimson-maple-leaf.webp](crimson-maple-leaf.webp) | 512 × 341 | Reusable loose leaf; scale and rotate individual instances |
| [double-heart.webp](double-heart.webp) | 320 × 320 | Pink paired-heart emblem above the lobby title |

Four smaller foreground exports are included for phones:

- `pumpkins-candles-mobile.webp` — 600 × 400
- `fence-lantern-mobile.webp` — 500 × 625
- `maple-branch-mobile.webp` — 640 × 427
- `rose-moon-mobile.webp` — 320 × 213

## SVG details

- [bat.svg](bat.svg): dark silhouette; reuse at varied scales, angles and opacities.
- [floating-heart.svg](floating-heart.svg): rose heart with a soft, transparent glow.
- [heart-outline.svg](heart-outline.svg): optional small hand-drawn heart accent.
- [ember.svg](ember.svg): tiny light particle with a transparent radial falloff.
- [sparkle.svg](sparkle.svg): optional four-point warm glint.

These are code-native vector assets, not additional imagegen outputs. They reuse the established bat/heart/sparkle shapes from the app where applicable.

## Composition and responsive guidance

Layer order, back to front:

1. Forest background, including mist and the wet floor.
2. Rose moon and distant bats.
3. Overhead branch and foreground fence.
4. Pumpkins/candles and sparse loose leaves.
5. Small hearts and embers around the edges.
6. The real LDR card and its controls, always above decorative layers.

The foreground assets include their own glow or shading; keep any additional CSS glow subtle. The moon's disc occupies part of its transparent canvas, so size and position the visible disc rather than assuming the image box is the disc. The branch intentionally reaches the upper-right boundary.

For a phone, use the portrait backdrop and smaller foreground exports. Reduce the branch width and foreground prop sizes, keep the moon in the upper-right, and keep the form clear of all imagery. The original design is a portrait composition; the separate landscape background avoids cropping away important scene elements on desktop.

Decorative layers should use `aria-hidden="true"` and `pointer-events: none`. Any drifting hearts, leaves, candle shimmer or embers should respect `prefers-reduced-motion`. The preview is static so the asset relationships are easy to review.

Website use should import only WebP/SVG files, not the PNG masters. The larger and smaller exports are alternatives, not files that all need to load together.

## Review and source files

The local asset export includes `preview.html`: a layered scene, desktop/phone preview buttons, and a checkerboard catalog for transparency review. Its dashed center region is an asset-review guide. The implemented lobby uses the real form and room controls. The preview and PNG masters remain in the local/full ZIP export rather than the production source commit.

- `masters/*.png`: eight original generated PNGs, copied into this project.
- `generation-prompts.json`: exact prompt set and generation method.
- `generation-sources.json`: portable mapping between PNG masters and WebP exports.
- `manifest.json`: output dimensions, byte sizes and source alpha measurements.
- `validation.json`: browser decode, output transparency and preview verification.

Only optimized WebP/SVG images are imported by the live interface. Desktop and phone picture sources load according to viewport width; the forest also switches to its portrait composition on tall screens. Decorative images cannot intercept pointer events, and particle motion stops with reduced-motion preferences.
