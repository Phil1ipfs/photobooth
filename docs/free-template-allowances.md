# Free template allowances

Each account can create two photo strips and two Live Strips on each of these
five designs: Classic, Love Hearts, Polaroid, Vintage Film and Pink Pop.
There are 20 strips in total. Usage is lifetime and survives deletion. Existing
free creations count toward their design's photo allowance; saved legacy Live
Strips are classified as live. Premium and admin accounts remain unlimited.

The allowance counts a strip creation, not each picture slot. Retakes within an
unexported draft do not consume another strip. Downloading the same completed
composition again is free. Exporting a different composition needs a new claim.
Photo and Live claims are separate; switching mode or template cannot transfer
a claim into another quota. Each browser draft retains its own claim while the
user switches between designs and modes.

## Activation order

1. Apply `supabase/migrations/014_free_template_allowances.sql` to the existing
   project after migration 013. It is transactional and safe to run again.
2. Run `supabase/tests/free_template_allowances_test.sql` in that project's SQL
   editor. It checks all 20 allowed strips, a third capture in every bucket,
   repeated downloads, invalid types, ownership, paid designs/layouts, existing
   usage, compatibility endpoints and unlimited Premium use. It rolls back all
   its synthetic test accounts and creations.
3. Deploy the matching frontend. The new app uses the mode-aware claim/finalize
   RPCs and needs migration 014. Do not publish the new allowance copy before
   applying the migration.

The old RPC signatures remain as compatibility wrappers. Previously open tabs
claim photo strips against the same per-design limit. Cloud saving, LDR, music,
sharing, printing, advanced layouts, premium filters and HD remain Premium.

## Verification

`npm test -- --watchAll=false --runInBand` checks frontend permissions, catalogue
consistency, scoped draft reuse, RPC arguments, usage counters and the other
existing behaviors. `npm run build` produces the browser build.
