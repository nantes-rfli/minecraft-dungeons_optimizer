import type { Inventory } from '../core/types'

/** Add the single staged copy to the saved inventory without changing its recorded facts. */
export function retainTrialCandidate(inventory: Inventory, trialInventory: Inventory, instanceId: string): Inventory | null {
  const stagedMatches = [
    ...trialInventory.weapons.filter((item) => item.instanceId === instanceId),
    ...(trialInventory.armors ?? []).filter((item) => item.instanceId === instanceId),
    ...(trialInventory.rangedWeapons ?? []).filter((item) => item.instanceId === instanceId),
    ...trialInventory.artifacts.filter((item) => item.instanceId === instanceId),
    ...(trialInventory.catalogItems ?? []).filter((item) => item.instanceId === instanceId),
  ]
  if (stagedMatches.length !== 1) return null

  const alreadySaved = [
    ...inventory.weapons,
    ...(inventory.armors ?? []),
    ...(inventory.rangedWeapons ?? []),
    ...inventory.artifacts,
    ...(inventory.catalogItems ?? []),
  ].some((item) => item.instanceId === instanceId)
  if (alreadySaved) return null

  const weapon = trialInventory.weapons.find((item) => item.instanceId === instanceId)
  if (weapon) return { ...inventory, weapons: [...inventory.weapons, weapon] }

  const armor = trialInventory.armors?.find((item) => item.instanceId === instanceId)
  if (armor) return { ...inventory, armors: [...(inventory.armors ?? []), armor] }

  const rangedWeapon = trialInventory.rangedWeapons?.find((item) => item.instanceId === instanceId)
  if (rangedWeapon) return { ...inventory, rangedWeapons: [...(inventory.rangedWeapons ?? []), rangedWeapon] }

  const artifact = trialInventory.artifacts.find((item) => item.instanceId === instanceId)
  if (artifact) return { ...inventory, artifacts: [...inventory.artifacts, artifact] }

  const catalogItem = trialInventory.catalogItems?.find((item) => item.instanceId === instanceId)
  if (catalogItem) return { ...inventory, catalogItems: [...(inventory.catalogItems ?? []), catalogItem] }

  return null
}
