import type { SourceReference } from '../core/types'

export const DUNGEONS_TOOLS_SOURCE: SourceReference = {
  id: 'dungeons-tools-1.17-tier-list',
  label: 'dungeons.tools: Minecraft Dungeons 1.17.0.0 game-file weapon data',
  url: 'https://www.dungeons.tools/tier-list',
  kind: 'game-files',
}

export const MINECRAFT_WIKI_ENCHANTMENTS_SOURCE: SourceReference = {
  id: 'minecraft-wiki-enchantments',
  label: 'Minecraft Wiki: Dungeons enchantments (in-game descriptions and community tests)',
  url: 'https://minecraft.wiki/w/Dungeons:Enchantment',
  kind: 'community-test',
}

export const MINECRAFT_WIKI_DEATH_CAP_SOURCE: SourceReference = {
  id: 'minecraft-wiki-death-cap',
  label: 'Minecraft Wiki: Death Cap Mushroom',
  url: 'https://minecraft.wiki/w/Dungeons:Death_Cap_Mushroom',
  kind: 'community-test',
}

export const MINECRAFT_WIKI_IRON_HIDE_SOURCE: SourceReference = {
  id: 'minecraft-wiki-iron-hide',
  label: 'Minecraft Wiki: Iron Hide Amulet',
  url: 'https://minecraft.wiki/w/Dungeons:Iron_Hide_Amulet',
  kind: 'community-test',
}

export const MINECRAFT_WIKI_FIGHTERS_BINDINGS_SOURCE: SourceReference = {
  id: 'minecraft-wiki-fighters-bindings-stats',
  label: "Minecraft Wiki: Fighter's Bindings per-hit Stats table",
  url: 'https://minecraft.wiki/w/Dungeons%3AFighter%27s_Bindings',
  kind: 'published-reference',
}

export const MINECRAFT_WIKI_DOUBLE_AXE_SOURCE: SourceReference = {
  id: 'minecraft-wiki-double-axe-stats',
  label: 'Minecraft Wiki: Double Axe per-hit Stats table',
  url: 'https://minecraft.wiki/w/Dungeons%3ADouble_Axe',
  kind: 'published-reference',
}

export const MINECRAFT_WIKI_ANCHOR_SOURCE: SourceReference = {
  id: 'minecraft-wiki-anchor-stats',
  label: 'Minecraft Wiki: Anchor per-hit Stats table',
  url: 'https://minecraft.wiki/w/Dungeons%3AAnchor',
  kind: 'published-reference',
}

export const MINECRAFT_WIKI_ANCHOR_POWER_CURVE_SOURCE: SourceReference = {
  id: 'minecraft-wiki-anchor-power-curve',
  label: 'Minecraft Wiki: Anchor Power 50–263 damage table',
  url: 'https://minecraft.wiki/w/Dungeons%3AAnchor',
  kind: 'published-reference',
}

export const MVP_MODEL_SOURCE: SourceReference = {
  id: 'mvp-model-v0.1',
  label: 'Optimizer v0.1 modelling assumption; replace with frame-timed measurements',
  kind: 'model-assumption',
}

export const COMMUNITY_ARTIFACT_STACKING_SOURCE: SourceReference = {
  id: 'community-artifact-refresh-test',
  label: 'Community test: duplicate temporary artifact effects refresh instead of stacking',
  url: 'https://www.reddit.com/r/MinecraftDungeons/comments/nrc4on/do_ironhide_amulets_stack/',
  kind: 'community-test',
}

export const COMMUNITY_RADIANCE_STACKING_SOURCE: SourceReference = {
  id: 'community-radiance-stacking-test',
  label: 'Community tests: Radiance healing stack is 100% / 175% / 225% / 250%',
  url: 'https://www.reddit.com/r/MinecraftDungeons/comments/he5bsy/some_weaponarmour_enchantment_stacking_numbers/',
  kind: 'community-test',
}
