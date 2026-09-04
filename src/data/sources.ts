import type { SourceReference } from '../core/types'

export const DUNGEONS_TOOLS_SOURCE: SourceReference = {
  id: 'dungeons-tools-1.17-tier-list',
  label: 'dungeons.tools: Minecraft Dungeons 1.17.0.0 game-file weapon data',
  url: 'https://www.dungeons.tools/tier-list',
  kind: 'game-files',
}

export const DUNGEONS_TOOLS_DAMAGE_CALCULATOR_SOURCE: SourceReference = {
  id: 'dungeons-tools-1.17-damage-calculator',
  label: 'dungeons.tools: 1.17.0.0 internal Power rating and common Gear Power curve',
  url: 'https://www.dungeons.tools/damage-calculator',
  kind: 'game-files',
}

export const MINECRAFT_WIKI_ENCHANTMENTS_SOURCE: SourceReference = {
  id: 'minecraft-wiki-enchantments',
  label: 'Minecraft Wiki: Dungeons enchantments (in-game descriptions and community tests)',
  url: 'https://minecraft.wiki/w/Dungeons:Enchantment',
  kind: 'community-test',
}

export const MINECRAFT_WIKI_VOID_STRIKE_SOURCE: SourceReference = {
  id: 'minecraft-wiki-void-strike-mechanics',
  label: 'Minecraft Wiki: Void Strike tiers, reset, and other-damage consumption',
  url: 'https://minecraft.wiki/w/Dungeons%3AVoid_Strike',
  kind: 'published-reference',
}

export const DUNGEONS_TOOLS_ENCHANTMENTS_SOURCE: SourceReference = {
  id: 'dungeons-tools-enchantments-1.17',
  label: 'dungeons.tools: 1.17.0.0 enchantment data and in-game descriptions',
  url: 'https://www.dungeons.tools/enchantments',
  kind: 'game-files',
}

export const SHARPNESS_SOURCE: SourceReference = {
  id: 'dungeons-tools-sharpness-1.17',
  label: 'dungeons.tools: Sharpness tiers, melee applicability and multiplicative copies (1.17.0.0)',
  url: 'https://www.dungeons.tools/enchantments/sharpness',
  kind: 'game-files',
}

export const UNCHANTING_SOURCE: SourceReference = {
  id: 'dungeons-tools-unchanting-1.17',
  label: 'dungeons.tools: Unchanting tiers, enchanted target condition and non-stackable flag (1.17.0.0)',
  url: 'https://www.dungeons.tools/enchantments/unchanting',
  kind: 'game-files',
}

export const REFRESHMENT_SOURCE: SourceReference = {
  id: 'dungeons-tools-refreshment-1.17',
  label: 'dungeons.tools: Refreshment tier reductions and non-stackable flag (1.17.0.0)',
  url: 'https://www.dungeons.tools/enchantments/refreshment',
  kind: 'game-files',
}

export const REFRESHMENT_KILL_SOURCE: SourceReference = {
  id: 'dungeons-tools-refreshment-direct-kills',
  label: 'dungeons.tools: Refreshment direct weapon kill condition (published mechanics prose)',
  url: 'https://www.dungeons.tools/enchantments/refreshment',
  kind: 'published-reference',
}

export const REFRESHMENT_EXCLUSIONS_SOURCE: SourceReference = {
  id: 'community-refreshment-indirect-kills',
  label: 'Community report: enchantment proc/DoT kills do not trigger direct-kill enchantments',
  url: 'https://www.reddit.com/r/MinecraftDungeons/comments/1dml95h/enchantments_interfering/',
  kind: 'community-test',
}

export const HEALTH_POTION_SOURCE: SourceReference = {
  id: 'minecraft-wiki-health-potion',
  label: 'Minecraft Wiki: Health Potion, 45-second cooldown and approximately 75% healing',
  url: 'https://minecraft.wiki/w/Dungeons%3AHealth_Potion',
  kind: 'published-reference',
}

export const WEAKENING_SOURCE: SourceReference = {
  id: 'dungeons-tools-weakening-1.17',
  label: 'dungeons.tools: Weakening tiers and nearby-enemy five-second description (1.17.0.0)',
  url: 'https://www.dungeons.tools/enchantments/weakening',
  kind: 'game-files',
}

export const WEAKENING_STACKING_SOURCE: SourceReference = {
  id: 'minecraft-wiki-weakening-stacking',
  label: 'Minecraft Wiki: Weakening is non-stackable across normal, gilded and unique slots',
  url: 'https://minecraft.wiki/w/Dungeons%3AWeakening',
  kind: 'published-reference',
}

export const COMMUNITY_VOID_STRIKE_MEASUREMENTS_SOURCE: SourceReference = {
  id: 'community-void-strike-2021-damage-table',
  label: 'Community target-dummy test: Void Strike tiers and attack-speed damage table',
  url: 'https://www.reddit.com/r/MinecraftDungeons/comments/phyg2p/',
  kind: 'community-test',
}

export const COMMUNITY_VOID_STRIKE_CURVE_SOURCE: SourceReference = {
  id: 'community-void-strike-2023-curve-discussion',
  label: 'Community timing discussion: 1.25× minimum, linear ramp, and 3.6 s maximum',
  url: 'https://www.reddit.com/r/MinecraftDungeons/comments/16o226x/',
  kind: 'community-test',
}

export const COMMUNITY_VOID_STRIKE_EXPIRATION_SOURCE: SourceReference = {
  id: 'community-void-strike-2023-expiration-test',
  label: 'Community mechanics test: approximately 3.5 s to maximum and 5 s expiration',
  url: 'https://www.reddit.com/r/MinecraftDungeons/comments/15xk3z1/',
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

export const MINECRAFT_WIKI_SHOCK_POWDER_SOURCE: SourceReference = {
  id: 'minecraft-wiki-shock-powder',
  label: 'Minecraft Wiki: Shock Powder cooldown, stun semantics, and four Power-duration samples',
  url: 'https://minecraft.wiki/w/Dungeons%3AShock_Powder',
  kind: 'published-reference',
}

export const SHOCK_POWDER_TARGET_MODEL_SOURCE: SourceReference = {
  id: 'model-shock-powder-target-coverage',
  label: 'Scenario assumption: Shock Powder eligibility and affected-target shares',
  kind: 'model-assumption',
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

export const MINECRAFT_WIKI_FIGHTERS_BINDINGS_POWER_SOURCE: SourceReference = {
  id: 'minecraft-wiki-fighters-bindings-power-table',
  label: "Minecraft Wiki: Fighter's Bindings Power damage table (revision 2959833)",
  url: 'https://minecraft.wiki/w/Dungeons%3AFighter%27s_Bindings?oldid=2959833',
  kind: 'published-reference',
}

export const MINECRAFT_WIKI_DOUBLE_AXE_POWER_SOURCE: SourceReference = {
  id: 'minecraft-wiki-double-axe-power-table',
  label: 'Minecraft Wiki: Double Axe Power damage table (revision 3004051)',
  url: 'https://minecraft.wiki/w/Dungeons%3ADouble_Axe?oldid=3004051',
  kind: 'published-reference',
}

export const COMMUNITY_FIGHTERS_BINDINGS_POWER_251_SOURCE: SourceReference = {
  id: 'community-fighters-bindings-power-251-card-range',
  label: "Community item-card report: Fighter's Bindings at Power 251",
  url: 'https://www.reddit.com/r/MinecraftDungeons/comments/o8no8d/',
  kind: 'community-test',
}

export const MVP_MODEL_SOURCE: SourceReference = {
  id: 'mvp-model-v0.1',
  label: 'Optimizer modelling assumption; replace with frame-timed measurements',
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
