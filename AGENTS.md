# Project instructions

## 応答と検証

- ユーザーへの最終報告は日本語で行う。
- 既存の変更を保護し、未対応の効果を0点としてOptimizerへ登録しない。
- 公開前に関連audit、`npm test`、`npm run lint`、`npm run build`を成功させる。同じソースの検証済み結果は再利用してよい。

## GitHubへのpushとSites更新の完了条件

- このプロジェクトでユーザー依頼の変更をGitHubの`main`へpushした場合、明示的に「公開不要」「GitHubのみ」と指定されない限り、同じ検証済み内容を既存のChatGPT Sitesにも反映する。GitHubへのpushだけで作業完了としない。
- Sites building / hostingスキルを使用し、`.openai/hosting.json`の既存`project_id`を再利用する。新規サイトを作成しない。
- 公開先は既存の本人限定サイト。毎回アクセス設定を読み取り、所有者本人だけが閲覧可能であることを確認してprivate deploymentを使う。共有・一般公開への変更は行わず、本人限定を確認できない場合はユーザーへ確認する。
- GitHubのpushとは別に、Sitesのソースリポジトリへ同じcommitをpushし、そのcommitから作成した成果物を保存・公開する。認証情報をファイル、Git設定、remote URL、ログへ残さない。
- 公開成功まで状態を確認し、完了報告には閲覧URLを含める。失敗した場合は「GitHub更新済み・サイト未反映」を明示する。
- これはエージェントの作業手順であり、GitHub Actionsによる自動公開や定期監視を意味しない。無関係なbranchのpushや他者のpushを勝手に公開しない。
