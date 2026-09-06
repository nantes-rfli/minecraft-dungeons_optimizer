# Source Harvest Browser Performance

2026-09-06のPhase 4.1 snapshotで、Data Browser用read modelとproduction buildのlazy chunkを計測した。

| 対象 | raw | gzip | 計測 |
| --- | ---: | ---: | ---: |
| `research/source-harvest-browser.json` | 2,741,566 bytes | 84,488 bytes | `JSON.parse` median 9.9 ms / p95 28.4 ms（Node.js、50回） |
| production Data Browser chunk | 2,087,602 bytes | 102,964 bytes | buildで独立lazy chunkを維持 |

propertyごとのsource ID、version status、Unknownのattempt result追加によりraw sizeは増えたが、初期routeからは引き続きlazy loadされる。圧縮転送量とread modelのparse計測に明確な待ち時間はなく、現時点ではcategory分割を行わない。今後raw chunkが継続的に増える場合は、summary/indexとcategory detail JSONの分離を優先する。
