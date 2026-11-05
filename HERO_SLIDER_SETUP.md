# Top Cloud hero slider

Use the numbered SQL files under `supabase/setup/`, following [SUPABASE_SETUP_GUIDE.md](SUPABASE_SETUP_GUIDE.md). Historical migrations that authorized every signed-in account are intentionally not included.

Hero settings, slides, text positioning, ordering, active flags, autoplay and timing retain the original dashboard workflow. Save Draft and Publish use an atomic database RPC. Only explicitly enrolled administrators can edit. Anonymous visitors receive only active published slides, and cannot read inactive or draft slides.

The public Top Cloud hero keeps its existing classes and transitions. It reads the published snapshot, with the original Top Cloud three-slide carousel shown until the first publication. An intentionally empty published slider hides the hero. Draft uploads are publicly addressable marketing assets; do not upload confidential files.

Local checks: `npm test`. Real Supabase Storage transport, Realtime and desktop/mobile visual playback still require verification against the new project. The browser automation tool could not determine Chrome's URL, so visual QA was not completed in this session.
