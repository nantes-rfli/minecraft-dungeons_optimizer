# Finite Soul resource scheduler

Phase 2-2C adds `simulateSoulResourceSchedule` as the spending-aware counterpart to the retained zero-start/no-spending `soulTrajectory` closed form.

## State and conservation

The shared pool starts at `scenario.initialSoulUnits` (default 0), has capacity 300, receives continuous `resource units/second`, and pays an integer Artifact cost only at a realized use event. Between events the scheduler integrates the linear rise and any full-capacity plateau exactly. At every result:

```text
initial + potential income = end + spent + overflow
```

`averageSouls` is the time integral divided by encounter duration. It is not `(start + end) / 2`; that shortcut fails when the meter reaches capacity or is interrupted by spending.

## Event policy

A single consumer uses at `t=0` when both ready and affordable. Otherwise it fires at the earliest time when cooldown and affordability are both satisfied. The output separates cooldown-limited uses, resource-limited uses, realized integer uses, Soul-starved opportunities, spent units, and sorted use timestamps. Pickup events remain untouched: Anima continues to use pickup count, while spending removes resource units only.

All Soul Artifacts share one pool. Phase 2-2C deliberately supports at most one spender because ordering two ready consumers is a player policy. Multiple consumers are rejected instead of inheriting array or slot order.

Artifact-derived Gathering is added to weapon and enchantment Gathering before resource conversion; it never multiplies visual pickup count. The Artifact Synergy adapter consumes only `realizedUsesPerSecond`, so an empty pool cannot trigger Synergy from cooldown capacity alone.

## Scope

The scheduler is event-based rather than per-frame and does not search for an optimal use policy. With no spender and the default zero start, the previous `soulTrajectory` output path remains exact for regression compatibility. Soul Healer, Harvester and Lightning Rod remain outside the runtime catalog until their separate Evidence blockers are resolved.
