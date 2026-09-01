# Artifact Soul batch — Phase 2-2C

Phase 2-2C is complete at the resource-architecture and Evidence-decision level. Runtime remains 3 / 45 (Full 2, Limited 1, Research-only 42): none of the three candidates passed the no-extrapolation gate.

## Soul Healer

[dungeons.tools 1.17.0.0](https://www.dungeons.tools/artifacts/soul-healer) and the [1.3.2.0 history](https://minecraft.wiki/w/Dungeons:1.3.2.0) support a 5-second cooldown, 50 Souls/use and +1 Gathering. It can activate at full HP and targets the most injured nearby ally, including self; solo therefore implies self-targeting, while co-op would require an editable self-target share.

The 23 published healing rows cover only Power 1–108 and are not versioned into a usable 1.17 curve. Their nested min/max/range cells cannot be proven to describe the fixed-50-Soul current random distribution. No Power 210–263 extrapolation is permitted, so Soul Healer remains Research-only. Consequently no `soulHealerSelfTargetShare` scenario field or nominal healing is registered yet.

## Harvester

The [Minecraft Wiki page](https://minecraft.wiki/w/Dungeons:Harvester) and 1.3.2.0 history report 4 seconds, while the preferred 1.17 database reports 8 seconds. Cost 40, +1 Gathering, equal damage across affected AoE targets and “Harvester kills drop no Souls” are supported. The four Power 17/53/65/109 samples are historical and do not establish a current high-Power curve.

Runtime would require an `artifact-damage` channel, explicit AoE targets, source-attributed kills and a fixed point that excludes Harvester kills from eligible Soul income. The cooldown conflict, curve and target/feedback calibration remain blockers, so it is Research-only.

## Lightning Rod

[dungeons.tools 1.17.0.0](https://www.dungeons.tools/artifacts/lightning-rod) reports 4 seconds; the [Wiki page](https://minecraft.wiki/w/Dungeons:Lightning_Rod) and 1.3.2.0 history report 2 seconds. Cost 15 and +1 Gathering are supported. A delayed aimed strike with small AoE is qualitatively supported, but exact current delay, successful-target share and whether its kills generate Souls are unresolved. Seven damage rows stop at Power 114 and have no verified current distribution.

Runtime would credit only strikes landing inside the encounter, keep use actions separate from hit success, and solve any Soul/kill feedback only after kill eligibility is known. It remains Research-only.

The machine-readable decision record is [`research/artifact-soul-batch-audit.json`](../research/artifact-soul-batch-audit.json); scheduler details are in [Finite Soul resource scheduler](soul-resource-scheduler.md).
