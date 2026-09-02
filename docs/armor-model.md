# Armor model — Phase 2-3A foundation

## Scope

Phase 2-3A audits the Armor subsystem without making any Armor selectable. `Build`, inventory, `evaluate`, `evaluateCandidate`, `optimize`, Pareto output, and the current melee/Artifact catalogs are unchanged. The runtime support manifest is therefore Full 0 / Limited 0 / Research-only 73. An Armor whose major intrinsic property is not evaluated is never registered as a health-only or zero-effect candidate.

The type-only foundation lives in `src/core/armor.ts`. It is not a runtime catalog.

## Definition and owned instance

`ArmorDefinition` holds the stable family, Soul legality, intrinsic properties, and unique built-in enchantments. Rarity is not a score multiplier: a unique is evaluated through its additional property or built-in effect only.

`OwnedArmor` holds the actual item:

- `instanceId`, `armorId`, and visible `powerLevel`;
- direct card `observedHealthBonus`;
- normal selectable `EquipmentEnchantmentSlot<ArmorEnchantmentId>` values;
- a separate gilded enchantment and Tier I/II/III;
- optional `actualIntrinsicRolls` for Mystery Armor and future variable-property items.

Normal slot choices, unique built-ins, and gilded enchants are different sources. A unique built-in is not converted to a gilded enchantment, and one property is not counted both as family inheritance and unique-only.

## Family inheritance

The audit preserves `baseArmorId`, inherited property facts, and unique-only facts. For example, Renegade Armor inherits Mercenary Armor's weapon-damage aura and 35% damage reduction, then adds melee attack speed. Seasonal reskins are normalized to the Wiki family even where the primary index presents them as standalone entries.

Mystery Armor is not a fixed definition. A future owned instance must carry its actual positive rolls and optional negative roll. The optimizer must reject a Mystery candidate that lacks those rolls rather than substituting an average property set.

## Health state

The proposed source union is mutually exclusive:

```ts
type HealthSource =
  | { kind: 'legacy-scenario'; maxHealth: number }
  | { kind: 'armor-observed'; armorHealthBonus: number }
  | { kind: 'armor-model'; armorHealthBonus: number; powerLevel: number; modelId: string }
```

The terms are `baseHeroHealth`, `armorHealthBonus`, `preModifierMaxHealth`, and `finalMaxHealth`. The existing `scenario.maxHealth` remains a legacy explicit final-health override and is not added to an Armor route. `resolveHealthState` validates this isolated contract, but the current evaluator deliberately continues to use `scenario.maxHealth`.

## Defense integration

Current Defense is unchanged:

```text
Weakening enemy outgoing multiplier
× Artifact hero multiplier (Iron Hide)
× Guarding Strike uptime multiplier
= final damageTakenMultiplier
```

Weakening is enemy outgoing damage; Iron Hide and Guarding Strike are hero defense stages. The current numeric multiplication is a time-average approximation and does not establish that every future Armor source belongs to the same game bucket.

Before adding 35% Armor damage reduction, Phase 2-3B must specify a named Armor stage and verify normal combinations with Iron Hide, Potion Barrier, Guarding Strike, Weakening, and Protection. Public evidence already disproves simple addition. Protection Tier III plus 35% Armor reduction is reported around 41.65% total, while other community results disagree on a universal formula. Phase 2-3A records the conflict and does not change `calculateDefense`.

Chance to negate hits remains a discrete hit/proc family. It is not converted to expected 30% damage reduction because doing so would erase burst survival and low-HP trigger timing. Potion Barrier is a potion-triggered duration, not a permanent multiplier.

## Damage and attack speed

Armor melee damage, weapon-damage aura, and attack speed keep separate ownership:

- melee damage is not assumed to share Sharpness' stage;
- weapon-damage aura must resolve self/party scope and melee/ranged eligibility;
- Armor attack speed must be placed relative to Death Cap Mushroom and Rampaging only after bucket evidence;
- artifact damage is not scored while the corresponding Artifact damage is Research-only;
- ranged damage and arrow economy wait for the ranged subsystem.

## Cooldown integration

Future Artifact cooldown state separates:

```text
external Scenario reduction
Armor intrinsic reduction
Armor enchant reductions
future Cooldown Shot events
effective multiplier
```

Battle Robe's -40% intrinsic reduction and Cool Down are reported to multiply rather than add. This does not authorize merging either with `scenario.cooldownReduction`. Potion cooldown likewise keeps base cooldown, Armor intrinsic, and Refreshment direct-kill seconds as separate sources.

## Healing, Soul, and events

Life-steal aura can reuse Damage and Healing only after eligible sources are explicit: direct melee, ranged, Artifact, enchantment proc, DoT, and explosion. Party potion healing is not credited to solo Hero healing.

The Soul model can hold capacity, pickup count, resource units, spending, and overflow, but `+50% souls gathered` is not replaced with a flat `+1 Gathering`. Armor Soul legality (`acceptsSoulEnchantments`) and intrinsic Soul modification remain separate.

Potion-to-Artifact reset, Final Shout, roll triggers, pets, threat, and position-dependent auras need their own state/event ownership. They are not flattened into DPS or Defense.

## Optimizer growth

The first batch adds three owned Armor candidates, so it multiplies current weapon choices by three before Artifact choices. It must enumerate only owned Armor instances and their legal fixed/candidate slots. It must not generate the theoretical cross product of 41 Armor enchantments. Worker optimization remains Phase 3 work.

## Phase 2-3B gate

The selected Armor candidates are Battle Robe, Renegade Armor, and Wither Armor. The selected enchantments are Cool Down, Potion Barrier, and Chilling. Each needs direct `observedHealthBonus`; unsupported combinations must be rejected with a reason. Build and inventory receive Armor only when the batch can evaluate every major property or state a concrete Limited boundary.
