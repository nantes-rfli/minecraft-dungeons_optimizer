import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '../src/styles.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://nanto-minecraft-dungeons-optimizer.nantos.chatgpt.site'),
  title: 'Minecraft Dungeons 最適装備ツール',
  description: '手持ち装備を火力・回復・防御の計算モデルで比較する本人限定Optimizer',
  openGraph: {
    title: 'Minecraft Dungeons 最適装備ツール',
    description: '手持ち装備を火力・回復・防御の計算モデルで比較する本人限定Optimizer',
    images: [{ url: '/og.png', width: 1732, height: 908, alt: 'Minecraft Dungeons 最適装備ツール — 手持ち装備を比較' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Minecraft Dungeons 最適装備ツール',
    description: '手持ち装備を火力・回復・防御の計算モデルで比較する本人限定Optimizer',
    images: ['/og.png'],
  },
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
