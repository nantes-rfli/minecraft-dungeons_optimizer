# Artifact evidence matrix — Phase 2-2E

Target is Minecraft Dungeons 1.17.0.0. A current page is not treated as a current-version numeric table unless the table itself is pinned. Machine-readable provenance lives in [sources](../research/artifact-evidence/sources.json), [samples](../research/artifact-evidence/published-samples.json) and the [curve audit](../research/artifact-curve-audit.json).

Runtime remains **3 / 45 (Full 2, Limited 1, Research-only 42)**. No unsupported effect was registered as a zero-value candidate.

| Artifact | Metric | Samples | Power range | Version | Unit | Curve readiness | High-Power ready | Runtime readiness |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- |
| Powershaker | coefficient/damage | 1 | — | 1.16.2.0 historical | internal operand unresolved | R1 | No | Research-only |
| Harvester | damage/cooldown | 4 | 17–109 | table unresolved; DB current | range/cooldown semantics unresolved | R1 | No | Research-only |
| Lightning Rod | damage/cooldown | 7 | 1–114 | table unresolved; DB current | strike display/cooldown semantics unresolved | R1 | No | Research-only |
| Soul Healer | healing | 23 | 1–108 | table unresolved | nested range semantics unresolved | R1 | No | Research-only |
| Totem of Regeneration | healing/duration | 3 | 31–114 | table unresolved | total/rate/tick unresolved | R1 | No | Research-only |
| Wind Horn | push/slow | 5 | 1–108 | table unresolved | blocks known only in ambiguous bands | R2 | No | Research-only |

## Conflict decisions

| Conflict | Candidates | Conclusion | Why no selected value |
| --- | --- | --- | --- |
| harvester cooldown | 4 seconds / 4 seconds / 8 seconds | unresolved | Wiki labels 4s as the user-facing cooldown and history establishes 4s in 1.3.2.0. dungeons.tools labels 8s as Cooldown but its public HTML/client payload does not expose the raw property name, unit conversion or whether it is a use lock. |
| lightning-rod cooldown | 2 seconds / 2 seconds / 4 seconds | unresolved | Wiki labels 2s as the user-facing cooldown and history establishes 2s in 1.3.2.0. dungeons.tools labels 4s as Cooldown and separately describes only a qualitative strike delay; neither a numeric delay nor raw field name is public. |
| totem-of-regeneration healing | 40 health per second / 229 display health healed | unresolved | Patch history names per-second healing. The current table labels Health healed but does not state total, rate or tick value, and reports only approximate 5-10s duration. |
| wind-horn push-distance | 4 blocks / 5 blocks | unresolved | Published inclusive-looking ranges overlap at four boundaries and do not define boundary ownership. |

## Public-source stop condition

Every primary candidate checked dungeons.tools, Minecraft Wiki current/history and public GitHub save tooling. No source exposed the executable Artifact absolute curve, raw cooldown property names, Totem tick semantics or Wind Horn 109+ table, so each decision records `public-evidence-exhausted`.
