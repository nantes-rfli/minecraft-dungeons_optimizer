# Enemy-state conditional damage — Phase 2-1E

## 採用範囲と設計判断

対象versionは **1.17.0.0**。Ambush・Smiting・Committedを通常候補、lock、金色Tier I/II/III、inventory JSON/localStorage、Optimizer、寄与度へ追加しました。固有built-in・遠距離・防具は実装しません。

catalog runtime **15 / 33**、Power 50–263の広域対応 **12 / 33**、範囲限定proc **3 / 33**、research-only **18 / 33**。needs-enemy-stateは0です。広域対応はモデルの実戦精度保証ではありません。**Phase 2-1Dはpartialのまま**（Shockwave 210–252、Swirling 210–263、Thundering 248–263）。範囲外は引き続き自由候補を理由付き除外、lock/gildedを入力エラーとし、未対応効果を0点にしません。

Enemy type、targeting state、health trajectoryを別々に扱います。UI刷新や完全な敵simulatorを導入せず、既存のdirect/indirect境界に条件期待値と解析的HP推移を接続する設計です。

## 公開仕様の再確認

2026-08-30に以下を取得・照合しました。優先順位はgame-file-derived data → Wikiの具体的mechanics/version/stacking → 定量的community test → 複数報告 → model assumptionです。独立実機測定は今回追加していません。

| 効果 | Tier I / II / III | 条件・重複 | 出典 |
| --- | --- | --- | --- |
| Ambush | +20% / +40% / +60% | 対象がheroをactively targetingしていない。最大1copy | [dungeons.tools](https://www.dungeons.tools/enchantments/ambush)、[Wiki](https://minecraft.wiki/w/Dungeons:Ambush) |
| Smiting | +25% / +35% / +45% | undeadのみ。active倍率をcopyごとに乗算 | [dungeons.tools](https://www.dungeons.tools/enchantments/smiting)、[Wiki stacking/history](https://minecraft.wiki/w/Dungeons:Smiting) |
| Committed | 0–50% / 0–75% / 0–100% | targetのHP損失に比例。最大1copy | [dungeons.tools](https://www.dungeons.tools/enchantments/committed)、[Wiki mechanics](https://minecraft.wiki/w/Dungeons:Committed) |

Ambushは1.16.2.0で15/30/45→20/40/60、Smitingは20/30/40→25/35/45へ変更されています。SmitingのWikiは、gildedに存在してもEnchantsmithで通常枠へ再抽選可能と明記します。既存の通常3枠＋金色1枠から最大4copy、通常Tier III＋金色Tier I/IIを含むmixed tiersを認めます。built-inの同効果との重複は禁止されており、今回のruntimeにはbuilt-in自体を含めません。

Smitingの旧audit `behavior: special`を`multiplicative`へ修正しました。game-derivedのSTACKS YesとWikiの乗算説明は矛盾しませんが、厳密な乗算・Enchantsmith根拠はWikiに帰属させます。CommittedのWiki本文は44.25%と記す一方、併記式1/ln(2)は44.2695%です。この小差をauditへ残し、計算値を採用しました。

## 入力：共通defaultと意味

```ts
enemyComposition: { enchantedShare: 0.25, undeadShare: 0.5 }
enemyState: { ambushEligibleDirectDamageShare: 0.25 }
```

全6profileで同じ編集可能defaultを使用します。全missionに普遍的な実測割合は確認できていません。

- `undeadShare=0.5`：direct weapon damageを与える対象のうちUndeadが占めるbaseline-damage-weighted期待割合。50%は中間点を置くMVP仮定であり、敵出現率の主張ではありません。
- `ambushEligibleDirectDamageShare=0.25`：damage発生時に対象が自分をactively targetingしていないdirect melee機会のtime/baseline-damage-weighted割合。25%は部分的な有効機会を試すための例示的仮定であり、solo/co-opの実測ではありません。
- 他player・pet・CC/stun・shadow/invisibility・initial aggro前・背後からの攻撃機会を一つのexposureに集約します。背後にいるだけで条件成立とはせず、発生時のtargeting状態が条件です。これらの個別挙動や「4人だから75%」といった推定は追加しません。

両入力ともfiniteかつ0〜1、UIは0〜100%。欠落・null・NaN・Infinity・範囲外はevaluate/optimizer入口で拒否します。古いScenario APIの呼出側は新fieldが必要です。Scenarioはセッション内設定で、inventoryの保存schemaVersion=1は変更しません。

## Ambush / Smiting：condition → exposure → direct expectation

Ambush bonusをb、eligible shareをaとすると、期待倍率は `(1-a)+a(1+b)=1+a*b`。Tier III・a=0.25なら **1.15倍**、a=0なら1倍、a=1なら1.6倍です。

Smitingはコピー間で同じundead条件を共有します。先に `active=Π(1+bᵢ)` を作り、u=`undeadShare`から `expected=(1-u)+u*active` を計算します。

- Tier III・u=0.5：1.225倍。
- Tier III×2・u=0.5：active=1.45²=2.1025、expected=0.5+0.5×2.1025=**1.55125倍**。
- `(1+0.5*0.45)²=1.500625` は誤式です。条件はcopyごとの独立抽選ではありません。
- Tier III＋II・u=0.5：0.5+0.5×1.45×1.35=1.47875倍。順序非依存です。

`conditionExposure()`はenchanted→EnemyComposition.enchantedShare、undead→EnemyComposition.undeadShare、not-targeting→EnemyState.ambushEligibleDirectDamageShareを解決します。コピーの合成には既存stacking関数を使い、exposureは合成後に一度だけ掛けます。

## 条件間の相関：MVP independent-condition approximation

Unchanting、Smiting、Ambushの期待倍率を乗算します。これは `E[U*S*A]` の厳密計算ではなく、enchanted・undead・targetingの相関を無視するfactorizationです。特定missionで「UndeadだけがEnchanted」等なら誤差が生じます。

`CONDITIONAL_STATE_FACTORIZATION`はlow confidenceで、条件効果が複数あるBuildにだけ追加します。条件識別子と入力元を分けてあるため、将来は独立積の部分をjoint composition evaluatorへ置換できます。同じSmiting条件内のcopyはこの独立近似の対象ではありません。

## Committed：瞬間式と解析積分

残HP比h、Tier最大bonus bに対して公開仕様の瞬間倍率は `m(h)=1+b*(1-h)`。Tier IIIならHP100%→1倍、HP50%→1.5倍、HP→0→2倍です。常時2倍にも単純平均1.5倍にもしません。

MVPはfull-health targetを倒すまで継続攻撃するcontinuous steady-stateモデルです。Committed前の直接DPSをD、増幅しないproc DPSをP、敵最大HPをHとします。

```text
R(h) = P + D * [1 + b * (1-h)]
dh/dt = -R(h)/H
T/H = ∫₀¹ 1/R(h) dh
    = log1p(D*b/(P+D)) / (D*b)
effectiveTotalDps = H/T = D*b / log1p(D*b/(P+D))
effectiveDirectDps = effectiveTotalDps - P
directMultiplier = effectiveDirectDps / D
```

低HPほど高火力で短時間に通過するため、HP比を均等に平均した1.5倍とは異なります。P=0で直接倍率は `b/log1p(b)` となり、Tier I ≈1.2331517312、Tier II ≈1.3402052197、Tier III ≈**1.4426950409**。

D=100、P=100、b=1では総DPS ≈246.63034624、直接DPS ≈146.63034624、procは100のままです。procによるHP低下で直接hitのbonusが進む効果をPが表現します。procのdamage/event・発動頻度・平均対象数にCommittedは掛かりません。

### 数値安定性

`x=b*D/(D+P)`と置けば、直接倍率は `1+b*f(x)`、`f(x)=(x/log1p(x)-1)/x`。極小xでは `f(x)=1/2-x/12+x²/24-19x³/720+…` を使います。`effectiveTotal-P`の直接減算による桁落ちを避け、D/P比もD+Pのoverflowを起こさず求めます。b=0は1倍、D=0は直接DPS0・総DPS=P。NaN/負値/範囲外bonusを拒否し、表現不能な総DPSは明示エラーにします。

### 単体とAoE

単体はD=preCommitted direct ST、P=proc ST。AoEはD=preCommitted direct AoE、P=proc AoEとして別々に積分します。direct/procの命中範囲が異なるため両倍率が違うことがあります。AoE側は全対象を均質な一つのHP推移へまとめる**low-confidence aggregate approximation**です。

fresh-target仮定、継続攻撃、一定rateは実戦精度を保証しません。負傷済みtargetやco-op focus fireではCommittedを過小評価し得ます。戦闘終了までに倒せないboss、途中離脱、target switching、overkill、burst window、離散hit、敵ごとのHP・hit/proc coverageの相違は未モデル化です。短時間の遭遇に対する厳密なダメージ予測として扱わないでください。専用開始HPsliderは追加しません。

## 実際の計算順序とmetrics

```text
base direct × Sharpness × Critical期待値 × Void期待値
            × Unchanting期待値 × Smiting期待値 × Ambush期待値
  = preCommitted direct（単体 / AoE）
独立procの単体 / AoEをPとして参照
  → Committed trajectory → final direct（単体 / AoE）
final direct + 増幅していないproc = total（単体 / AoE）
```

`nonEnchantedTargetDps` / `enchantedTargetDps`は**Committed前**であり、他の条件期待値を固定したdirect単体diagnosticsです。`preCommittedDirectWeaponSingleTargetDps` / `preCommittedDirectWeaponAoeDps`、両Committed倍率、Smiting active/期待倍率、各入力割合を別fieldへ残します。`directWeaponSingleTargetDps` / `directWeaponAoeDps`はCommitted後です。UI・reasonにも適用前後を明記しています。

全modifier間のinteractionは独立実機検証済みではなく、`DIRECT_WEAPON_COMPOSITION`をlowのまま拡張します。CriticalやVoidを平均化したDと、実際のHP推移の相関も近似です。

最終direct/total AoEから既存のdirectDamageShareを再計算します。contributionは一つの効果を除去して全依存関係を再評価し、DPS→kill rate→Leeching/Guarding Strike/Refreshmentまで伝播します。proc removal時にもCommittedを新しいPで再計算します。damage shareをfinal-blow shareの代理にするPhase 2-1Dのlow-confidence制約は維持します。

## Evidenceの分離

| Evidence | confidence | 追加条件 |
| --- | --- | --- |
| 3種のTier、対象条件/HP比例、重複規則、buff履歴 | high（資料由来） | 対応効果使用時 |
| Smiting乗算・Enchantsmith4枠 | high（Wiki由来） | Smiting使用時 |
| Undead割合 | low（MVP仮定） | Smiting使用時のみ |
| Ambush eligible割合 | low（MVP仮定） | Ambush使用時のみ |
| 条件間factorization | low（MVP仮定） | 条件効果が複数ある時 |
| Committed解析積分 | high（式の数学的検証のみ） | Committed使用時 |
| fresh-target→撃破・AoE均質推移 | low（MVP仮定） | Committed使用時のみ |
| direct modifier composition | low（全interaction未検証） | direct modifierが複数ある時 |

数学的に正しい式と、実際の戦闘を忠実に再現することを区別します。未使用効果の新しいlow-confidence要因はBuildへ加えません。

## 検証と次のbatch

Tier/端点/混合・Smiting2/3/4copyとmixed tiers・誤ったcopy独立式との差・Committed golden/独立数値積分/極小値/巨大値・各procとの不変境界・単体/AoE・全profile入力拒否・UI callback・Evidence条件・寄与再計算・normal/lock/gilded/storage/JSON/Optimizerをテストします。既存Unchanting goldenとPower範囲外proc除外も維持します。解析モデルの検証であり、独立実戦測定サンプルを捏造しません。

残りはneeds-state-model 13、needs-damage-event-model 3、utility-only 2。次の候補を依存関係から比較すると、**Artifact Synergy + Rampaging + Echo**を推奨します。既存Artifact cooldown/uptime、kill rate、attack profileを利用できるためです。ただしArtifact-use→次hit消費、Rampagingの発動/持続/再発動とHPS循環、Echoの追加hit/cooldown/他on-hit発動境界を先に監査する必要があり、単純な常時倍率では実装しません。

Soul foundation + Anima Conduit / Soul Siphon / Enigma Resonatorは、soul獲得源・capacity・所持量分布・消費・収集遅延・回復/crit連携の共通基盤が必要で、今回の近接DPS境界からは拡張コストが大きい候補です。soul buildを優先したい場合に次点として選べます。どちらも今回の実装対象には含めません。
