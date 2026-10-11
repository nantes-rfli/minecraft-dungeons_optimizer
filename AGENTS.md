# Project instructions

- 未対応・未確認のゲーム効果を `0` として扱わず、unknown / unsupported の意味を保持する。
- 実装・修正依頼は、ユーザーが範囲を制限しない限り、変更の検証・commit・GitHub `main` へのpushまで完了する。直接の `main` commit と force push は行わない。
- ローカルでは変更に関係する検証だけを行い、理由なくGitHub CIの全体検証を重複実行しない。
- Siteへの反映はPRの検証・レビュー・mergeとは独立の運用作業とし、未反映や反映証跡の不足をmerge blockerにしない。通常の開発ではSiteへ自動反映せず、利用者から明示依頼がある場合に別途実施する。反映する際は `.openai/hosting.json` の既存projectを使用し、本人限定アクセスを維持して公開範囲を広げない。
- 自律ループを依頼された場合は [AUTONOMOUS.md](./AUTONOMOUS.md) を読む。1 Work Unitを1検証済みPRにし、マージは人間または同契約のgateを満たすtrusted independent automated reviewerが行う。implementerのself-reviewだけではマージしない。
