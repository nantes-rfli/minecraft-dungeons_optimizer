import { builtinProcMeleeEnchantments } from './builtinProcMelee'
import { fixedObservedMeleeComboEnchantments } from './fixedObservedMeleeCombo'

export const fixedMeleeEnchantments = (id: string) =>
  [...builtinProcMeleeEnchantments(id), ...fixedObservedMeleeComboEnchantments(id)]
