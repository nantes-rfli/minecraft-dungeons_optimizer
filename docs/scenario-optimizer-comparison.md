# Phase 6.9F — Scenario / Optimizer comparison

2026-09-10。finite hit、final-blow ownership、目的別metrics、Scenario / policy感度を研究用経路で比較した。runtime、UI、score、候補生成への組み込み、Evidence昇格、Gap closeは0。

## 比較境界

現runtimeはScenarioの平均敵HP・敵供給上限・`directKillShare`を使うsteady-state解析で、探索中の全候補を同じ式へ通せる。一方、有限encounterの初撃・overkill・対象切替・final blowの発生源・実際のoverhealは平均DPSだけから復元できない。6.9Fではゲーム内真値を補完せず、明示的に与えたevent sequenceだけを有限Scenarioへ適用する比較器を追加した。

eventはtime、target、action、component、source effect、damage、ownershipを必須とする。敵ごとのHPとspawn時刻を追跡し、nominal damageをeffective damageとoverkillへ分離する。direct-meleeのfinal blowだけがdirect-kill healingを発生させ、actual healingはその時点の欠損HPまでに制限する。indirect / artifact killは別集計する。ownershipが`null`のeventで敵を倒した候補、または`unresolvedMechanics`を持つ候補は理由付き`excluded`となり、score 0の候補としてrankへ入らない。

同時刻の被damageを攻撃eventより先に処理する規則は再現性のための比較上の規約であり、ゲームのframe順を主張しない。比較keyにはcandidate model revision、Scenario id、Objective revisionを含める。

## 旧proxyとの比較

合成Scenarioで4体をindirect componentが仕留める候補を比較した。finite結果は4 kill、direct-owned kill 0、実回復0。旧steady-state型の`directKillShare=0.9`と敵HP 100、Leeching相当20%を適用すると、direct kill 3.6、回復capacity 72となる。この差は旧runtimeの誤差を実測したものではなく、平均shareと明示ownershipが表現する問いの違いを固定したcounterexampleである。

direct finisher候補は3 kill、direct-owned kill 3、欠損HP内の実回復60。indirect finisher候補は4 kill、有効damage 400、実回復0となった。damage policyではindirectが1位、healingを重くしたsustain policyではdirectが1位へ反転する。confidenceをscoreへ掛けず、目的関数とゲームmetricを分けた。

## 有限時間と順位感度

burst候補は0.2秒で100 damage、steady候補は0.5 / 1.5 / 2.5秒に70 / 70 / 100 damageを与える。1秒Scenarioではburstが100対70で1位、3秒Scenarioではsteadyが200対100で1位になる。steadyの1体目への2撃目は30 effective + 40 overkillとして扱い、raw damageをそのまま有効damageへ足さない。

Objectiveはeffective damage、kills、actual healing、damage avoided、control target-secondsを独立metricとして受け取る。各targetとweightはpolicy revisionの一部で、今回の値は順位感度を示す合成値であり、production profileの置換候補ではない。

## 性能・再現性・監査

`npm run generate:scenario-optimizer-comparison`で[machine-readable比較](../research/external-community/scenario-optimizer-comparison.json)を再生成する。`npm run audit:scenario-optimizer-comparison`は同一入力2回の完全一致、candidate idによる安定tie-break、500候補のrankが1秒未満で終わること、目的・durationの順位反転、未知候補の除外、生成物driftをoffline監査する。wall-clock実測値自体は環境依存なのでJSONへ固定しない。`tests/scenarioOptimizerComparison.test.ts`はfinite damage、overkill、ownership、actual healing、revision key、異常入力を検証する。

## 未解決と判断

event sequenceの独立観測、target switching、同frame順、実overheal、被damage時系列、control eventの帰属、Objective targetの検証が未完了。aggregate HPSやattack definitionからevent列を合成せず、これらを0・倍・0点で埋めない。

6.9Fの研究比較と通過条件は完了した。Phase 6.9全体で作ったEvidence adapter、attack/event、DR/modifier、Scenario/Optimizerはすべてruntimeから分離されたままで、昇格可能なsliceはまだない。次は残存blockerに対して外部観測・限定実測を取得し、Phase 8のvalidationを通った単位だけをPhase 9で昇格する。
