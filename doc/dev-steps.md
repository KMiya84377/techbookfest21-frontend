# 開発手順

`webapp/`(Astro + React + CopilotKit + Amplify)と、`agent/`(Strands Agents)を構築し、AWS にデプロイする手順書です。各節は「手順」と「補足」に分かれています。手順は上から順に実行し、補足は必要に応じて読んでください。

## 第1章 フロントエンドをモックで動かす

### 1.1 事前準備

#### 1.1.1 Claude Code の支援ツール(MCP・スキル)の追加

##### 1.1.1.1 MCP サーバー(aimock-docs)

**手順**

1. aimock のドキュメント用 MCP サーバーを登録します。

   ```sh
   claude mcp add aimock-docs --transport http https://mcp.aimock.copilotkit.dev/mcp
   ```

> [!NOTE]
> aimock は、LLM API などのモックを提供するツールです。

##### 1.1.1.2 スキル(CopilotKit)

**手順**

1. CopilotKit のスキルを追加します。

   ```sh
   npx skills add CopilotKit/CopilotKit/skills -y
   ```

> [!NOTE]
> - 次の 9 つのスキルが追加されます: `copilotkit`、`copilotkit-cli`、`copilotkit-channels`、`channels-setup`、`setup-slack-channel`、`inspector-docs`、`inspector-workbench`、`intelligence-docs`、`intelligence-vocabulary`。
> - 作成されるファイルとディレクトリは次のとおりです。
>   - `.agents/skills/`: スキル本体
>   - `.claude/skills/`: 本体へのシンボリックリンク
>   - `skills-lock.json`: 取得元とハッシュの記録

##### 1.1.1.3 MCP サーバー(copilotkit-mcp)

**手順**

1. CopilotKit 本体のドキュメント用 MCP サーバーを登録します。

   ```sh
   claude mcp add --transport sse copilotkit-mcp https://mcp.copilotkit.ai/sse --scope local
   ```

> [!NOTE]
> - 公式の案内([Build with agents](https://docs.copilotkit.ai/build-with-agents))のコマンドは `--scope project` ですが、ここでは `--scope local` を指定しています。
> - `local` は自分の環境だけに登録する指定、`project` はリポジトリで共有する指定です。

#### 1.1.2 Astro の導入

**手順**

1. Astro のプロジェクトを作成します。

   ```sh
   npm create astro@latest -- --template minimal
   ```

2. 作成したディレクトリに移動し、依存パッケージをインストールします。

   ```sh
   cd webapp
   npm install
   ```

> [!NOTE]
> - Node.js `v22.12.0` 以上が必要です(奇数バージョンは非対応)。
> - 詳細は [Install and setup](https://docs.astro.build/en/install-and-setup/) を参照してください。

#### 1.1.3 React の導入

**手順**

1. Astro に React 統合を追加します。

   ```sh
   npx astro add react
   ```

2. `astro.config.mjs` と `tsconfig.json` が、次の内容になっていることを確認します。

   `astro.config.mjs`:

   ```js
   import { defineConfig } from 'astro/config';
   import react from '@astrojs/react';

   export default defineConfig({
     integrations: [react()],
   });
   ```

   `tsconfig.json`:

   ```json
   {
     "extends": "astro/tsconfigs/strict",
     "compilerOptions": {
       "jsx": "react-jsx",
       "jsxImportSource": "react"
     }
   }
   ```

> [!NOTE]
> - CopilotKit の UI は React コンポーネントなので、React 統合が必要です。
> - React コンポーネントは、`.astro` ページの中で `client:load` などのクライアントディレクティブを付けて埋め込みます。
> - 詳細は [React integration](https://docs.astro.build/en/guides/integrations-guide/react/) を参照してください。

#### 1.1.4 CopilotKit の導入

**手順**

1. CopilotKit をインストールします。

   ```sh
   npm install @copilotkit/react-core
   ```

2. 第 2 章のバックエンドで使うパッケージをインストールします。

   ```sh
   npm install @copilotkit/runtime @ag-ui/client@0.0.59
   ```

3. AG-UI のエージェントをモックするツールを、開発用の依存としてインストールします。

   ```sh
   npm install -D @copilotkit/aimock
   ```

4. `astro.config.mjs` に、次の設定を追加します。

   ```js
   export default defineConfig({
     integrations: [react()],
     vite: {
       resolve: {
         noExternal: ['@copilotkit/react-core']
       }
     }
   });
   ```

> [!NOTE]
> - `@copilotkit/runtime` は、CopilotRuntime(バックエンド)のパッケージです。`@copilotkit/react-core` と同じバージョンがインストールされます。
> - `@ag-ui/client` は、AG-UI のエージェントに接続する `HttpAgent` を提供します。バージョンは、`@copilotkit/runtime` が依存している 0.0.59 に揃えています。
> - `@copilotkit/aimock` は、開発中だけ使うので `-D` でインストールします。

> [!NOTE]
> **v1 と v2 がある。v2 を使う**
>
> `@copilotkit/react-core` には、v1 の API と v2 の API が含まれています。v2 は同じパッケージの `/v2` サブパスにあります。**v2 を使う場合は、import 元に `/v2` を付けてください。**
>
> | 項目 | v1 | v2 |
> |---|---|---|
> | import 元 | `@copilotkit/react-core`、`@copilotkit/react-ui` | `@copilotkit/react-core/v2` |
> | ルートのコンポーネント | `CopilotKit` | `CopilotKitProvider` |
> | ポップアップ | `CopilotPopup`(`react-ui`) | `CopilotPopup`(`react-core/v2`) |
> | スタイル | `@copilotkit/react-ui/styles.css` | `@copilotkit/react-core/v2/styles.css` |
> | ラベルのキー | `title` / `initial` | `modalHeaderTitle` / `welcomeMessageText` |
>
> - v2 では `@copilotkit/react-ui` は不要です。
> - v1 の `CopilotKit` は、`/v2` の import からも取得できますが、互換用の旧 API です。v2 の API と混在させないでください。

#### 1.1.5 Amplify Gen 2 の導入

**手順**

1. Amplify Gen 2 のバックエンド用パッケージをインストールします。

   ```sh
   npm add --save-dev @aws-amplify/backend@latest @aws-amplify/backend-cli@latest typescript
   ```

2. `webapp/amplify/auth/resource.ts` を、次の内容で作成します。

   ```ts
   import { defineAuth } from "@aws-amplify/backend";

   export const auth = defineAuth({
     loginWith: {
       email: true,
     },
   });
   ```

3. `webapp/amplify/backend.ts` を、次の内容で作成します。

   ```ts
   import { defineBackend } from "@aws-amplify/backend";
   import { auth } from "./auth/resource";

   defineBackend({
     auth,
   });
   ```

> [!NOTE]
> - Amplify Gen 2 は、認証(Amazon Cognito)の作成と、将来のホスティング(`defineHosting`、`definePipeline`)に使います。手順は、公式の [Manual installation](https://docs.amplify.aws/javascript/start/manual-installation/) に沿っています。
> - `defineAuth` の `loginWith.email: true` は、メールアドレスとパスワードでのログインです。
> - この時点では、AWS にリソースは作られません。Cognito を実際に作成するのは、認証の章です。

#### 1.1.6 動かして確認する

**手順**

1. 開発サーバーを起動します。

   ```sh
   npm run dev
   ```

2. ブラウザで `localhost:4321` を開き、ページが表示されることを確認します。

### 1.2 フロントエンドの実装

#### 1.2.1 コンポーネントを書く

**手順**

1. `webapp/src/components/AiAssistant.tsx` を、次の内容で作成します。

   ```tsx
   import { CopilotKitProvider, CopilotPopup } from "@copilotkit/react-core/v2";
   import "@copilotkit/react-core/v2/styles.css";

   const RUNTIME_URL = "/api/copilotkit";

   export default function AiAssistant() {
     return (
       <CopilotKitProvider runtimeUrl={RUNTIME_URL}>
         <CopilotPopup
           labels={{ modalHeaderTitle: "AI Assistant", welcomeMessageText: "こんにちは!" }}
         />
       </CopilotKitProvider>
     );
   }
   ```

> [!NOTE]
> - ポップアップ型のチャットを表示するコンポーネントです。
> - `runtimeUrl` は、ブラウザがバックエンド(CopilotRuntime)に接続する先です。

#### 1.2.2 ページに埋め込む

**手順**

1. `webapp/src/pages/index.astro` を、次の内容にします。

   ```astro
   ---
   import AiAssistant from "../components/AiAssistant";
   ---

   <html lang="en">
     <head>
       <meta charset="utf-8" />
       <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
       <link rel="icon" href="/favicon.ico" />
       <meta name="viewport" content="width=device-width" />
       <meta name="generator" content={Astro.generator} />
       <title>Astro</title>
     </head>
     <body>
       <h1>Astro</h1>
       <AiAssistant client:load />
     </body>
   </html>
   ```

2. ビルドします。

   ```sh
   npm run build
   ```

> [!NOTE]
> **1.1.4 で `noExternal` を追加した理由(追加しないと、ビルド時に CSS のエラーが出ます。他のパッケージでも起こりえます)**
>
> - Astro の SSG では、ビルド時に Node.js で各ページを描画して HTML を作ります(プリレンダー)。`client:load` を付けたコンポーネントも、このとき一度実行されます。
> - Vite は、依存パッケージを既定ではバンドルせず(外部化)、Node.js が直接読み込みます。詳細は [Vite の SSR ガイド](https://vite.dev/guide/ssr)と [SSR オプション](https://vite.dev/config/ssr-options)を参照してください。
> - `@copilotkit/react-core/v2` は、JS の中で `import "./index.css"` を実行しています。この行は Vite を通らずに Node.js に渡されますが、Node.js は `.css` を読み込めないため、失敗します。エラーのスタックトレースが `node:internal/modules/esm/...` になるのは、Vite ではなく Node.js 本体で失敗しているためです。
> - `noExternal` に指定したパッケージは、外部化されずに Vite がバンドルします。パッケージ内の CSS の `import` も Vite が処理するので、Node.js は CSS に触れません。
> - この設定で、`npm run build` が成功しました。なお、`vite.ssr.noExternal` ではエラーが解消しませんでした。

## 第2章 バックエンドを作る

### 2.1 CopilotRuntime を Astro に作る

#### 2.1.1 エンドポイントを書く

**手順**

1. `webapp/src/pages/api/copilotkit/[...slug].ts` を、次の内容で作成します。

   ```ts
   import type { APIRoute } from "astro";
   import { HttpAgent } from "@ag-ui/client";
   import {
     CopilotRuntime,
     createCopilotRuntimeHandler,
   } from "@copilotkit/runtime/v2";

   // リクエストごとにサーバーで動かす(静的ファイルにしない)
   export const prerender = false;

   // AG-UI エンドポイント(開発中は aimock、将来は AgentCore Runtime)
   const AGENT_URL = import.meta.env.AGENT_URL ?? "http://localhost:4010/agui";

   const runtime = new CopilotRuntime({
     agents: { default: new HttpAgent({ url: AGENT_URL }) },
   });

   const handler = createCopilotRuntimeHandler({
     runtime,
     basePath: "/api/copilotkit",
   });

   export const ALL: APIRoute = ({ request }) => handler(request);
   ```

> [!NOTE]
> - このエンドポイントは、`AiAssistant` が接続する `/api/copilotkit` を提供します。
> - ランタイムも v2 の API(`@copilotkit/runtime/v2`)を使います。
> - エージェントは `HttpAgent` で、AG-UI のエンドポイントに接続します。`AGENT_URL` が未設定のときは、2.2 節でモックする `http://localhost:4010/agui` に接続します。Amazon Bedrock AgentCore Runtime 上の Strands Agents への接続(SigV4 署名つき)は、4.4 節で追加します。
> - ファイル名を `[...slug].ts`(キャッチオール)にしているのは、ハンドラーが `/info` や `/agent/:agentId/run` など、`/api/copilotkit` の下位のパスを受け付けるためです。フロントエンドの `runtimeUrl` は `/api/copilotkit` のままで構いません。
> - `prerender = false` は、このエンドポイントをリクエストごとに動かすための指定です。Astro では、リクエスト時に動かすページやエンドポイントにはサーバーアダプタが必要です。

> [!NOTE]
> この時点では、サーバーアダプタを導入していないため、`npm run build` は `NoAdapterInstalled` のエラーで失敗します。第 5 章の 5.1 で、アダプタを導入して解消します。

### 2.2 AG-UI のエージェントをモックする

#### 2.2.1 設定ファイルを書く

**手順**

1. `webapp/mock/aimock.json` を、次の内容で作成します。

   ```json
   {
     "port": 4010,
     "agui": {
       "path": "/agui",
       "fixtures": [
         { "match": { "message": "こんにちは" }, "text": "こんにちは!AG-UI のモックです。" }
       ]
     }
   }
   ```

> [!NOTE]
> - `agui.fixtures` は、ユーザーの発言に応じて返す応答の定義です。上の例は、ユーザーの最後の発言が「こんにちは」に一致すると、テキストを返します。
> - どの定義にも一致しないリクエストには、404 を返します。

#### 2.2.2 aimock を起動する

**手順**

1. `webapp/` で、aimock を起動します。

   ```sh
   npx aimock --config mock/aimock.json --port 4010
   ```

2. 別のターミナルで、aimock に直接リクエストを送って確認します。

   ```sh
   curl -s -N -X POST localhost:4010/agui \
     -H 'content-type: application/json' -H 'accept: text/event-stream' \
     -d '{"threadId":"t1","runId":"r1","state":{},"messages":[{"id":"m1","role":"user","content":"こんにちは"}],"tools":[],"context":[],"forwardedProps":{}}'
   ```

   `RUN_STARTED`、`TEXT_MESSAGE_START`、`TEXT_MESSAGE_CONTENT`、`TEXT_MESSAGE_END`、`RUN_FINISHED` の順にイベントが返ります。

### 2.3 CopilotRuntime の動作を確認する

#### 2.3.1 開発サーバーで確認する

**手順**

1. 開発サーバーを起動します。

   ```sh
   npx astro dev --background
   ```

2. ランタイムの情報を取得します。

   ```sh
   curl -s localhost:4321/api/copilotkit/info
   ```

   `agents` に `default` が含まれていれば成功です。

3. ランタイム経由でエージェントを実行します。

   ```sh
   curl -s -N -X POST localhost:4321/api/copilotkit/agent/default/run \
     -H 'content-type: application/json' -H 'accept: text/event-stream' \
     -d '{"threadId":"t1","runId":"r1","state":{},"messages":[{"id":"m1","role":"user","content":"こんにちは"}],"tools":[],"context":[],"forwardedProps":{}}'
   ```

   2.2.2 と同じ順序でイベントが返り、`TEXT_MESSAGE_CONTENT` の `delta` にモックの応答が入っていれば成功です。

> [!NOTE]
> - エンドポイントのファイルを作成する前から開発サーバーを起動していた場合は、`astro dev stop` で停止してから、起動し直してください。今回の環境では、起動したままだと `/info` が 500(`GetStaticPathsRequired`)を返しました。原因は特定していません。
> - `npm run build` は、サーバーアダプタがないと通りません(2.1.1 の NOTE を参照。第 5 章の 5.1 で解消します)。開発サーバーは、アダプタなしでも動きました。

## 第3章 認証を追加する

ブラウザからバックエンドへの通信を、Amazon Cognito の JWT で認証します。ログイン画面は Amplify Auth で作り、バックエンド(CopilotRuntime)が JWT を検証します。

### 3.1 Cognito を作成する

#### 3.1.1 sandbox をデプロイする

**手順**

1. `webapp/` で、sandbox を 1 回だけデプロイします。

   ```sh
   npx ampx sandbox --once
   ```

2. `webapp/amplify_outputs.json` が作成されたことを確認します。

> [!NOTE]
> - あなたの AWS アカウントに、Cognito のユーザープール、アプリクライアント、ID プール、IAM ロールが作成されます。リージョンは、AWS の設定に従います(今回は `ap-northeast-1`)。
> - 事前に、対象のアカウントとリージョンで `cdk bootstrap` を済ませておきます(Amplify のドキュメントの前提です)。
> - プロファイルを指定するときは `--profile` を付けます。`--once` は、ファイルの変更を監視せず、1 回だけデプロイする指定です。
> - 不要になったら `npx ampx sandbox delete` で削除できます。
> - `amplify_outputs.json` には、ユーザープールの ID などが入っています。パスワードやシークレットは入っていません。ただし、`webapp/.gitignore` には入っていないので、リポジトリに含めるかどうかは、別途決めてください。

#### 3.1.2 テストユーザーを作る

**手順**

1. 動作確認用のユーザーを作成します。`<user_pool_id>` は、`amplify_outputs.json` の `auth.user_pool_id` です。

   ```sh
   aws cognito-idp admin-create-user \
     --user-pool-id <user_pool_id> \
     --username test@example.com \
     --message-action SUPPRESS \
     --user-attributes Name=email,Value=test@example.com Name=email_verified,Value=true

   aws cognito-idp admin-set-user-password \
     --user-pool-id <user_pool_id> \
     --username test@example.com \
     --password '<パスワード>' \
     --permanent
   ```

> [!NOTE]
> - 今回は、AWS MCP から、同名の API(`AdminCreateUser`、`AdminSetUserPassword`)を呼んで作成しました。上のコマンドは、それに対応する AWS CLI の書き方で、そのままの形では実行していません。
> - ログイン画面の「Create Account」から、メールアドレスで登録する方法もあります。メールに届く確認コードが必要です。この方法は、試していません。

### 3.2 フロントエンドに認証を追加する

#### 3.2.1 パッケージのインストール

**手順**

1. Amplify の UI と、JWT の検証用のパッケージをインストールします。

   ```sh
   npm install aws-amplify @aws-amplify/ui-react aws-jwt-verify
   ```

#### 3.2.2 コンポーネントを書き換える

**手順**

1. `webapp/src/components/AiAssistant.tsx` を、次の内容に置き換えます。

   ```tsx
   import { useEffect, useRef, useState } from "react";
   import { Amplify } from "aws-amplify";
   import { fetchAuthSession } from "aws-amplify/auth";
   import { Authenticator } from "@aws-amplify/ui-react";
   import "@aws-amplify/ui-react/styles.css";
   import { CopilotKitProvider, CopilotPopup } from "@copilotkit/react-core/v2";
   import "@copilotkit/react-core/v2/styles.css";
   import outputs from "../../amplify_outputs.json";

   Amplify.configure(outputs);

   const RUNTIME_URL = "/api/copilotkit";
   // アクセストークンの更新間隔(ミリ秒)
   const TOKEN_REFRESH_MS = 5 * 60 * 1000;

   function Assistant() {
     const token = useRef("");
     const [ready, setReady] = useState(false);

     useEffect(() => {
       let active = true;
       const refresh = async () => {
         const session = await fetchAuthSession();
         token.current = session.tokens?.accessToken?.toString() ?? "";
         if (active) setReady(true);
       };
       refresh();
       const id = setInterval(refresh, TOKEN_REFRESH_MS);
       return () => {
         active = false;
         clearInterval(id);
       };
     }, []);

     // トークンを取得するまで、ランタイムに接続しない
     if (!ready) return null;

     return (
       <CopilotKitProvider
         runtimeUrl={RUNTIME_URL}
         headers={() => ({ Authorization: `Bearer ${token.current}` })}
       >
         <CopilotPopup
           labels={{ modalHeaderTitle: "AI Assistant", welcomeMessageText: "こんにちは!" }}
         />
       </CopilotKitProvider>
     );
   }

   export default function AiAssistant() {
     return <Authenticator>{() => <Assistant />}</Authenticator>;
   }
   ```

> [!NOTE]
> - `Authenticator` が、ログイン画面(Sign In、Create Account)を表示します。ログインすると、中のコンポーネントが表示されます。
> - Cognito のアクセストークンを、`CopilotKitProvider` の `headers` で、`Authorization: Bearer` として送ります。`headers` は、関数でも渡せます(型定義で確認しています)。トークンは、5 分ごとに更新します。
> - トークンを取得するまでは、ランタイムに接続しません。トークンなしで接続すると、バックエンドが 401 を返すためです。

#### 3.2.3 ページの指定を変える

**手順**

1. `webapp/src/pages/index.astro` の、`AiAssistant` の行を、次のように変更します。

   ```astro
   <AiAssistant client:only="react" />
   ```

> [!NOTE]
> - `client:only="react"` は、サーバーでは描画せず、ブラウザだけで描画する指定です。ログイン画面は、ブラウザ側のログイン状態に依存するため、この指定にしました。サーバーでの描画(`client:load`)のままにしたときの動作は、試していません。

### 3.3 バックエンドで JWT を検証する

**手順**

1. `webapp/src/pages/api/copilotkit/[...slug].ts` を、次の内容に置き換えます。

   ```ts
   import type { APIRoute } from "astro";
   import { HttpAgent } from "@ag-ui/client";
   import {
     CopilotRuntime,
     createCopilotRuntimeHandler,
   } from "@copilotkit/runtime/v2";
   import { CognitoJwtVerifier } from "aws-jwt-verify";
   import outputs from "../../../../amplify_outputs.json";

   // リクエストごとにサーバーで動かす(静的ファイルにしない)
   export const prerender = false;

   // AG-UI エンドポイント(開発中は aimock、将来は AgentCore Runtime)
   const AGENT_URL = import.meta.env.AGENT_URL ?? "http://localhost:4010/agui";

   // Cognito のアクセストークンを検証する
   const verifier = CognitoJwtVerifier.create({
     userPoolId: outputs.auth.user_pool_id,
     tokenUse: "access",
     clientId: outputs.auth.user_pool_client_id,
   });

   const runtime = new CopilotRuntime({
     agents: { default: new HttpAgent({ url: AGENT_URL }) },
   });

   const handler = createCopilotRuntimeHandler({
     runtime,
     basePath: "/api/copilotkit",
     hooks: {
       // 全リクエストで JWT を検証し、失敗したら 401 を返す
       onRequest: async ({ request }) => {
         const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
         if (!token) {
           throw new Response("Unauthorized", { status: 401 });
         }
         try {
           await verifier.verify(token);
         } catch {
           throw new Response("Unauthorized", { status: 401 });
         }
       },
     },
   });

   export const ALL: APIRoute = ({ request }) => handler(request);
   ```

> [!NOTE]
> - `hooks.onRequest` は、ルーティングの前に、全リクエストで呼ばれます。`Response` を `throw` すると、その応答で処理を打ち切ります(`@copilotkit/runtime` の型定義のコメントで確認しています)。
> - `CognitoJwtVerifier` は、`aws-jwt-verify` のクラスです。署名、有効期限、発行元、クライアント ID を検証します。フロントエンドが送るのはアクセストークンなので、`tokenUse` は `"access"` です。
> - ユーザープールの ID とクライアント ID は、フロントエンドと同じ `amplify_outputs.json` から読み込みます。

### 3.4 動作を確認する

**手順**

1. 開発サーバーと aimock が起動していることを確認します(2.2、2.3 を参照)。

2. トークンなしでリクエストして、401 が返ることを確認します。

   ```sh
   curl -s -o /dev/null -w "%{http_code}\n" localhost:4321/api/copilotkit/info
   curl -s -o /dev/null -w "%{http_code}\n" -H 'authorization: Bearer invalid.token.value' localhost:4321/api/copilotkit/info
   ```

3. ブラウザで `localhost:4321` を開き、ログイン画面が表示されることを確認します。

4. 3.1.2 で作ったテストユーザー(メールアドレスとパスワード)でログインします。

5. ポップアップのチャット欄に「こんにちは」と送り、モックの応答「こんにちは!AG-UI のモックです。」が表示されることを確認します。

> [!NOTE]
> - 確認した結果は、2 の 2 つがどちらも 401、5 の応答が表示されて、`info`、`threads`、`run` の 3 つのリクエストが 200 でした。
> - パッケージを追加した直後に、ブラウザのコンソールへ `504 (Outdated Optimize Dep)` が出ることがあります。開発サーバー(Vite)が、依存パッケージの事前変換をやり直したためで(ログに `Re-optimizing dependencies because lockfile has changed` と出ます)、チャットの動作には影響しません。ブラウザを再読み込みすると消えます。

## 第4章 エージェントを作る

### 4.1 Strands Agents をローカルで動かす

#### 4.1.1 プロジェクトを作る

**手順**

1. リポジトリのルートで、`agent/` を Python のプロジェクトとして作成します。

   ```sh
   uv init agent --app --no-workspace --python 3.12 --vcs none
   ```

2. `agent/` に移動し、依存パッケージを追加します。

   ```sh
   cd agent
   uv add strands-agents ag-ui-strands fastapi uvicorn
   ```

> [!NOTE]
> - 確認したバージョンは、`strands-agents` 1.57.0、`ag-ui-strands` 0.4.1、`fastapi` 0.141.1、`uvicorn` 0.54.0 です。
> - Python は 3.12 で確認しました。このマシンの標準の Python は 3.14.1 ですが、3.14 は試していません。
> - `ag-ui-strands` は、Strands のエージェントを AG-UI のプロトコルに対応させるパッケージです。

#### 4.1.2 エージェントを書く

**手順**

1. `agent/main.py` を、次の内容に置き換えます。

   ```python
   import os

   from ag_ui_strands import StrandsAgent, create_strands_app
   from strands import Agent
   from strands.models import BedrockModel

   REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
   MODEL_ID = os.environ.get("MODEL_ID", "jp.anthropic.claude-sonnet-4-6")

   strands_agent = Agent(
       model=BedrockModel(model_id=MODEL_ID, region_name=REGION),
       system_prompt="あなたは親切なアシスタントです。日本語で簡潔に答えてください。",
   )

   # AG-UI のプロトコルに対応させる
   agui_agent = StrandsAgent(
       agent=strands_agent,
       name="assistant",
       description="A helpful assistant",
   )

   # AgentCore Runtime の契約: ポート 8080 の /invocations(AG-UI)と /ping(ヘルスチェック)
   app = create_strands_app(
       agui_agent,
       path="/invocations",
       ping_path="/ping",
       cors_enabled=False,
   )

   if __name__ == "__main__":
       import uvicorn

       uvicorn.run(app, host="0.0.0.0", port=8080)
   ```

2. `agent/.gitignore` を、次の内容で作成します。

   ```
   .venv/
   __pycache__/
   ```

> [!NOTE]
> - `/invocations` と `/ping` は、AgentCore Runtime が AG-UI のコンテナに求める契約です(ポート 8080)。ローカルでも同じ形にしておくと、そのままデプロイできます。
> - `cors_enabled=False` は、ブラウザからではなく、バックエンド(Astro のランタイム)から呼ぶためです。
> - モデルは、東京リージョンの JP 推論プロファイル `jp.anthropic.claude-sonnet-4-6` です。環境変数 `MODEL_ID` と `AWS_REGION` で変更できます。Bedrock を呼ぶので、AWS の認証情報と、対象モデルの利用が必要です。

#### 4.1.3 起動して確認する

**手順**

1. `agent/` で、エージェントを起動します。

   ```sh
   uv run python main.py
   ```

2. 別のターミナルで、ヘルスチェックを確認します。

   ```sh
   curl -s localhost:8080/ping
   ```

   `{"status":"healthy"}` が返れば成功です。

3. エージェントに、AG-UI のリクエストを送ります。

   ```sh
   curl -s -N -X POST localhost:8080/invocations \
     -H 'content-type: application/json' -H 'accept: text/event-stream' \
     -d '{"threadId":"t1","runId":"r1","state":{},"messages":[{"id":"m1","role":"user","content":"こんにちは。自己紹介を1文でお願いします。"}],"tools":[],"context":[],"forwardedProps":{}}'
   ```

   `RUN_STARTED` から `RUN_FINISHED` まで、イベントが順に返り、`TEXT_MESSAGE_CONTENT` の `delta` に、モデルの応答が分割して入っていれば成功です。

> [!NOTE]
> - エージェントのログに、OpenTelemetry の `Failed to detach context`(`ValueError: ... was created in a different Context`)が出ました。2 リクエストで 6 回でした。応答には影響しませんでした。原因は特定していません。

### 4.2 Web アプリからエージェントに接続する

**手順**

1. `webapp/` で、開発サーバーを、`AGENT_URL` を指定して、起動し直します。

   ```sh
   npx astro dev stop
   AGENT_URL=http://localhost:8080/invocations npx astro dev --background
   ```

2. ブラウザで `localhost:4321` を開き、ログインして、ポップアップに質問を送ります(例: 「東京タワーの高さを教えて」)。

   モデルの応答(今回は「東京タワーの高さは333メートルです。…」)が、ストリーミングで表示されれば成功です。

> [!NOTE]
> - `AGENT_URL` は、シェルの環境変数として渡して、動作を確認しました。`.env` からの読み込みは、確認していません。
> - aimock に戻すときは、`AGENT_URL` を指定せずに、開発サーバーを起動し直します(既定値が aimock です)。

### 4.3 AgentCore Runtime を Amplify のカスタムリソースに定義する

エージェントを Amazon Bedrock AgentCore Runtime で動かす定義を、`amplify/backend.ts` に CDK で追加します。この節では、AWS へのデプロイはせず、ローカルで確認できる範囲(コンテナのビルドと、CloudFormation テンプレートの合成)までを行います。

#### 4.3.1 コンテナを定義する

**手順**

1. `agent/Dockerfile` を、次の内容で作成します。

   ```dockerfile
   # AgentCore Runtime は ARM64 のコンテナが必須
   FROM --platform=linux/arm64 ghcr.io/astral-sh/uv:python3.12-bookworm-slim

   WORKDIR /app

   # 依存パッケージ(ロックファイルどおりにインストール)
   COPY pyproject.toml uv.lock ./
   RUN uv sync --frozen --no-dev

   COPY main.py ./

   ENV PYTHONUNBUFFERED=1
   EXPOSE 8080

   CMD ["uv", "run", "--no-dev", "python", "main.py"]
   ```

2. `agent/.dockerignore` を、次の内容で作成します。

   ```
   .venv/
   __pycache__/
   ```

3. `agent/` で、ローカルでビルドして、コンテナが起動することを確認します。

   ```sh
   docker build --platform linux/arm64 -t strands-agent-test .
   docker run -d --rm -p 8081:8080 --name strands-test strands-agent-test
   curl -s localhost:8081/ping
   docker stop strands-test
   docker rmi strands-agent-test
   ```

   `{"status":"healthy"}` が返れば成功です。

> [!NOTE]
> - AgentCore Runtime が受け付けるコンテナは ARM64 だけです(AgentCore のドキュメントに記載)。今回のマシンは arm64(Apple シリコン)なので、そのままビルドできました。x86 のマシンでビルドするときは、`docker buildx` などのクロスビルドが必要です(未確認)。
> - `uv.lock` が必要です(`--frozen` でロックファイルどおりにインストールします)。`uv add` で自動的に作られるので、リポジトリに含めてください。
> - コンテナには AWS の認証情報を渡していないので、`/invocations`(Bedrock を呼ぶ)は、この確認の対象外です。

#### 4.3.2 `backend.ts` にエージェントを定義する

**手順**

1. `webapp/amplify/backend.ts` を、次の内容に置き換えます。

   ```ts
   import * as path from "node:path";
   import { defineBackend } from "@aws-amplify/backend";
   import * as agentcore from "aws-cdk-lib/aws-bedrockagentcore";
   import * as iam from "aws-cdk-lib/aws-iam";
   import { auth } from "./auth/resource";

   const backend = defineBackend({
     auth,
   });

   // エージェント(Strands)を AgentCore Runtime にデプロイする(カスタムリソース)
   const agentStack = backend.createStack("agent");

   const agentRuntime = new agentcore.Runtime(agentStack, "AgentRuntime", {
     // agent/ の Dockerfile からイメージをビルドして ECR に登録する(ARM64)
     agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
       path.resolve(process.cwd(), "..", "agent"),
     ),
     protocolConfiguration: agentcore.ProtocolType.AGUI,
   });

   // Bedrock のモデルを呼び出す権限(JP 推論プロファイルと、その先の基盤モデル)
   agentRuntime.addToRolePolicy(
     new iam.PolicyStatement({
       actions: [
         "bedrock:InvokeModel",
         "bedrock:InvokeModelWithResponseStream",
       ],
       resources: [
         "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
         `arn:aws:bedrock:*:${agentStack.account}:inference-profile/*anthropic.claude-*`,
       ],
     }),
   );

   // バックエンド(CopilotRuntime)が接続先を知るための出力
   backend.addOutput({
     custom: {
       agentRuntimeArn: agentRuntime.agentRuntimeArn,
     },
   });
   ```

> [!NOTE]
> - `aws-cdk-lib` の L2 コンストラクト `aws_bedrockagentcore.Runtime` を使います。実行ロールは自動で作られ、ログ、X-Ray、CloudWatch のメトリクス、ワークロードのアイデンティティ、ECR からのイメージ取得の権限が付きます。Bedrock の呼び出し権限だけを、`addToRolePolicy` で足しています。
> - `protocolConfiguration` を `AGUI` にすると、AgentCore Runtime は、ポート 8080 の `/invocations` に AG-UI のリクエストをそのまま渡します。
> - 認証は、L2 の既定(IAM の SigV4)のままです。呼び出し側(バックエンド)は、SigV4 で署名する必要があります。
> - エージェントのパスを `import.meta` ではなく `process.cwd()` から作っているのは、`definePipeline` が `backend.ts` を `require()` で読み込むため、`import.meta` が使えないからです(`@aws-amplify/hosting` の `pipeline_factory.ts` で確認)。`process.cwd()` は `webapp/` を前提にしています。
> - `runtimeName` は指定しません。固定の名前にすると、同じアカウントとリージョンに、別の環境(sandbox と `--identifier dev` など)を作ったとき、名前が重複して `AlreadyExists` で失敗しました。省略すると、環境ごとに一意な名前が付きます。
> - プラットフォームバージョンは指定していないので、V1 になります(省略時は V1。AgentCore のドキュメントに記載)。`aws-cdk-lib` 2.270.0 には `platformVersion` のプロパティがありません(確認済み)。
> - Bedrock の権限は、`anthropic.claude-*` の基盤モデルと、`*anthropic.claude-*` の推論プロファイルに、広く許可しています。本番では、使うモデルだけに絞ってください。

#### 4.3.3 ローカルで合成して確認する

**手順**

1. `webapp/` で、CloudFormation テンプレートを合成します。AWS には接続しません(アカウント ID はダミーです)。

   ```sh
   CDK_OUTDIR=/tmp/cdk.out CDK_DEFAULT_ACCOUNT=111111111111 CDK_DEFAULT_REGION=ap-northeast-1 \
   CDK_CONTEXT_JSON='{"amplify-backend-namespace":"synthtest","amplify-backend-name":"local","amplify-backend-type":"standalone"}' \
   npx tsx amplify/backend.ts
   ```

2. `/tmp/cdk.out` の `*agent*.nested.template.json` に、次のリソースがあることを確認します。

   - `AWS::IAM::Role`(実行ロール)
   - `AWS::IAM::Policy`(実行ロールのポリシー)
   - `AWS::BedrockAgentCore::Runtime`(`ProtocolConfiguration` が `AGUI`、`NetworkMode` が `PUBLIC`、`ContainerUri` が CDK のアセット用 ECR リポジトリ)

3. `/tmp/cdk.out` の `amplify-synthtest-*.template.json` の `customOutputs` に、`agentRuntimeArn` が含まれることを確認します。

> [!NOTE]
> - この確認では、コンテナイメージはビルドされず、ECR にも登録されません。イメージのビルドと登録は、デプロイのときに行われます。
> - 4.3.2 の後は、3.1.1 の `npx ampx sandbox --once` でも、Cognito に加えて、AgentCore Runtime(Docker イメージのビルドと ECR への登録を含む)が、AWS アカウントに作成されます。
> - AWS にデプロイして、ランタイムが作られて動くことは、4.4 節で確認しました。
> - **未確認**: `definePipeline` の CodeBuild(x86)で、ARM64 のイメージをビルドできるか(`synth` の `dockerEnabled` と、クロスビルドの設定が要る可能性があります)。
> - `amplify_outputs.json` は、デプロイ(`ampx sandbox`)で更新されるまで、`custom.agentRuntimeArn` を持ちません。

### 4.4 バックエンドから AgentCore Runtime に SigV4 で接続する

#### 4.4.1 AgentCore Runtime をデプロイする

**手順**

1. `webapp/` で、sandbox を更新します。

   ```sh
   npx ampx sandbox --once
   ```

   Docker イメージのビルドと ECR への登録、AgentCore Runtime の作成が行われます(今回は約 43 秒)。

2. `webapp/amplify_outputs.json` に、`custom.agentRuntimeArn` が追加されたことを確認します。

3. ランタイムの状態を確認します(`<runtime_id>` は ARN の最後の `runtime/` 以降です)。

   ```sh
   aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id <runtime_id> --region ap-northeast-1
   ```

   `status` が `READY`、`protocolConfiguration.serverProtocol` が `AGUI` であれば成功です。

> [!NOTE]
> - 手順 3 は、AWS MCP から同名の API(`GetAgentRuntime`)を呼んで確認しました。上のコマンドは、それに対応する AWS CLI の書き方で、そのままの形では実行していません。
> - 確認した結果は、`status: READY`、`agentRuntimeVersion: 1`、`serverProtocol: AGUI`、`networkMode: PUBLIC` でした。

#### 4.4.2 パッケージのインストール

**手順**

1. SigV4 の署名と、AWS の認証情報の取得に使うパッケージをインストールします。

   ```sh
   npm install @smithy/signature-v4 @smithy/protocol-http @aws-crypto/sha256-js @aws-sdk/credential-providers
   ```

#### 4.4.3 SigV4 署名つきの接続を書く

**手順**

1. `webapp/src/lib/agentcore.ts` を、次の内容で作成します。

   ```ts
   import { HttpAgent } from "@ag-ui/client";
   import type { HttpAgentFetchFn } from "@ag-ui/client";
   import { Sha256 } from "@aws-crypto/sha256-js";
   import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
   import { HttpRequest } from "@smithy/protocol-http";
   import { SignatureV4 } from "@smithy/signature-v4";

   // セッション ID の長さの制約(InvokeAgentRuntime の runtimeSessionId)
   const SESSION_ID_MIN_LENGTH = 33;
   const SESSION_ID_MAX_LENGTH = 256;

   // AgentCore Runtime の ARN から、リージョンを取り出す
   // 例: arn:aws:bedrock-agentcore:ap-northeast-1:123456789012:runtime/xxxx
   const regionOf = (arn: string): string => {
     const region = arn.split(":")[3];
     if (!region) throw new Error(`AgentCore Runtime の ARN が不正です: ${arn}`);
     return region;
   };

   // AG-UI の threadId から、AgentCore のセッション ID を作る(同じスレッドは同じセッション)
   const sessionIdOf = (threadId: string): string => {
     const padded = threadId.padEnd(SESSION_ID_MIN_LENGTH, "0");
     return padded.slice(0, SESSION_ID_MAX_LENGTH);
   };

   // リクエストに SigV4 で署名して送る fetch(サービス名は bedrock-agentcore)
   const createSigV4Fetch = (region: string): HttpAgentFetchFn => {
     const signer = new SignatureV4({
       credentials: fromNodeProviderChain(),
       region,
       service: "bedrock-agentcore",
       sha256: Sha256,
     });

     return async (url, init) => {
       const target = new URL(url);
       const body = typeof init.body === "string" ? init.body : "";
       const threadId = (JSON.parse(body || "{}") as { threadId?: string }).threadId ?? "default";

       const request = new HttpRequest({
         method: "POST",
         protocol: target.protocol,
         hostname: target.hostname,
         path: target.pathname,
         query: Object.fromEntries(target.searchParams),
         headers: {
           host: target.host,
           "content-type": "application/json",
           accept: "text/event-stream",
           "x-amzn-bedrock-agentcore-runtime-session-id": sessionIdOf(threadId),
         },
         body,
       });

       const signed = await signer.sign(request);
       return fetch(target, {
         method: "POST",
         headers: signed.headers,
         body,
         signal: init.signal,
       });
     };
   };

   // AgentCore Runtime(AG-UI)に、SigV4 署名つきで接続するエージェント
   export const createAgentCoreAgent = (runtimeArn: string): HttpAgent => {
     const region = regionOf(runtimeArn);
     const url =
       `https://bedrock-agentcore.${region}.amazonaws.com` +
       `/runtimes/${encodeURIComponent(runtimeArn)}/invocations?qualifier=DEFAULT`;
     return new HttpAgent({ url, fetch: createSigV4Fetch(region) });
   };
   ```

2. `webapp/src/pages/api/copilotkit/[...slug].ts` を、次の内容に置き換えます。

   ```ts
   import type { APIRoute } from "astro";
   import { HttpAgent } from "@ag-ui/client";
   import {
     CopilotRuntime,
     createCopilotRuntimeHandler,
   } from "@copilotkit/runtime/v2";
   import { CognitoJwtVerifier } from "aws-jwt-verify";
   import outputs from "../../../../amplify_outputs.json";
   import { createAgentCoreAgent } from "../../../lib/agentcore";

   // リクエストごとにサーバーで動かす(静的ファイルにしない)
   export const prerender = false;

   // エージェントの接続先
   //   AGENT_RUNTIME_ARN があれば、AgentCore Runtime に SigV4 署名つきで接続する
   //   なければ AGENT_URL(未設定なら aimock)に、署名なしで接続する
   const env = (name: string): string | undefined =>
     process.env[name] ?? (import.meta.env[name] as string | undefined);
   const AGENT_RUNTIME_ARN = env("AGENT_RUNTIME_ARN");
   const AGENT_URL = env("AGENT_URL") ?? "http://localhost:4010/agui";

   const agent = AGENT_RUNTIME_ARN
     ? createAgentCoreAgent(AGENT_RUNTIME_ARN)
     : new HttpAgent({ url: AGENT_URL });

   // Cognito のアクセストークンを検証する
   const verifier = CognitoJwtVerifier.create({
     userPoolId: outputs.auth.user_pool_id,
     tokenUse: "access",
     clientId: outputs.auth.user_pool_client_id,
   });

   const runtime = new CopilotRuntime({
     agents: { default: agent },
   });

   const handler = createCopilotRuntimeHandler({
     runtime,
     basePath: "/api/copilotkit",
     hooks: {
       // 全リクエストで JWT を検証し、失敗したら 401 を返す
       onRequest: async ({ request }) => {
         const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
         if (!token) {
           throw new Response("Unauthorized", { status: 401 });
         }
         try {
           await verifier.verify(token);
         } catch {
           throw new Response("Unauthorized", { status: 401 });
         }
       },
     },
   });

   export const ALL: APIRoute = ({ request }) => handler(request);
   ```

> [!NOTE]
> - AgentCore Runtime の呼び出しは、`POST https://bedrock-agentcore.<region>.amazonaws.com/runtimes/<ARN をエンコードしたもの>/invocations` です。セッション ID のヘッダー `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id` は、33〜256 文字が必要です(`InvokeAgentRuntime` の API リファレンス)。AG-UI の `threadId`(UUID の 36 文字)から作ります。
> - 署名に使う認証情報は、`fromNodeProviderChain()` が取得します。ローカルでは、環境変数や `~/.aws` の設定です。AWS 上(Lambda など)では、実行ロールです。呼び出し側のロールには、`bedrock-agentcore:InvokeAgentRuntime` の権限が必要です。
> - 接続先は、環境変数で切り替えます。`AGENT_RUNTIME_ARN` があれば AgentCore Runtime、なければ `AGENT_URL`(未設定なら aimock)です。

#### 4.4.4 動作を確認する

**手順**

1. `AGENT_RUNTIME_ARN` を指定して、開発サーバーを起動し直します。

   ```sh
   npx astro dev stop
   AGENT_RUNTIME_ARN=<amplify_outputs.json の custom.agentRuntimeArn> npx astro dev --background
   ```

2. ブラウザで `localhost:4321` を開き、ログインして、ポップアップに質問を送ります(例: 「富士山の標高を教えて」)。

   モデルの応答(今回は「富士山の標高は 3,776メートル です。…」)が表示されれば成功です。

3. AgentCore 側のログに、呼び出しが記録されていることを確認します。ロググループは `/aws/bedrock-agentcore/runtimes/<runtime_id>-DEFAULT` です。`POST /invocations 200 OK` が出ていれば、AgentCore Runtime を通っています。

> [!NOTE]
> - 手順 3 は、AWS MCP から CloudWatch Logs の API(`FilterLogEvents`)で確認しました。
> - `.env` からの `AGENT_RUNTIME_ARN` の読み込みは、確認していません(シェルの環境変数で渡しました)。
> - ローカルでエージェントを動かしたまま(ポート 8080)でも、`AGENT_RUNTIME_ARN` を指定すると、AgentCore Runtime が優先されます。

## 第5章 ホスティングを定義する

Amplify の `defineHosting`(自己管理型のホスティング)で、Web アプリを CloudFront + S3 + Lambda に載せる定義を作ります。5.1 から 5.3 は、ローカルで確認できる範囲(ビルドと、CloudFormation テンプレートの合成)です。5.4 で、AWS にデプロイして確認します。

### 5.1 サーバーアダプタを導入する

**手順**

1. `webapp/` で、Node.js 用のアダプタをインストールします。

   ```sh
   npm install @astrojs/node
   ```

2. `webapp/astro.config.mjs` を、次の内容に置き換えます。

   ```js
   // @ts-check
   import { defineConfig } from 'astro/config';

   import node from '@astrojs/node';
   import react from '@astrojs/react';

   // https://astro.build/config
   export default defineConfig({
     adapter: node({ mode: 'standalone' }),
     integrations: [react()],
     vite: {
       resolve: {
         noExternal: ['@copilotkit/react-core']
       },
       ssr: {
         // 依存をすべてサーバーのバンドルに含める(Lambda に node_modules を置かないため)
         noExternal: true
       }
     }
   });
   ```

3. 本番ビルドが通ることを確認します。

   ```sh
   npm run build
   ```

   `dist/client` と `dist/server/entry.mjs` が作られれば成功です。

4. ビルドしたサーバーを、単体で起動して確認します(ポートは、空いているものを使います)。

   ```sh
   HOST=127.0.0.1 PORT=4391 node dist/server/entry.mjs
   ```

   別のターミナルで、`curl -s -o /dev/null -w "%{http_code}\n" localhost:4391/` が 200、`curl -s -o /dev/null -w "%{http_code}\n" localhost:4391/api/copilotkit/info`(トークンなし)が 401 であれば成功です。

5. `dist/server` を、`node_modules` のない場所にコピーして、起動できることを確認します(Lambda と同じ条件です)。

   ```sh
   mkdir /tmp/dist-iso && cp -r dist/server /tmp/dist-iso/server
   cd /tmp/dist-iso && HOST=127.0.0.1 PORT=4392 node server/entry.mjs
   ```

   起動して、`/api/copilotkit/info`(トークンなし)が 401 であれば成功です(`/` は、静的ファイルをコピーしていないので 404 になります)。

> [!NOTE]
> - `@astrojs/node` は 11.1.6 で、`astro` の `^7.2.1` を要求します(npm の `peerDependencies`)。このプロジェクトの Astro 7.3.5 と合います。
> - `defineHosting` の Astro 用のアダプタ(`@aws-blocks/hosting` 0.3.1 の `adapters/astro.ts`)は、`astro.config` に `adapter` が設定されていれば、その設定をそのまま使います。`adapter` が未設定で `output: 'server'` のときは、自動で `@astrojs/node@^9` を入れて、ビルドします。この `^9` は、Astro 7 と合わない可能性があります(未検証)。そのため、11 系を自分で設定しました。
> - 同じアダプタが検証済みとする Astro のバージョンの範囲は `>=4.0.0 <6.0.0` で、Astro 7.3.5 は範囲外です。ただし、ビルドと合成は通り(5.3 節)、AWS にデプロイした後の動作も確認できました(5.4 節)。
> - `vite.ssr.noExternal: true` は、`adapter` を自分で設定したときに必要です。ないと、サーバーのバンドルが外部パッケージ(今回は `@oslojs/encoding`)を要求し、Lambda で `Cannot find package` になって、CloudFront が 502 を返しました。`adapter` が未設定のときは、`defineHosting` のアダプタが、この設定を自動で付けます(`adapters/astro.ts` の `buildBridgeConfigSource`)。
> - ビルド時に「Enabling sessions with filesystem storage」と出ます。このアプリはセッションを使わないので、影響はありません(確認はしていません)。
> - ポートが別のプロセスに使われていると、別のサーバーのページが返ります(`curl` の結果が、想定と違う内容になります)。`<title>` などで、自分のサーバーの応答か確認してください。

### 5.2 `defineHosting` を定義する

**手順**

1. `@aws-amplify/hosting` を、開発用の依存としてインストールします。

   ```sh
   npm install -D @aws-amplify/hosting
   ```

2. `webapp/amplify/hosting.ts` を、次の内容で作成します。

   ```ts
   import * as iam from "aws-cdk-lib/aws-iam";
   import * as lambda from "aws-cdk-lib/aws-lambda";
   import { defineHosting } from "@aws-amplify/hosting";

   const hosting = defineHosting({
     // エージェントの応答(SSE)が長くなるため、SSR の Lambda のタイムアウトを延ばす(既定は 30 秒)
     compute: { timeout: 60 },
   });

   // SSR の Lambda に、AgentCore Runtime を呼び出す権限を付ける(SigV4 署名に使われる実行ロール)
   // defineHosting の resources には SSR の Lambda が含まれないため、CDK のツリーから探す
   const { region, account } = hosting.stack;
   for (const construct of hosting.stack.node.findAll()) {
     if (
       construct instanceof lambda.Function &&
       /Compute-(default|server)/.test(construct.node.path)
     ) {
       construct.addToRolePolicy(
         new iam.PolicyStatement({
           actions: ["bedrock-agentcore:InvokeAgentRuntime"],
           resources: [`arn:aws:bedrock-agentcore:${region}:${account}:runtime/*`],
         }),
       );
     }
   }
   ```

3. `webapp/src/pages/api/copilotkit/[...slug].ts` を、次の内容に置き換えます(4.4.3 からの変更は、接続先を決める部分だけです)。

   ```ts
   import type { APIRoute } from "astro";
   import { HttpAgent } from "@ag-ui/client";
   import {
     CopilotRuntime,
     createCopilotRuntimeHandler,
   } from "@copilotkit/runtime/v2";
   import { CognitoJwtVerifier } from "aws-jwt-verify";
   import outputs from "../../../../amplify_outputs.json";
   import { createAgentCoreAgent } from "../../../lib/agentcore";

   // リクエストごとにサーバーで動かす(静的ファイルにしない)
   export const prerender = false;

   // エージェントの接続先
   //   AGENT_RUNTIME_ARN があれば、AgentCore Runtime に SigV4 署名つきで接続する
   //   本番ビルドでは、環境変数がなくても、amplify_outputs.json の ARN に接続する
   //   どちらもなければ AGENT_URL(未設定なら aimock)に、署名なしで接続する
   const env = (name: string): string | undefined =>
     process.env[name] ?? (import.meta.env[name] as string | undefined);
   const outputsArn = (outputs as { custom?: { agentRuntimeArn?: string } }).custom
     ?.agentRuntimeArn;
   const AGENT_RUNTIME_ARN =
     env("AGENT_RUNTIME_ARN") ?? (import.meta.env.PROD ? outputsArn : undefined);
   const AGENT_URL = env("AGENT_URL") ?? "http://localhost:4010/agui";

   const agent = AGENT_RUNTIME_ARN
     ? createAgentCoreAgent(AGENT_RUNTIME_ARN)
     : new HttpAgent({ url: AGENT_URL });

   // Cognito のアクセストークンを検証する
   const verifier = CognitoJwtVerifier.create({
     userPoolId: outputs.auth.user_pool_id,
     tokenUse: "access",
     clientId: outputs.auth.user_pool_client_id,
   });

   const runtime = new CopilotRuntime({
     agents: { default: agent },
   });

   const handler = createCopilotRuntimeHandler({
     runtime,
     basePath: "/api/copilotkit",
     hooks: {
       // 全リクエストで JWT を検証し、失敗したら 401 を返す
       onRequest: async ({ request }) => {
         const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
         if (!token) {
           throw new Response("Unauthorized", { status: 401 });
         }
         try {
           await verifier.verify(token);
         } catch {
           throw new Response("Unauthorized", { status: 401 });
         }
       },
     },
   });

   export const ALL: APIRoute = ({ request }) => handler(request);
   ```

> [!NOTE]
> - `defineHosting` は、`amplify/backend.ts` とは別のファイル(`amplify/hosting.ts`)に書きます(`@aws-amplify/hosting` のソースのコメントで確認)。
> - SSR の Lambda の既定値は、メモリ 1024 MB、タイムアウト 30 秒、x86_64 です(`@aws-blocks/hosting` 0.3.1 の `compute_construct.ts`)。ここでは、タイムアウトだけ 60 秒に延ばしました。
> - SSR の Lambda に権限を付けるため、CDK のツリー(`hosting.stack.node.findAll()`)から、`Compute-default` を含むパスの `lambda.Function` を探しています。`defineHosting` の `resources` には、`bucket`、`distribution`、`distributionUrl`、`buildCacheBucket` しかなく、SSR の Lambda は含まれません(ソースの型定義で確認)。
> - 権限のリソースは、`runtime/*` とアカウント・リージョンで絞っています。特定のランタイムだけに絞るには、`amplify_outputs.json` の ARN を読む方法が考えられますが、試していません。
> - 本番ビルドでは、`amplify_outputs.json` が SSR の Lambda のバンドルに同梱されます(`Copied amplify_outputs.json → dist/amplify_outputs.json` と出力されます)。そのため、環境変数を設定しなくても、`outputs.custom.agentRuntimeArn` から接続先を決められます。
> - CloudFront の価格クラスは、既定の `PRICE_CLASS_100`(米国、カナダ、欧州)のままです。日本のエッジを含めるには、`cdn.priceClass` を指定します(`doc/hosting-cost-comparison.md` を参照)。

### 5.3 ローカルで合成して確認する

**手順**

1. `webapp/` で、CloudFormation テンプレートを合成します。AWS には接続しません(アカウント ID はダミーです)。このとき `npm run build` も実行されます。

   ```sh
   CDK_OUTDIR=/tmp/cdk-host.out CDK_DEFAULT_ACCOUNT=111111111111 CDK_DEFAULT_REGION=ap-northeast-1 \
   CDK_CONTEXT_JSON='{"amplify-backend-namespace":"synthtest","amplify-backend-name":"local","amplify-backend-type":"standalone"}' \
   npx tsx amplify/hosting.ts
   ```

2. `/tmp/cdk-host.out` の `*hosting*.nested.template.json` で、次を確認します。

   - SSR の `AWS::Lambda::Function`: `nodejs24.x`、メモリ 1024、タイムアウト 60、`x86_64`、レイヤー 1 つ
   - `AWS::IAM::Policy` に、`bedrock-agentcore:InvokeAgentRuntime` を許可する文(`arn:aws:bedrock-agentcore:<region>:<account>:runtime/*`)
   - `AWS::ApiGateway::Method` の `ResponseTransferMode` が `STREAM`(SSE を流すため)
   - `AWS::CloudFront::Distribution` の `PriceClass` が `PriceClass_100`
   - `AWS::CloudWatch::Alarm` が 3 個

> [!NOTE]
> - 合成では、次のメッセージが出ます: 「Installing sharp (linux-x64) into the Astro SSR bundle」、「Astro remote-image redirect patch found no matching fetch(…{redirect:"manual"})」。後者は、リモート画像を使わないこのアプリには影響しません(確認はしていません)。

### 5.4 AWS にデプロイして確認する

**手順**

1. `amplify_outputs.json` のバックアップを取ります。`ampx deploy` は、これをプロジェクト直下に書き出し、sandbox の内容を上書きするためです。

   ```sh
   cp amplify_outputs.json /tmp/sandbox-outputs.json
   ```

2. `webapp/` で、デプロイします。

   ```sh
   npx ampx deploy --identifier dev
   ```

   Cognito、AgentCore Runtime、CloudFront、S3、Lambda、API Gateway が作られます(今回は、バックエンドが約 70 秒、ホスティングが約 280 秒)。`--yes` を付けると、確認を飛ばして適用します。

3. 新しい Cognito のユーザープール(`amplify_outputs.json` の `auth.user_pool_id`)に、3.1.2 と同じ手順でテストユーザーを作ります。

4. CloudFront のドメイン名(`aws cloudfront list-distributions` で、更新時刻が最新のもの)をブラウザで開き、ログインして、質問を送ります。今回は、AWS MCP から同名の API(`ListDistributions`)を呼んで、ドメイン名を調べました。上のコマンドは、それに対応する AWS CLI の書き方で、そのままの形では実行していません。

   モデルの応答が表示されれば成功です。

5. ストリーミングを確認します。ログイン後のページのコンソールで、次を実行します。

   ```js
   const token = localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('.accessToken')));
   const t0 = performance.now();
   const res = await fetch('/api/copilotkit/agent/default/run', {
     method: 'POST',
     headers: { 'content-type': 'application/json', accept: 'text/event-stream', authorization: 'Bearer ' + token },
     body: JSON.stringify({ threadId: crypto.randomUUID(), runId: crypto.randomUUID(), state: {}, messages: [{ id: 'm1', role: 'user', content: '富士山について、5つの豆知識を教えて' }], tools: [], context: [], forwardedProps: {} })
   });
   const reader = res.body.getReader();
   const times = [];
   while (true) { const { done } = await reader.read(); if (done) break; times.push(Math.round(performance.now() - t0)); }
   console.log(times.length, times[0], times.at(-1));
   ```

   チャンクの数が多く、最初と最後の到着時刻に差があれば、途中でまとめられずに、ストリーミングされています。

> [!NOTE]
> - 確認した結果は、次のとおりです。
>   - ログイン画面が表示され、ログイン後に、CopilotKit のポップアップが表示された(既定の CSP に阻まれなかった)。
>   - 質問への応答が、CloudFront → API Gateway → SSR の Lambda → AgentCore Runtime(SigV4)の経路で、返ってきた。
>   - SSE は、203 個のチャンクに分かれて、約 9.6 秒にわたって届いた(最初のチャンクが 1.35 秒)。
> - 最初のデプロイでは、2 つの失敗がありました。どちらも、ここまでの手順に反映済みです。
>   - AgentCore Runtime の名前の重複(`AlreadyExists`)。4.3.2 の NOTE を参照。
>   - Lambda で `Cannot find package '@oslojs/encoding'`(CloudFront が 502)。5.1 の NOTE を参照。
> - CloudFront から API Gateway へ流れるので、API Gateway の URL に直接アクセスすると、リソースポリシーで 403 になります(設計どおりです)。
> - `ampx sandbox` で作った環境は、`--identifier dev` の環境とは別に、AWS アカウントに残ります。不要なら `npx ampx sandbox delete` で削除できます。
> - デプロイ後の `amplify_outputs.json` は、`dev` の環境の内容です。ローカルの開発を sandbox の環境に戻すには、手順 1 のバックアップを `webapp/amplify_outputs.json` に戻します。

## 第6章 CI/CD を作る(GitHub Actions)

`main` への push で、自動でデプロイします。エージェントと Web アプリを、別々のワークフローにして、変更したフォルダに応じて、片方だけをデプロイします。

### 6.1 方針

- `definePipeline` は、1 回の実行で、バックエンド(Cognito と AgentCore)とホスティングを、必ず両方デプロイします(`@aws-amplify/hosting` の `pipeline_factory.ts` で、この 2 段階が固定されています)。エージェントだけ、Web アプリだけ、という切り分けができないため、使いません。
- `ampx deploy` は、`--backend`(Cognito と AgentCore だけ)と `--frontend`(ホスティングだけ)を、別々に実行できます(`@aws-amplify/backend-cli` の `deploy_command.js` で確認)。これを、GitHub Actions の別々のワークフローから実行します。
- `--frontend` は、デプロイ済みのバックエンドの CloudFormation のスタックから、`amplify_outputs.json` を自動で作り直します。バックエンドのジョブの成果物を、受け渡す必要はありません。

### 6.2 ワークフローを作る

**手順**

1. `.github/workflows/deploy-agent.yml` を、次の内容で作成します(リポジトリのルートです)。

   ```yaml
   name: Deploy agent

   # エージェント(agent/)と、バックエンド定義(Cognito、AgentCore)が変わったときだけ動く
   on:
     push:
       branches: [main]
       paths:
         - "agent/**"
         - "webapp/amplify/backend.ts"
         - "webapp/amplify/auth/**"
         - ".github/workflows/deploy-agent.yml"
     workflow_dispatch:

   permissions:
     id-token: write # OIDC で AWS のロールを引き受ける
     contents: read

   concurrency:
     group: deploy-agent
     cancel-in-progress: false

   env:
     AWS_REGION: ap-northeast-1
     AMPLIFY_IDENTIFIER: dev

   jobs:
     deploy:
       runs-on: ubuntu-latest
       defaults:
         run:
           working-directory: webapp
       steps:
         - uses: actions/checkout@v4

         - uses: actions/setup-node@v4
           with:
             node-version: 22
             cache: npm
             cache-dependency-path: webapp/package-lock.json

         # x86 のランナーで、ARM64 の Docker イメージをビルドするため
         - uses: docker/setup-qemu-action@v3
           with:
             platforms: arm64

         - run: npm ci

         - uses: aws-actions/configure-aws-credentials@v4
           with:
             role-to-assume: ${{ vars.AWS_ROLE_ARN }}
             aws-region: ${{ env.AWS_REGION }}

         # バックエンド(Cognito と AgentCore Runtime)だけをデプロイする
         - run: npx ampx deploy --identifier "$AMPLIFY_IDENTIFIER" --backend --yes
   ```

2. `.github/workflows/deploy-web.yml` を、次の内容で作成します。

   ```yaml
   name: Deploy web

   # Web アプリ(webapp/ のフロントエンド)が変わったときだけ動く
   on:
     push:
       branches: [main]
       paths:
         - "webapp/src/**"
         - "webapp/public/**"
         - "webapp/astro.config.mjs"
         - "webapp/tsconfig.json"
         - "webapp/package.json"
         - "webapp/package-lock.json"
         - "webapp/amplify/hosting.ts"
         - ".github/workflows/deploy-web.yml"
     workflow_dispatch:

   permissions:
     id-token: write # OIDC で AWS のロールを引き受ける
     contents: read

   concurrency:
     group: deploy-web
     cancel-in-progress: false

   env:
     AWS_REGION: ap-northeast-1
     AMPLIFY_IDENTIFIER: dev

   jobs:
     deploy:
       runs-on: ubuntu-latest
       defaults:
         run:
           working-directory: webapp
       steps:
         - uses: actions/checkout@v4

         - uses: actions/setup-node@v4
           with:
             node-version: 22
             cache: npm
             cache-dependency-path: webapp/package-lock.json

         - run: npm ci

         - uses: aws-actions/configure-aws-credentials@v4
           with:
             role-to-assume: ${{ vars.AWS_ROLE_ARN }}
             aws-region: ${{ env.AWS_REGION }}

         # ホスティング(CloudFront、S3、Lambda)だけをデプロイする
         # amplify_outputs.json は、デプロイ済みのバックエンドから自動で作られる
         - run: npx ampx deploy --identifier "$AMPLIFY_IDENTIFIER" --frontend --yes
   ```

3. `webapp/amplify/backend.ts` の Docker アセットに、ARM64 のプラットフォームを明示します。

   ```ts
   import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";

   // ...
   agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
     path.resolve(process.cwd(), "..", "agent"),
     { platform: ecrAssets.Platform.LINUX_ARM64 },
   ),
   ```

> [!NOTE]
> - `paths:` で、変更したフォルダに応じて、片方のワークフローだけが動きます(GitHub Actions の標準機能です)。`webapp/amplify/backend.ts` はエージェントのデプロイ定義を含むため、`deploy-agent.yml` に入れています。
> - `AMPLIFY_IDENTIFIER` は、デプロイする環境の名前です。5.4 で作った `dev` と同じにしているので、同じスタックが更新されます。
> - `--backend` を先にデプロイしていないと、`--frontend` は「Backend has not been deployed yet」で失敗します(`deploy_command.js` のエラー)。最初の 1 回は、`deploy-agent` を先に動かします。
> - Web アプリのビルドには、`amplify_outputs.json` の `custom.agentRuntimeArn` が含まれます。エージェントのランタイムが作り直されて、ARN が変わったときは、`deploy-web` も動かす必要があります。
> - `backend.ts` の `platform` の指定は、ローカルの合成で `linux/arm64` がアセットに入ることを確認しました。
> - **この章のワークフローは、まだ GitHub 上で実行していません。** 実行するには、`main` への push が必要です。

### 6.3 AWS 側に、GitHub Actions 用のロールを作る

GitHub Actions は、OIDC で AWS のロールを引き受けます(長期のアクセスキーを保存しません)。

**手順**

1. GitHub の OIDC プロバイダーを作ります(アカウントに 1 つ)。

   ```sh
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com
   ```

2. ロールを作ります。信頼ポリシー(`trust.json`)は、このリポジトリの `main` ブランチだけに、引き受けを許可します。`<account_id>` は、AWS のアカウント ID です。

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::<account_id>:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:KMiya84377/techbookfest21-frontend:ref:refs/heads/main"
           }
         }
       }
     ]
   }
   ```

   ```sh
   aws iam create-role \
     --role-name github-actions-techbookfest21-deploy \
     --assume-role-policy-document file://trust.json
   ```

3. ロールに、権限を付けます(`policy.json`)。`@aws-amplify/hosting` の `definePipeline` が、ホスティングのデプロイ用の CodeBuild に付ける権限(`pipeline_factory.ts`)と、同じ範囲です。

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": "sts:AssumeRole",
         "Resource": "arn:aws:iam::<account_id>:role/cdk-*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "cloudformation:*", "s3:*", "amplify:*", "appsync:*",
           "cognito-idp:*", "cognito-identity:*", "dynamodb:*", "lambda:*",
           "ssm:GetParameter*", "ssm:PutParameter", "logs:*",
           "cloudfront:*", "route53:*", "acm:*"
         ],
         "Resource": "*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "iam:PassRole", "iam:CreateRole", "iam:AttachRolePolicy",
           "iam:PutRolePolicy", "iam:GetRole", "iam:GetRolePolicy",
           "iam:DeleteRole", "iam:DeleteRolePolicy", "iam:DetachRolePolicy"
         ],
         "Resource": [
           "arn:aws:iam::<account_id>:role/cdk-*",
           "arn:aws:iam::<account_id>:role/amplify*"
         ]
       }
     ]
   }
   ```

   ```sh
   aws iam put-role-policy \
     --role-name github-actions-techbookfest21-deploy \
     --policy-name ampx-deploy \
     --policy-document file://policy.json
   ```

4. GitHub のリポジトリの「Settings → Secrets and variables → Actions → Variables」に、`AWS_ROLE_ARN` を追加します。値は、作成したロールの ARN(`arn:aws:iam::<account_id>:role/github-actions-techbookfest21-deploy`)です。

> [!NOTE]
> - 手順 1〜3 の AWS CLI のコマンドは、そのままの形では実行していません(実行は、権限の制限でブロックされました)。
> - **未確認**: 上の権限で、`ampx deploy` が最後まで通るか。足りない権限があれば、ワークフローのエラーに出ます。
> - **未確認**: x86 のランナー(`ubuntu-latest`)で、QEMU を使った ARM64 の Docker ビルドが、期待どおりに通り、実用的な時間で終わるか。
