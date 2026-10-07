export function InventoryDeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="danger-button" aria-label={`${label}を削除`} onClick={() => {
    if (window.confirm(`「${label}」のこの個体を削除しますか？\nエンチャントやメモを含む登録内容が削除されます。`)) onClick()
  }}>削除</button>
}
