# Illustrated Halloween strip frames

Ten original designs generated for PhotoBooth using the built-in image generation tool with transparency enabled. Full prompts are in `prompts.md`.

The full WebP files preserve alpha and native resolution, exported from the generated PNG masters at quality 0.92. The 360px preview copies use quality 0.88 and load in thumbnail and editor previews; downloads use the full assets. Masters and the review gallery remain in `output/halloween-strips-collection-2/`. Only browser assets are used by the application.

`manifest.json` records native sizes, file sizes, and measured photo opening bounds. These bounds were found from connected transparent regions in the original assets and are consumed by `src/templates/halloweenIllustrated.js`.

The classic four-photo format uses the complete original artwork. Other layouts preserve the header/footer illustrations at their original proportions and use matching photo borders, keeping characters intact rather than slicing stickers across cells. Photos and filters share the same renderer for still photos, Live Strip frames and LDR exports. The new templates remain Premium; `supabase/migrations/012_illustrated_halloween_templates.sql` updates the database catalogue to match.
