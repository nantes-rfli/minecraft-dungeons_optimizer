# Armor health evidence and migration

## Conclusion

The runtime primary route is the exact `+X health` value observed on an owned Armor card. Phase 2-3B connects this route to evaluation and optimization. A Power-only fallback is unavailable for the current endgame range, and no midpoint is imputed.

## Evidence

Public sources report base Hero maximum health as 100 and Armor cards as `+X health`. Four separate Armor families publish the same min/max table from Power 1 through 108; Hero's Armor adds a Power 113 row. This supports a shared low-Power curve hypothesis, but not a current endgame formula.

The checked snapshot contains 27 numeric rows:

- 23 canonical min/max rows at Power 1–108;
- one additional Hero's Armor row at Power 113;
- three exact community card observations at Power 251.

At the same visible Power 251, Sturdy Shulker Armor reports +1,882,725 and Rugged Climbing Gear +1,855,307, a spread of 27,418. Renegade Armor independently reports +1,880,317. Visible Power therefore does not uniquely identify exact health, consistent with a hidden internal roll or upgrade position.

One Wither Armor search snapshot reports a Power 108 maximum of 9,987 where the other family tables report 5,921. The audit preserves this as a source conflict and excludes it from the canonical table.

## Runtime policy

```text
observedHealthBonus present
  -> use the direct card value

otherwise, validated model and Power inside its validated range
  -> use the model result

otherwise
  -> candidate unsupported
```

`observedHealthBonus` must be finite and non-negative. A future model envelope may warn about an unusual value but must not hard-reject a direct observation. An observed value and a model value are alternatives, not additive inputs.

The current evidence has only three endgame samples at one Power. It does not cover the target 210–263 range well enough to enable `armor-model`, so `modelFallbackAvailable` remains false and extrapolation is forbidden.

## Scenario migration

`scenario.maxHealth` is retained only for Armor-less legacy builds. It cannot be combined with Armor-derived health; the Armor UI disables that input while Armor candidates are registered.

Armor evaluation computes:

```text
baseHeroHealth = 100
armorHealthBonus = observed card value or validated model output
preModifierMaxHealth = baseHeroHealth + armorHealthBonus
finalMaxHealth = preModifierMaxHealth
```

Life Boost and trial ordering remain future work. The resolved maximum feeds Healing, Pain Cycle, Potion, Defense/EHP, and Soul/Anima. Equivalent legacy and Armor routes are regression-tested, while all Armor-less baseline digests remain exact.

Machine-readable samples and provenance are in `research/armor-health-audit.json`.
