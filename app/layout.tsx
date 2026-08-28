import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '../src/styles.css'

export const metadata: Metadata = {
  title: 'Minecraft Dungeons 最適装備ツール',
  description: '手持ち装備を火力・回復・防御の計算モデルで比較する本人限定Optimizer',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
