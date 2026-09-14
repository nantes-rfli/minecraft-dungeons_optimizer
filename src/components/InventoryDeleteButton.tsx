export function InventoryDeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="danger-button" aria-label={`${label}を削除`} onClick={onClick}>削除</button>
}
