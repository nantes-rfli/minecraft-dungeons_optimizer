# Enchantment ownership and UI sources

The owned-item model records one to three candidate IDs per slot and an optional
selected ID plus Tier. Candidate tiers are deliberately not stored. Gilded and
catalog built-in enchantments remain separate concepts.

## Japanese names

The Japanese display table is primarily paired by localization key between the
bundled Minecraft Dungeons 1.17.0.0 resources:

- `Dungeons/Content/Localization/Game/en/Game.locres`
- `Dungeons/Content/Localization/Game/ja-JP/Game.locres`

The cooked localization contains 91 of the 97 player enchantments in the
canonical catalog. Existing verified project terminology fills Ambush. The
remaining established Japanese names are taken from the official Japanese
Minecraft September update article (Bag of Souls and Tumblebee) and the existing
Japanese MCD reference list (Dipping Poison, Luck of the Sea, and Shadow Surge).
No machine translation is used.

## Artwork and diamond frame

The four enchantments whose Melee and Ranged definitions reference different
textures are exported separately and selected by category. All other entries use
their canonical icon.

The game-data search also located the cooked slot materials under
`Dungeons/Content/UI/Materials/Inventory2/Enchantment/Slots`, including
`BaseSlot_common`, `BaseSlot_powerful`, `BaseSlot_HOVER`, and the `Pickslot_*`
materials. They are cooked material packages rather than an independently
verifiable frame texture, so they were not presented as a confirmed visual asset.
The shared diamond component therefore uses the real enchantment icon inside an
accessible CSS frame with explicit Common/Powerful text and visible focus and
selected states.
