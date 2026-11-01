# Friendly Halloween account-page artwork

The supplied reference uses a warm cream screen, deep burgundy branding and buttons, softly tinted pink form fields, a delicate corner cobweb, and a cheerful storybook Halloween garden below the account form. Pink hearts, four-point sparkles and small red/orange leaves keep the composition playful. The browser layout uses the reference's inner screen composition and adapts to desktop and phone widths.

The real logo, typography, Google icon, forms and controls remain code-native. The existing login, signup, password visibility, password reset, consent and redirect logic is preserved. `AuthLayout` provides the shared presentation for account pages; `AuthArtwork` supplies only decorative layers. The garden follows the form/footer in document flow, so it cannot overlap longer signup forms or validation messages.

## Generated assets

Created using the **built-in imagegen tool**, with the user's attachment as the style reference. All four illustrations have genuine transparency. The original PNGs are retained locally in `masters/`; production uses only the optimized WebP files. Exact prompts are in [generation-prompts.json](generation-prompts.json), and dimensions/alpha checks are in [manifest.json](manifest.json).

| Asset | Web dimensions | Use |
| --- | --- | --- |
| [witch-ghost.webp](witch-ghost.webp) | 480 × 439 | Smiling ivory ghost with a burgundy witch hat and blush cheeks |
| [smiling-pumpkin.webp](smiling-pumpkin.webp) | 400 × 400 | Friendly orange pumpkin with warm carved features |
| [heart-lantern.webp](heart-lantern.webp) | 260 × 284 | Burgundy lantern with warm glass and a glowing heart |
| [foliage-border.webp](foliage-border.webp) | 1200 × 400 | Layered shrubs, autumn leaves and bare trees framing the footer |

The four WebP illustrations total about 164 KB. PNG masters are local source assets and are not included in the production source commit.

## Vector details

- [cobweb.svg](cobweb.svg): pink corner web with a hanging burgundy heart.
- [maple-leaf-red.svg](maple-leaf-red.svg): small red leaf accent.
- [maple-leaf-orange.svg](maple-leaf-orange.svg): small orange leaf accent.
- Hearts and sparkles use the existing `DoodleHeart` and `Sparkle` components for consistency with the rest of PhotoBooth.

These SVG details are deterministic code-native artwork, not additional imagegen outputs. All decoration is hidden from assistive technology and ignores pointer input. The scene is static and adds no continuous animation.
