# AWS Quest Board

AWSの技術ニュースをクエストとして学習するWebアプリです。Astro・React・CopilotKit V2と、PythonのStrands Agentsを組み合わせています。

認証はAWS BlocksのAuthCognito、保存はDistributedTable、配信基盤はHosting Blockで定義します。ローカルではBlocksの認証・保存実装を利用できます。AWS上のWebアプリではCognitoのJWTを検証し、AIエージェントへはIAM認証で接続します。

- [ローカル起動・検証](webapp/README.md)
- [PythonのAIエージェント](agent/README.md)

2026年11月3日に旧Amplify環境を削除し、Blocks版をデプロイしました。旧Amplifyの定義はgitの履歴にあります。

公開環境は招待制です。管理者がCognitoから作成したユーザーだけが利用でき、自己登録はできません。ローカル開発でのユーザー登録は引き続き利用できます。
