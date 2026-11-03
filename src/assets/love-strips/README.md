# Illustrated Love frames

Ten original romantic designs generated with the built-in image generation tool. `prompts.md` records the final prompts. Theater of Us is a burgundy-and-cream theater admission ticket inspired by the supplied reference, using PhotoBooth branding.

Original PNG masters remain in `output/love-strips/masters/`. Full-resolution WebP copies use quality 0.92, and 360px preview copies use quality 0.88. Exports preserve the original pixels and alpha; no synthetic artwork was substituted.

`manifest.json` records dimensions and measured photo rectangles. Where generated artwork contains a pale photo matte (`photosOnTop`), the application paints real photos over those rectangles to keep the image clear. Other frames use their transparent openings. Grids and irregular layouts preserve whole header/footer illustrations and use matching photo borders.

All ten templates are Premium and appear first in the Love category. Apply `supabase/migrations/013_illustrated_love_templates.sql` to synchronize the database catalog.
