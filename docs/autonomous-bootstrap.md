# Autonomous loop bootstrap

このリポジトリを開いた新しいセッションへ以下を貼り付ける。起動後の判断規則は [AUTONOMOUS.md](../AUTONOMOUS.md) が正本。マージ後も同じpromptで再開できる。

```text
MCD Optimizerの自律開発ループを1 iteration実行してください。
最新のorigin/mainと既存PRを確認し、AGENTS.mdとAUTONOMOUS.mdを読んでください。
canonical project stateを再計算し、Applicationのcompletion frontier（今できること／次の実用capability／最小bottleneck）を定義してから、
契約のmission・優先順位・停止条件に従って次のWork Unitを選定し、調査・設計・実装・検証・self-review・fix-upを完遂してください。
判断と検証結果をiteration recordに残し、最終headのCI成功を確認したmain向けPRを提出してください。
implementer自身はマージせず、人間またはtrusted independent automated reviewerへ引き継いでください。
自動mergeはAUTONOMOUS.mdの全gateを満たす場合だけ許可し、確認不能なら停止またはfix-upへ戻してください。
以前のnext候補は再評価し、open autonomous PRがあれば新しいWork Unitを始めず、
live PR stateとrecordを確認してAUTONOMOUS.mdの状態別処理に従ってください。
Draft / VALIDATINGは同じPRの未完了handoffを継続し、LOCAL_FIX_REQUIREDは同じPRをfix・再検証し、
Ready / AWAITING_MERGEはReviewer / human mergeを待ってください。
```

初回導入の調査・運用確認は [initial audit](autonomous-development-initial-audit.md) を参照。そこにある候補や件数は固定baselineの記録であり、次タスクの指示ではない。
