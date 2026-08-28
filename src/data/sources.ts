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
