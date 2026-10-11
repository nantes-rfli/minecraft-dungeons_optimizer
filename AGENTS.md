# Project instructions

- 未対応・未確認のゲーム効果を `0` として扱わず、unknown / unsupported の意味を保持する。
- 実装・修正依頼は、ユーザーが範囲を制限しない限り、変更の検証・commit・GitHub `main` へのpushまで完了する。直接の `main` commit と force push は行わない。
- ローカルでは変更に関係する検証だけを行い、理由なくGitHub CIの全体検証を重複実行しない。
- Siteの表示・挙動・配信成果物に影響する変更は、原則として `main` へのmerge後にSiteへ反映する。ただし実行環境に必要なSite更新手段・権限があり、`.openai/hosting.json` の既存projectと本人限定アクセスを確認・維持できる場合に限る。手段・権限がない、公開範囲を確認できない、または反映に失敗した場合は、実施せず理由を報告する。Siteと無関係な変更は反映不要。Site反映はPRの検証・レビュー・mergeとは独立で、反映未実施・失敗・証跡不足をmerge blockerにしない。公開範囲を広げず、ユーザーの明示的な停止・スキップ指示は優先する。
- 自律ループを依頼された場合は [AUTONOMOUS.md](./AUTONOMOUS.md) を読む。1 Work Unitを1検証済みPRにし、マージは人間または同契約のgateを満たすtrusted independent automated reviewerが行う。implementerのself-reviewだけではマージしない。
