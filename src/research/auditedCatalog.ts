import armorAudit from '../../research/armor-audit.json' with { type: 'json' }

export function auditedArmorIntrinsicProperties(armorId: string): readonly { readonly kind: string; readonly raw: string }[] {
  const entry = armorAudit.entries.find((item) => item.id === armorId)
  return entry?.intrinsicProperties.map(({ kind, raw }) => ({ kind, raw })) ?? []
}
