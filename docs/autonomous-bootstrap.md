# Autonomous loop bootstrap

このリポジトリを開いた新しいセッションへ以下を貼り付ける。起動後の判断規則は [AUTONOMOUS.md](../AUTONOMOUS.md) が正本。マージ後も同じpromptで再開できる。

```text
MCD Optimizerの自律開発ループを1 iteration実行してください。
最新のorigin/mainと既存PRを確認し、AGENTS.mdとAUTONOMOUS.mdを読んでください。
canonical project stateを再計算し、契約のmission・優先順位・停止条件に従って
次のWork Unitを選定し、調査・設計・実装・検証・独立self-review・fix-upを完遂してください。
判断と検証結果をiteration recordに残し、最終headのCI成功を確認したmain向けPRを提出してください。
マージはせず、停止条件またはマージ待ちで引き継いでください。
以前のnext候補は再評価し、同じmissionの未マージPRがあれば新規実装を始めないでください。
```

初回導入の調査・運用確認は [initial audit](autonomous-development-initial-audit.md) を参照。そこにある候補や件数は固定baselineの記録であり、次タスクの指示ではない。
