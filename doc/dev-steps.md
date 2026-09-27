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
       plugins: [
         {
           // 依存をすべてサーバーのバンドルに含める(Lambda に node_modules を置かないため)
           // 開発サーバーでは、この設定で起動に失敗するため、ビルドのときだけ有効にする
           name: 'bundle-ssr-dependencies',
           config(_, { command }) {
             return command === 'build' ? { ssr: { noExternal: true } } : {};
           }
         }
       ]
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
> - `vite.ssr.noExternal: true` は、開発サーバーでは使えません。`astro.config.mjs` に直接書くと、`astro dev` が「Failed to create the dev server app: module is not defined」で、ページを返さなくなりました(確認済み。`astro dev logs` に出ます)。そのため、Vite のプラグインの `config` フックで、ビルドのときだけ付けています(この形で、開発サーバーの起動と、ビルドの成功を確認しました)。
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

GitHub Actionsから必要なときだけ手動でデプロイします。意図しない実行を避けるため、pushによる自動デプロイは一旦設定しません。エージェントと Web アプリは、別々のワークフローにします。

### 6.1 方針

- `definePipeline` は、1 回の実行で、バックエンド(Cognito と AgentCore)とホスティングを、必ず両方デプロイします(`@aws-amplify/hosting` の `pipeline_factory.ts` で、この 2 段階が固定されています)。エージェントだけ、Web アプリだけ、という切り分けができないため、使いません。
- `ampx deploy` は、`--backend`(Cognito と AgentCore だけ)と `--frontend`(ホスティングだけ)を、別々に実行できます(`@aws-amplify/backend-cli` の `deploy_command.js` で確認)。これを、GitHub Actions の別々のワークフローから実行します。
- `--frontend` は、デプロイ済みのバックエンドの CloudFormation のスタックから、`amplify_outputs.json` を自動で作り直します。バックエンドのジョブの成果物を、受け渡す必要はありません。

### 6.2 ワークフローを作る

**手順**

1. `.github/workflows/deploy-agent.yml` を、次の内容で作成します(リポジトリのルートです)。

   ```yaml
   name: Deploy agent

   # 必要なときに、GitHub Actions から手動で実行する
   on:
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

         # バックエンド(Cognito、AgentCore Runtime、毎朝の実行の Lambda と Scheduler)だけをデプロイする
         - run: npx ampx deploy --identifier "$AMPLIFY_IDENTIFIER" --backend --yes
   ```

2. `.github/workflows/deploy-web.yml` を、次の内容で作成します。

   ```yaml
   name: Deploy web

   # 必要なときに、GitHub Actions から手動で実行する
   on:
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
> - 現在はpushでは起動せず、Actions画面から手動で実行します。バックエンドとWebを同時に変更した場合は、`deploy-agent` の成功後に `deploy-web` を実行します。
> - `AMPLIFY_IDENTIFIER` は、デプロイする環境の名前です。5.4 で作った `dev` と同じにしているので、同じスタックが更新されます。
> - `--backend` を先にデプロイしていないと、`--frontend` は「Backend has not been deployed yet」で失敗します(`deploy_command.js` のエラー)。最初の 1 回は、`deploy-agent` を先に動かします。
> - Web アプリのビルドには、`amplify_outputs.json` の `custom.agentRuntimeArn` が含まれます。エージェントのランタイムが作り直されて、ARN が変わったときは、`deploy-web` も動かす必要があります。
> - `backend.ts` の `platform` の指定は、ローカルの合成で `linux/arm64` がアセットに入ることを確認しました。
> - **この章のワークフローは、まだ GitHub 上で実行していません。** GitHubのActions画面から `workflow_dispatch` で手動実行します。

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

## 第7章 クエストボードと、クエストの API を作る

機能仕様書(`doc/機能仕様書.md`)の 5 章のうち、メイン領域(クエストボードとクエスト詳細)と、チャット領域の 2 分割を作ります。クエストは、エージェントを通さず、Astro の API(`/api/quests`)が DynamoDB から取得して返します。テーブルは、CDK で作ります。技術の想定は、`doc/設計メモ.md` にあります。Generative UI(理解度チェックなど)は、この章では入れません。

### 7.1 認証を、開発時だけ外せるようにする

画面の確認のたびにログインしなくて済むよう、開発サーバーを `--mode mock` で起動したときだけ、認証を外します。

- 判定は `import.meta.env.DEV && import.meta.env.MODE === "mock"` です。`import.meta.env.DEV` は、開発サーバー以外(ビルド)では常に `false` なので、ビルドした成果物では、認証は外れません。
- `amplify_outputs.json` は、デプロイで作られるファイルです(git の管理外)。`import.meta.glob` で読み込むと、ファイルがなくても、起動が止まりません。
- JWT の検証は、`src/lib/auth.ts` にまとめます。CopilotRuntime のエンドポイントと、クエストの API が、同じ関数を使います。検証に成功すると、ユーザー ID(Cognito の `sub`)を返します。

**手順**

1. `webapp/src/lib/outputs.ts` を、次の内容で作成します。

   ```ts
   // amplify_outputs.json は、デプロイで生成される(git の管理外)
   // import.meta.glob なら、ファイルがなくても、ビルドと起動が止まらない
   type Outputs = {
     auth: {
       aws_region: string;
       user_pool_id: string;
       user_pool_client_id: string;
       [key: string]: unknown;
     };
     custom?: { agentRuntimeArn?: string; questTableName?: string };
     [key: string]: unknown;
   };

   const found = import.meta.glob<Outputs>("../../amplify_outputs.json", {
     eager: true,
     import: "default",
   });

   export const outputs: Outputs | undefined = Object.values(found)[0];

   // 認証を外すのは、`astro dev --mode mock` のときだけ
   // import.meta.env.DEV は、開発サーバー以外(ビルド)では常に false
   export const AUTH_DISABLED =
     import.meta.env.DEV && import.meta.env.MODE === "mock";
   ```

2. `webapp/src/lib/auth.ts` を、次の内容で作成します。

   ```ts
   import { CognitoJwtVerifier } from "aws-jwt-verify";
   import { AUTH_DISABLED, outputs } from "./outputs";

   // mock モード(認証なし)で使うユーザー ID
   export const MOCK_USER_ID = "mock-user";

   // Cognito のアクセストークンを検証する
   // `astro dev --mode mock` のときだけ、認証を外す(ビルドでは外れない)
   if (!AUTH_DISABLED && !outputs) {
     throw new Error(
       "amplify_outputs.json がありません。npx ampx sandbox などで生成するか、認証なしで動かす場合は npm run dev:mock を使ってください",
     );
   }
   const verifier =
     !AUTH_DISABLED && outputs
       ? CognitoJwtVerifier.create({
           userPoolId: outputs.auth.user_pool_id,
           tokenUse: "access",
           clientId: outputs.auth.user_pool_client_id,
         })
       : undefined;

   // リクエストのトークンを検証して、ユーザー ID(Cognito の sub)を返す
   // 認証に失敗したら null を返す
   export async function authenticate(request: Request): Promise<string | null> {
     if (!verifier) return MOCK_USER_ID;
     const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
     if (!token) return null;
     try {
       const payload = await verifier.verify(token);
       return payload.sub;
     } catch {
       return null;
     }
   }
   ```

3. `webapp/src/pages/api/copilotkit/[...slug].ts` を、次の内容に置き換えます(5.2 の内容からの変更は、`amplify_outputs.json` の読み込みと、JWT の検証を、`auth.ts` に移したことです)。

   ```ts
   import type { APIRoute } from "astro";
   import { HttpAgent } from "@ag-ui/client";
   import {
     CopilotRuntime,
     createCopilotRuntimeHandler,
   } from "@copilotkit/runtime/v2";
   import { createAgentCoreAgent } from "../../../lib/agentcore";
   import { authenticate } from "../../../lib/auth";
   import { outputs } from "../../../lib/outputs";

   // リクエストごとにサーバーで動かす(静的ファイルにしない)
   export const prerender = false;

   // エージェントの接続先
   //   AGENT_RUNTIME_ARN があれば、AgentCore Runtime に SigV4 署名つきで接続する
   //   本番ビルドでは、環境変数がなくても、amplify_outputs.json の ARN に接続する
   //   どちらもなければ AGENT_URL(未設定なら aimock)に、署名なしで接続する
   const env = (name: string): string | undefined =>
     process.env[name] ?? (import.meta.env[name] as string | undefined);
   const AGENT_RUNTIME_ARN =
     env("AGENT_RUNTIME_ARN") ??
     (import.meta.env.PROD ? outputs?.custom?.agentRuntimeArn : undefined);
   const AGENT_URL = env("AGENT_URL") ?? "http://localhost:4010/agui";

   const agent = AGENT_RUNTIME_ARN
     ? createAgentCoreAgent(AGENT_RUNTIME_ARN)
     : new HttpAgent({ url: AGENT_URL });

   const runtime = new CopilotRuntime({
     agents: { default: agent },
   });

   const handler = createCopilotRuntimeHandler({
     runtime,
     basePath: "/api/copilotkit",
     hooks: {
       // 全リクエストで JWT を検証し、失敗したら 401 を返す
       onRequest: async ({ request }) => {
         if (!(await authenticate(request))) {
           throw new Response("Unauthorized", { status: 401 });
         }
       },
     },
   });

   export const ALL: APIRoute = ({ request }) => handler(request);
   ```

4. `webapp/src/components/AuthGate.tsx` を、次の内容で作成します。3.2 の `AiAssistant.tsx` の、ログイン画面とトークンの取得の部分を、切り出したものです。

   ```tsx
   import { useEffect, useRef, useState, type ReactNode } from "react";
   import { Amplify } from "aws-amplify";
   import { fetchAuthSession } from "aws-amplify/auth";
   import { Authenticator } from "@aws-amplify/ui-react";
   import "@aws-amplify/ui-react/styles.css";
   import { outputs } from "../lib/outputs";

   if (outputs) Amplify.configure(outputs as Parameters<typeof Amplify.configure>[0]);

   // アクセストークンの更新間隔(ミリ秒)
   const TOKEN_REFRESH_MS = 5 * 60 * 1000;

   type Children = (getToken: () => string) => ReactNode;

   function Session({ children }: { children: Children }) {
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
     return <>{children(() => token.current)}</>;
   }

   // ログインした人にだけ、子(トークンの取得関数を受け取る)を表示する
   export default function AuthGate({ children }: { children: Children }) {
     if (!outputs) {
       return (
         <p style={{ padding: 24 }}>
           amplify_outputs.json がありません。npx ampx sandbox などで生成するか、認証なしで動かす場合は
           npm run dev:mock を使ってください。
         </p>
       );
     }
     return (
       <Authenticator>
         {() => <Session>{children}</Session>}
       </Authenticator>
     );
   }
   ```

> [!NOTE]
> - `amplify_outputs.json` がないとき、`npm run dev:mock` は起動して、`/api/copilotkit/info` は 200 を返します(確認済み)。`npm run dev`(認証あり)は、500 になり、「amplify_outputs.json がありません」というエラーになります(確認済み)。
> - `astro build --mode mock` で作ったサーバーでも、トークンなしの `/api/copilotkit/info` と `/api/quests` は 401 でした(確認済み)。

### 7.2 クエストの API を作る

クエストは、テーブルに、ユーザーごとに保存します。キーは、`userId`(ユーザー ID)と `questId`(公開日時 + `#` + ニュースの ID)です。`questId` の並びが、公開日時の順になるため、新しい順に取れます。

**手順**

1. DynamoDB のクライアントと、TypeScript の実行ツール(初期データの投入に使う)を、インストールします。

   ```sh
   npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
   npm install -D tsx
   ```

2. `webapp/src/data/quests.ts` を、次の内容で作成します。クエストの型と、表示用のラベルです。重要度、状態、想定学習時間など、仕様書 5.1 の項目を持ちます。

   ```ts
   // クエストの型と、表示用のラベル
   export type QuestStatus = "todo" | "viewed" | "cleared";
   export type Importance = "high" | "medium" | "low";

   export interface Quest {
     id: string;
     title: string;
     services: string[];
     summary: string;
     importance: Importance;
     minutes: number;
     status: QuestStatus;
     // ニュースの公開日時(ISO 8601)
     publishedAt: string;
     source: { label: string; url: string };
     changes: string[];
     before: string;
     after: string;
     impact: { changes: string; unchanged: string; check: string };
     checks: string[];
   }

   export const STATUS_LABEL: Record<QuestStatus, string> = {
     todo: "未着手",
     viewed: "閲覧済み",
     cleared: "クリア済み",
   };

   export const IMPORTANCE_LABEL: Record<Importance, string> = {
     high: "重要度 高",
     medium: "重要度 中",
     low: "重要度 低",
   };

   // 依頼書に押す印(重要度から決める)
   export const RANK: Record<Importance, string> = { high: "S", medium: "A", low: "B" };
   ```

3. `webapp/src/data/sampleQuests.ts` を、次の内容で作成します。サンプルのクエストです(実際のニュースではありません)。mock モードの API と、初期データの投入に使います。

   ```ts
   // サンプルのクエスト(画面確認と、初期データの投入に使う固定データ。実際のニュースではない)
   import type { Quest } from "./quests";

   const SAMPLES: Omit<Quest, "publishedAt">[] = [
     {
       id: "agentcore-agui",
       title: "AgentCore Runtime の AG-UI 対応",
       services: ["AgentCore", "フロントエンド"],
       summary:
         "AgentCore Runtime に、AG-UI のサーバーをそのままデプロイできます。フロントエンドとエージェントの接続方式を見直せます。",
       importance: "high",
       minutes: 5,
       status: "todo",
       source: { label: "AWS What's New(サンプル)", url: "https://aws.amazon.com/new/" },
       changes: ["AG-UI のプロトコルを指定して、Runtime を作れる", "エージェントは、/invocations で SSE を返す"],
       before: "フロントエンドとエージェントの間に、独自の中継層を作って運用する。",
       after: "Runtime の AG-UI エンドポイントへ、直接つなぐ選択肢が増える。",
       impact: {
         changes: "接続方式と、認証の境界を見直せる",
         unchanged: "Generative UI の部品づくりは必要",
         check: "CopilotRuntime を残す理由があるか",
       },
       checks: ["認証方式(SigV4 か JWT か)", "ストリーミングの経路と、タイムアウト"],
     },
     {
       id: "lambda-streaming",
       title: "Lambda のストリーミング応答を確認する",
       services: ["Lambda", "SSE"],
       summary:
         "応答ストリーミングの制約と適用範囲の更新です。SSE を使うエージェント UI の設計に関係します。",
       importance: "medium",
       minutes: 4,
       status: "todo",
       source: { label: "AWS What's New(サンプル)", url: "https://aws.amazon.com/new/" },
       changes: ["ストリーミング応答の扱いに、変更がある", "対象のランタイムと制限値を確認する"],
       before: "応答をまとめて返すか、独自にストリームの経路を用意する。",
       after: "新しい制約を踏まえて、SSE の経路とタイムアウトを設計し直せる。",
       impact: {
         changes: "初回応答までの体感を改善できる",
         unchanged: "UI 側の逐次描画は、引き続き必要",
         check: "既存のプロキシ設定と制限値",
       },
       checks: ["API Gateway と CloudFront の設定", "タイムアウトの値"],
     },
     {
       id: "bedrock-models",
       title: "Bedrock のモデル更新を比較する",
       services: ["Bedrock", "AI"],
       summary:
         "新しいモデルバージョンと既存モデルを、用途、料金、コンテキスト長で比べます。",
       importance: "medium",
       minutes: 6,
       status: "viewed",
       source: { label: "AWS ニュースブログ(サンプル)", url: "https://aws.amazon.com/blogs/aws/" },
       changes: ["新しいモデルバージョンが選べる", "料金とコンテキスト長が異なる"],
       before: "既存モデルを前提に、プロンプトとコストを最適化している。",
       after: "新モデルを候補に加え、品質、速度、料金を同じ条件で比べられる。",
       impact: {
         changes: "用途別に、モデルを選び直せる",
         unchanged: "評価データと UI は再利用できる",
         check: "移行時の品質の差と、月額コスト",
       },
       checks: ["リージョンごとの提供状況", "推論プロファイルの ID"],
     },
     {
       id: "cloudfront-pricing",
       title: "CloudFront の料金変更を理解する",
       services: ["CloudFront", "料金"],
       summary: "料金変更の対象範囲と、自分の構成で確認する項目を整理します。",
       importance: "low",
       minutes: 3,
       status: "cleared",
       source: { label: "AWS What's New(サンプル)", url: "https://aws.amazon.com/new/" },
       changes: ["料金の体系に、変更がある", "対象のリクエスト種別を確認する"],
       before: "旧料金を前提に、月額コストを見積もっていた。",
       after: "新料金の対象範囲を反映して、見積もりを更新する。",
       impact: {
         changes: "新料金で、再計算できる",
         unchanged: "配信の構成そのものは変わらない",
         check: "リージョンごとの実利用量",
       },
       checks: ["価格クラスの設定", "キャッシュのヒット率"],
     },
   ];

   // 新しい順に、1 日ずつ古くなる公開日時を付ける
   export function buildSampleQuests(now = new Date()): Quest[] {
     return SAMPLES.map((q, i) => ({
       ...q,
       publishedAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
     }));
   }
   ```

4. `webapp/src/lib/questItem.ts` を、次の内容で作成します。クエストと、テーブルの 1 件の変換です。環境に依存しないので、投入用のスクリプトからも使えます。

   ```ts
   import type { Quest } from "../data/quests";

   // テーブルの 1 件は、ユーザー ID(userId)とクエスト ID(questId)をキーにする
   // questId は「公開日時#ニュースの ID」なので、新しい順に取れる
   export interface QuestItem extends Omit<Quest, "id"> {
     userId: string;
     questId: string;
   }

   export function toItem(userId: string, quest: Quest): QuestItem {
     const { id, ...rest } = quest;
     return { ...rest, userId, questId: `${quest.publishedAt}#${id}` };
   }

   export function toQuest(item: QuestItem): Quest {
     const { userId: _userId, questId, ...rest } = item;
     return { ...rest, id: questId.slice(questId.indexOf("#") + 1) };
   }
   ```

5. `webapp/src/lib/quests.ts` を、次の内容で作成します。テーブル名は、環境変数 `QUEST_TABLE` か、`amplify_outputs.json` の `custom.questTableName` から読みます。

   ```ts
   import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
   import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
   import type { Quest } from "../data/quests";
   import { outputs } from "./outputs";
   import { toQuest, type QuestItem } from "./questItem";

   // Quests テーブルの名前
   //   QUEST_TABLE があればそれを、なければ amplify_outputs.json の値を使う
   const tableName =
     process.env.QUEST_TABLE ??
     (import.meta.env.QUEST_TABLE as string | undefined) ??
     outputs?.custom?.questTableName;

   const client = DynamoDBDocumentClient.from(
     new DynamoDBClient({ region: outputs?.auth.aws_region }),
   );

   // ユーザーのクエストを、公開日時の新しい順に返す
   export async function listQuests(userId: string): Promise<Quest[]> {
     if (!tableName) {
       throw new Error(
         "Quests テーブルの名前がありません。QUEST_TABLE を設定するか、バックエンドをデプロイして amplify_outputs.json を更新してください",
       );
     }
     const result = await client.send(
       new QueryCommand({
         TableName: tableName,
         KeyConditionExpression: "userId = :u",
         ExpressionAttributeValues: { ":u": userId },
         ScanIndexForward: false,
         Limit: 200,
       }),
     );
     return (result.Items as QuestItem[] | undefined)?.map(toQuest) ?? [];
   }
   ```

6. `webapp/src/pages/api/quests.ts` を、次の内容で作成します。ログインしたユーザー自身のクエストだけを返します。mock モードでは、DynamoDB を使わず、サンプルを返します。

   ```ts
   import type { APIRoute } from "astro";
   import { buildSampleQuests } from "../../data/sampleQuests";
   import { authenticate } from "../../lib/auth";
   import { AUTH_DISABLED } from "../../lib/outputs";
   import { listQuests } from "../../lib/quests";

   // リクエストごとにサーバーで動かす(静的ファイルにしない)
   export const prerender = false;

   const json = (body: unknown, status = 200) =>
     new Response(JSON.stringify(body), {
       status,
       headers: { "content-type": "application/json; charset=utf-8" },
     });

   // ログインしたユーザー自身のクエストを返す(エージェントは通さない)
   //   mock モード(認証なし)では、DynamoDB を使わず、サンプルのクエストを返す
   export const GET: APIRoute = async ({ request }) => {
     const userId = await authenticate(request);
     if (!userId) return json({ error: "Unauthorized" }, 401);

     if (AUTH_DISABLED) return json({ quests: buildSampleQuests() });

     try {
       return json({ quests: await listQuests(userId) });
     } catch (error) {
       console.error("クエストの取得に失敗しました", error);
       return json({ error: "クエストを取得できませんでした" }, 500);
     }
   };
   ```

### 7.3 画面を作る

**手順**

1. `webapp/src/components/QuestBoard.tsx` を、次の内容で作成します。状態で絞り込めて、重要度の高いクエストを先に並べます。クエストが 1 件もないときは、「チャットで探せる」ことを案内します(仕様書の例外時の振る舞い)。

   ```tsx
   import { useState } from "react";
   import {
     IMPORTANCE_LABEL,
     RANK,
     STATUS_LABEL,
     type Quest,
     type QuestStatus,
   } from "../data/quests";

   const FILTERS: { key: "all" | QuestStatus; label: string }[] = [
     { key: "all", label: "すべて" },
     { key: "todo", label: "未着手" },
     { key: "viewed", label: "閲覧済み" },
     { key: "cleared", label: "クリア済み" },
   ];

   const IMPORTANCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

   interface Props {
     quests: Quest[];
     onOpen: (id: string) => void;
   }

   export default function QuestBoard({ quests, onOpen }: Props) {
     const [filter, setFilter] = useState<"all" | QuestStatus>("all");

     // 重要度の高いクエストを、先に表示する
     const shown = quests
       .filter((q) => filter === "all" || q.status === filter)
       .sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance]);

     return (
       <section className="board" aria-label="クエストボード">
         <div className="board-head">
           <div>
             <h2>クエストボード</h2>
             <p className="muted">
               {shown.length} 件のクエスト・サンプルデータ
             </p>
           </div>
           <div className="tabs" role="tablist" aria-label="状態で絞り込む">
             {FILTERS.map((f) => (
               <button
                 key={f.key}
                 type="button"
                 role="tab"
                 aria-selected={filter === f.key}
                 className={filter === f.key ? "tab active" : "tab"}
                 onClick={() => setFilter(f.key)}
               >
                 {f.label}
               </button>
             ))}
           </div>
         </div>

         {quests.length === 0 ? (
           <p className="empty">
             クエストがまだありません。チャットで、クエストを探せます。
           </p>
         ) : shown.length === 0 ? (
           <p className="empty">該当するクエストがありません。絞り込みを変えてください。</p>
         ) : (
           <div className="quest-list">
             {shown.map((q) => (
               <button
                 key={q.id}
                 type="button"
                 className={`quest status-${q.status}`}
                 data-stamp={q.status === "cleared" ? "済" : RANK[q.importance]}
                 onClick={() => onOpen(q.id)}
               >
                 <span className="quest-head">
                   <span className="quest-title">{q.title}</span>
                   <span className={`badge status ${q.status}`}>{STATUS_LABEL[q.status]}</span>
                 </span>
                 <span className="quest-copy">{q.summary}</span>
                 <span className="meta-row">
                   {q.services.map((s) => (
                     <span key={s} className="badge">
                       {s}
                     </span>
                   ))}
                   <span className={q.importance === "high" ? "badge high" : "badge"}>
                     {IMPORTANCE_LABEL[q.importance]}
                   </span>
                   <span className="source">約 {q.minutes} 分</span>
                 </span>
               </button>
             ))}
           </div>
         )}
       </section>
     );
   }
   ```

2. `webapp/src/components/QuestDetail.tsx` を、次の内容で作成します。メイン領域だけを覆う詳細レイヤーで、Esc キーでも閉じます。ニュースの内容と、アプリが生成した説明を、ラベルで見分けられるようにします(仕様書 IR-02)。

   ```tsx
   import { useEffect, useRef } from "react";
   import { IMPORTANCE_LABEL, STATUS_LABEL, type Quest } from "../data/quests";

   interface Props {
     quest: Quest;
     onClose: () => void;
   }

   // ニュースの内容と、アプリが生成した説明を、見分けられるようにする
   function Origin({ kind }: { kind: "news" | "ai" }) {
     return kind === "news" ? (
       <span className="origin news">ニュース</span>
     ) : (
       <span className="origin ai">AI 生成</span>
     );
   }

   export default function QuestDetail({ quest, onClose }: Props) {
     const closeRef = useRef<HTMLButtonElement>(null);

     useEffect(() => {
       closeRef.current?.focus();
       const onKey = (e: KeyboardEvent) => {
         if (e.key === "Escape") onClose();
       };
       window.addEventListener("keydown", onKey);
       return () => window.removeEventListener("keydown", onKey);
     }, [onClose]);

     return (
       <div className="detail-layer" role="dialog" aria-label={`クエスト詳細: ${quest.title}`}>
         <div className="detail-toolbar">
           <button ref={closeRef} type="button" className="back-button" onClick={onClose}>
             ← クエストボードへ戻る
           </button>
           <span className="muted">
             {STATUS_LABEL[quest.status]}・{IMPORTANCE_LABEL[quest.importance]}・約 {quest.minutes} 分
           </span>
         </div>

         <article className="strategy-sheet">
           <div className="strategy-kicker">{quest.services.join(" / ")}</div>
           <h2 className="strategy-title">{quest.title}</h2>

           <div className="generated-stack">
             <section className="generated-panel">
               <h3>
                 要約 <Origin kind="news" />
               </h3>
               <p>{quest.summary}</p>
             </section>

             <section className="generated-panel">
               <h3>
                 何が変わったか <Origin kind="news" />
               </h3>
               <ul>
                 {quest.changes.map((c) => (
                   <li key={c}>{c}</li>
                 ))}
               </ul>
             </section>

             <section className="generated-panel">
               <h3>
                 従来との違い <Origin kind="ai" />
               </h3>
               <div className="compare-grid">
                 <div className="compare-side">
                   <strong>これまで</strong>
                   {quest.before}
                 </div>
                 <div className="compare-arrow" aria-hidden="true">
                   →
                 </div>
                 <div className="compare-side">
                   <strong>更新後</strong>
                   {quest.after}
                 </div>
               </div>
             </section>

             <section className="generated-panel">
               <h3>
                 ユーザーへの影響 <Origin kind="ai" />
               </h3>
               <div className="impact-list">
                 <div className="impact-item">
                   <strong>変わる</strong>
                   {quest.impact.changes}
                 </div>
                 <div className="impact-item">
                   <strong>変わらない</strong>
                   {quest.impact.unchanged}
                 </div>
                 <div className="impact-item">
                   <strong>要検証</strong>
                   {quest.impact.check}
                 </div>
               </div>
             </section>

             <section className="generated-panel">
               <h3>
                 確認すべき事項 <Origin kind="ai" />
               </h3>
               <ul>
                 {quest.checks.map((c) => (
                   <li key={c}>{c}</li>
                 ))}
               </ul>
             </section>

             <section className="generated-panel">
               <h3>元情報</h3>
               <a href={quest.source.url} target="_blank" rel="noreferrer">
                 {quest.source.label}
               </a>
             </section>
           </div>
         </article>
       </div>
     );
   }
   ```

3. `webapp/src/styles/quest.css` を、次の内容で作成します。

   ```css
   :root {
     color-scheme: light dark;
     --bg: light-dark(#f4efe2, #171714);
     --panel: light-dark(#fffaf0, #23231f);
     --panel-2: light-dark(#eee4cf, #2b2a24);
     --text: light-dark(#302b22, #f6f0e3);
     --muted: light-dark(#746b5c, #b8ae9d);
     --line: light-dark(#d9c9aa, #474239);
     --accent: light-dark(#74532b, #d4aa68);
     --green: light-dark(#3e7254, #83c79e);
     --board: light-dark(#6f4729, #3b271a);
     --board-dark: light-dark(#4b2e1a, #21150f);
     --board-text: light-dark(#fff3d7, #f4dfbd);
     --board-muted: light-dark(#e6ceb0, #cbb28e);
     --paper: light-dark(#f4e5bd, #d8c59b);
     --paper-2: light-dark(#ead4a3, #c7af7e);
     --ink: light-dark(#3c2b1b, #332517);
     --pin: light-dark(#8d2f29, #bd5a4f);
     --wax: light-dark(#77362e, #6d302b);
     --shadow: light-dark(#22140c99, #0d0806b8);
   }

   body {
     margin: 0;
     color: var(--text);
     background: var(--bg);
     font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Hiragino Sans", sans-serif;
   }

   * {
     box-sizing: border-box;
   }

   h2,
   h3,
   p {
     margin: 0;
   }

   /* 画面を、メイン領域とチャット領域に分ける */
   .app {
     display: grid;
     grid-template-columns: minmax(0, 1fr) 400px;
     height: 100vh;
   }

   .board-area {
     position: relative;
     min-width: 0;
     overflow: hidden;
     background:
       repeating-linear-gradient(93deg, transparent 0 72px, color-mix(in srgb, var(--board-dark) 20%, transparent) 73px 75px),
       linear-gradient(135deg, var(--board), var(--board-dark));
     box-shadow: inset 0 0 0 8px color-mix(in srgb, var(--board-dark) 72%, transparent);
   }

   .board-scroll {
     height: 100%;
     overflow: auto;
     padding: 24px;
   }

   .mode-banner {
     position: absolute;
     left: 16px;
     bottom: 12px;
     z-index: 20;
     padding: 4px 10px;
     border-radius: 999px;
     color: var(--ink);
     background: var(--paper);
     font-size: 12px;
   }

   .chat-area {
     display: flex;
     min-width: 0;
     height: 100vh;
     flex-direction: column;
     border-left: 1px solid var(--line);
     background: var(--panel);
   }

   .chat-area > * {
     flex: 1;
     min-height: 0;
   }

   /* クエストボード */
   .board-head {
     display: flex;
     align-items: flex-end;
     justify-content: space-between;
     gap: 16px;
     margin-bottom: 14px;
   }

   .board-head h2 {
     color: var(--board-text);
     font-size: 20px;
     font-weight: 500;
     text-shadow: 0 2px 2px var(--board-dark);
   }

   .board-head .muted {
     color: var(--board-muted);
     font-size: 12px;
   }

   .tabs {
     display: flex;
     flex-wrap: wrap;
     gap: 6px;
   }

   .tab {
     padding: 7px 10px;
     border: 0;
     border-radius: 8px;
     color: var(--board-text);
     background: color-mix(in srgb, var(--board-dark) 62%, transparent);
     font: inherit;
     font-size: 12px;
     cursor: pointer;
   }

   .tab.active {
     color: var(--ink);
     background: var(--paper);
   }

   .empty,
   .board-message {
     padding: 32px 0;
     color: var(--board-text);
   }

   .board-message p {
     margin-bottom: 12px;
   }

   .quest-list {
     display: grid;
     grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
     gap: 24px 18px;
     padding: 10px 4px;
   }

   .quest {
     position: relative;
     display: block;
     width: 100%;
     min-height: 190px;
     padding: 28px 18px 18px;
     border: 0;
     border-radius: 2px;
     color: var(--ink);
     background:
       linear-gradient(90deg, color-mix(in srgb, var(--paper-2) 42%, transparent), transparent 15% 85%, color-mix(in srgb, var(--paper-2) 42%, transparent)),
       repeating-linear-gradient(0deg, transparent 0 26px, color-mix(in srgb, var(--ink) 7%, transparent) 27px),
       var(--paper);
     clip-path: polygon(1% 2%, 48% 0, 99% 2%, 100% 42%, 98% 98%, 54% 100%, 2% 98%, 0 55%);
     box-shadow: 2px 7px 13px var(--shadow);
     font: inherit;
     text-align: left;
     cursor: pointer;
     transition: transform 0.15s ease;
   }

   .quest:nth-child(3n + 1) {
     transform: rotate(-1.2deg);
   }

   .quest:nth-child(3n + 2) {
     transform: rotate(1deg);
   }

   .quest:nth-child(3n) {
     transform: rotate(0.6deg);
   }

   .quest:hover,
   .quest:focus-visible {
     transform: translateY(-3px) rotate(0deg);
     outline: none;
   }

   .quest::before {
     content: "";
     position: absolute;
     top: 8px;
     left: 50%;
     width: 12px;
     height: 12px;
     border-radius: 50%;
     background: radial-gradient(circle at 35% 30%, #f4a59c 0 10%, var(--pin) 28% 70%, #55201d 72%);
     transform: translateX(-50%);
   }

   .quest::after {
     content: attr(data-stamp);
     position: absolute;
     right: 15px;
     bottom: 13px;
     display: grid;
     place-items: center;
     width: 34px;
     height: 34px;
     border: 2px solid var(--wax);
     border-radius: 50%;
     color: var(--wax);
     background: color-mix(in srgb, var(--wax) 20%, transparent);
     font-family: Georgia, serif;
     font-weight: 700;
     transform: rotate(-9deg);
   }

   .quest.status-cleared {
     opacity: 0.66;
   }

   .quest-head {
     display: flex;
     align-items: flex-start;
     justify-content: space-between;
     gap: 12px;
   }

   .quest-title {
     font-family: Georgia, "Yu Mincho", serif;
     font-size: 15px;
     font-weight: 500;
   }

   .quest-copy {
     display: block;
     margin-top: 11px;
     font-size: 13px;
     line-height: 1.55;
     color: color-mix(in srgb, var(--ink) 77%, transparent);
   }

   .meta-row {
     display: flex;
     flex-wrap: wrap;
     align-items: center;
     gap: 6px;
     margin-top: 12px;
     padding-right: 44px;
   }

   .badge {
     padding: 4px 7px;
     border-radius: 999px;
     color: light-dark(#3f4f51, #344447);
     background: color-mix(in srgb, light-dark(#729197, #678289) 18%, transparent);
     font-size: 12px;
     white-space: nowrap;
   }

   .badge.high {
     color: light-dark(#7d2e25, #6c2923);
     background: color-mix(in srgb, light-dark(#a4493d, #8e3e35) 17%, transparent);
   }

   .badge.status.viewed {
     color: light-dark(#3d5a75, #2f4a62);
     background: color-mix(in srgb, light-dark(#4f7ea3, #4f7ea3) 18%, transparent);
   }

   .badge.status.cleared {
     color: light-dark(#315d3e, #2c5137);
     background: color-mix(in srgb, light-dark(#4d7f58, #476f50) 17%, transparent);
   }

   .source {
     color: light-dark(#725b42, #5f4b38);
     font-size: 12px;
   }

   /* クエスト詳細(メイン領域だけを覆う。チャット領域は覆わない) */
   .detail-layer {
     position: absolute;
     inset: 0;
     z-index: 10;
     overflow: auto;
     padding: 24px;
     background:
       repeating-linear-gradient(93deg, transparent 0 72px, color-mix(in srgb, var(--board-dark) 20%, transparent) 73px 75px),
       linear-gradient(135deg, var(--board), var(--board-dark));
   }

   .detail-toolbar {
     display: flex;
     align-items: center;
     justify-content: space-between;
     gap: 12px;
     margin-bottom: 14px;
   }

   .detail-toolbar .muted {
     color: var(--board-muted);
     font-size: 12px;
   }

   .back-button {
     padding: 8px 11px;
     border: 0;
     border-radius: 8px;
     color: var(--board-text);
     background: color-mix(in srgb, var(--board-dark) 65%, transparent);
     font: inherit;
     font-size: 12px;
     cursor: pointer;
   }

   .strategy-sheet {
     max-width: 820px;
     margin: 0 auto;
     padding: 28px 28px 24px;
     color: var(--ink);
     background:
       repeating-linear-gradient(0deg, transparent 0 29px, color-mix(in srgb, var(--ink) 6%, transparent) 30px),
       var(--paper);
     box-shadow: 3px 9px 18px var(--shadow);
   }

   .strategy-kicker {
     color: color-mix(in srgb, var(--ink) 70%, transparent);
     font-size: 12px;
     letter-spacing: 0.08em;
   }

   .strategy-title {
     margin-top: 5px;
     font-family: Georgia, "Yu Mincho", serif;
     font-size: 20px;
     font-weight: 500;
   }

   .generated-stack {
     display: grid;
     gap: 10px;
     margin-top: 18px;
   }

   .generated-panel {
     padding: 14px;
     background: color-mix(in srgb, var(--paper-2) 44%, transparent);
     font-size: 13px;
     line-height: 1.6;
   }

   .generated-panel h3 {
     display: flex;
     align-items: center;
     gap: 8px;
     margin: 0 0 8px;
     font-family: Georgia, "Yu Mincho", serif;
     font-size: 14px;
     font-weight: 500;
   }

   .generated-panel ul {
     margin: 0;
     padding-left: 18px;
   }

   .generated-panel a {
     color: var(--wax);
   }

   .origin {
     padding: 2px 6px;
     border: 1px solid currentColor;
     border-radius: 4px;
     font-family: ui-sans-serif, system-ui, sans-serif;
     font-size: 11px;
   }

   .origin.news {
     color: light-dark(#315d3e, #2c5137);
   }

   .origin.ai {
     color: light-dark(#7d2e25, #6c2923);
   }

   .compare-grid {
     display: grid;
     grid-template-columns: 1fr auto 1fr;
     align-items: stretch;
     gap: 10px;
   }

   .compare-side,
   .impact-item {
     padding: 11px;
     background: color-mix(in srgb, var(--paper) 72%, transparent);
     font-size: 12px;
     line-height: 1.55;
   }

   .compare-side strong,
   .impact-item strong {
     display: block;
     margin-bottom: 4px;
     font-weight: 500;
   }

   .compare-arrow {
     align-self: center;
     font-size: 18px;
   }

   .impact-list {
     display: grid;
     grid-template-columns: repeat(3, 1fr);
     gap: 8px;
   }

   /* 狭い画面では、チャットを下に置く */
   @media (max-width: 900px) {
     .app {
       grid-template-columns: 1fr;
       grid-template-rows: minmax(0, 1fr) 55vh;
     }

     .chat-area {
       height: 55vh;
       border-top: 1px solid var(--line);
       border-left: 0;
     }

     .board-head {
       align-items: flex-start;
       flex-direction: column;
     }

     .impact-list,
     .compare-grid {
       grid-template-columns: 1fr;
     }

     .compare-arrow {
       justify-self: center;
       transform: rotate(90deg);
     }
   }
   ```

4. `webapp/src/components/App.tsx` を、次の内容で作成します。`/api/quests` からクエストを取得し(読み込み中と失敗の表示を含む)、メイン領域とチャット領域を並べます。詳細を開いたクエストは、画面の中だけで「閲覧済み」にします(保存は、まだしません)。チャットは、ポップアップ(`CopilotPopup`)ではなく、右側に固定表示する `CopilotChat` に変えます。

   ```tsx
   import { useCallback, useEffect, useRef, useState } from "react";
   import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
   import "@copilotkit/react-core/v2/styles.css";
   import "../styles/quest.css";
   import type { Quest, QuestStatus } from "../data/quests";
   import { AUTH_DISABLED } from "../lib/outputs";
   import AuthGate from "./AuthGate";
   import QuestBoard from "./QuestBoard";
   import QuestDetail from "./QuestDetail";

   const RUNTIME_URL = "/api/copilotkit";
   const QUESTS_URL = "/api/quests";

   function Workspace({ getToken }: { getToken?: () => string }) {
     // getToken は、レンダリングのたびに作り直されることがあるため、参照で持つ
     const tokenRef = useRef(getToken);
     tokenRef.current = getToken;

     const [quests, setQuests] = useState<Quest[] | null>(null);
     const [failed, setFailed] = useState(false);
     // 画面での状態の変更(詳細を開いたら、閲覧済みにする)。保存は、まだしない
     const [statuses, setStatuses] = useState<Record<string, QuestStatus>>({});
     const [openId, setOpenId] = useState<string | null>(null);

     // クエストは、エージェントを通さず、API から取得する
     const load = useCallback(async () => {
       setFailed(false);
       setQuests(null);
       try {
         const token = tokenRef.current?.();
         const res = await fetch(QUESTS_URL, {
           headers: token ? { Authorization: `Bearer ${token}` } : {},
         });
         if (!res.ok) throw new Error(`HTTP ${res.status}`);
         setQuests((await res.json()).quests as Quest[]);
       } catch {
         setFailed(true);
       }
     }, []);

     useEffect(() => {
       void load();
     }, [load]);

     const shown = quests?.map((q) => ({ ...q, status: statuses[q.id] ?? q.status }));
     const opened = shown?.find((q) => q.id === openId);

     // 詳細を開いたクエストは、閲覧済みにする(クリア済みは、そのまま)
     const open = (id: string) => {
       setOpenId(id);
       setStatuses((s) => {
         const current = s[id] ?? quests?.find((q) => q.id === id)?.status;
         return current === "todo" ? { ...s, [id]: "viewed" } : s;
       });
     };
     const close = useCallback(() => setOpenId(null), []);

     return (
       <CopilotKitProvider
         runtimeUrl={RUNTIME_URL}
         headers={getToken ? () => ({ Authorization: `Bearer ${getToken()}` }) : undefined}
       >
         <div className="app">
           <main className="board-area">
             {AUTH_DISABLED && <div className="mode-banner">mock モード(認証なし)</div>}
             <div className="board-scroll">
               {failed ? (
                 <div className="board-message" role="alert">
                   <p>クエストを取得できませんでした。</p>
                   <button type="button" className="tab active" onClick={load}>
                     もう一度取得する
                   </button>
                 </div>
               ) : !shown ? (
                 <div className="board-message" role="status">
                   クエストを読み込んでいます…
                 </div>
               ) : (
                 <QuestBoard quests={shown} onOpen={open} />
               )}
             </div>
             {opened && <QuestDetail quest={opened} onClose={close} />}
           </main>
           <aside className="chat-area" aria-label="チャット">
             <CopilotChat
               labels={{
                 welcomeMessageText: "クエストについて、なんでも聞いてください。",
                 chatInputPlaceholder: "クエストについて質問する",
               }}
             />
           </aside>
         </div>
       </CopilotKitProvider>
     );
   }

   export default function App() {
     if (AUTH_DISABLED) return <Workspace />;
     return <AuthGate>{(getToken) => <Workspace getToken={getToken} />}</AuthGate>;
   }
   ```

5. `webapp/src/components/AiAssistant.tsx` を削除します。`App.tsx` と `AuthGate.tsx` に置き換わりました。

6. `webapp/src/pages/index.astro` を、次の内容に置き換えます。`<head>` の `<meta charset>` は、残します。

   ```astro
   ---
   import App from "../components/App";
   ---

   <html lang="ja">
   	<head>
   		<meta charset="utf-8" />
   		<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
   		<link rel="icon" href="/favicon.ico" />
   		<meta name="viewport" content="width=device-width" />
   		<meta name="generator" content={Astro.generator} />
   		<title>AWS クエストボード</title>
   	</head>
   	<body>
   		<App client:only="react" />
   	</body>
   </html>
   ```

### 7.4 テーブルを CDK で作る

**手順**

1. `webapp/amplify/backend.ts` を、次の内容に置き換えます(4.3 の内容からの変更は、テーブルの作成、エージェントへの環境変数と権限、出力への `questTableName` の追加です)。エージェントは、`boto3` で、このテーブルを直接読み書きします(実行ロールの権限を使います)。

   ```ts
   import * as path from "node:path";
   import { defineBackend } from "@aws-amplify/backend";
   import { RemovalPolicy } from "aws-cdk-lib";
   import * as agentcore from "aws-cdk-lib/aws-bedrockagentcore";
   import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
   import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
   import * as iam from "aws-cdk-lib/aws-iam";
   import { auth } from "./auth/resource";

   const backend = defineBackend({
     auth,
   });

   // エージェント(Strands)を AgentCore Runtime にデプロイする(カスタムリソース)
   const agentStack = backend.createStack("agent");

   // クエストを保存するテーブル(ユーザーごとに持つ)
   //   userId: ユーザー ID(Cognito の sub)
   //   questId: 「公開日時#ニュースの ID」。新しい順に取れる
   const questTable = new dynamodb.Table(agentStack, "QuestTable", {
     partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
     sortKey: { name: "questId", type: dynamodb.AttributeType.STRING },
     billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
     // サンプルアプリのため、環境を削除したらテーブルも削除する
     removalPolicy: RemovalPolicy.DESTROY,
   });

   const agentRuntime = new agentcore.Runtime(agentStack, "AgentRuntime", {
     // agent/ の Dockerfile からイメージをビルドして ECR に登録する(ARM64)
     // x86 のマシン(CI など)でも ARM64 でビルドするよう、プラットフォームを明示する
     agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
       path.resolve(process.cwd(), "..", "agent"),
       { platform: ecrAssets.Platform.LINUX_ARM64 },
     ),
     protocolConfiguration: agentcore.ProtocolType.AGUI,
     environmentVariables: { QUEST_TABLE: questTable.tableName },
   });

   // エージェントが、クエストを読み書きする権限
   questTable.grantReadWriteData(agentRuntime);

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

   // バックエンド(CopilotRuntime とクエストの API)が接続先を知るための出力
   backend.addOutput({
     custom: {
       agentRuntimeArn: agentRuntime.agentRuntimeArn,
       questTableName: questTable.tableName,
     },
   });
   ```

2. `webapp/amplify/hosting.ts` を、次の内容に置き換えます(5.2 の内容からの変更は、Astro のサーバー(SSR の Lambda)に、テーブルを読む権限を付けたことです)。テーブル名は、`amplify_outputs.json` から読みます。

   ```ts
   import { existsSync, readFileSync } from "node:fs";
   import * as path from "node:path";
   import * as iam from "aws-cdk-lib/aws-iam";
   import * as lambda from "aws-cdk-lib/aws-lambda";
   import { defineHosting } from "@aws-amplify/hosting";

   const hosting = defineHosting({
     // エージェントの応答(SSE)が長くなるため、SSR の Lambda のタイムアウトを延ばす(既定は 30 秒)
     compute: { timeout: 60 },
   });

   // Quests テーブルの名前(バックエンドのデプロイで、amplify_outputs.json に出力される)
   // まだない場合は、アカウントとリージョン内のテーブル全体に許可する
   const outputsPath = path.resolve(process.cwd(), "amplify_outputs.json");
   const questTableName: string | undefined = existsSync(outputsPath)
     ? JSON.parse(readFileSync(outputsPath, "utf-8")).custom?.questTableName
     : undefined;
   if (!questTableName) {
     console.warn(
       "amplify_outputs.json に custom.questTableName がありません。DynamoDB の権限を、テーブル全体に付けます。先にバックエンドをデプロイしてください",
     );
   }

   // SSR の Lambda に、次の権限を付ける
   //   - AgentCore Runtime を呼び出す権限(SigV4 署名に使われる実行ロール)
   //   - Quests テーブルを読む権限
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
       construct.addToRolePolicy(
         new iam.PolicyStatement({
           actions: ["dynamodb:Query"],
           resources: [
             `arn:aws:dynamodb:${region}:${account}:table/${questTableName ?? "*"}`,
           ],
         }),
       );
     }
   }
   ```

3. `webapp/astro.config.mjs` は、5.1 の内容のままです(開発サーバーで動くよう、5.1 で直しています)。

> [!NOTE]
> - `npx tsx amplify/backend.ts` で合成して、テーブル(`userId` と `questId` のキー、オンデマンド課金)、エージェントの環境変数 `QUEST_TABLE`、エージェントの実行ロールへの読み書きの権限、`questTableName` の出力が、CloudFormation のテンプレートに出ることを確認しました。
> - `npx tsx amplify/hosting.ts` で合成して、SSR の Lambda に、`dynamodb:Query` が付くことを確認しました。`amplify_outputs.json` に `questTableName` があるときは、そのテーブルの ARN に限定されます。ないときは、警告を出して、アカウントとリージョン内のテーブル全体に許可します(先にバックエンドをデプロイして、`amplify_outputs.json` を更新してください)。
> - テーブルは、`RemovalPolicy.DESTROY`(環境を削除したら、テーブルも削除)にしています。サンプルアプリのためです。
> - **`ampx sandbox` は、いまの sandbox 環境では、更新に失敗しました**。sandbox のエージェントのランタイムが、以前の固定名(`strandsAgent`)で作られていて、いまのコードが生成する名前と違うため、ランタイムの置き換えが必要になり、「Replacement type updates not supported on stack with disable-rollback」で失敗しました(AWS の CloudFormation のドキュメントで、`AgentRuntimeName` の変更が置き換えになること、`EnvironmentVariables` の変更は置き換えにならないことを確認しました)。この失敗で、テーブルだけは、sandbox の agent スタックに作られましたが、スタックは `UPDATE_FAILED` のままです。sandbox は、`npx ampx sandbox delete` で削除して、作り直す必要があります(未実施)。
> - `dev` の環境(`--identifier dev`)は、いまの名前で作られているため、この問題は起きませんでした。`npx ampx deploy --identifier dev --backend --yes` で、バックエンドをデプロイして、成功しました(83 秒。Quests テーブルが作られ、`amplify_outputs.json` の `custom.questTableName` にテーブル名が入りました。確認済み)。

### 7.5 モックと起動コマンドを整える

**手順**

1. `webapp/package.json` の `scripts` を、次の内容にします。`dev:mock` は認証なし、`mock` は aimock の起動、`seed` は初期データの投入です。

   ```json
   {
     "dev": "astro dev",
     "dev:mock": "astro dev --mode mock",
     "mock": "aimock --config mock/aimock.json --port 4010",
     "build": "astro build",
     "preview": "astro preview",
     "astro": "astro",
     "seed": "tsx scripts/seed-quests.ts"
   }
   ```

2. `webapp/mock/aimock.json` を、次の内容にします。チャットに「クエスト」を含めると、2 つ目の応答を返します。

   ```json
   {
     "port": 4010,
     "agui": {
       "path": "/agui",
       "fixtures": [
         { "match": { "message": "こんにちは" }, "text": "こんにちは!AG-UI のモックです。" },
         {
           "match": { "message": "クエスト" },
           "text": "クエストボードのカードを選ぶと、詳細を見ながら質問できます。(モックの応答です)"
         }
       ]
     }
   }
   ```

3. `webapp/scripts/seed-quests.ts` を、次の内容で作成します。サンプルのクエストを、指定したユーザーのクエストとして、テーブルに入れます。ユーザー ID は、Cognito のユーザーの `sub` です。

   ```ts
   // サンプルのクエストを、Quests テーブルに入れる
   //   使い方: npm run seed -- <ユーザー ID(Cognito の sub)>
   //   テーブル名とリージョンは、amplify_outputs.json から読む(QUEST_TABLE でも指定できる)
   import { existsSync, readFileSync } from "node:fs";
   import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
   import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
   import { buildSampleQuests } from "../src/data/sampleQuests";
   import { toItem } from "../src/lib/questItem";

   const userId = process.argv[2];
   if (!userId) {
     console.error("使い方: npm run seed -- <ユーザー ID(Cognito の sub)>");
     process.exit(1);
   }

   const outputs = existsSync("amplify_outputs.json")
     ? JSON.parse(readFileSync("amplify_outputs.json", "utf-8"))
     : undefined;
   const tableName: string | undefined =
     process.env.QUEST_TABLE ?? outputs?.custom?.questTableName;
   if (!tableName) {
     console.error("テーブル名がありません。QUEST_TABLE を設定するか、バックエンドをデプロイしてください");
     process.exit(1);
   }

   const client = DynamoDBDocumentClient.from(
     new DynamoDBClient({ region: outputs?.auth?.aws_region }),
   );
   const items = buildSampleQuests().map((q) => toItem(userId, q));
   await client.send(
     new BatchWriteCommand({
       RequestItems: { [tableName]: items.map((Item) => ({ PutRequest: { Item } })) },
     }),
   );
   console.log(`${items.length} 件のクエストを、${tableName} に入れました(ユーザー: ${userId})`);
   ```

### 7.6 動作を確認する

**mock モード(認証なし。DynamoDB を使わない)**

1. `webapp/` で、aimock を起動します。

   ```sh
   npm run mock
   ```

2. 別のターミナルで、開発サーバーを、認証なしで起動します。

   ```sh
   npm run dev:mock
   ```

3. ブラウザで、開発サーバーの URL(既定は `http://localhost:4321/`)を開きます。次のことを確認します。
   - 左にクエストボード、右にチャットが表示され、左下に「mock モード(認証なし)」と出る。
   - タブ(すべて/未着手/閲覧済み/クリア済み)で、表示するクエストが絞り込まれる。
   - クエストを選ぶと、左側だけを覆う詳細が開き、チャットは操作できる。開いたクエストは、「閲覧済み」に変わる。
   - Esc キーか「クエストボードへ戻る」で、ボードに戻る。
   - チャットに「こんにちは」と送ると、「こんにちは!AG-UI のモックです。」と返る。

   ブラウザの開発者ツールのネットワークで、`GET /api/quests` が 200 で、クエストが返ることも確認できます(確認済み)。

**DynamoDB につないだ確認**

バックエンドを、`dev`(または、作り直した sandbox)にデプロイしたあと(`amplify_outputs.json` が更新されます)、次を行います。

1. Cognito のユーザーの `sub` を調べ、初期データを入れます。

   ```sh
   npm run seed -- <ユーザー ID>
   ```

2. `npm run dev` で、そのユーザーでログインして、クエストが、DynamoDB から表示されることを確認します。

   確認の結果(`dev` の Cognito のテストユーザー `test@example.com` で実施しました):
   - `seed` で、4 件のクエストが、テーブルに入りました。
   - ログイン画面から、ログインすると、クエストボードに 4 件が表示されました(画面左下の「mock モード」の表示は、ありません)。
   - `GET /api/quests` は、`Authorization: Bearer <トークン>` つきで、200 でした。応答の `publishedAt` は、`seed` を実行した時刻(表示した時刻より前)でした。mock モードのサンプルは、リクエストの時刻で作られるため、DynamoDB から読めていることが分かります。

3. 別のユーザーでログインすると、クエストがない案内が表示されることを確認します(未確認)。

> [!NOTE]
> - mock モードの確認は、Chrome で行いました(幅 1400px と 600px。600px では、チャットが下に移ります)。ダークモードの見た目は、確認していません。
> - 本番ビルド(`npm run build`)したサーバーで、トークンなしの `/api/quests` が 401 になることを確認しました。
> - 開発中は、CopilotKit の Inspector のボタンが、チャットの右上に出て、メッセージに重なることがあります。ローカルの開発サーバーだけに出ます(型定義のコメントより。ビルドした成果物での表示は、確認していません)。
> - **未確認**: 別のユーザーでの、クエストがないときの表示、Web アプリ(ホスティング)のデプロイ(`ampx deploy --frontend`)。ホスティングの Lambda に付けた `dynamodb:Query` の権限が、本番で足りるか。

## 第8章 理解度チェックを、チャットに表示して、回答をエージェントに返す(Generative UI)

機能仕様書の F-05(理解度チェック)を、チャット内の部品として表示します。エージェントが、ツール呼び出し(`show_quiz`)の引数に、問題を入れます。フロントエンドは、あらかじめ登録した部品で、それを描画し、ユーザーの回答を、エージェントに返します(CopilotKit の「Interactive」。`useHumanInTheLoop`)。この章では、エージェントの代わりに、aimock がツール呼び出しのイベントを返します。

### 8.1 方針

- 問題は、エージェントが作って、ツール呼び出しの引数(問題文、選択肢、正解の番号、解説)として渡します。
- 部品は、単一選択の問題を表示します。回答するまで正解を示さず、回答後に正誤と解説を表示します。不正解のときは、再回答できます。再回答しても、初回の結果は上書きしません(仕様書 F-05、IR-05)。
- エージェントに返すのは、**初回の回答だけ**です(選んだ選択肢と、正誤)。再回答は、画面の中だけで行います。
- `useHumanInTheLoop` を使うと、部品が回答を返すまで、エージェントの実行が止まります。回答を返すと、その内容がツールの結果としてエージェントに渡り、エージェントが続きの応答をします。
- 表示だけなら `useComponent` でも作れます(最初は、これで作りました)。回答を返す部品には、`useHumanInTheLoop` を使います。
- クリアの記録(仕様書 F-06)は、まだ作りません。

### 8.2 部品を作る

**手順**

1. `zod`(引数のスキーマ)を、明示してインストールします。CopilotKit の依存として、すでに入っていますが、自分のコードから使うため、明示します。

   ```sh
   npm install zod
   ```

2. `webapp/src/components/Quiz.tsx` を、次の内容で作成します。引数は、ストリーミングで少しずつ届くため、届く前は「問題を作成しています」と表示します。初回の回答だけ、`respond` で、エージェントに返します。

   ```tsx
   import { useState } from "react";
   import { z } from "zod";

   // エージェントが、ツール呼び出し(show_quiz)の引数として渡す、理解度チェックの問題
   export const quizSchema = z.object({
     question: z.string().describe("問題文"),
     options: z.array(z.string()).describe("選択肢(2〜4 個)"),
     answer: z.number().int().describe("正解の選択肢の番号(0 から始まる)"),
     explanation: z.string().describe("解説"),
   });

   type QuizProps = z.infer<typeof quizSchema>;

   // エージェントに返す、初回の回答の内容
   export interface QuizAnswer {
     selectedIndex: number;
     selectedOption: string;
     correct: boolean;
   }

   interface Props extends Partial<QuizProps> {
     // 回答を、エージェントに返す関数(エージェントの応答待ちの間だけ、渡される)
     respond?: (result: unknown) => Promise<void>;
     // 回答済みのときの、エージェントに返した内容(JSON の文字列)
     result?: string;
   }

   function parseFirstResult(result?: string): "correct" | "wrong" | null {
     if (!result) return null;
     try {
       return (JSON.parse(result) as QuizAnswer).correct ? "correct" : "wrong";
     } catch {
       return null;
     }
   }

   // 引数は、ストリーミングで少しずつ届くため、届いていない項目は undefined になる
   // 単一選択の問題。回答するまで、正解は示さない。不正解なら、再回答できる
   // エージェントに返すのは、初回の回答だけ(再回答は、画面の中だけ)
   export default function Quiz(props: Props) {
     const { question, options, answer, explanation, respond, result: returned } = props;
     const [selected, setSelected] = useState<number | null>(null);
     // 直近の回答の結果(null は、まだ回答していない)
     const [result, setResult] = useState<"correct" | "wrong" | null>(null);
     // 初回の回答の結果。再回答しても、上書きしない
     const [firstResult, setFirstResult] = useState<"correct" | "wrong" | null>(null);
     // 再読み込みなどで画面の状態が失われても、エージェントに返した内容から、初回の結果を復元する
     const first = firstResult ?? parseFirstResult(returned);

     const ready = question && options && options.length >= 2 && answer !== undefined && explanation;
     if (!ready) {
       return <div className="quiz quiz-loading">問題を作成しています…</div>;
     }

     const submit = () => {
       if (selected === null) return;
       const outcome = selected === answer ? "correct" : "wrong";
       setResult(outcome);
       if (first === null) {
         setFirstResult(outcome);
         const answered: QuizAnswer = {
           selectedIndex: selected,
           selectedOption: options[selected],
           correct: outcome === "correct",
         };
         void respond?.(answered);
       }
     };
     const retry = () => {
       setSelected(null);
       setResult(null);
     };
     const locked = result !== null;

     return (
       <div className="quiz" role="group" aria-label="理解度チェック">
         <div className="quiz-kicker">理解度チェック</div>
         <p className="quiz-question">{question}</p>
         <div className="quiz-options" role="radiogroup" aria-label="選択肢">
           {options.map((option, i) => (
             <button
               key={i}
               type="button"
               role="radio"
               aria-checked={selected === i}
               disabled={locked}
               className={selected === i ? "quiz-option selected" : "quiz-option"}
               onClick={() => setSelected(i)}
             >
               {option}
             </button>
           ))}
         </div>

         {result === null ? (
           <button type="button" className="quiz-submit" disabled={selected === null} onClick={submit}>
             回答する
           </button>
         ) : (
           <div className={`quiz-result ${result}`} role="status">
             <strong>{result === "correct" ? "正解です" : "不正解です"}</strong>
             <p>{explanation}</p>
             {first && (
               <p className="quiz-first">
                 初回の回答: {first === "correct" ? "正解" : "不正解"}
               </p>
             )}
             {result === "wrong" && (
               <button type="button" className="quiz-submit" onClick={retry}>
                 もう一度答える
               </button>
             )}
           </div>
         )}
       </div>
     );
   }
   ```

3. `webapp/src/components/GenerativeUI.tsx` を、次の内容で作成します。`useHumanInTheLoop` で、エージェントが呼び出せる部品を登録します。ツールの名前、説明、引数のスキーマは、エージェントに、ツールの定義として渡されます。

   ```tsx
   import { useHumanInTheLoop } from "@copilotkit/react-core/v2";
   import Quiz, { quizSchema } from "./Quiz";

   // エージェントが呼び出せる、チャット内の UI を登録する(CopilotKitProvider の中に置く)
   export default function GenerativeUI() {
     // 理解度チェック: 問題を表示し、ユーザーの初回の回答を、エージェントに返す
     // 回答が返るまで、エージェントの実行は止まる
     useHumanInTheLoop({
       name: "show_quiz",
       description:
         "クエストの内容に合わせた、単一選択の理解度チェックの問題を、チャットに表示する。ユーザーが回答すると、その内容(選んだ選択肢と、正誤)が返る",
       parameters: quizSchema,
       render: ({ args, respond, result }) => (
         <Quiz {...args} respond={respond} result={result} />
       ),
     });
     return null;
   }
   ```

4. `webapp/src/components/App.tsx` を、次の内容に置き換えます(7.3 からの変更は、`GenerativeUI` を `CopilotKitProvider` の中に置いたことです)。

   ```tsx
   import { useCallback, useEffect, useRef, useState } from "react";
   import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
   import "@copilotkit/react-core/v2/styles.css";
   import "../styles/quest.css";
   import type { Quest, QuestStatus } from "../data/quests";
   import { AUTH_DISABLED } from "../lib/outputs";
   import AuthGate from "./AuthGate";
   import GenerativeUI from "./GenerativeUI";
   import QuestBoard from "./QuestBoard";
   import QuestDetail from "./QuestDetail";

   const RUNTIME_URL = "/api/copilotkit";
   const QUESTS_URL = "/api/quests";

   function Workspace({ getToken }: { getToken?: () => string }) {
     // getToken は、レンダリングのたびに作り直されることがあるため、参照で持つ
     const tokenRef = useRef(getToken);
     tokenRef.current = getToken;

     const [quests, setQuests] = useState<Quest[] | null>(null);
     const [failed, setFailed] = useState(false);
     // 画面での状態の変更(詳細を開いたら、閲覧済みにする)。保存は、まだしない
     const [statuses, setStatuses] = useState<Record<string, QuestStatus>>({});
     const [openId, setOpenId] = useState<string | null>(null);

     // クエストは、エージェントを通さず、API から取得する
     const load = useCallback(async () => {
       setFailed(false);
       setQuests(null);
       try {
         const token = tokenRef.current?.();
         const res = await fetch(QUESTS_URL, {
           headers: token ? { Authorization: `Bearer ${token}` } : {},
         });
         if (!res.ok) throw new Error(`HTTP ${res.status}`);
         setQuests((await res.json()).quests as Quest[]);
       } catch {
         setFailed(true);
       }
     }, []);

     useEffect(() => {
       void load();
     }, [load]);

     const shown = quests?.map((q) => ({ ...q, status: statuses[q.id] ?? q.status }));
     const opened = shown?.find((q) => q.id === openId);

     // 詳細を開いたクエストは、閲覧済みにする(クリア済みは、そのまま)
     const open = (id: string) => {
       setOpenId(id);
       setStatuses((s) => {
         const current = s[id] ?? quests?.find((q) => q.id === id)?.status;
         return current === "todo" ? { ...s, [id]: "viewed" } : s;
       });
     };
     const close = useCallback(() => setOpenId(null), []);

     return (
       <CopilotKitProvider
         runtimeUrl={RUNTIME_URL}
         headers={getToken ? () => ({ Authorization: `Bearer ${getToken()}` }) : undefined}
       >
         <GenerativeUI />
         <div className="app">
           <main className="board-area">
             {AUTH_DISABLED && <div className="mode-banner">mock モード(認証なし)</div>}
             <div className="board-scroll">
               {failed ? (
                 <div className="board-message" role="alert">
                   <p>クエストを取得できませんでした。</p>
                   <button type="button" className="tab active" onClick={load}>
                     もう一度取得する
                   </button>
                 </div>
               ) : !shown ? (
                 <div className="board-message" role="status">
                   クエストを読み込んでいます…
                 </div>
               ) : (
                 <QuestBoard quests={shown} onOpen={open} />
               )}
             </div>
             {opened && <QuestDetail quest={opened} onClose={close} />}
           </main>
           <aside className="chat-area" aria-label="チャット">
             <CopilotChat
               labels={{
                 welcomeMessageText: "クエストについて、なんでも聞いてください。",
                 chatInputPlaceholder: "クエストについて質問する",
               }}
             />
           </aside>
         </div>
       </CopilotKitProvider>
     );
   }

   export default function App() {
     if (AUTH_DISABLED) return <Workspace />;
     return <AuthGate>{(getToken) => <Workspace getToken={getToken} />}</AuthGate>;
   }
   ```

5. `webapp/src/styles/quest.css` の末尾に、次を追加します。チャットの配色(CopilotKit の設定)に左右されないよう、色は固定しています(固定しないと、文字が読みにくくなりました)。

   ```css
   /* チャット内の理解度チェック */
   .quiz {
     /* チャットの配色(CopilotKit の設定)に左右されないよう、色を固定する */
     --quiz-text: #302b22;
     --quiz-muted: #746b5c;
     --quiz-accent: #74532b;
     --quiz-panel: #fffaf0;
     --quiz-line: #d9c9aa;
     --quiz-green: #3e7254;
     --quiz-wax: #77362e;
     margin: 8px 0;
     padding: 14px;
     border: 1px solid var(--quiz-line);
     border-radius: 12px;
     color: var(--quiz-text);
     background: var(--quiz-panel);
     font-size: 14px;
     line-height: 1.6;
   }

   .quiz-kicker {
     margin-bottom: 4px;
     color: var(--quiz-accent);
     font-size: 12px;
     letter-spacing: 0.08em;
   }

   .quiz-question {
     margin: 0 0 10px;
     font-weight: 500;
   }

   .quiz-options {
     display: grid;
     gap: 6px;
   }

   .quiz-option {
     padding: 9px 11px;
     border: 1px solid var(--quiz-line);
     border-radius: 8px;
     color: inherit;
     background: transparent;
     font: inherit;
     text-align: left;
     cursor: pointer;
   }

   .quiz-option.selected {
     border-color: var(--quiz-accent);
     background: color-mix(in srgb, var(--quiz-accent) 14%, transparent);
   }

   .quiz-option:disabled {
     cursor: default;
   }

   .quiz-submit {
     margin-top: 10px;
     padding: 8px 14px;
     border: 0;
     border-radius: 8px;
     color: var(--quiz-panel);
     background: var(--quiz-accent);
     font: inherit;
     cursor: pointer;
   }

   .quiz-submit:disabled {
     opacity: 0.5;
     cursor: default;
   }

   .quiz-result {
     margin-top: 10px;
     padding: 10px 12px;
     border-radius: 8px;
   }

   .quiz-result.correct {
     background: color-mix(in srgb, var(--quiz-green) 18%, transparent);
   }

   .quiz-result.wrong {
     background: color-mix(in srgb, var(--quiz-wax) 16%, transparent);
   }

   .quiz-result p {
     margin: 4px 0 0;
   }

   .quiz-first {
     color: var(--quiz-muted);
     font-size: 12px;
   }

   .quiz-loading {
     color: var(--quiz-muted);
   }
   ```

### 8.3 aimock にツール呼び出しを書く

**手順**

1. `webapp/mock/aimock.json` を、次の内容にします。次の 2 つのフィクスチャを、この順番で書きます(先に一致したものが使われます)。
   - 回答の結果(ツール `quiz-1` の結果)が届いたときに、テキストで返す。
   - 「理解度チェック」を含むメッセージに、`show_quiz` のツール呼び出しのイベントを返す。引数(`delta`)は、2 回に分けて、ストリーミングの動きを再現しています。

   ```json
   {
     "port": 4010,
     "agui": {
       "path": "/agui",
       "fixtures": [
         {
           "match": {
             "toolCallId": "quiz-1"
           },
           "text": "回答を受け取りました。(モックの応答です)"
         },
         {
           "match": {
             "message": "こんにちは"
           },
           "text": "こんにちは!AG-UI のモックです。"
         },
         {
           "match": {
             "message": "クエスト"
           },
           "text": "クエストボードのカードを選ぶと、詳細を見ながら質問できます。(モックの応答です)"
         },
         {
           "match": {
             "message": "理解度チェック"
           },
           "events": [
             {
               "type": "RUN_STARTED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             },
             {
               "type": "TOOL_CALL_START",
               "toolCallId": "quiz-1",
               "toolCallName": "show_quiz"
             },
             {
               "type": "TOOL_CALL_ARGS",
               "toolCallId": "quiz-1",
               "delta": "{\"question\": \"AgentCore Runtime で AG-UI のエージェントを動かすとき、エージェントがリクエストを受け付けるパスはどれですか。\", "
             },
             {
               "type": "TOOL_CALL_ARGS",
               "toolCallId": "quiz-1",
               "delta": "\"options\": [\"/invocations\", \"/chat\", \"/run\", \"/agent\"], \"answer\": 0, \"explanation\": \"AgentCore Runtime は、コンテナの /invocations でリクエストを受け付け、/ping でヘルスチェックを行います。このアプリのエージェント(agent/main.py)も、同じパスを使っています。\"}"
             },
             {
               "type": "TOOL_CALL_END",
               "toolCallId": "quiz-1"
             },
             {
               "type": "RUN_FINISHED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             }
           ]
         }
       ]
     }
   }
   ```

2. aimock を、起動し直します(フィクスチャは、起動時に読み込まれます)。ポート 4010 で動いている aimock を止めてから、起動します。

   ```sh
   npm run mock
   ```

> [!NOTE]
> - `text` ではなく `events` でイベントを書くときは、`RUN_STARTED` と `RUN_FINISHED` を、自分で書く必要があります。書かないと、「First event must be 'RUN_STARTED'」というエラーになりました(確認済み。aimock に直接リクエストすると、書いたイベントだけが返ります)。
> - `RUN_STARTED` の `threadId` と `runId` は、固定の値にしています。実際のリクエストの値と違っていても、動作しました(確認済み)。
> - 回答を返したあとのリクエストは、最後のユーザーのメッセージが、同じ「理解度チェック」のままです。「理解度チェック」のフィクスチャを先に書くと、また問題が返ってしまいます。そのため、`toolCallId` で一致するフィクスチャを、先に書いています(aimock は、`agui-handler.js` の `findFixture` で、先に一致したものを使います)。
> - `toolCallId` は、固定(`quiz-1`)です。同じ会話で、この問題を 2 回出したときの動きは、確認していません。

### 8.4 動作を確認する

**手順**

1. aimock(`npm run mock`)と、開発サーバー(`npm run dev:mock`)を起動します。
2. チャットに「理解度チェック」と送ります。問題と、4 つの選択肢、「回答する」ボタンが、チャットに表示されます(確認済み)。
3. 選択肢を選ぶまでは、「回答する」が押せません(確認済み)。
4. 不正解の選択肢を選んで「回答する」を押します(確認済み)。
   - 「不正解です」と解説、「初回の回答: 不正解」、「もう一度答える」ボタンが表示されます。
   - 続けて、チャットに「回答を受け取りました。(モックの応答です)」が表示されます。
   - ブラウザの開発者ツールのネットワークで、`POST /api/copilotkit/agent/default/run` が、もう 1 回送られています。本文の `messages` の末尾に、`{"role":"tool","toolCallId":"quiz-1","content":"{"selectedIndex":1,"selectedOption":"/chat","correct":false}"}` が入っています。
5. 「もう一度答える」を押して、正解の選択肢を選んで回答します。「正解です」と表示され、「初回の回答: 不正解」は、そのまま残ります(確認済み)。再回答では、リクエストは、送られません(確認済み。実行の POST は、2 回のままです)。

> [!NOTE]
> - 手順 4 のリクエストの `tools` に、`show_quiz` の名前、説明、引数のスキーマ(JSON Schema)が入っていることを確認しました。エージェントには、この定義が渡ります。
> - **未確認**: 本物のエージェント(Strands)が、`show_quiz` を呼び出して、問題を作ること。Strands 側で、フロントエンドのツールが、期待どおりに呼び出されるか。
> - **未確認**: クリアの記録(仕様書 F-06)。
> - 解説に、正解が書かれているため、不正解のあとの再回答は、すぐ正解できます。解説の書き方は、エージェントへの指示で調整します。
> - 開発中は、CopilotKit の Inspector のボタンが、チャットの右上に出て、問題に重なることがあります(ローカルの開発サーバーだけ)。

## 第9章 チャットから、メイン領域を更新する(フロントエンドのツール)

機能仕様書の SR-04(チャットで指定した検索条件を、メイン領域の表示へ反映する)と、SR-05(何が変更されたか確認できる)を実装します。エージェントが、フロントエンドのツール(`update_quest_filter`)を呼び出すと、クエストボードの検索条件が変わります。変更の内容(変更前、変更後、件数)は、チャットに表示し、ツールの結果として、エージェントにも返します。この章でも、エージェントの代わりに、aimock がツール呼び出しのイベントを返します。

### 9.1 方針

- 検索条件は、画面(`App.tsx`)が持ちます。詳細を閉じても、条件は維持します(仕様書 F-03)。
- 条件は、状態、AWS サービス、重要度、想定学習時間(上限)、期間(直近の日数)です。指定していない条件は、絞り込みません。条件は、すべて満たすものを表示します(仕様書 F-01)。
- 関心領域(AI、料金など)は、クエストのデータに項目がないため、まだ扱いません。
- 画面の操作(状態のタブ、「条件をすべて解除」)と、エージェントのツールは、同じ関数(`updateFilter`)を使います。
- ツールの引数は、変えたい条件だけを渡します。`null` で、その条件を解除します。`reset: true` で、すべて解除してから適用します。
- ツールは、フロントエンドで動きます(`useFrontendTool`)。エージェントに渡る、ツールの名前、説明、引数のスキーマは、`useHumanInTheLoop` と同じ形です。
- 詳細レイヤーを開いたまま、条件を変えても、詳細は開いたままです(仕様書 5.2。別のクエストに切り替わらない)。
- 条件に合うクエストが 0 件のときは、条件を減らす案内と、解除のボタンを出します(仕様書 F-02)。

### 9.2 実装する

**手順**

1. `webapp/src/lib/questFilter.ts` を、次の内容で作成します。検索条件の型、ツールの引数のスキーマ、条件の変更、絞り込み、条件の文への変換です。

   ```ts
   import { z } from "zod";
   import {
     IMPORTANCE_LABEL,
     STATUS_LABEL,
     type Importance,
     type Quest,
     type QuestStatus,
   } from "../data/quests";

   // クエストボードの検索条件(機能仕様書 F-01)
   //   指定していない条件は、絞り込まない。条件は、すべて満たすものを表示する
   export interface QuestFilter {
     status?: QuestStatus;
     // サービス名(どれか 1 つに合えばよい。大文字小文字は区別しない)
     services?: string[];
     importance?: Importance[];
     // 想定学習時間(分)の上限
     maxMinutes?: number;
     // 直近の日数(公開日時で絞る)
     sinceDays?: number;
   }

   export const EMPTY_FILTER: QuestFilter = {};

   // エージェントが、ボードの検索条件を変えるときの引数
   //   指定した条件だけを変える。null を渡すと、その条件を解除する。reset は、すべて解除してから適用する
   export const filterPatchSchema = z.object({
     reset: z.boolean().optional().describe("true なら、これまでの条件をすべて解除してから、次の条件を適用する"),
     status: z
       .enum(["todo", "viewed", "cleared"])
       .nullable()
       .optional()
       .describe("クエストの状態(未着手、閲覧済み、クリア済み)。null で解除"),
     services: z.array(z.string()).nullable().optional().describe("AWS サービス名(例: AgentCore、Lambda)。null で解除"),
     importance: z
       .array(z.enum(["high", "medium", "low"]))
       .nullable()
       .optional()
       .describe("重要度。null で解除"),
     maxMinutes: z.number().int().nullable().optional().describe("想定学習時間の上限(分)。null で解除"),
     sinceDays: z.number().int().nullable().optional().describe("直近の日数(公開日時)。null で解除"),
   });

   export type FilterPatch = z.infer<typeof filterPatchSchema>;

   // 条件を変える。指定した条件だけを上書きし、null の条件は解除する
   export function mergeFilter(prev: QuestFilter, patch: FilterPatch): QuestFilter {
     const next: Record<string, unknown> = patch.reset ? {} : { ...prev };
     const { reset: _reset, ...changes } = patch;
     for (const [key, value] of Object.entries(changes)) {
       if (value === undefined) continue;
       if (value === null) delete next[key];
       else next[key] = value;
     }
     return next as QuestFilter;
   }

   const DAY_MS = 24 * 60 * 60 * 1000;

   export function applyFilter(quests: Quest[], filter: QuestFilter, now = Date.now()): Quest[] {
     return quests.filter((q) => {
       if (filter.status && q.status !== filter.status) return false;
       if (filter.services?.length) {
         const wanted = filter.services.map((s) => s.toLowerCase());
         const has = q.services.some((s) => wanted.some((w) => s.toLowerCase().includes(w)));
         if (!has) return false;
       }
       if (filter.importance?.length && !filter.importance.includes(q.importance)) return false;
       if (filter.maxMinutes !== undefined && q.minutes > filter.maxMinutes) return false;
       if (filter.sinceDays !== undefined && Date.parse(q.publishedAt) < now - filter.sinceDays * DAY_MS) {
         return false;
       }
       return true;
     });
   }

   // 適用中の条件を、画面とチャットに出す文にする(条件がなければ、空の配列)
   export function describeFilter(filter: QuestFilter): string[] {
     const labels: string[] = [];
     if (filter.sinceDays !== undefined) labels.push(`期間: 直近 ${filter.sinceDays} 日`);
     if (filter.services?.length) labels.push(`サービス: ${filter.services.join("、")}`);
     if (filter.importance?.length) {
       labels.push(`重要度: ${filter.importance.map((i) => IMPORTANCE_LABEL[i].replace("重要度 ", "")).join("、")}`);
     }
     if (filter.maxMinutes !== undefined) labels.push(`想定学習時間: ${filter.maxMinutes} 分以内`);
     if (filter.status) labels.push(`状態: ${STATUS_LABEL[filter.status]}`);
     return labels;
   }

   // 条件を変えた結果(チャットに表示し、エージェントにも返す)
   export interface FilterChange {
     before: string[];
     after: string[];
     // 変更後に、ボードに表示されるクエストの数と、全体の数
     count: number;
     total: number;
   }
   ```

2. `webapp/src/components/QuestBoard.tsx` を、次の内容に置き換えます(7.3 からの変更は、検索条件を親から受け取ること、適用中の条件と件数の表示、0 件のときの案内です)。

   ```tsx
   import {
     IMPORTANCE_LABEL,
     RANK,
     STATUS_LABEL,
     type Quest,
     type QuestStatus,
   } from "../data/quests";
   import {
     applyFilter,
     describeFilter,
     type FilterPatch,
     type QuestFilter,
   } from "../lib/questFilter";

   const TABS: { key: "all" | QuestStatus; label: string }[] = [
     { key: "all", label: "すべて" },
     { key: "todo", label: "未着手" },
     { key: "viewed", label: "閲覧済み" },
     { key: "cleared", label: "クリア済み" },
   ];

   const IMPORTANCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

   interface Props {
     quests: Quest[];
     filter: QuestFilter;
     onFilterChange: (patch: FilterPatch) => void;
     onOpen: (id: string) => void;
   }

   export default function QuestBoard({ quests, filter, onFilterChange, onOpen }: Props) {
     // 重要度の高いクエストを、先に表示する
     const shown = applyFilter(quests, filter).sort(
       (a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance],
     );
     const conditions = describeFilter(filter);
     const activeTab = filter.status ?? "all";

     return (
       <section className="board" aria-label="クエストボード">
         <div className="board-head">
           <div>
             <h2>クエストボード</h2>
             <p className="muted">
               {shown.length} 件のクエスト
               {conditions.length > 0 && `(全 ${quests.length} 件)`}・サンプルデータ
             </p>
           </div>
           <div className="tabs" role="tablist" aria-label="状態で絞り込む">
             {TABS.map((tab) => (
               <button
                 key={tab.key}
                 type="button"
                 role="tab"
                 aria-selected={activeTab === tab.key}
                 className={activeTab === tab.key ? "tab active" : "tab"}
                 onClick={() => onFilterChange({ status: tab.key === "all" ? null : tab.key })}
               >
                 {tab.label}
               </button>
             ))}
           </div>
         </div>

         {conditions.length > 0 && (
           <div className="conditions" aria-label="適用中の条件">
             <span className="conditions-label">適用中の条件</span>
             {conditions.map((c) => (
               <span key={c} className="condition">
                 {c}
               </span>
             ))}
             <button type="button" className="tab" onClick={() => onFilterChange({ reset: true })}>
               条件をすべて解除
             </button>
           </div>
         )}

         {quests.length === 0 ? (
           <p className="empty">クエストがまだありません。チャットで、クエストを探せます。</p>
         ) : shown.length === 0 ? (
           <div className="empty">
             <p>条件に合うクエストがありません。条件を減らすか、期間を広げてください。</p>
             <button
               type="button"
               className="tab active"
               onClick={() => onFilterChange({ reset: true })}
             >
               条件をすべて解除する
             </button>
           </div>
         ) : (
           <div className="quest-list">
             {shown.map((q) => (
               <button
                 key={q.id}
                 type="button"
                 className={`quest status-${q.status}`}
                 data-stamp={q.status === "cleared" ? "済" : RANK[q.importance]}
                 onClick={() => onOpen(q.id)}
               >
                 <span className="quest-head">
                   <span className="quest-title">{q.title}</span>
                   <span className={`badge status ${q.status}`}>{STATUS_LABEL[q.status]}</span>
                 </span>
                 <span className="quest-copy">{q.summary}</span>
                 <span className="meta-row">
                   {q.services.map((s) => (
                     <span key={s} className="badge">
                       {s}
                     </span>
                   ))}
                   <span className={q.importance === "high" ? "badge high" : "badge"}>
                     {IMPORTANCE_LABEL[q.importance]}
                   </span>
                   <span className="source">約 {q.minutes} 分</span>
                 </span>
               </button>
             ))}
           </div>
         )}
       </section>
     );
   }
   ```

3. `webapp/src/components/FilterChangeCard.tsx` を、次の内容で作成します。チャットに表示する、変更の内容(変更前、変更後、件数)です。

   ```tsx
   import type { FilterChange } from "../lib/questFilter";

   interface Props {
     status: string;
     result?: string;
   }

   function parseChange(result?: string): FilterChange | null {
     if (!result) return null;
     try {
       return JSON.parse(result) as FilterChange;
     } catch {
       return null;
     }
   }

   // エージェントが、メイン領域の検索条件を変えたことを、チャットに示す(仕様書 SR-05)
   export default function FilterChangeCard({ status, result }: Props) {
     const change = parseChange(result);
     if (!change) {
       return (
         <div className="notice notice-loading">
           {status === "complete" ? "メイン領域を更新しました" : "メイン領域を更新しています…"}
         </div>
       );
     }
     const show = (labels: string[]) => (labels.length > 0 ? labels.join(" / ") : "条件なし");
     return (
       <div className="notice" role="status">
         <div className="notice-title">メイン領域を更新しました</div>
         <dl>
           <dt>変更前</dt>
           <dd>{show(change.before)}</dd>
           <dt>変更後</dt>
           <dd>{show(change.after)}</dd>
           <dt>表示</dt>
           <dd>
             {change.count} 件(全 {change.total} 件)
           </dd>
         </dl>
       </div>
     );
   }
   ```

4. `webapp/src/components/GenerativeUI.tsx` を、次の内容に置き換えます(8.2 からの変更は、`update_quest_filter` の登録です)。

   ```tsx
   import { useFrontendTool, useHumanInTheLoop } from "@copilotkit/react-core/v2";
   import { filterPatchSchema, type FilterChange, type FilterPatch } from "../lib/questFilter";
   import FilterChangeCard from "./FilterChangeCard";
   import Quiz, { quizSchema } from "./Quiz";

   interface Props {
     // メイン領域(クエストボード)の検索条件を変える。変更の内容を返す
     updateFilter: (patch: FilterPatch) => FilterChange;
   }

   // エージェントが呼び出せる、チャット内の UI と、画面を操作するツールを登録する
   // (CopilotKitProvider の中に置く)
   export default function GenerativeUI({ updateFilter }: Props) {
     // 理解度チェック: 問題を表示し、ユーザーの初回の回答を、エージェントに返す
     // 回答が返るまで、エージェントの実行は止まる
     useHumanInTheLoop({
       name: "show_quiz",
       description:
         "クエストの内容に合わせた、単一選択の理解度チェックの問題を、チャットに表示する。ユーザーが回答すると、その内容(選んだ選択肢と、正誤)が返る",
       parameters: quizSchema,
       render: ({ args, respond, result }) => (
         <Quiz {...args} respond={respond} result={result} />
       ),
     });

     // クエストボードの検索条件の変更: ユーザーの依頼(期間、サービス、重要度など)を、メイン領域に反映する
     // 変更の内容(変更前、変更後、件数)を、チャットに表示し、エージェントにも返す
     useFrontendTool({
       name: "update_quest_filter",
       description:
         "クエストボードの検索条件を変える。ユーザーが、期間、AWS サービス、重要度、想定学習時間、状態で、クエストを絞り込みたいときに呼ぶ。指定した条件だけを変え、null で条件を解除する。すべて解除するときは reset を true にする。変更前後の条件と、表示される件数が返る",
       parameters: filterPatchSchema,
       handler: async (args) => updateFilter(args),
       render: ({ status, result }) => <FilterChangeCard status={status} result={result} />,
     });

     return null;
   }
   ```

5. `webapp/src/components/App.tsx` を、次の内容に置き換えます(8.2 からの変更は、検索条件の状態と `updateFilter` を持つことです)。

   ```tsx
   import { useCallback, useEffect, useRef, useState } from "react";
   import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
   import "@copilotkit/react-core/v2/styles.css";
   import "../styles/quest.css";
   import type { Quest, QuestStatus } from "../data/quests";
   import { AUTH_DISABLED } from "../lib/outputs";
   import {
     EMPTY_FILTER,
     applyFilter,
     describeFilter,
     mergeFilter,
     type FilterChange,
     type FilterPatch,
     type QuestFilter,
   } from "../lib/questFilter";
   import AuthGate from "./AuthGate";
   import GenerativeUI from "./GenerativeUI";
   import QuestBoard from "./QuestBoard";
   import QuestDetail from "./QuestDetail";

   const RUNTIME_URL = "/api/copilotkit";
   const QUESTS_URL = "/api/quests";

   function Workspace({ getToken }: { getToken?: () => string }) {
     // getToken は、レンダリングのたびに作り直されることがあるため、参照で持つ
     const tokenRef = useRef(getToken);
     tokenRef.current = getToken;

     const [quests, setQuests] = useState<Quest[] | null>(null);
     const [failed, setFailed] = useState(false);
     // 画面での状態の変更(詳細を開いたら、閲覧済みにする)。保存は、まだしない
     const [statuses, setStatuses] = useState<Record<string, QuestStatus>>({});
     const [openId, setOpenId] = useState<string | null>(null);
     // クエストボードの検索条件。詳細を閉じても、維持する(仕様書 F-03)
     const [filter, setFilter] = useState<QuestFilter>(EMPTY_FILTER);
     const filterRef = useRef(filter);

     // クエストは、エージェントを通さず、API から取得する
     const load = useCallback(async () => {
       setFailed(false);
       setQuests(null);
       try {
         const token = tokenRef.current?.();
         const res = await fetch(QUESTS_URL, {
           headers: token ? { Authorization: `Bearer ${token}` } : {},
         });
         if (!res.ok) throw new Error(`HTTP ${res.status}`);
         setQuests((await res.json()).quests as Quest[]);
       } catch {
         setFailed(true);
       }
     }, []);

     useEffect(() => {
       void load();
     }, [load]);

     const shown = quests?.map((q) => ({ ...q, status: statuses[q.id] ?? q.status }));
     const opened = shown?.find((q) => q.id === openId);
     const shownRef = useRef(shown);
     shownRef.current = shown;

     // 検索条件を変える(画面の操作と、エージェントのツールの、どちらからも使う)
     // 変更前後の条件と、表示される件数を返す
     const updateFilter = useCallback((patch: FilterPatch): FilterChange => {
       const before = filterRef.current;
       const after = mergeFilter(before, patch);
       filterRef.current = after;
       setFilter(after);
       const all = shownRef.current ?? [];
       return {
         before: describeFilter(before),
         after: describeFilter(after),
         count: applyFilter(all, after).length,
         total: all.length,
       };
     }, []);

     // 詳細を開いたクエストは、閲覧済みにする(クリア済みは、そのまま)
     const open = (id: string) => {
       setOpenId(id);
       setStatuses((s) => {
         const current = s[id] ?? quests?.find((q) => q.id === id)?.status;
         return current === "todo" ? { ...s, [id]: "viewed" } : s;
       });
     };
     const close = useCallback(() => setOpenId(null), []);

     return (
       <CopilotKitProvider
         runtimeUrl={RUNTIME_URL}
         headers={getToken ? () => ({ Authorization: `Bearer ${getToken()}` }) : undefined}
       >
         <GenerativeUI updateFilter={updateFilter} />
         <div className="app">
           <main className="board-area">
             {AUTH_DISABLED && <div className="mode-banner">mock モード(認証なし)</div>}
             <div className="board-scroll">
               {failed ? (
                 <div className="board-message" role="alert">
                   <p>クエストを取得できませんでした。</p>
                   <button type="button" className="tab active" onClick={load}>
                     もう一度取得する
                   </button>
                 </div>
               ) : !shown ? (
                 <div className="board-message" role="status">
                   クエストを読み込んでいます…
                 </div>
               ) : (
                 <QuestBoard
                   quests={shown}
                   filter={filter}
                   onFilterChange={updateFilter}
                   onOpen={open}
                 />
               )}
             </div>
             {opened && <QuestDetail quest={opened} onClose={close} />}
           </main>
           <aside className="chat-area" aria-label="チャット">
             <CopilotChat
               labels={{
                 welcomeMessageText: "クエストについて、なんでも聞いてください。",
                 chatInputPlaceholder: "クエストについて質問する",
               }}
             />
           </aside>
         </div>
       </CopilotKitProvider>
     );
   }

   export default function App() {
     if (AUTH_DISABLED) return <Workspace />;
     return <AuthGate>{(getToken) => <Workspace getToken={getToken} />}</AuthGate>;
   }
   ```

6. `webapp/src/styles/quest.css` を、次の内容に置き換えます(8.2 からの変更は、適用中の条件、通知のカード、モードの表示の位置です)。

   ```css
   :root {
     color-scheme: light dark;
     --bg: light-dark(#f4efe2, #171714);
     --panel: light-dark(#fffaf0, #23231f);
     --panel-2: light-dark(#eee4cf, #2b2a24);
     --text: light-dark(#302b22, #f6f0e3);
     --muted: light-dark(#746b5c, #b8ae9d);
     --line: light-dark(#d9c9aa, #474239);
     --accent: light-dark(#74532b, #d4aa68);
     --green: light-dark(#3e7254, #83c79e);
     --board: light-dark(#6f4729, #3b271a);
     --board-dark: light-dark(#4b2e1a, #21150f);
     --board-text: light-dark(#fff3d7, #f4dfbd);
     --board-muted: light-dark(#e6ceb0, #cbb28e);
     --paper: light-dark(#f4e5bd, #d8c59b);
     --paper-2: light-dark(#ead4a3, #c7af7e);
     --ink: light-dark(#3c2b1b, #332517);
     --pin: light-dark(#8d2f29, #bd5a4f);
     --wax: light-dark(#77362e, #6d302b);
     --shadow: light-dark(#22140c99, #0d0806b8);
   }

   body {
     margin: 0;
     color: var(--text);
     background: var(--bg);
     font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Hiragino Sans", sans-serif;
   }

   * {
     box-sizing: border-box;
   }

   h2,
   h3,
   p {
     margin: 0;
   }

   /* 画面を、メイン領域とチャット領域に分ける */
   .app {
     display: grid;
     grid-template-columns: minmax(0, 1fr) 400px;
     height: 100vh;
   }

   .board-area {
     position: relative;
     min-width: 0;
     overflow: hidden;
     background:
       repeating-linear-gradient(93deg, transparent 0 72px, color-mix(in srgb, var(--board-dark) 20%, transparent) 73px 75px),
       linear-gradient(135deg, var(--board), var(--board-dark));
     box-shadow: inset 0 0 0 8px color-mix(in srgb, var(--board-dark) 72%, transparent);
   }

   .board-scroll {
     height: 100%;
     overflow: auto;
     padding: 24px;
   }

   .mode-banner {
     position: absolute;
     right: 16px;
     bottom: 12px;
     z-index: 20;
     padding: 4px 10px;
     border-radius: 999px;
     color: var(--ink);
     background: var(--paper);
     font-size: 12px;
   }

   .chat-area {
     display: flex;
     min-width: 0;
     height: 100vh;
     flex-direction: column;
     border-left: 1px solid var(--line);
     background: var(--panel);
   }

   .chat-area > * {
     flex: 1;
     min-height: 0;
   }

   /* クエストボード */
   .board-head {
     display: flex;
     align-items: flex-end;
     justify-content: space-between;
     gap: 16px;
     margin-bottom: 14px;
   }

   .board-head h2 {
     color: var(--board-text);
     font-size: 20px;
     font-weight: 500;
     text-shadow: 0 2px 2px var(--board-dark);
   }

   .board-head .muted {
     color: var(--board-muted);
     font-size: 12px;
   }

   .tabs {
     display: flex;
     flex-wrap: wrap;
     gap: 6px;
   }

   .tab {
     padding: 7px 10px;
     border: 0;
     border-radius: 8px;
     color: var(--board-text);
     background: color-mix(in srgb, var(--board-dark) 62%, transparent);
     font: inherit;
     font-size: 12px;
     cursor: pointer;
   }

   .tab.active {
     color: var(--ink);
     background: var(--paper);
   }

   .empty,
   .board-message {
     padding: 32px 0;
     color: var(--board-text);
   }

   .board-message p {
     margin-bottom: 12px;
   }

   .conditions {
     display: flex;
     flex-wrap: wrap;
     align-items: center;
     gap: 6px;
     margin-bottom: 14px;
   }

   .conditions-label {
     color: var(--board-muted);
     font-size: 12px;
   }

   .condition {
     padding: 4px 9px;
     border-radius: 999px;
     color: var(--ink);
     background: var(--paper);
     font-size: 12px;
   }

   .quest-list {
     display: grid;
     grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
     gap: 24px 18px;
     padding: 10px 4px;
   }

   .quest {
     position: relative;
     display: block;
     width: 100%;
     min-height: 190px;
     padding: 28px 18px 18px;
     border: 0;
     border-radius: 2px;
     color: var(--ink);
     background:
       linear-gradient(90deg, color-mix(in srgb, var(--paper-2) 42%, transparent), transparent 15% 85%, color-mix(in srgb, var(--paper-2) 42%, transparent)),
       repeating-linear-gradient(0deg, transparent 0 26px, color-mix(in srgb, var(--ink) 7%, transparent) 27px),
       var(--paper);
     clip-path: polygon(1% 2%, 48% 0, 99% 2%, 100% 42%, 98% 98%, 54% 100%, 2% 98%, 0 55%);
     box-shadow: 2px 7px 13px var(--shadow);
     font: inherit;
     text-align: left;
     cursor: pointer;
     transition: transform 0.15s ease;
   }

   .quest:nth-child(3n + 1) {
     transform: rotate(-1.2deg);
   }

   .quest:nth-child(3n + 2) {
     transform: rotate(1deg);
   }

   .quest:nth-child(3n) {
     transform: rotate(0.6deg);
   }

   .quest:hover,
   .quest:focus-visible {
     transform: translateY(-3px) rotate(0deg);
     outline: none;
   }

   .quest::before {
     content: "";
     position: absolute;
     top: 8px;
     left: 50%;
     width: 12px;
     height: 12px;
     border-radius: 50%;
     background: radial-gradient(circle at 35% 30%, #f4a59c 0 10%, var(--pin) 28% 70%, #55201d 72%);
     transform: translateX(-50%);
   }

   .quest::after {
     content: attr(data-stamp);
     position: absolute;
     right: 15px;
     bottom: 13px;
     display: grid;
     place-items: center;
     width: 34px;
     height: 34px;
     border: 2px solid var(--wax);
     border-radius: 50%;
     color: var(--wax);
     background: color-mix(in srgb, var(--wax) 20%, transparent);
     font-family: Georgia, serif;
     font-weight: 700;
     transform: rotate(-9deg);
   }

   .quest.status-cleared {
     opacity: 0.66;
   }

   .quest-head {
     display: flex;
     align-items: flex-start;
     justify-content: space-between;
     gap: 12px;
   }

   .quest-title {
     font-family: Georgia, "Yu Mincho", serif;
     font-size: 15px;
     font-weight: 500;
   }

   .quest-copy {
     display: block;
     margin-top: 11px;
     font-size: 13px;
     line-height: 1.55;
     color: color-mix(in srgb, var(--ink) 77%, transparent);
   }

   .meta-row {
     display: flex;
     flex-wrap: wrap;
     align-items: center;
     gap: 6px;
     margin-top: 12px;
     padding-right: 44px;
   }

   .badge {
     padding: 4px 7px;
     border-radius: 999px;
     color: light-dark(#3f4f51, #344447);
     background: color-mix(in srgb, light-dark(#729197, #678289) 18%, transparent);
     font-size: 12px;
     white-space: nowrap;
   }

   .badge.high {
     color: light-dark(#7d2e25, #6c2923);
     background: color-mix(in srgb, light-dark(#a4493d, #8e3e35) 17%, transparent);
   }

   .badge.status.viewed {
     color: light-dark(#3d5a75, #2f4a62);
     background: color-mix(in srgb, light-dark(#4f7ea3, #4f7ea3) 18%, transparent);
   }

   .badge.status.cleared {
     color: light-dark(#315d3e, #2c5137);
     background: color-mix(in srgb, light-dark(#4d7f58, #476f50) 17%, transparent);
   }

   .source {
     color: light-dark(#725b42, #5f4b38);
     font-size: 12px;
   }

   /* クエスト詳細(メイン領域だけを覆う。チャット領域は覆わない) */
   .detail-layer {
     position: absolute;
     inset: 0;
     z-index: 10;
     overflow: auto;
     padding: 24px;
     background:
       repeating-linear-gradient(93deg, transparent 0 72px, color-mix(in srgb, var(--board-dark) 20%, transparent) 73px 75px),
       linear-gradient(135deg, var(--board), var(--board-dark));
   }

   .detail-toolbar {
     display: flex;
     align-items: center;
     justify-content: space-between;
     gap: 12px;
     margin-bottom: 14px;
   }

   .detail-toolbar .muted {
     color: var(--board-muted);
     font-size: 12px;
   }

   .back-button {
     padding: 8px 11px;
     border: 0;
     border-radius: 8px;
     color: var(--board-text);
     background: color-mix(in srgb, var(--board-dark) 65%, transparent);
     font: inherit;
     font-size: 12px;
     cursor: pointer;
   }

   .strategy-sheet {
     max-width: 820px;
     margin: 0 auto;
     padding: 28px 28px 24px;
     color: var(--ink);
     background:
       repeating-linear-gradient(0deg, transparent 0 29px, color-mix(in srgb, var(--ink) 6%, transparent) 30px),
       var(--paper);
     box-shadow: 3px 9px 18px var(--shadow);
   }

   .strategy-kicker {
     color: color-mix(in srgb, var(--ink) 70%, transparent);
     font-size: 12px;
     letter-spacing: 0.08em;
   }

   .strategy-title {
     margin-top: 5px;
     font-family: Georgia, "Yu Mincho", serif;
     font-size: 20px;
     font-weight: 500;
   }

   .generated-stack {
     display: grid;
     gap: 10px;
     margin-top: 18px;
   }

   .generated-panel {
     padding: 14px;
     background: color-mix(in srgb, var(--paper-2) 44%, transparent);
     font-size: 13px;
     line-height: 1.6;
   }

   .generated-panel h3 {
     display: flex;
     align-items: center;
     gap: 8px;
     margin: 0 0 8px;
     font-family: Georgia, "Yu Mincho", serif;
     font-size: 14px;
     font-weight: 500;
   }

   .generated-panel ul {
     margin: 0;
     padding-left: 18px;
   }

   .generated-panel a {
     color: var(--wax);
   }

   .origin {
     padding: 2px 6px;
     border: 1px solid currentColor;
     border-radius: 4px;
     font-family: ui-sans-serif, system-ui, sans-serif;
     font-size: 11px;
   }

   .origin.news {
     color: light-dark(#315d3e, #2c5137);
   }

   .origin.ai {
     color: light-dark(#7d2e25, #6c2923);
   }

   .compare-grid {
     display: grid;
     grid-template-columns: 1fr auto 1fr;
     align-items: stretch;
     gap: 10px;
   }

   .compare-side,
   .impact-item {
     padding: 11px;
     background: color-mix(in srgb, var(--paper) 72%, transparent);
     font-size: 12px;
     line-height: 1.55;
   }

   .compare-side strong,
   .impact-item strong {
     display: block;
     margin-bottom: 4px;
     font-weight: 500;
   }

   .compare-arrow {
     align-self: center;
     font-size: 18px;
   }

   .impact-list {
     display: grid;
     grid-template-columns: repeat(3, 1fr);
     gap: 8px;
   }

   /* 狭い画面では、チャットを下に置く */
   @media (max-width: 900px) {
     .app {
       grid-template-columns: 1fr;
       grid-template-rows: minmax(0, 1fr) 55vh;
     }

     .chat-area {
       height: 55vh;
       border-top: 1px solid var(--line);
       border-left: 0;
     }

     .board-head {
       align-items: flex-start;
       flex-direction: column;
     }

     .impact-list,
     .compare-grid {
       grid-template-columns: 1fr;
     }

     .compare-arrow {
       justify-self: center;
       transform: rotate(90deg);
     }
   }

   /* チャット内の理解度チェック */
   /* チャット内の部品の配色は、チャットの配色(CopilotKit の設定)に左右されないよう、固定する */
   .quiz,
   .notice {
     --quiz-text: #302b22;
     --quiz-muted: #746b5c;
     --quiz-accent: #74532b;
     --quiz-panel: #fffaf0;
     --quiz-line: #d9c9aa;
     --quiz-green: #3e7254;
     --quiz-wax: #77362e;
   }

   .quiz {
     margin: 8px 0;
     padding: 14px;
     border: 1px solid var(--quiz-line);
     border-radius: 12px;
     color: var(--quiz-text);
     background: var(--quiz-panel);
     font-size: 14px;
     line-height: 1.6;
   }

   .quiz-kicker {
     margin-bottom: 4px;
     color: var(--quiz-accent);
     font-size: 12px;
     letter-spacing: 0.08em;
   }

   .quiz-question {
     margin: 0 0 10px;
     font-weight: 500;
   }

   .quiz-options {
     display: grid;
     gap: 6px;
   }

   .quiz-option {
     padding: 9px 11px;
     border: 1px solid var(--quiz-line);
     border-radius: 8px;
     color: inherit;
     background: transparent;
     font: inherit;
     text-align: left;
     cursor: pointer;
   }

   .quiz-option.selected {
     border-color: var(--quiz-accent);
     background: color-mix(in srgb, var(--quiz-accent) 14%, transparent);
   }

   .quiz-option:disabled {
     cursor: default;
   }

   .quiz-submit {
     margin-top: 10px;
     padding: 8px 14px;
     border: 0;
     border-radius: 8px;
     color: var(--quiz-panel);
     background: var(--quiz-accent);
     font: inherit;
     cursor: pointer;
   }

   .quiz-submit:disabled {
     opacity: 0.5;
     cursor: default;
   }

   .quiz-result {
     margin-top: 10px;
     padding: 10px 12px;
     border-radius: 8px;
   }

   .quiz-result.correct {
     background: color-mix(in srgb, var(--quiz-green) 18%, transparent);
   }

   .quiz-result.wrong {
     background: color-mix(in srgb, var(--quiz-wax) 16%, transparent);
   }

   .quiz-result p {
     margin: 4px 0 0;
   }

   .quiz-first {
     color: var(--quiz-muted);
     font-size: 12px;
   }

   .quiz-loading {
     color: var(--quiz-muted);
   }

   /* チャット内の、メイン領域を更新したことの通知 */
   .notice {
     margin: 8px 0;
     padding: 12px 14px;
     border: 1px solid var(--quiz-line);
     border-left: 4px solid var(--quiz-accent);
     border-radius: 8px;
     color: var(--quiz-text);
     background: var(--quiz-panel);
     font-size: 13px;
     line-height: 1.6;
   }

   .notice-title {
     margin-bottom: 4px;
     font-weight: 500;
   }

   .notice dl {
     display: grid;
     grid-template-columns: auto 1fr;
     gap: 2px 10px;
     margin: 0;
   }

   .notice dt {
     color: var(--quiz-muted);
   }

   .notice dd {
     margin: 0;
   }

   .notice-loading {
     color: var(--quiz-muted);
   }
   ```

7. `webapp/mock/aimock.json` を、次の内容にします。「絞り込み」「条件を解除」「一致しない」を含むメッセージに、それぞれ、`update_quest_filter` のツール呼び出しを返します。ツールの結果が届いたあとの返答(`filter-1` など)を、先に書いています(8.3 と同じ理由です)。

   ```json
   {
     "port": 4010,
     "agui": {
       "path": "/agui",
       "fixtures": [
         {
           "match": {
             "toolCallId": "quiz-1"
           },
           "text": "回答を受け取りました。(モックの応答です)"
         },
         {
           "match": {
             "toolCallId": "filter-1"
           },
           "text": "ボードを更新しました。(モックの応答です)"
         },
         {
           "match": {
             "toolCallId": "filter-2"
           },
           "text": "ボードを更新しました。(モックの応答です)"
         },
         {
           "match": {
             "toolCallId": "filter-3"
           },
           "text": "ボードを更新しました。(モックの応答です)"
         },
         {
           "match": {
             "message": "絞り込み"
           },
           "events": [
             {
               "type": "RUN_STARTED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             },
             {
               "type": "TOOL_CALL_START",
               "toolCallId": "filter-1",
               "toolCallName": "update_quest_filter"
             },
             {
               "type": "TOOL_CALL_ARGS",
               "toolCallId": "filter-1",
               "delta": "{\"services\": [\"AgentCore\", \"Lambda\"], \"maxMinutes\": 5}"
             },
             {
               "type": "TOOL_CALL_END",
               "toolCallId": "filter-1"
             },
             {
               "type": "RUN_FINISHED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             }
           ]
         },
         {
           "match": {
             "message": "条件を解除"
           },
           "events": [
             {
               "type": "RUN_STARTED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             },
             {
               "type": "TOOL_CALL_START",
               "toolCallId": "filter-2",
               "toolCallName": "update_quest_filter"
             },
             {
               "type": "TOOL_CALL_ARGS",
               "toolCallId": "filter-2",
               "delta": "{\"reset\": true}"
             },
             {
               "type": "TOOL_CALL_END",
               "toolCallId": "filter-2"
             },
             {
               "type": "RUN_FINISHED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             }
           ]
         },
         {
           "match": {
             "message": "一致しない"
           },
           "events": [
             {
               "type": "RUN_STARTED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             },
             {
               "type": "TOOL_CALL_START",
               "toolCallId": "filter-3",
               "toolCallName": "update_quest_filter"
             },
             {
               "type": "TOOL_CALL_ARGS",
               "toolCallId": "filter-3",
               "delta": "{\"reset\": true, \"services\": [\"EC2\"]}"
             },
             {
               "type": "TOOL_CALL_END",
               "toolCallId": "filter-3"
             },
             {
               "type": "RUN_FINISHED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             }
           ]
         },
         {
           "match": {
             "message": "こんにちは"
           },
           "text": "こんにちは!AG-UI のモックです。"
         },
         {
           "match": {
             "message": "理解度チェック"
           },
           "events": [
             {
               "type": "RUN_STARTED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             },
             {
               "type": "TOOL_CALL_START",
               "toolCallId": "quiz-1",
               "toolCallName": "show_quiz"
             },
             {
               "type": "TOOL_CALL_ARGS",
               "toolCallId": "quiz-1",
               "delta": "{\"question\": \"AgentCore Runtime で AG-UI のエージェントを動かすとき、エージェントがリクエストを受け付けるパスはどれですか。\", "
             },
             {
               "type": "TOOL_CALL_ARGS",
               "toolCallId": "quiz-1",
               "delta": "\"options\": [\"/invocations\", \"/chat\", \"/run\", \"/agent\"], \"answer\": 0, \"explanation\": \"AgentCore Runtime は、コンテナの /invocations でリクエストを受け付け、/ping でヘルスチェックを行います。このアプリのエージェント(agent/main.py)も、同じパスを使っています。\"}"
             },
             {
               "type": "TOOL_CALL_END",
               "toolCallId": "quiz-1"
             },
             {
               "type": "RUN_FINISHED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             }
           ]
         },
         {
           "match": {
             "message": "クエスト"
           },
           "text": "クエストボードのカードを選ぶと、詳細を見ながら質問できます。(モックの応答です)"
         }
       ]
     }
   }
   ```

8. aimock を、起動し直します(ポート 4010 で動いているものを止めてから、`npm run mock`)。

### 9.3 動作を確認する

**手順**

1. aimock と開発サーバー(`npm run dev:mock`)を起動して、ブラウザで開きます。
2. チャットに「AgentCore と Lambda を 5 分以内に絞り込み」と送ります(確認済み)。
   - ボードが 2 件(AgentCore と Lambda)になり、「適用中の条件」に「サービス: AgentCore、Lambda」と「想定学習時間: 5 分以内」が出ます。件数は「2 件のクエスト(全 4 件)」です。
   - チャットに、「メイン領域を更新しました」のカードが出て、変更前(条件なし)、変更後、表示(2 件(全 4 件))が表示されます。
   - 続けて、エージェントの返答「ボードを更新しました。(モックの応答です)」が出ます。
3. 続けて、「一致しない条件」と送ります(確認済み)。ボードが 0 件になり、「条件に合うクエストがありません。条件を減らすか、期間を広げてください。」と「条件をすべて解除する」が出ます。チャットのカードの「変更前」は、直前の条件になっています。
4. 「条件をすべて解除する」を押します(確認済み)。4 件に戻ります。
5. クエストを開いたまま、手順 2 のメッセージを送ります(確認済み。再読み込みして、新しい会話で行います)。詳細は開いたままで、後ろのボードが 2 件に変わります。詳細を閉じても、条件と 2 件の表示は、そのまま維持されます。

> [!NOTE]
> - **aimock の制限**: 固定のイベントの中の `toolCallId`(`filter-1` など)は、毎回同じです。同じ会話の中で、同じメッセージを 2 回送ると、2 回目は、ツールの呼び出しとして扱われず、何も起きませんでした(確認済み)。再読み込みして、新しい会話にすると、動きます。本物のエージェントは、呼び出しごとに、別の ID を作るため、この制限は、モックだけのものと考えています(未確認)。
> - **確認していない**: 期間(`sinceDays`)と重要度(`importance`)の条件を、チャットから指定すること。ロジックは書いていますが、ブラウザでは、サービスと想定学習時間、リセットだけを確認しました。
> - **確認していない**: 本物のエージェント(Strands)が、`update_quest_filter` を、自然言語の依頼から、適切な引数で呼び出すこと。
> - チャットに条件を書く前に、エージェントが、依頼を条件に解釈する必要があります(仕様書 F-01 の「条件確認」)。その確認の UI は、次に作ります。

## 第10章 クエストをクリアする(回答後の操作)

機能仕様書の F-05(回答後の操作の提示)と F-06(クエストクリア)を実装します。理解度チェックに回答すると、問題のカードの中に、「クエストをクリアする」「詳細へ戻る」「追加で質問する」が出ます。

### 10.1 方針

- **クリアの条件**: 正解・不正解にかかわらず、回答したらクリアできます(仕様書 F-06)。仕様書の未決事項には、「回答済みとするか、正解済みとするか」が残っています。ここでは、F-06 のとおり、回答済みとして作っています。
- **復習候補**: 不正解のままクリアすると、そのクエストに「復習」の印を付けます(F-06)。クリアした時点の、直近の回答が不正解のときです。正解してからクリアしたときは、付きません。
- **重複**: クリア済みのクエストには、「クリアする」ではなく、「クリア済みです」を出します(F-06。週間のクリア数を、重複して加算しない、に対応)。
- **保存**: まだしません。画面の中だけで持つので、再読み込みで戻ります(履歴の保存は、F-07 で作ります)。
- **問題とクエストの対応**: `show_quiz` に、クエストの ID(`questId`)を足しました。どのクエストのクリアか、決めるためです。
- **チャット内の部品から、画面を操作する窓口**: React の Context(`QuestActions`)にします。理解度チェックの部品は、クエストの状態を読み、クリアと詳細の表示、入力欄へのフォーカスを、この窓口から行います。
- 1 クエストの出題数(未決事項)は、1 問のままです。

### 10.2 実装する

**手順**

1. `webapp/src/components/QuestActions.tsx` を、次の内容で作成します。

   ```tsx
   import { createContext, useContext } from "react";
   import type { QuestStatus } from "../data/quests";

   // チャット内の部品(理解度チェックなど)が、クエストボードの状態を読み、操作するための窓口
   export interface QuestActions {
     // クエストの状態と、復習候補かどうか(クエストがなければ undefined)
     statusOf: (questId: string) => QuestStatus | undefined;
     isReview: (questId: string) => boolean;
     // クエストをクリアする。review が true なら、復習候補の印を付ける(クリア済みなら、何もしない)
     clear: (questId: string, review: boolean) => void;
     // クエストの詳細を開く
     open: (questId: string) => void;
     // チャットの入力欄に、フォーカスする
     focusChat: () => void;
   }

   const noop: QuestActions = {
     statusOf: () => undefined,
     isReview: () => false,
     clear: () => {},
     open: () => {},
     focusChat: () => {},
   };

   export const QuestActionsContext = createContext<QuestActions>(noop);

   export const useQuestActions = () => useContext(QuestActionsContext);
   ```

2. `webapp/src/data/quests.ts` を、次の内容に置き換えます(7.2 からの変更は、`review`(復習候補の印)を足したことです)。

   ```ts
   // クエストの型と、表示用のラベル
   export type QuestStatus = "todo" | "viewed" | "cleared";
   export type Importance = "high" | "medium" | "low";

   export interface Quest {
     id: string;
     title: string;
     services: string[];
     summary: string;
     importance: Importance;
     minutes: number;
     status: QuestStatus;
     // 不正解のままクリアした、復習候補の印(画面の中だけで持つ)
     review?: boolean;
     // ニュースの公開日時(ISO 8601)
     publishedAt: string;
     source: { label: string; url: string };
     changes: string[];
     before: string;
     after: string;
     impact: { changes: string; unchanged: string; check: string };
     checks: string[];
   }

   export const STATUS_LABEL: Record<QuestStatus, string> = {
     todo: "未着手",
     viewed: "閲覧済み",
     cleared: "クリア済み",
   };

   export const IMPORTANCE_LABEL: Record<Importance, string> = {
     high: "重要度 高",
     medium: "重要度 中",
     low: "重要度 低",
   };

   // 依頼書に押す印(重要度から決める)
   export const RANK: Record<Importance, string> = { high: "S", medium: "A", low: "B" };
   ```

3. `webapp/src/components/Quiz.tsx` を、次の内容に置き換えます(8.2 からの変更は、`questId` の引数と、回答後の操作です)。

   ```tsx
   import { useState } from "react";
   import { z } from "zod";
   import { useQuestActions } from "./QuestActions";

   // エージェントが、ツール呼び出し(show_quiz)の引数として渡す、理解度チェックの問題
   export const quizSchema = z.object({
     questId: z.string().describe("この問題の対象のクエストの ID"),
     question: z.string().describe("問題文"),
     options: z.array(z.string()).describe("選択肢(2〜4 個)"),
     answer: z.number().int().describe("正解の選択肢の番号(0 から始まる)"),
     explanation: z.string().describe("解説"),
   });

   type QuizProps = z.infer<typeof quizSchema>;

   // エージェントに返す、初回の回答の内容
   export interface QuizAnswer {
     selectedIndex: number;
     selectedOption: string;
     correct: boolean;
   }

   interface Props extends Partial<QuizProps> {
     // 回答を、エージェントに返す関数(エージェントの応答待ちの間だけ、渡される)
     respond?: (result: unknown) => Promise<void>;
     // 回答済みのときの、エージェントに返した内容(JSON の文字列)
     result?: string;
   }

   function parseFirstResult(result?: string): "correct" | "wrong" | null {
     if (!result) return null;
     try {
       return (JSON.parse(result) as QuizAnswer).correct ? "correct" : "wrong";
     } catch {
       return null;
     }
   }

   // 引数は、ストリーミングで少しずつ届くため、届いていない項目は undefined になる
   // 単一選択の問題。回答するまで、正解は示さない。不正解なら、再回答できる
   // エージェントに返すのは、初回の回答だけ(再回答は、画面の中だけ)
   export default function Quiz(props: Props) {
     const { questId, question, options, answer, explanation, respond, result: returned } = props;
     const actions = useQuestActions();
     const [selected, setSelected] = useState<number | null>(null);
     // 直近の回答の結果(null は、まだ回答していない)
     const [result, setResult] = useState<"correct" | "wrong" | null>(null);
     // 初回の回答の結果。再回答しても、上書きしない
     const [firstResult, setFirstResult] = useState<"correct" | "wrong" | null>(null);
     // 再読み込みなどで画面の状態が失われても、エージェントに返した内容から、初回の結果を復元する
     const first = firstResult ?? parseFirstResult(returned);

     const ready = question && options && options.length >= 2 && answer !== undefined && explanation;
     if (!ready) {
       return <div className="quiz quiz-loading">問題を作成しています…</div>;
     }

     const submit = () => {
       if (selected === null) return;
       const outcome = selected === answer ? "correct" : "wrong";
       setResult(outcome);
       if (first === null) {
         setFirstResult(outcome);
         const answered: QuizAnswer = {
           selectedIndex: selected,
           selectedOption: options[selected],
           correct: outcome === "correct",
         };
         void respond?.(answered);
       }
     };
     const retry = () => {
       setSelected(null);
       setResult(null);
     };
     const locked = result !== null;

     return (
       <div className="quiz" role="group" aria-label="理解度チェック">
         <div className="quiz-kicker">理解度チェック</div>
         <p className="quiz-question">{question}</p>
         <div className="quiz-options" role="radiogroup" aria-label="選択肢">
           {options.map((option, i) => (
             <button
               key={i}
               type="button"
               role="radio"
               aria-checked={selected === i}
               disabled={locked}
               className={selected === i ? "quiz-option selected" : "quiz-option"}
               onClick={() => setSelected(i)}
             >
               {option}
             </button>
           ))}
         </div>

         {result === null ? (
           <button type="button" className="quiz-submit" disabled={selected === null} onClick={submit}>
             回答する
           </button>
         ) : (
           <div className={`quiz-result ${result}`} role="status">
             <strong>{result === "correct" ? "正解です" : "不正解です"}</strong>
             <p>{explanation}</p>
             {first && (
               <p className="quiz-first">
                 初回の回答: {first === "correct" ? "正解" : "不正解"}
               </p>
             )}
             {result === "wrong" && (
               <button type="button" className="quiz-submit" onClick={retry}>
                 もう一度答える
               </button>
             )}
           </div>
         )}

         {result !== null && questId && (
           <div className="quiz-actions" aria-label="次の操作">
             {actions.statusOf(questId) === "cleared" ? (
               <span className="quiz-cleared" role="status">
                 クリア済みです{actions.isReview(questId) && "(復習候補)"}
               </span>
             ) : (
               // 正解・不正解にかかわらず、回答したらクリアできる(仕様書 F-06)
               // 不正解のままクリアすると、復習候補になる
               <button
                 type="button"
                 className="quiz-submit"
                 onClick={() => actions.clear(questId, result === "wrong")}
               >
                 クエストをクリアする
               </button>
             )}
             <button type="button" className="quiz-secondary" onClick={() => actions.open(questId)}>
               詳細へ戻る
             </button>
             <button type="button" className="quiz-secondary" onClick={actions.focusChat}>
               追加で質問する
             </button>
           </div>
         )}
       </div>
     );
   }
   ```

4. `webapp/src/components/QuestBoard.tsx` を、次の内容に置き換えます(9.2 からの変更は、「復習」のバッジです)。

   ```tsx
   import {
     IMPORTANCE_LABEL,
     RANK,
     STATUS_LABEL,
     type Quest,
     type QuestStatus,
   } from "../data/quests";
   import {
     applyFilter,
     describeFilter,
     type FilterPatch,
     type QuestFilter,
   } from "../lib/questFilter";

   const TABS: { key: "all" | QuestStatus; label: string }[] = [
     { key: "all", label: "すべて" },
     { key: "todo", label: "未着手" },
     { key: "viewed", label: "閲覧済み" },
     { key: "cleared", label: "クリア済み" },
   ];

   const IMPORTANCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

   interface Props {
     quests: Quest[];
     filter: QuestFilter;
     onFilterChange: (patch: FilterPatch) => void;
     onOpen: (id: string) => void;
   }

   export default function QuestBoard({ quests, filter, onFilterChange, onOpen }: Props) {
     // 重要度の高いクエストを、先に表示する
     const shown = applyFilter(quests, filter).sort(
       (a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance],
     );
     const conditions = describeFilter(filter);
     const activeTab = filter.status ?? "all";

     return (
       <section className="board" aria-label="クエストボード">
         <div className="board-head">
           <div>
             <h2>クエストボード</h2>
             <p className="muted">
               {shown.length} 件のクエスト
               {conditions.length > 0 && `(全 ${quests.length} 件)`}・サンプルデータ
             </p>
           </div>
           <div className="tabs" role="tablist" aria-label="状態で絞り込む">
             {TABS.map((tab) => (
               <button
                 key={tab.key}
                 type="button"
                 role="tab"
                 aria-selected={activeTab === tab.key}
                 className={activeTab === tab.key ? "tab active" : "tab"}
                 onClick={() => onFilterChange({ status: tab.key === "all" ? null : tab.key })}
               >
                 {tab.label}
               </button>
             ))}
           </div>
         </div>

         {conditions.length > 0 && (
           <div className="conditions" aria-label="適用中の条件">
             <span className="conditions-label">適用中の条件</span>
             {conditions.map((c) => (
               <span key={c} className="condition">
                 {c}
               </span>
             ))}
             <button type="button" className="tab" onClick={() => onFilterChange({ reset: true })}>
               条件をすべて解除
             </button>
           </div>
         )}

         {quests.length === 0 ? (
           <p className="empty">クエストがまだありません。チャットで、クエストを探せます。</p>
         ) : shown.length === 0 ? (
           <div className="empty">
             <p>条件に合うクエストがありません。条件を減らすか、期間を広げてください。</p>
             <button
               type="button"
               className="tab active"
               onClick={() => onFilterChange({ reset: true })}
             >
               条件をすべて解除する
             </button>
           </div>
         ) : (
           <div className="quest-list">
             {shown.map((q) => (
               <button
                 key={q.id}
                 type="button"
                 className={`quest status-${q.status}`}
                 data-stamp={q.status === "cleared" ? "済" : RANK[q.importance]}
                 onClick={() => onOpen(q.id)}
               >
                 <span className="quest-head">
                   <span className="quest-title">{q.title}</span>
                   <span className={`badge status ${q.status}`}>{STATUS_LABEL[q.status]}</span>
                 </span>
                 <span className="quest-copy">{q.summary}</span>
                 <span className="meta-row">
                   {q.services.map((s) => (
                     <span key={s} className="badge">
                       {s}
                     </span>
                   ))}
                   <span className={q.importance === "high" ? "badge high" : "badge"}>
                     {IMPORTANCE_LABEL[q.importance]}
                   </span>
                   {q.review && <span className="badge review">復習</span>}
                   <span className="source">約 {q.minutes} 分</span>
                 </span>
               </button>
             ))}
           </div>
         )}
       </section>
     );
   }
   ```

5. `webapp/src/components/QuestDetail.tsx` を、次の内容に置き換えます(7.3 からの変更は、「復習候補」の表示です)。

   ```tsx
   import { useEffect, useRef } from "react";
   import { IMPORTANCE_LABEL, STATUS_LABEL, type Quest } from "../data/quests";

   interface Props {
     quest: Quest;
     onClose: () => void;
   }

   // ニュースの内容と、アプリが生成した説明を、見分けられるようにする
   function Origin({ kind }: { kind: "news" | "ai" }) {
     return kind === "news" ? (
       <span className="origin news">ニュース</span>
     ) : (
       <span className="origin ai">AI 生成</span>
     );
   }

   export default function QuestDetail({ quest, onClose }: Props) {
     const closeRef = useRef<HTMLButtonElement>(null);

     useEffect(() => {
       closeRef.current?.focus();
       const onKey = (e: KeyboardEvent) => {
         if (e.key === "Escape") onClose();
       };
       window.addEventListener("keydown", onKey);
       return () => window.removeEventListener("keydown", onKey);
     }, [onClose]);

     return (
       <div className="detail-layer" role="dialog" aria-label={`クエスト詳細: ${quest.title}`}>
         <div className="detail-toolbar">
           <button ref={closeRef} type="button" className="back-button" onClick={onClose}>
             ← クエストボードへ戻る
           </button>
           <span className="muted">
             {STATUS_LABEL[quest.status]}{quest.review && "(復習候補)"}・{IMPORTANCE_LABEL[quest.importance]}・約 {quest.minutes} 分
           </span>
         </div>

         <article className="strategy-sheet">
           <div className="strategy-kicker">{quest.services.join(" / ")}</div>
           <h2 className="strategy-title">{quest.title}</h2>

           <div className="generated-stack">
             <section className="generated-panel">
               <h3>
                 要約 <Origin kind="news" />
               </h3>
               <p>{quest.summary}</p>
             </section>

             <section className="generated-panel">
               <h3>
                 何が変わったか <Origin kind="news" />
               </h3>
               <ul>
                 {quest.changes.map((c) => (
                   <li key={c}>{c}</li>
                 ))}
               </ul>
             </section>

             <section className="generated-panel">
               <h3>
                 従来との違い <Origin kind="ai" />
               </h3>
               <div className="compare-grid">
                 <div className="compare-side">
                   <strong>これまで</strong>
                   {quest.before}
                 </div>
                 <div className="compare-arrow" aria-hidden="true">
                   →
                 </div>
                 <div className="compare-side">
                   <strong>更新後</strong>
                   {quest.after}
                 </div>
               </div>
             </section>

             <section className="generated-panel">
               <h3>
                 ユーザーへの影響 <Origin kind="ai" />
               </h3>
               <div className="impact-list">
                 <div className="impact-item">
                   <strong>変わる</strong>
                   {quest.impact.changes}
                 </div>
                 <div className="impact-item">
                   <strong>変わらない</strong>
                   {quest.impact.unchanged}
                 </div>
                 <div className="impact-item">
                   <strong>要検証</strong>
                   {quest.impact.check}
                 </div>
               </div>
             </section>

             <section className="generated-panel">
               <h3>
                 確認すべき事項 <Origin kind="ai" />
               </h3>
               <ul>
                 {quest.checks.map((c) => (
                   <li key={c}>{c}</li>
                 ))}
               </ul>
             </section>

             <section className="generated-panel">
               <h3>元情報</h3>
               <a href={quest.source.url} target="_blank" rel="noreferrer">
                 {quest.source.label}
               </a>
             </section>
           </div>
         </article>
       </div>
     );
   }
   ```

6. `webapp/src/components/App.tsx` を、次の内容に置き換えます(9.2 からの変更は、復習候補の状態と、`QuestActions` を提供することです)。

   ```tsx
   import { useCallback, useEffect, useRef, useState } from "react";
   import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
   import "@copilotkit/react-core/v2/styles.css";
   import "../styles/quest.css";
   import type { Quest, QuestStatus } from "../data/quests";
   import { AUTH_DISABLED } from "../lib/outputs";
   import {
     EMPTY_FILTER,
     applyFilter,
     describeFilter,
     mergeFilter,
     type FilterChange,
     type FilterPatch,
     type QuestFilter,
   } from "../lib/questFilter";
   import AuthGate from "./AuthGate";
   import GenerativeUI from "./GenerativeUI";
   import QuestBoard from "./QuestBoard";
   import { QuestActionsContext, type QuestActions } from "./QuestActions";
   import QuestDetail from "./QuestDetail";

   const RUNTIME_URL = "/api/copilotkit";
   const QUESTS_URL = "/api/quests";

   function Workspace({ getToken }: { getToken?: () => string }) {
     // getToken は、レンダリングのたびに作り直されることがあるため、参照で持つ
     const tokenRef = useRef(getToken);
     tokenRef.current = getToken;

     const [quests, setQuests] = useState<Quest[] | null>(null);
     const [failed, setFailed] = useState(false);
     // 画面での状態の変更(詳細を開いたら、閲覧済みにする)。保存は、まだしない
     const [statuses, setStatuses] = useState<Record<string, QuestStatus>>({});
     // 不正解のままクリアした、復習候補の印
     const [reviews, setReviews] = useState<Record<string, boolean>>({});
     const [openId, setOpenId] = useState<string | null>(null);
     const chatRef = useRef<HTMLElement>(null);
     // クエストボードの検索条件。詳細を閉じても、維持する(仕様書 F-03)
     const [filter, setFilter] = useState<QuestFilter>(EMPTY_FILTER);
     const filterRef = useRef(filter);

     // クエストは、エージェントを通さず、API から取得する
     const load = useCallback(async () => {
       setFailed(false);
       setQuests(null);
       try {
         const token = tokenRef.current?.();
         const res = await fetch(QUESTS_URL, {
           headers: token ? { Authorization: `Bearer ${token}` } : {},
         });
         if (!res.ok) throw new Error(`HTTP ${res.status}`);
         setQuests((await res.json()).quests as Quest[]);
       } catch {
         setFailed(true);
       }
     }, []);

     useEffect(() => {
       void load();
     }, [load]);

     const shown = quests?.map((q) => ({
       ...q,
       status: statuses[q.id] ?? q.status,
       review: reviews[q.id] ?? q.review,
     }));
     const opened = shown?.find((q) => q.id === openId);
     const shownRef = useRef(shown);
     shownRef.current = shown;

     // 検索条件を変える(画面の操作と、エージェントのツールの、どちらからも使う)
     // 変更前後の条件と、表示される件数を返す
     const updateFilter = useCallback((patch: FilterPatch): FilterChange => {
       const before = filterRef.current;
       const after = mergeFilter(before, patch);
       filterRef.current = after;
       setFilter(after);
       const all = shownRef.current ?? [];
       return {
         before: describeFilter(before),
         after: describeFilter(after),
         count: applyFilter(all, after).length,
         total: all.length,
       };
     }, []);

     // 詳細を開いたクエストは、閲覧済みにする(クリア済みは、そのまま)
     const open = (id: string) => {
       setOpenId(id);
       setStatuses((s) => {
         const current = s[id] ?? quests?.find((q) => q.id === id)?.status;
         return current === "todo" ? { ...s, [id]: "viewed" } : s;
       });
     };
     const close = useCallback(() => setOpenId(null), []);

     // チャット内の部品が、クエストボードの状態を読み、操作するための窓口
     const actions: QuestActions = {
       statusOf: (id) => shown?.find((q) => q.id === id)?.status,
       isReview: (id) => Boolean(shown?.find((q) => q.id === id)?.review),
       clear: (id, review) => {
         if (shown?.find((q) => q.id === id)?.status === "cleared") return;
         setStatuses((s) => ({ ...s, [id]: "cleared" }));
         setReviews((r) => ({ ...r, [id]: review }));
       },
       open,
       focusChat: () => chatRef.current?.querySelector("textarea")?.focus(),
     };

     return (
       <CopilotKitProvider
         runtimeUrl={RUNTIME_URL}
         headers={getToken ? () => ({ Authorization: `Bearer ${getToken()}` }) : undefined}
       >
         <QuestActionsContext.Provider value={actions}>
         <GenerativeUI updateFilter={updateFilter} />
         <div className="app">
           <main className="board-area">
             {AUTH_DISABLED && <div className="mode-banner">mock モード(認証なし)</div>}
             <div className="board-scroll">
               {failed ? (
                 <div className="board-message" role="alert">
                   <p>クエストを取得できませんでした。</p>
                   <button type="button" className="tab active" onClick={load}>
                     もう一度取得する
                   </button>
                 </div>
               ) : !shown ? (
                 <div className="board-message" role="status">
                   クエストを読み込んでいます…
                 </div>
               ) : (
                 <QuestBoard
                   quests={shown}
                   filter={filter}
                   onFilterChange={updateFilter}
                   onOpen={open}
                 />
               )}
             </div>
             {opened && <QuestDetail quest={opened} onClose={close} />}
           </main>
           <aside className="chat-area" aria-label="チャット" ref={chatRef}>
             <CopilotChat
               labels={{
                 welcomeMessageText: "クエストについて、なんでも聞いてください。",
                 chatInputPlaceholder: "クエストについて質問する",
               }}
             />
           </aside>
         </div>
         </QuestActionsContext.Provider>
       </CopilotKitProvider>
     );
   }

   export default function App() {
     if (AUTH_DISABLED) return <Workspace />;
     return <AuthGate>{(getToken) => <Workspace getToken={getToken} />}</AuthGate>;
   }
   ```

7. `webapp/src/styles/quest.css` を、次の内容に置き換えます(9.2 からの変更は、回答後の操作と、「復習」のバッジです)。

   ```css
   :root {
     color-scheme: light dark;
     --bg: light-dark(#f4efe2, #171714);
     --panel: light-dark(#fffaf0, #23231f);
     --panel-2: light-dark(#eee4cf, #2b2a24);
     --text: light-dark(#302b22, #f6f0e3);
     --muted: light-dark(#746b5c, #b8ae9d);
     --line: light-dark(#d9c9aa, #474239);
     --accent: light-dark(#74532b, #d4aa68);
     --green: light-dark(#3e7254, #83c79e);
     --board: light-dark(#6f4729, #3b271a);
     --board-dark: light-dark(#4b2e1a, #21150f);
     --board-text: light-dark(#fff3d7, #f4dfbd);
     --board-muted: light-dark(#e6ceb0, #cbb28e);
     --paper: light-dark(#f4e5bd, #d8c59b);
     --paper-2: light-dark(#ead4a3, #c7af7e);
     --ink: light-dark(#3c2b1b, #332517);
     --pin: light-dark(#8d2f29, #bd5a4f);
     --wax: light-dark(#77362e, #6d302b);
     --shadow: light-dark(#22140c99, #0d0806b8);
   }

   body {
     margin: 0;
     color: var(--text);
     background: var(--bg);
     font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Hiragino Sans", sans-serif;
   }

   * {
     box-sizing: border-box;
   }

   h2,
   h3,
   p {
     margin: 0;
   }

   /* 画面を、メイン領域とチャット領域に分ける */
   .app {
     display: grid;
     grid-template-columns: minmax(0, 1fr) 400px;
     height: 100vh;
   }

   .board-area {
     position: relative;
     min-width: 0;
     overflow: hidden;
     background:
       repeating-linear-gradient(93deg, transparent 0 72px, color-mix(in srgb, var(--board-dark) 20%, transparent) 73px 75px),
       linear-gradient(135deg, var(--board), var(--board-dark));
     box-shadow: inset 0 0 0 8px color-mix(in srgb, var(--board-dark) 72%, transparent);
   }

   .board-scroll {
     height: 100%;
     overflow: auto;
     padding: 24px;
   }

   .mode-banner {
     position: absolute;
     right: 16px;
     bottom: 12px;
     z-index: 20;
     padding: 4px 10px;
     border-radius: 999px;
     color: var(--ink);
     background: var(--paper);
     font-size: 12px;
   }

   .chat-area {
     display: flex;
     min-width: 0;
     height: 100vh;
     flex-direction: column;
     border-left: 1px solid var(--line);
     background: var(--panel);
   }

   .chat-area > * {
     flex: 1;
     min-height: 0;
   }

   /* クエストボード */
   .board-head {
     display: flex;
     align-items: flex-end;
     justify-content: space-between;
     gap: 16px;
     margin-bottom: 14px;
   }

   .board-head h2 {
     color: var(--board-text);
     font-size: 20px;
     font-weight: 500;
     text-shadow: 0 2px 2px var(--board-dark);
   }

   .board-head .muted {
     color: var(--board-muted);
     font-size: 12px;
   }

   .tabs {
     display: flex;
     flex-wrap: wrap;
     gap: 6px;
   }

   .tab {
     padding: 7px 10px;
     border: 0;
     border-radius: 8px;
     color: var(--board-text);
     background: color-mix(in srgb, var(--board-dark) 62%, transparent);
     font: inherit;
     font-size: 12px;
     cursor: pointer;
   }

   .tab.active {
     color: var(--ink);
     background: var(--paper);
   }

   .empty,
   .board-message {
     padding: 32px 0;
     color: var(--board-text);
   }

   .board-message p {
     margin-bottom: 12px;
   }

   .conditions {
     display: flex;
     flex-wrap: wrap;
     align-items: center;
     gap: 6px;
     margin-bottom: 14px;
   }

   .conditions-label {
     color: var(--board-muted);
     font-size: 12px;
   }

   .condition {
     padding: 4px 9px;
     border-radius: 999px;
     color: var(--ink);
     background: var(--paper);
     font-size: 12px;
   }

   .quest-list {
     display: grid;
     grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
     gap: 24px 18px;
     padding: 10px 4px;
   }

   .quest {
     position: relative;
     display: block;
     width: 100%;
     min-height: 190px;
     padding: 28px 18px 18px;
     border: 0;
     border-radius: 2px;
     color: var(--ink);
     background:
       linear-gradient(90deg, color-mix(in srgb, var(--paper-2) 42%, transparent), transparent 15% 85%, color-mix(in srgb, var(--paper-2) 42%, transparent)),
       repeating-linear-gradient(0deg, transparent 0 26px, color-mix(in srgb, var(--ink) 7%, transparent) 27px),
       var(--paper);
     clip-path: polygon(1% 2%, 48% 0, 99% 2%, 100% 42%, 98% 98%, 54% 100%, 2% 98%, 0 55%);
     box-shadow: 2px 7px 13px var(--shadow);
     font: inherit;
     text-align: left;
     cursor: pointer;
     transition: transform 0.15s ease;
   }

   .quest:nth-child(3n + 1) {
     transform: rotate(-1.2deg);
   }

   .quest:nth-child(3n + 2) {
     transform: rotate(1deg);
   }

   .quest:nth-child(3n) {
     transform: rotate(0.6deg);
   }

   .quest:hover,
   .quest:focus-visible {
     transform: translateY(-3px) rotate(0deg);
     outline: none;
   }

   .quest::before {
     content: "";
     position: absolute;
     top: 8px;
     left: 50%;
     width: 12px;
     height: 12px;
     border-radius: 50%;
     background: radial-gradient(circle at 35% 30%, #f4a59c 0 10%, var(--pin) 28% 70%, #55201d 72%);
     transform: translateX(-50%);
   }

   .quest::after {
     content: attr(data-stamp);
     position: absolute;
     right: 15px;
     bottom: 13px;
     display: grid;
     place-items: center;
     width: 34px;
     height: 34px;
     border: 2px solid var(--wax);
     border-radius: 50%;
     color: var(--wax);
     background: color-mix(in srgb, var(--wax) 20%, transparent);
     font-family: Georgia, serif;
     font-weight: 700;
     transform: rotate(-9deg);
   }

   .quest.status-cleared {
     opacity: 0.66;
   }

   .quest-head {
     display: flex;
     align-items: flex-start;
     justify-content: space-between;
     gap: 12px;
   }

   .quest-title {
     font-family: Georgia, "Yu Mincho", serif;
     font-size: 15px;
     font-weight: 500;
   }

   .quest-copy {
     display: block;
     margin-top: 11px;
     font-size: 13px;
     line-height: 1.55;
     color: color-mix(in srgb, var(--ink) 77%, transparent);
   }

   .meta-row {
     display: flex;
     flex-wrap: wrap;
     align-items: center;
     gap: 6px;
     margin-top: 12px;
     padding-right: 44px;
   }

   .badge {
     padding: 4px 7px;
     border-radius: 999px;
     color: light-dark(#3f4f51, #344447);
     background: color-mix(in srgb, light-dark(#729197, #678289) 18%, transparent);
     font-size: 12px;
     white-space: nowrap;
   }

   .badge.high {
     color: light-dark(#7d2e25, #6c2923);
     background: color-mix(in srgb, light-dark(#a4493d, #8e3e35) 17%, transparent);
   }

   .badge.status.viewed {
     color: light-dark(#3d5a75, #2f4a62);
     background: color-mix(in srgb, light-dark(#4f7ea3, #4f7ea3) 18%, transparent);
   }

   .badge.review {
     color: light-dark(#7d2e25, #6c2923);
     background: color-mix(in srgb, light-dark(#a4493d, #8e3e35) 17%, transparent);
   }

   .badge.status.cleared {
     color: light-dark(#315d3e, #2c5137);
     background: color-mix(in srgb, light-dark(#4d7f58, #476f50) 17%, transparent);
   }

   .source {
     color: light-dark(#725b42, #5f4b38);
     font-size: 12px;
   }

   /* クエスト詳細(メイン領域だけを覆う。チャット領域は覆わない) */
   .detail-layer {
     position: absolute;
     inset: 0;
     z-index: 10;
     overflow: auto;
     padding: 24px;
     background:
       repeating-linear-gradient(93deg, transparent 0 72px, color-mix(in srgb, var(--board-dark) 20%, transparent) 73px 75px),
       linear-gradient(135deg, var(--board), var(--board-dark));
   }

   .detail-toolbar {
     display: flex;
     align-items: center;
     justify-content: space-between;
     gap: 12px;
     margin-bottom: 14px;
   }

   .detail-toolbar .muted {
     color: var(--board-muted);
     font-size: 12px;
   }

   .back-button {
     padding: 8px 11px;
     border: 0;
     border-radius: 8px;
     color: var(--board-text);
     background: color-mix(in srgb, var(--board-dark) 65%, transparent);
     font: inherit;
     font-size: 12px;
     cursor: pointer;
   }

   .strategy-sheet {
     max-width: 820px;
     margin: 0 auto;
     padding: 28px 28px 24px;
     color: var(--ink);
     background:
       repeating-linear-gradient(0deg, transparent 0 29px, color-mix(in srgb, var(--ink) 6%, transparent) 30px),
       var(--paper);
     box-shadow: 3px 9px 18px var(--shadow);
   }

   .strategy-kicker {
     color: color-mix(in srgb, var(--ink) 70%, transparent);
     font-size: 12px;
     letter-spacing: 0.08em;
   }

   .strategy-title {
     margin-top: 5px;
     font-family: Georgia, "Yu Mincho", serif;
     font-size: 20px;
     font-weight: 500;
   }

   .generated-stack {
     display: grid;
     gap: 10px;
     margin-top: 18px;
   }

   .generated-panel {
     padding: 14px;
     background: color-mix(in srgb, var(--paper-2) 44%, transparent);
     font-size: 13px;
     line-height: 1.6;
   }

   .generated-panel h3 {
     display: flex;
     align-items: center;
     gap: 8px;
     margin: 0 0 8px;
     font-family: Georgia, "Yu Mincho", serif;
     font-size: 14px;
     font-weight: 500;
   }

   .generated-panel ul {
     margin: 0;
     padding-left: 18px;
   }

   .generated-panel a {
     color: var(--wax);
   }

   .origin {
     padding: 2px 6px;
     border: 1px solid currentColor;
     border-radius: 4px;
     font-family: ui-sans-serif, system-ui, sans-serif;
     font-size: 11px;
   }

   .origin.news {
     color: light-dark(#315d3e, #2c5137);
   }

   .origin.ai {
     color: light-dark(#7d2e25, #6c2923);
   }

   .compare-grid {
     display: grid;
     grid-template-columns: 1fr auto 1fr;
     align-items: stretch;
     gap: 10px;
   }

   .compare-side,
   .impact-item {
     padding: 11px;
     background: color-mix(in srgb, var(--paper) 72%, transparent);
     font-size: 12px;
     line-height: 1.55;
   }

   .compare-side strong,
   .impact-item strong {
     display: block;
     margin-bottom: 4px;
     font-weight: 500;
   }

   .compare-arrow {
     align-self: center;
     font-size: 18px;
   }

   .impact-list {
     display: grid;
     grid-template-columns: repeat(3, 1fr);
     gap: 8px;
   }

   /* 狭い画面では、チャットを下に置く */
   @media (max-width: 900px) {
     .app {
       grid-template-columns: 1fr;
       grid-template-rows: minmax(0, 1fr) 55vh;
     }

     .chat-area {
       height: 55vh;
       border-top: 1px solid var(--line);
       border-left: 0;
     }

     .board-head {
       align-items: flex-start;
       flex-direction: column;
     }

     .impact-list,
     .compare-grid {
       grid-template-columns: 1fr;
     }

     .compare-arrow {
       justify-self: center;
       transform: rotate(90deg);
     }
   }

   /* チャット内の理解度チェック */
   /* チャット内の部品の配色は、チャットの配色(CopilotKit の設定)に左右されないよう、固定する */
   .quiz,
   .notice {
     --quiz-text: #302b22;
     --quiz-muted: #746b5c;
     --quiz-accent: #74532b;
     --quiz-panel: #fffaf0;
     --quiz-line: #d9c9aa;
     --quiz-green: #3e7254;
     --quiz-wax: #77362e;
   }

   .quiz {
     margin: 8px 0;
     padding: 14px;
     border: 1px solid var(--quiz-line);
     border-radius: 12px;
     color: var(--quiz-text);
     background: var(--quiz-panel);
     font-size: 14px;
     line-height: 1.6;
   }

   .quiz-kicker {
     margin-bottom: 4px;
     color: var(--quiz-accent);
     font-size: 12px;
     letter-spacing: 0.08em;
   }

   .quiz-question {
     margin: 0 0 10px;
     font-weight: 500;
   }

   .quiz-options {
     display: grid;
     gap: 6px;
   }

   .quiz-option {
     padding: 9px 11px;
     border: 1px solid var(--quiz-line);
     border-radius: 8px;
     color: inherit;
     background: transparent;
     font: inherit;
     text-align: left;
     cursor: pointer;
   }

   .quiz-option.selected {
     border-color: var(--quiz-accent);
     background: color-mix(in srgb, var(--quiz-accent) 14%, transparent);
   }

   .quiz-option:disabled {
     cursor: default;
   }

   .quiz-submit {
     margin-top: 10px;
     padding: 8px 14px;
     border: 0;
     border-radius: 8px;
     color: var(--quiz-panel);
     background: var(--quiz-accent);
     font: inherit;
     cursor: pointer;
   }

   .quiz-submit:disabled {
     opacity: 0.5;
     cursor: default;
   }

   .quiz-result {
     margin-top: 10px;
     padding: 10px 12px;
     border-radius: 8px;
   }

   .quiz-result.correct {
     background: color-mix(in srgb, var(--quiz-green) 18%, transparent);
   }

   .quiz-result.wrong {
     background: color-mix(in srgb, var(--quiz-wax) 16%, transparent);
   }

   .quiz-result p {
     margin: 4px 0 0;
   }

   .quiz-actions {
     display: flex;
     flex-wrap: wrap;
     align-items: center;
     gap: 8px;
     margin-top: 12px;
     padding-top: 12px;
     border-top: 1px solid var(--quiz-line);
   }

   .quiz-actions .quiz-submit {
     margin-top: 0;
   }

   .quiz-secondary {
     padding: 8px 14px;
     border: 1px solid var(--quiz-line);
     border-radius: 8px;
     color: var(--quiz-text);
     background: transparent;
     font: inherit;
     cursor: pointer;
   }

   .quiz-cleared {
     color: var(--quiz-green);
     font-weight: 500;
   }

   .quiz-first {
     color: var(--quiz-muted);
     font-size: 12px;
   }

   .quiz-loading {
     color: var(--quiz-muted);
   }

   /* チャット内の、メイン領域を更新したことの通知 */
   .notice {
     margin: 8px 0;
     padding: 12px 14px;
     border: 1px solid var(--quiz-line);
     border-left: 4px solid var(--quiz-accent);
     border-radius: 8px;
     color: var(--quiz-text);
     background: var(--quiz-panel);
     font-size: 13px;
     line-height: 1.6;
   }

   .notice-title {
     margin-bottom: 4px;
     font-weight: 500;
   }

   .notice dl {
     display: grid;
     grid-template-columns: auto 1fr;
     gap: 2px 10px;
     margin: 0;
   }

   .notice dt {
     color: var(--quiz-muted);
   }

   .notice dd {
     margin: 0;
   }

   .notice-loading {
     color: var(--quiz-muted);
   }
   ```

8. `webapp/mock/aimock.json` を、次の内容にします(9.2 からの変更は、`show_quiz` の引数に `questId` を足したことです)。aimock を、起動し直します。

   ```json
   {
     "port": 4010,
     "agui": {
       "path": "/agui",
       "fixtures": [
         {
           "match": {
             "toolCallId": "quiz-1"
           },
           "text": "回答を受け取りました。(モックの応答です)"
         },
         {
           "match": {
             "toolCallId": "filter-1"
           },
           "text": "ボードを更新しました。(モックの応答です)"
         },
         {
           "match": {
             "toolCallId": "filter-2"
           },
           "text": "ボードを更新しました。(モックの応答です)"
         },
         {
           "match": {
             "toolCallId": "filter-3"
           },
           "text": "ボードを更新しました。(モックの応答です)"
         },
         {
           "match": {
             "message": "絞り込み"
           },
           "events": [
             {
               "type": "RUN_STARTED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             },
             {
               "type": "TOOL_CALL_START",
               "toolCallId": "filter-1",
               "toolCallName": "update_quest_filter"
             },
             {
               "type": "TOOL_CALL_ARGS",
               "toolCallId": "filter-1",
               "delta": "{\"services\": [\"AgentCore\", \"Lambda\"], \"maxMinutes\": 5}"
             },
             {
               "type": "TOOL_CALL_END",
               "toolCallId": "filter-1"
             },
             {
               "type": "RUN_FINISHED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             }
           ]
         },
         {
           "match": {
             "message": "条件を解除"
           },
           "events": [
             {
               "type": "RUN_STARTED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             },
             {
               "type": "TOOL_CALL_START",
               "toolCallId": "filter-2",
               "toolCallName": "update_quest_filter"
             },
             {
               "type": "TOOL_CALL_ARGS",
               "toolCallId": "filter-2",
               "delta": "{\"reset\": true}"
             },
             {
               "type": "TOOL_CALL_END",
               "toolCallId": "filter-2"
             },
             {
               "type": "RUN_FINISHED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             }
           ]
         },
         {
           "match": {
             "message": "一致しない"
           },
           "events": [
             {
               "type": "RUN_STARTED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             },
             {
               "type": "TOOL_CALL_START",
               "toolCallId": "filter-3",
               "toolCallName": "update_quest_filter"
             },
             {
               "type": "TOOL_CALL_ARGS",
               "toolCallId": "filter-3",
               "delta": "{\"reset\": true, \"services\": [\"EC2\"]}"
             },
             {
               "type": "TOOL_CALL_END",
               "toolCallId": "filter-3"
             },
             {
               "type": "RUN_FINISHED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             }
           ]
         },
         {
           "match": {
             "message": "こんにちは"
           },
           "text": "こんにちは!AG-UI のモックです。"
         },
         {
           "match": {
             "message": "理解度チェック"
           },
           "events": [
             {
               "type": "RUN_STARTED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             },
             {
               "type": "TOOL_CALL_START",
               "toolCallId": "quiz-1",
               "toolCallName": "show_quiz"
             },
             {
               "type": "TOOL_CALL_ARGS",
               "toolCallId": "quiz-1",
               "delta": "{\"questId\": \"agentcore-agui\", \"question\": \"AgentCore Runtime で AG-UI のエージェントを動かすとき、エージェントがリクエストを受け付けるパスはどれですか。\", "
             },
             {
               "type": "TOOL_CALL_ARGS",
               "toolCallId": "quiz-1",
               "delta": "\"options\": [\"/invocations\", \"/chat\", \"/run\", \"/agent\"], \"answer\": 0, \"explanation\": \"AgentCore Runtime は、コンテナの /invocations でリクエストを受け付け、/ping でヘルスチェックを行います。このアプリのエージェント(agent/main.py)も、同じパスを使っています。\"}"
             },
             {
               "type": "TOOL_CALL_END",
               "toolCallId": "quiz-1"
             },
             {
               "type": "RUN_FINISHED",
               "threadId": "mock-thread",
               "runId": "mock-run"
             }
           ]
         },
         {
           "match": {
             "message": "クエスト"
           },
           "text": "クエストボードのカードを選ぶと、詳細を見ながら質問できます。(モックの応答です)"
         }
       ]
     }
   }
   ```

### 10.3 動作を確認する

**手順**

1. aimock と開発サーバー(`npm run dev:mock`)を起動して、ブラウザで開き、チャットに「理解度チェック」と送ります。
2. 回答する前は、「クエストをクリアする」などは出ません(確認済み)。
3. 不正解を選んで回答します(確認済み)。
   - 「クエストをクリアする」「詳細へ戻る」「追加で質問する」が出ます。
   - 「クエストをクリアする」を押すと、ボードの「AgentCore Runtime の AG-UI 対応」が「クリア済み」に変わり、「復習」のバッジが付きます。ボタンは、「クリア済みです(復習候補)」に変わります。
   - 「詳細へ戻る」を押すと、そのクエストの詳細が開き、上部に「クリア済み(復習候補)」と出ます。
   - 「追加で質問する」を押すと、チャットの入力欄にフォーカスが移ります。
4. 再読み込みして、新しい会話で、正解を選んで回答し、「クエストをクリアする」を押します(確認済み)。「クリア済みです」と出て、ボードのカードは「クリア済み」になり、「復習」のバッジは付きません。

> [!NOTE]
> - **確認していない**: 不正解のあとに再回答して、正解してからクリアしたときの動き(実装は、直近の回答の正誤で決めるので、「復習」は付かないはずです)。
> - **確認していない**: 出題した問題が、開いているクエスト以外のものだったときの動き(`questId` は、エージェントが指定する前提です)。
> - 機能仕様書の F-09 は、「初回不正解だったクエスト」を復習候補にします。F-06 の「不正解のままクリア」とは、条件が違います。履歴(F-07)を作るときに、そろえます。
> - 保存はしていません。再読み込みで、クリアの状態は戻ります。
> - aimock の制限(同じ会話で、同じメッセージを 2 回送っても、2 回目は動かない)は、9.3 のとおりです。

## 第11章 AWS の環境で動かす(`dev` へのデプロイと、本物のエージェントでの確認)

第 7〜10 章で、mock モード(aimock)で動かした機能を、AWS の `dev` 環境にデプロイして、本物のエージェント(AgentCore Runtime の Strands)で確認します。この章の時点で、`agent/` は、変更していません(第 4 章のまま。ツールなしの汎用のアシスタントです)。

### 11.1 デプロイする

**手順**

1. バックエンド(Cognito、AgentCore、Quests テーブル)を、デプロイします。`ampx deploy` は、`webapp/amplify_outputs.json` を上書きするので、必要なら、先にバックアップします。

   ```sh
   npx ampx deploy --identifier dev --backend --yes
   ```

   83 秒で成功しました。Quests テーブルが作られ、`amplify_outputs.json` の `custom.questTableName` に、テーブル名が入りました(確認済み)。

2. 初期データを入れます。`dev` の Cognito のユーザーの `sub` を調べて、`seed` を実行します。

   ```sh
   npm run seed -- <ユーザー ID>
   ```

   4 件が、テーブルに入りました(確認済み)。

3. Web アプリ(ホスティング)を、デプロイします。

   ```sh
   npx ampx deploy --identifier dev --frontend --yes
   ```

   154 秒で成功しました(確認済み)。CloudFront の URL は、5.4 と同じです。

> [!NOTE]
> - デプロイのログに、「Failed to load astro.config (astro.config.mjs); falling back to defaults. Error: Cannot use 'import.meta' outside a module」という警告が出ました。ビルド(`npm run build`)は、通常どおり動いて、デプロイは成功しました。この警告が、以前のデプロイでも出ていたかは、確認していません。
> - ローカルの開発サーバー(`npm run dev`。認証あり)で、ログインして、DynamoDB のクエストが表示されることも、確認しました(7.6)。

### 11.2 AWS の環境で確認する

CloudFront の URL を開いて、テストユーザーでログインした状態で、確認しました。

**確認できたこと(実行して確認)**

| 機能 | 結果 |
|---|---|
| 初回のクエスト取得 | クエストボードに、DynamoDB の 4 件が表示された(`GET /api/quests` が 200) |
| チャットからメイン領域の更新(第 9 章) | 「AgentCore と Lambda のクエストだけに絞り込んでください」と送ると、本物のエージェントが、`update_quest_filter` を、`{"services":["AgentCore","Lambda"]}` で呼び出し、ボードが 2 件になった。チャットに、変更前後の条件と件数のカードが出て、エージェントが、続けて返答した |
| 理解度チェックの表示と回答(第 8 章) | 「AgentCore Runtime の AG-UI 対応クエストについて、理解度チェックの問題を出してください」と送ると、本物のエージェントが、`show_quiz` を呼び出して、問題を作った(問題文、4 つの選択肢、正解の番号、解説)。選んで回答すると、初回の回答がエージェントに返り、エージェントが、「正解です!」と返答した |
| 回答後の操作の表示(第 10 章) | 回答後に、「クエストをクリアする」「詳細へ戻る」「追加で質問する」が表示された |

これで、次の未確認だった点が、確認できました。
- 本物のエージェントが、`show_quiz` と `update_quest_filter` を、自然言語の依頼から、適切な引数で呼び出すこと(システムプロンプトを変えていない、汎用のアシスタントで動きました)。
- 本物のエージェントは、呼び出しごとに、別の `toolCallId` を作ること(`tooluse_…` の形)。aimock の制限(同じメッセージを 2 回送ると動かない)は、モックだけのものです。

**動かなかったこと**

- **「クエストをクリアする」を押しても、ボードのカードが変わりませんでした**。原因は、エージェントが渡した `questId` です。リクエストの内容で確認したところ、エージェントは `"agentcore-runtime-ag-ui"` を渡していました。実際の ID は `"agentcore-agui"` で、一致しません。エージェントは、クエストの ID を知らないため、推測で作りました(リクエストの `context` と `state` は、空でした)。
- 対応の案(未実施): 画面から、クエストの一覧と、開いているクエストを、エージェントに渡す(`useAgentContext`)。問題の対象のクエストが、一覧にないときは、「クリア」を出さない。

**確認していないこと**

- 別のユーザーでログインしたときの、「クエストがまだありません」の表示。
- 「期間」と「重要度」を、自然言語で頼んだときの動き。
- エージェントが、クエストの内容(要約など)を知らずに、問題を作っている点(`agentcore-agui` の問題は、エージェント自身の知識で作られました)。

## 第12章 エージェントの実装(クエストの作成と保存)

第 11 章で、`agent/` は、ツールのない汎用のアシスタントのままでした。この章で、次の 3 つを作ります。

- **画面の状況を、エージェントに渡す**: クエストの一覧(ID つき)、詳細を開いているクエスト、適用中の検索条件を、エージェントに渡します(`useAgentContext`)。エージェントが、クエストの ID を知らずに推測して、「クリア」が効かなかった問題(11.2)の対応です。
- **クエストの作成と保存**: エージェントが、AWS の最新情報(What's New の RSS)を取得し、クエストにして、DynamoDB に保存します。保存したら、画面のクエストボードを更新します。
- **ユーザー ID の受け渡し**: 保存は、ユーザーごとです。Web アプリのサーバーが、検証したユーザー ID を、エージェントへのリクエストに入れます。

### 12.1 方針

- **ユーザー ID**: CopilotRuntime のエンドポイントが、検証済みの JWT から、ユーザー ID を取り、そのリクエストの処理の間だけ持ちます(Node.js の `AsyncLocalStorage`)。エージェントへ送るときに、AG-UI のリクエストの本文の `forwardedProps.userId` に入れます(署名は、この本文に対して行います)。画面が送ってきた値は、必ず上書きするので、偽装できません。エージェントは、`create_strands_app` の `invocation_state_provider` で、これを受け取り、ツールが `tool_context.invocation_state["user_id"]` で読みます。
- **エージェントのツール**: `fetch_news`(RSS の取得)と、`save_quests`(DynamoDB への保存。`boto3`)です。すでにある同じクエストは、上書きしません(重要度などが、毎回変わらないようにする)。
- **画面のツール**: 保存後に、画面が、クエストを取得し直すよう、`reload_quests` を、フロントエンドのツールとして足します。
- **エージェントの指示**: システムプロンプトに、ツールの使い分け、画面の状況の読み方、クエストの作り方(ニュースの本文に書かれていることだけを根拠にする)を書きます。

### 12.2 画面側を変更する

**手順**

1. `webapp/src/lib/userContext.ts` を、次の内容で作成します。

   ```ts
   import { AsyncLocalStorage } from "node:async_hooks";

   // 検証済みのリクエストの、ユーザー ID を、そのリクエストの処理の間だけ持つ
   // (CopilotRuntime から、エージェントへの送信まで、同じ処理の流れの中で、読み出す)
   export const userContext = new AsyncLocalStorage<{ userId: string }>();

   // エージェントへ送る AG-UI のリクエストの本文に、サーバーが検証したユーザー ID を入れる
   // 画面が送ってきた forwardedProps.userId は、必ず上書きする(または、取り除く)ので、偽装できない
   export function withUserId(body: string): string {
     if (!body) return body;
     const userId = userContext.getStore()?.userId;
     const input = JSON.parse(body) as { forwardedProps?: Record<string, unknown> };
     const props = { ...(input.forwardedProps ?? {}) };
     if (userId) props.userId = userId;
     else delete props.userId;
     return JSON.stringify({ ...input, forwardedProps: props });
   }
   ```

2. `webapp/src/lib/agentcore.ts` を、次の内容に置き換えます(4.4 からの変更は、本文にユーザー ID を入れることと、ローカルのエージェント用の接続です)。

   ```ts
   import { HttpAgent } from "@ag-ui/client";
   import type { HttpAgentFetchFn } from "@ag-ui/client";
   import { Sha256 } from "@aws-crypto/sha256-js";
   import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
   import { HttpRequest } from "@smithy/protocol-http";
   import { SignatureV4 } from "@smithy/signature-v4";
   import { withUserId } from "./userContext";

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
       // 検証済みのユーザー ID を、本文に入れる(署名は、この本文に対して行う)
       const body = withUserId(typeof init.body === "string" ? init.body : "");
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

   // ローカルのエージェント(署名なし)に接続するエージェント
   // AgentCore と同じく、検証済みのユーザー ID を、本文に入れる
   export const createLocalAgent = (url: string): HttpAgent =>
     new HttpAgent({
       url,
       fetch: (target, init) =>
         fetch(target, {
           ...init,
           body: typeof init.body === "string" ? withUserId(init.body) : init.body,
         }),
     });
   ```

3. `webapp/src/pages/api/copilotkit/[...slug].ts` を、次の内容に置き換えます(7.1 からの変更は、ユーザー ID を持たせることと、ローカルのエージェントの接続です)。

   ```ts
   import type { APIRoute } from "astro";
   import {
     CopilotRuntime,
     createCopilotRuntimeHandler,
   } from "@copilotkit/runtime/v2";
   import { createAgentCoreAgent, createLocalAgent } from "../../../lib/agentcore";
   import { authenticate } from "../../../lib/auth";
   import { outputs } from "../../../lib/outputs";
   import { userContext } from "../../../lib/userContext";

   // リクエストごとにサーバーで動かす(静的ファイルにしない)
   export const prerender = false;

   // エージェントの接続先
   //   AGENT_RUNTIME_ARN があれば、AgentCore Runtime に SigV4 署名つきで接続する
   //   本番ビルドでは、環境変数がなくても、amplify_outputs.json の ARN に接続する
   //   どちらもなければ AGENT_URL(未設定なら aimock)に、署名なしで接続する
   const env = (name: string): string | undefined =>
     process.env[name] ?? (import.meta.env[name] as string | undefined);
   const AGENT_RUNTIME_ARN =
     env("AGENT_RUNTIME_ARN") ??
     (import.meta.env.PROD ? outputs?.custom?.agentRuntimeArn : undefined);
   const AGENT_URL = env("AGENT_URL") ?? "http://localhost:4010/agui";

   const agent = AGENT_RUNTIME_ARN
     ? createAgentCoreAgent(AGENT_RUNTIME_ARN)
     : createLocalAgent(AGENT_URL);

   const runtime = new CopilotRuntime({
     agents: { default: agent },
   });

   const handler = createCopilotRuntimeHandler({
     runtime,
     basePath: "/api/copilotkit",
     hooks: {
       // 全リクエストで JWT を検証し、失敗したら 401 を返す
       onRequest: async ({ request }) => {
         if (!(await authenticate(request))) {
           throw new Response("Unauthorized", { status: 401 });
         }
       },
     },
   });

   // 検証したユーザー ID を、この処理の間だけ持たせる(エージェントへの送信で、本文に入れる)
   export const ALL: APIRoute = async ({ request }) => {
     const userId = await authenticate(request);
     return userId ? userContext.run({ userId }, () => handler(request)) : handler(request);
   };
   ```

4. `webapp/src/components/GenerativeUI.tsx` を、次の内容に置き換えます(9.2 からの変更は、画面の状況の受け渡し(`useAgentContext`)と、`reload_quests` です)。

   ```tsx
   import { useAgentContext, useFrontendTool, useHumanInTheLoop } from "@copilotkit/react-core/v2";
   import { z } from "zod";
   import type { Quest } from "../data/quests";
   import {
     describeFilter,
     filterPatchSchema,
     type FilterChange,
     type FilterPatch,
     type QuestFilter,
   } from "../lib/questFilter";
   import FilterChangeCard from "./FilterChangeCard";
   import Quiz, { quizSchema } from "./Quiz";

   interface Props {
     // ボードのクエストと、詳細を開いているクエストの ID、適用中の検索条件(エージェントに、状況として渡す)
     quests: Quest[];
     openedId: string | null;
     filter: QuestFilter;
     // メイン領域(クエストボード)の検索条件を変える。変更の内容を返す
     updateFilter: (patch: FilterPatch) => FilterChange;
     // クエストを取得し直して、ボードを更新する
     reloadQuests: () => Promise<{ count: number }>;
   }

   // エージェントが呼び出せる、チャット内の UI と、画面を操作するツールを登録し、画面の状況を渡す
   // (CopilotKitProvider の中に置く)
   export default function GenerativeUI({
     quests,
     openedId,
     filter,
     updateFilter,
     reloadQuests,
   }: Props) {
     // 画面の状況: エージェントは、クエストの ID を知らないため、ここで渡す
     useAgentContext({
       description:
         "クエストボードにあるクエストの一覧。id は、show_quiz の questId などに、そのまま使う(推測しない)",
       value: quests.map((q) => ({
         id: q.id,
         title: q.title,
         services: q.services,
         importance: q.importance,
         minutes: q.minutes,
         status: q.status,
         publishedAt: q.publishedAt,
         summary: q.summary,
       })),
     });
     const opened = quests.find((q) => q.id === openedId);
     useAgentContext({
       description:
         "ユーザーが、いま詳細を開いているクエスト(なければ null)。「このクエスト」は、これを指す",
       value: opened ? JSON.parse(JSON.stringify(opened)) : null,
     });
     useAgentContext({
       description: "クエストボードで、適用中の検索条件(空なら、条件なし)",
       value: describeFilter(filter),
     });

     // 理解度チェック: 問題を表示し、ユーザーの初回の回答を、エージェントに返す
     // 回答が返るまで、エージェントの実行は止まる
     useHumanInTheLoop({
       name: "show_quiz",
       description:
         "クエストの内容に合わせた、単一選択の理解度チェックの問題を、チャットに表示する。questId は、クエスト一覧の id を、そのまま使う。ユーザーが回答すると、その内容(選んだ選択肢と、正誤)が返る",
       parameters: quizSchema,
       render: ({ args, respond, result }) => (
         <Quiz {...args} respond={respond} result={result} />
       ),
     });

     // クエストボードの検索条件の変更: ユーザーの依頼(期間、サービス、重要度など)を、メイン領域に反映する
     // 変更の内容(変更前、変更後、件数)を、チャットに表示し、エージェントにも返す
     useFrontendTool({
       name: "update_quest_filter",
       description:
         "クエストボードの検索条件を変える。ユーザーが、期間、AWS サービス、重要度、想定学習時間、状態で、クエストを絞り込みたいときに呼ぶ。指定した条件だけを変え、null で条件を解除する。すべて解除するときは reset を true にする。変更前後の条件と、表示される件数が返る",
       parameters: filterPatchSchema,
       handler: async (args) => updateFilter(args),
       render: ({ status, result }) => <FilterChangeCard status={status} result={result} />,
     });

     // クエストの取得し直し: エージェントが、クエストを保存したあとに呼び、ボードに反映する
     useFrontendTool({
       name: "reload_quests",
       description:
         "保存済みのクエストを取得し直して、クエストボードを更新する。save_quests でクエストを保存したあとに、必ず呼ぶ。更新後のクエストの数が返る",
       parameters: z.object({}),
       handler: async () => reloadQuests(),
       render: ({ status, result }) => {
         const count = (() => {
           try {
             return (JSON.parse(result ?? "") as { count: number }).count;
           } catch {
             return null;
           }
         })();
         return (
           <div className="notice" role="status">
             {status === "complete" && count !== null
               ? `クエストボードを更新しました(${count} 件)`
               : "クエストボードを更新しています…"}
           </div>
         );
       },
     });

     return null;
   }
   ```

5. `webapp/src/components/App.tsx` を、次の内容に置き換えます(10.2 からの変更は、クエストの取得し直し(`reloadQuests`)と、`GenerativeUI` への受け渡しです)。

   ```tsx
   import { useCallback, useEffect, useRef, useState } from "react";
   import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
   import "@copilotkit/react-core/v2/styles.css";
   import "../styles/quest.css";
   import type { Quest, QuestStatus } from "../data/quests";
   import { AUTH_DISABLED } from "../lib/outputs";
   import {
     EMPTY_FILTER,
     applyFilter,
     describeFilter,
     mergeFilter,
     type FilterChange,
     type FilterPatch,
     type QuestFilter,
   } from "../lib/questFilter";
   import AuthGate from "./AuthGate";
   import GenerativeUI from "./GenerativeUI";
   import QuestBoard from "./QuestBoard";
   import { QuestActionsContext, type QuestActions } from "./QuestActions";
   import QuestDetail from "./QuestDetail";

   const RUNTIME_URL = "/api/copilotkit";
   const QUESTS_URL = "/api/quests";

   function Workspace({ getToken }: { getToken?: () => string }) {
     // getToken は、レンダリングのたびに作り直されることがあるため、参照で持つ
     const tokenRef = useRef(getToken);
     tokenRef.current = getToken;

     const [quests, setQuests] = useState<Quest[] | null>(null);
     const [failed, setFailed] = useState(false);
     // 画面での状態の変更(詳細を開いたら、閲覧済みにする)。保存は、まだしない
     const [statuses, setStatuses] = useState<Record<string, QuestStatus>>({});
     // 不正解のままクリアした、復習候補の印
     const [reviews, setReviews] = useState<Record<string, boolean>>({});
     const [openId, setOpenId] = useState<string | null>(null);
     const chatRef = useRef<HTMLElement>(null);
     // クエストボードの検索条件。詳細を閉じても、維持する(仕様書 F-03)
     const [filter, setFilter] = useState<QuestFilter>(EMPTY_FILTER);
     const filterRef = useRef(filter);

     // クエストは、エージェントを通さず、API から取得する
     const fetchQuests = useCallback(async (): Promise<Quest[]> => {
       const token = tokenRef.current?.();
       const res = await fetch(QUESTS_URL, {
         headers: token ? { Authorization: `Bearer ${token}` } : {},
       });
       if (!res.ok) throw new Error(`HTTP ${res.status}`);
       return (await res.json()).quests as Quest[];
     }, []);

     // 最初の取得(読み込み中の表示を出す)
     const load = useCallback(async () => {
       setFailed(false);
       setQuests(null);
       try {
         setQuests(await fetchQuests());
       } catch {
         setFailed(true);
       }
     }, [fetchQuests]);

     // 取得し直す(画面は、そのまま。エージェントが、クエストを保存したあとに使う)
     const reloadQuests = useCallback(async (): Promise<{ count: number }> => {
       const latest = await fetchQuests();
       setQuests(latest);
       return { count: latest.length };
     }, [fetchQuests]);

     useEffect(() => {
       void load();
     }, [load]);

     const shown = quests?.map((q) => ({
       ...q,
       status: statuses[q.id] ?? q.status,
       review: reviews[q.id] ?? q.review,
     }));
     const opened = shown?.find((q) => q.id === openId);
     const shownRef = useRef(shown);
     shownRef.current = shown;

     // 検索条件を変える(画面の操作と、エージェントのツールの、どちらからも使う)
     // 変更前後の条件と、表示される件数を返す
     const updateFilter = useCallback((patch: FilterPatch): FilterChange => {
       const before = filterRef.current;
       const after = mergeFilter(before, patch);
       filterRef.current = after;
       setFilter(after);
       const all = shownRef.current ?? [];
       return {
         before: describeFilter(before),
         after: describeFilter(after),
         count: applyFilter(all, after).length,
         total: all.length,
       };
     }, []);

     // 詳細を開いたクエストは、閲覧済みにする(クリア済みは、そのまま)
     const open = (id: string) => {
       setOpenId(id);
       setStatuses((s) => {
         const current = s[id] ?? quests?.find((q) => q.id === id)?.status;
         return current === "todo" ? { ...s, [id]: "viewed" } : s;
       });
     };
     const close = useCallback(() => setOpenId(null), []);

     // チャット内の部品が、クエストボードの状態を読み、操作するための窓口
     const actions: QuestActions = {
       statusOf: (id) => shown?.find((q) => q.id === id)?.status,
       isReview: (id) => Boolean(shown?.find((q) => q.id === id)?.review),
       clear: (id, review) => {
         if (shown?.find((q) => q.id === id)?.status === "cleared") return;
         setStatuses((s) => ({ ...s, [id]: "cleared" }));
         setReviews((r) => ({ ...r, [id]: review }));
       },
       open,
       focusChat: () => chatRef.current?.querySelector("textarea")?.focus(),
     };

     return (
       <CopilotKitProvider
         runtimeUrl={RUNTIME_URL}
         headers={getToken ? () => ({ Authorization: `Bearer ${getToken()}` }) : undefined}
       >
         <QuestActionsContext.Provider value={actions}>
         <GenerativeUI
           quests={shown ?? []}
           openedId={openId}
           filter={filter}
           updateFilter={updateFilter}
           reloadQuests={reloadQuests}
         />
         <div className="app">
           <main className="board-area">
             {AUTH_DISABLED && <div className="mode-banner">mock モード(認証なし)</div>}
             <div className="board-scroll">
               {failed ? (
                 <div className="board-message" role="alert">
                   <p>クエストを取得できませんでした。</p>
                   <button type="button" className="tab active" onClick={load}>
                     もう一度取得する
                   </button>
                 </div>
               ) : !shown ? (
                 <div className="board-message" role="status">
                   クエストを読み込んでいます…
                 </div>
               ) : (
                 <QuestBoard
                   quests={shown}
                   filter={filter}
                   onFilterChange={updateFilter}
                   onOpen={open}
                 />
               )}
             </div>
             {opened && <QuestDetail quest={opened} onClose={close} />}
           </main>
           <aside className="chat-area" aria-label="チャット" ref={chatRef}>
             <CopilotChat
               labels={{
                 welcomeMessageText: "クエストについて、なんでも聞いてください。",
                 chatInputPlaceholder: "クエストについて質問する",
               }}
             />
           </aside>
         </div>
         </QuestActionsContext.Provider>
       </CopilotKitProvider>
     );
   }

   export default function App() {
     if (AUTH_DISABLED) return <Workspace />;
     return <AuthGate>{(getToken) => <Workspace getToken={getToken} />}</AuthGate>;
   }
   ```

6. `webapp/src/components/Quiz.tsx` を、次の内容に置き換えます(10.2 からの変更は、対象のクエストがボードにないとき(エージェントが ID を間違えたとき)は、「クリア」を出さないことです)。

   ```tsx
   import { useState } from "react";
   import { z } from "zod";
   import { useQuestActions } from "./QuestActions";

   // エージェントが、ツール呼び出し(show_quiz)の引数として渡す、理解度チェックの問題
   export const quizSchema = z.object({
     questId: z.string().describe("この問題の対象のクエストの ID"),
     question: z.string().describe("問題文"),
     options: z.array(z.string()).describe("選択肢(2〜4 個)"),
     answer: z.number().int().describe("正解の選択肢の番号(0 から始まる)"),
     explanation: z.string().describe("解説"),
   });

   type QuizProps = z.infer<typeof quizSchema>;

   // エージェントに返す、初回の回答の内容
   export interface QuizAnswer {
     selectedIndex: number;
     selectedOption: string;
     correct: boolean;
   }

   interface Props extends Partial<QuizProps> {
     // 回答を、エージェントに返す関数(エージェントの応答待ちの間だけ、渡される)
     respond?: (result: unknown) => Promise<void>;
     // 回答済みのときの、エージェントに返した内容(JSON の文字列)
     result?: string;
   }

   function parseFirstResult(result?: string): "correct" | "wrong" | null {
     if (!result) return null;
     try {
       return (JSON.parse(result) as QuizAnswer).correct ? "correct" : "wrong";
     } catch {
       return null;
     }
   }

   // 引数は、ストリーミングで少しずつ届くため、届いていない項目は undefined になる
   // 単一選択の問題。回答するまで、正解は示さない。不正解なら、再回答できる
   // エージェントに返すのは、初回の回答だけ(再回答は、画面の中だけ)
   export default function Quiz(props: Props) {
     const { questId, question, options, answer, explanation, respond, result: returned } = props;
     const actions = useQuestActions();
     const [selected, setSelected] = useState<number | null>(null);
     // 直近の回答の結果(null は、まだ回答していない)
     const [result, setResult] = useState<"correct" | "wrong" | null>(null);
     // 初回の回答の結果。再回答しても、上書きしない
     const [firstResult, setFirstResult] = useState<"correct" | "wrong" | null>(null);
     // 再読み込みなどで画面の状態が失われても、エージェントに返した内容から、初回の結果を復元する
     const first = firstResult ?? parseFirstResult(returned);

     const ready = question && options && options.length >= 2 && answer !== undefined && explanation;
     if (!ready) {
       return <div className="quiz quiz-loading">問題を作成しています…</div>;
     }

     const submit = () => {
       if (selected === null) return;
       const outcome = selected === answer ? "correct" : "wrong";
       setResult(outcome);
       if (first === null) {
         setFirstResult(outcome);
         const answered: QuizAnswer = {
           selectedIndex: selected,
           selectedOption: options[selected],
           correct: outcome === "correct",
         };
         void respond?.(answered);
       }
     };
     const retry = () => {
       setSelected(null);
       setResult(null);
     };
     const locked = result !== null;

     return (
       <div className="quiz" role="group" aria-label="理解度チェック">
         <div className="quiz-kicker">理解度チェック</div>
         <p className="quiz-question">{question}</p>
         <div className="quiz-options" role="radiogroup" aria-label="選択肢">
           {options.map((option, i) => (
             <button
               key={i}
               type="button"
               role="radio"
               aria-checked={selected === i}
               disabled={locked}
               className={selected === i ? "quiz-option selected" : "quiz-option"}
               onClick={() => setSelected(i)}
             >
               {option}
             </button>
           ))}
         </div>

         {result === null ? (
           <button type="button" className="quiz-submit" disabled={selected === null} onClick={submit}>
             回答する
           </button>
         ) : (
           <div className={`quiz-result ${result}`} role="status">
             <strong>{result === "correct" ? "正解です" : "不正解です"}</strong>
             <p>{explanation}</p>
             {first && (
               <p className="quiz-first">
                 初回の回答: {first === "correct" ? "正解" : "不正解"}
               </p>
             )}
             {result === "wrong" && (
               <button type="button" className="quiz-submit" onClick={retry}>
                 もう一度答える
               </button>
             )}
           </div>
         )}

         {/* questId が、ボードのクエストに一致しないとき(エージェントが、ID を間違えたとき)は、出さない */}
         {result !== null && questId && actions.statusOf(questId) !== undefined && (
           <div className="quiz-actions" aria-label="次の操作">
             {actions.statusOf(questId) === "cleared" ? (
               <span className="quiz-cleared" role="status">
                 クリア済みです{actions.isReview(questId) && "(復習候補)"}
               </span>
             ) : (
               // 正解・不正解にかかわらず、回答したらクリアできる(仕様書 F-06)
               // 不正解のままクリアすると、復習候補になる
               <button
                 type="button"
                 className="quiz-submit"
                 onClick={() => actions.clear(questId, result === "wrong")}
               >
                 クエストをクリアする
               </button>
             )}
             <button type="button" className="quiz-secondary" onClick={() => actions.open(questId)}>
               詳細へ戻る
             </button>
             <button type="button" className="quiz-secondary" onClick={actions.focusChat}>
               追加で質問する
             </button>
           </div>
         )}
       </div>
     );
   }
   ```

### 12.3 エージェントを実装する

**手順**

1. `boto3` を、依存として明示します(`strands-agents` の依存として、すでに入っていますが、自分のコードから使うためです)。

   ```sh
   cd agent
   uv add boto3
   ```

2. `agent/tools.py` を、次の内容で作成します。RSS の取得(`fetch_news`)と、クエストの保存(`save_quests`)です。

   ```python
   import html
   import os
   import re
   import traceback
   import urllib.request
   import xml.etree.ElementTree as ET
   from datetime import datetime, timedelta, timezone
   from email.utils import parsedate_to_datetime
   from typing import Literal

   import boto3
   from botocore.exceptions import ClientError
   from pydantic import BaseModel, Field
   from strands import ToolContext, tool

   # AWS の最新情報(What's New)の RSS
   FEED_URL = "https://aws.amazon.com/about-aws/whats-new/recent/feed/"
   # 本文は、長いので、切り詰める(エージェントに渡す量を抑える)
   TEXT_LIMIT = 700


   def _plain_text(markup: str) -> str:
       """HTML のタグを取り除いて、空白を整える"""
       text = re.sub(r"<[^>]+>", " ", markup or "")
       return re.sub(r"\s+", " ", html.unescape(text)).strip()


   def _services_of(categories: list[str]) -> list[str]:
       """category(例: general:products/amazon-ec2,marketing:marchitecture/compute)から、サービス名(amazon-ec2)を取り出す

       1 つの category に、カンマ区切りで、複数の値が入っている
       """
       services: list[str] = []
       for category in categories:
           for value in category.split(","):
               if "products/" in value:
                   services.append(value.split("products/", 1)[1].strip())
       return services


   @tool
   def fetch_news(days: int = 7, keyword: str = "", limit: int = 20) -> list[dict]:
       """AWS の最新情報(What's New の RSS)を取得する。

       Args:
           days: 何日前までのニュースを対象にするか(RSS には、直近 1 週間ほどしかない)
           keyword: 指定すると、タイトル、本文、サービス名に、この文字列(英語。大文字小文字は区別しない)を含むものだけを返す
           limit: 返す件数の上限(新しい順)

       Returns:
           ニュースの一覧。id は、save_quests の id に、そのまま使う
       """
       request = urllib.request.Request(FEED_URL, headers={"User-Agent": "quest-agent/0.1"})
       with urllib.request.urlopen(request, timeout=20) as response:
           root = ET.fromstring(response.read())

       since = datetime.now(timezone.utc) - timedelta(days=days)
       wanted = keyword.lower()
       news: list[dict] = []
       for item in root.iter("item"):
           published = parsedate_to_datetime(item.findtext("pubDate", default=""))
           if published < since:
               continue
           categories = [c.text or "" for c in item.findall("category")]
           title = _plain_text(item.findtext("title", default=""))
           text = _plain_text(item.findtext("description", default=""))
           services = _services_of(categories)
           if wanted and wanted not in " ".join([title, text, *services]).lower():
               continue
           news.append(
               {
                   "id": (item.findtext("guid", default="") or "")[:12],
                   "title": title,
                   "published_at": published.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
                   "services": services,
                   "link": item.findtext("link", default=""),
                   "text": text[:TEXT_LIMIT],
               }
           )
       news.sort(key=lambda n: n["published_at"], reverse=True)
       return news[:limit]


   class QuestInput(BaseModel):
       """保存する 1 件のクエスト(1 件のニュースに対応する)"""

       id: str = Field(description="ニュースの id(fetch_news の id をそのまま使う)")
       title: str = Field(description="クエストのタイトル(日本語。ニュースの内容がわかる短い題)")
       services: list[str] = Field(description="対象の AWS サービス名(例: Amazon EC2)")
       summary: str = Field(description="要約(日本語で 2 文まで。ニュースに書かれていることだけ)")
       importance: Literal["high", "medium", "low"] = Field(
           description="重要度。多くの利用者の構成、料金、仕様に影響するなら high、一部の利用者なら medium、限られた場合なら low"
       )
       minutes: int = Field(description="想定学習時間(分。3〜10)")
       published_at: str = Field(description="ニュースの公開日時(fetch_news の published_at をそのまま使う)")
       source_label: str = Field(description="元情報の名前(例: AWS What's New)")
       source_url: str = Field(description="元情報の URL(fetch_news の link をそのまま使う)")
       changes: list[str] = Field(description="何が変わったか(2〜3 個。ニュースの事実だけ)")
       before: str = Field(description="従来との違い: これまで(ニュースから読み取れる範囲で)")
       after: str = Field(description="従来との違い: 更新後")
       impact_changes: str = Field(description="ユーザーへの影響: 変わること")
       impact_unchanged: str = Field(description="ユーザーへの影響: 変わらないこと")
       impact_check: str = Field(description="ユーザーへの影響: 要検証のこと")
       checks: list[str] = Field(description="確認すべき事項(1〜3 個)")


   def _quest_table():
       return boto3.resource(
           "dynamodb", region_name=os.environ.get("AWS_REGION", "ap-northeast-1")
       ).Table(os.environ["QUEST_TABLE"])


   @tool(context=True)
   def save_quests(quests: list[QuestInput], tool_context: ToolContext) -> dict:
       """クエストを、ユーザーのクエストとして、DynamoDB に保存する。すでにあるクエスト(同じニュース)は、保存しない。

       保存したら、続けて reload_quests を呼んで、画面のクエストボードを更新すること。

       Args:
           quests: 保存するクエスト
       """
       user_id = tool_context.invocation_state.get("user_id")
       print(f"save_quests: user_id={'あり' if user_id else 'なし'}, 件数={len(quests)}", flush=True)
       if not user_id:
           return {"error": "ユーザーが特定できないため、保存できません"}

       table = _quest_table()
       saved: list[str] = []
       skipped: list[str] = []
       for raw in quests:
           # ツールの引数は、辞書で渡されることがある
           q = raw if isinstance(raw, QuestInput) else QuestInput.model_validate(raw)
           item = {
               "userId": user_id,
               # 「公開日時#ニュースの id」。新しい順に取れる(画面の API と同じ形)
               "questId": f"{q.published_at}#{q.id}",
               "title": q.title,
               "services": q.services,
               "summary": q.summary,
               "importance": q.importance,
               "minutes": q.minutes,
               "status": "todo",
               "publishedAt": q.published_at,
               "source": {"label": q.source_label, "url": q.source_url},
               "changes": q.changes,
               "before": q.before,
               "after": q.after,
               "impact": {
                   "changes": q.impact_changes,
                   "unchanged": q.impact_unchanged,
                   "check": q.impact_check,
               },
               "checks": q.checks,
           }
           try:
               # 同じクエストは、上書きしない(重要度などが、毎回変わらないようにする)
               table.put_item(Item=item, ConditionExpression="attribute_not_exists(questId)")
               saved.append(q.id)
           except ClientError as error:
               if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                   skipped.append(q.id)
                   continue
               traceback.print_exc()
               return {"error": f"保存に失敗しました({q.id}): {error}", "saved": saved}
           except Exception as error:  # 想定外の形のデータなど
               traceback.print_exc()
               return {"error": f"保存に失敗しました({q.id}): {type(error).__name__}: {error}", "saved": saved}
       return {"saved": saved, "skipped_existing": skipped}
   ```

3. `agent/main.py` を、次の内容に置き換えます(4.1 からの変更は、システムプロンプト、ツール、`invocation_state_provider` です)。

   ```python
   import os

   from ag_ui_strands import StrandsAgent, create_strands_app
   from strands import Agent
   from strands.models import BedrockModel

   from tools import fetch_news, save_quests

   REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
   MODEL_ID = os.environ.get("MODEL_ID", "jp.anthropic.claude-sonnet-4-6")

   SYSTEM_PROMPT = """\
   あなたは、AWS の最新情報を、RPG のクエストのように学べるアプリの、学習アシスタントです。日本語で、簡潔に答えます。

   # 画面の状況
   リクエストの context に、次の情報が入っています。
   - クエストボードにあるクエストの一覧(id つき)
   - ユーザーが、いま詳細を開いているクエスト
   - クエストボードで、適用中の検索条件
   クエストの id は、context にあるものを、そのまま使います。推測して作りません。

   # ツールの使い方
   - 絞り込みの依頼(期間、サービス、重要度、想定学習時間、状態): update_quest_filter を呼びます。条件を変えるだけで、クエストは作りません。
   - 理解度チェックの依頼: show_quiz を 1 回だけ呼びます。
     - 「このクエスト」は、詳細を開いているクエストです。開いていなくて、対象が決まらないときは、どのクエストか、聞き返します。
     - 問題は、そのクエストの内容(context の情報)に基づく、単一選択(4 択)にします。questId は、context のクエストの id です。
     - 問題の内容は、クエストに書かれていることだけを根拠にします。
     - ユーザーの回答(選んだ選択肢と、正誤)が返ってきたら、短く講評します。解説は、explanation に書くので、繰り返しません。
   - 新しいクエストの依頼(「最新のニュースを探して」「クエストを更新して」など):
     1. fetch_news で、ニュースを取得します(ユーザーが、サービスや話題を指定したら、keyword に、英語で入れます)。
     2. context のクエスト一覧に、すでにあるニュース(id が同じ)は、除きます。
     3. 学ぶ価値の高いものを、最大 5 件選び、クエストにして、save_quests で保存します。
     4. 保存したら、必ず reload_quests を呼びます。
     5. 何件を保存したか、どんなクエストか、短く伝えます。
     クエストの内容は、ニュースの本文に書かれていることだけを根拠にし、書かれていないことを足しません。「変わらないこと」や「要検証」も、本文から言える範囲で書きます。
   - 上のどれでもない質問: 通常の会話で、簡潔に答えます。クエストの内容についての質問は、context の情報を根拠にし、わからないことは、わからないと言います。
   """

   strands_agent = Agent(
       model=BedrockModel(model_id=MODEL_ID, region_name=REGION),
       system_prompt=SYSTEM_PROMPT,
       tools=[fetch_news, save_quests],
   )

   # AG-UI のプロトコルに対応させる
   agui_agent = StrandsAgent(
       agent=strands_agent,
       name="assistant",
       description="AWS の最新情報を、クエストとして学ぶための学習アシスタント",
   )


   def invocation_state(request, input_data) -> dict:
       """ツールに渡す、リクエスト単位の情報

       Web アプリのサーバーが、検証したユーザー ID を、forwardedProps.userId に入れて送る
       (画面が送った値は、サーバーが上書きする)
       """
       props = input_data.forwarded_props
       user_id = props.get("userId") if isinstance(props, dict) else None
       return {"user_id": user_id} if user_id else {}


   # AgentCore Runtime の契約: ポート 8080 の /invocations(AG-UI)と /ping(ヘルスチェック)
   app = create_strands_app(
       agui_agent,
       path="/invocations",
       ping_path="/ping",
       cors_enabled=False,
       invocation_state_provider=invocation_state,
   )

   if __name__ == "__main__":
       import uvicorn

       uvicorn.run(app, host="0.0.0.0", port=8080)
   ```

4. `agent/Dockerfile` の、`COPY main.py ./` を、次のように変更します(`tools.py` を、イメージに入れるためです)。

   ```dockerfile
   COPY main.py tools.py ./
   ```

### 12.4 動作を確認する

**ローカルで確認する**

1. エージェントを、`dev` のテーブルにつなげて起動します。テーブル名は、`webapp/amplify_outputs.json` の `custom.questTableName` です。AWS の認証情報が、ローカルに要ります。

   ```sh
   cd agent
   QUEST_TABLE=<テーブル名> uv run python main.py
   ```

2. 別のターミナルで、Web アプリを、認証ありで、ローカルのエージェントにつなげて起動します。

   ```sh
   cd webapp
   AGENT_URL=http://localhost:8080/invocations npm run dev
   ```

3. ログインして、チャットに「Bedrock に関する最新のニュースを探して、クエストを作ってください」と送ります(確認済み)。
   - エージェントが、`fetch_news` でニュースを取得し、`save_quests` で、3 件を保存し、`reload_quests` を呼びました。ボードが 4 件から 7 件になりました。
   - エージェントのログに、`save_quests: user_id=あり` と出て、ユーザー ID が、ツールに届いていることを確認しました。
4. 追加されたクエストの詳細を開いて、「このクエストの理解度チェックをしてください」と送ります(確認済み)。エージェントは、context から、開いているクエストを特定し、そのクエストの内容に基づく問題を作りました。回答して、「クエストをクリアする」を押すと、ボードのカードが「クリア済み」になりました。

**AWS で確認する**

1. バックエンド(エージェントのイメージの更新)と、Web アプリを、デプロイします(第 11 章と同じコマンドです)。

   ```sh
   npx ampx deploy --identifier dev --backend --yes
   npx ampx deploy --identifier dev --frontend --yes
   ```

   バックエンドは 42 秒、Web アプリは 180 秒でした(確認済み)。

2. CloudFront の URL で、ログインして、チャットに「EC2 に関する最新のニュースを探して、クエストを作ってください」と送ります(確認済み)。
   - AgentCore の中のエージェントが、RSS を取得し(AgentCore から、インターネットに出られます)、3 件を保存して、ボードが 7 件から 10 件になりました。
   - 詳細を開いて、理解度チェックを頼み、回答して、「クエストをクリアする」を押すと、そのクエストが「クリア済み」になりました(11.2 で動かなかった問題が、直りました)。

> [!NOTE]
> - **つまずいた点**: `save_quests` の引数(`list[QuestInput]`)が、Strands から、辞書で渡されるため、最初は、`q.published_at` で、`AttributeError` になりました。エラーは、エージェントのログには出ず、エージェントが「リトライします」と繰り返すだけでした。`QuestInput.model_validate` で、辞書も受けるようにして、直りました。ツールでエラーが起きたときは、`print` でログに出すと、原因が分かります。
> - エージェントのログに、`Failed to detach context` と、OpenTelemetry の `ValueError` が大量に出ます。動作には影響しませんでした(原因は、確認していません)。
> - **未確認**: 別のユーザーで、クエストがないときの表示。10 件を超えたときの動き(API の上限は 200 件です)。同じニュースの重複を、`save_quests` が防ぐこと(エージェントが、自分で、一覧にあるものを除いたため、`skipped_existing` は、実際には、使われませんでした)。
> - **品質**: エージェントが付ける重要度は、Bedrock の 3 件が、すべて「高」でした。重要度の基準(仕様書の未決事項)を、プロンプトに書いていないためです。
> - システムプロンプトを変えたので、これまでの機能(絞り込み、理解度チェック)が、引き続き動くことも、ローカルで確認しました。
> - `ampx sandbox` の環境は、11.1 のとおり、更新に失敗した状態のままです。

## 第13章 チャットの質問に応じて、クエスト詳細を更新する(フロントエンドのツール)

仕様書の F-03、F-04 にある、「チャットの回答が詳細表示に適している場合、詳細レイヤーに新しい表示を追加または更新する」を作ります。比較(これまでと更新後)や、影響の整理は、チャットには広すぎるため、メイン領域の詳細レイヤーに出し、チャットには、更新したことだけを出します。

### 13.1 方針

- **方式**: 9 章の `update_quest_filter` と同じ、フロントエンドのツール(`useFrontendTool`)です。エージェントが、ツール `update_quest_detail` を呼び、画面が、詳細レイヤーに表示を足します。呼び出しの結果(追加した表示、更新した表示)は、エージェントにも返します。
- **エージェントが決めること・固定すること**: 表示の種類は、`comparison`(比較表)、`impact`(項目ごとの影響)、`text`(短い文章)の 3 つで、見た目は、画面側で固定です。エージェントは、種類と、中身(見出し、行、本文)を決めます。任意の UI を、エージェントが組み立てる方式(A2UI、JSON Render など)は、この章では使いません(メイン領域に出せるかが未確認のため。設計メモの 5 章)。
- **追加と更新**: 表示には、`id` を付けます。同じ `id` は置き換え、新しい `id` は末尾に足します。エージェントには、`useAgentContext` で、すでに追加した表示(`chatAddedSections`)を渡すので、内容を直すときは、同じ `id` で呼べます。
- **対象**: 詳細を開いているクエストだけです。開いていないクエストの `questId` で呼ぶと、エラーを返します(画面は変えません)。
- **区別**: 追加した表示には、「AI 生成」と「チャットで追加」の印を付けます(仕様書 IR-02)。
- **保存**: しません。再読み込みで消えます。

### 13.2 実装する

**手順**

1. `webapp/src/lib/detailSections.ts` を、次の内容で作成します。ツールの引数のスキーマ(`zod`)と、追加・更新の規則です。

   ```ts
   import { z } from "zod";

   // チャットでの質問に応じて、エージェントが、クエスト詳細に追加する表示(仕様書 F-03、F-04)
   // 種類は 3 つ。見た目は、こちらで固定し、エージェントは、中身だけを決める
   export const detailSectionSchema = z.object({
     id: z
       .string()
       .describe("表示の ID(英数字とハイフン)。すでにある表示と同じ ID なら更新し、新しい ID なら追加する"),
     kind: z
       .enum(["comparison", "impact", "text"])
       .describe("comparison: 「これまで」と「更新後」の比較表、impact: 項目ごとの影響、text: 短い文章"),
     title: z.string().describe("表示の見出し(短く)"),
     rows: z
       .array(
         z.object({
           label: z.string().describe("比較する項目"),
           before: z.string().describe("これまで"),
           after: z.string().describe("更新後"),
         }),
       )
       .optional()
       .describe("kind が comparison のときの、比較の行"),
     items: z
       .array(
         z.object({
           label: z.string().describe("影響の項目(例: 料金、構成、運用)"),
           text: z.string().describe("影響の内容"),
         }),
       )
       .optional()
       .describe("kind が impact のときの、影響の項目"),
     body: z.string().optional().describe("kind が text のときの、本文"),
   });

   export type DetailSection = z.infer<typeof detailSectionSchema>;

   export const detailUpdateSchema = z.object({
     questId: z.string().describe("詳細を開いているクエストの id(context のものを、そのまま使う)"),
     sections: z.array(detailSectionSchema).describe("追加または更新する表示"),
   });

   export interface DetailUpdate {
     // クエストのタイトル
     title?: string;
     added: string[];
     updated: string[];
     error?: string;
   }

   // 同じ ID の表示は置き換え、新しい ID は末尾に足す
   export function mergeSections(
     current: DetailSection[],
     incoming: DetailSection[],
   ): { sections: DetailSection[]; added: string[]; updated: string[] } {
     const sections = [...current];
     const added: string[] = [];
     const updated: string[] = [];
     for (const section of incoming) {
       const index = sections.findIndex((s) => s.id === section.id);
       if (index >= 0) {
         sections[index] = section;
         updated.push(section.title);
       } else {
         sections.push(section);
         added.push(section.title);
       }
     }
     return { sections, added, updated };
   }
   ```

2. `webapp/src/components/DetailUpdateCard.tsx` を、次の内容で作成します。詳細を更新したことを、チャットに示すカードです(仕様書 F-04)。

   ```tsx
   import type { DetailUpdate } from "../lib/detailSections";

   interface Props {
     status: string;
     result?: string;
   }

   function parseUpdate(result?: string): DetailUpdate | null {
     if (!result) return null;
     try {
       return JSON.parse(result) as DetailUpdate;
     } catch {
       return null;
     }
   }

   // エージェントが、クエスト詳細(メイン領域)に、表示を追加・更新したことを、チャットに示す(仕様書 F-04)
   export default function DetailUpdateCard({ status, result }: Props) {
     const update = parseUpdate(result);
     if (!update) {
       return (
         <div className="notice notice-loading">
           {status === "complete" ? "クエスト詳細を更新しました" : "クエスト詳細を更新しています…"}
         </div>
       );
     }
     if (update.error) {
       return (
         <div className="notice" role="status">
           <div className="notice-title">クエスト詳細を更新できませんでした</div>
           <p>{update.error}</p>
         </div>
       );
     }
     return (
       <div className="notice" role="status">
         <div className="notice-title">クエスト詳細を更新しました</div>
         <dl>
           <dt>クエスト</dt>
           <dd>{update.title}</dd>
           {update.added.length > 0 && (
             <>
               <dt>追加</dt>
               <dd>{update.added.join(" / ")}</dd>
             </>
           )}
           {update.updated.length > 0 && (
             <>
               <dt>更新</dt>
               <dd>{update.updated.join(" / ")}</dd>
             </>
           )}
         </dl>
       </div>
     );
   }
   ```

3. `webapp/src/components/QuestDetail.tsx` を、次の内容に置き換えます(7.3 からの変更は、追加された表示の描画(`ExtraSection`)です)。

   ```tsx
   import { useEffect, useRef } from "react";
   import { IMPORTANCE_LABEL, STATUS_LABEL, type Quest } from "../data/quests";
   import type { DetailSection } from "../lib/detailSections";

   interface Props {
     quest: Quest;
     // チャットから追加された表示
     extras?: DetailSection[];
     onClose: () => void;
   }

   // ニュースの内容と、アプリが生成した説明を、見分けられるようにする
   function Origin({ kind }: { kind: "news" | "ai" }) {
     return kind === "news" ? (
       <span className="origin news">ニュース</span>
     ) : (
       <span className="origin ai">AI 生成</span>
     );
   }

   // チャットでの質問に応じて、エージェントが追加した表示(見た目は固定。中身だけがエージェントの出力)
   function ExtraSection({ section }: { section: DetailSection }) {
     return (
       <section className="generated-panel extra-panel" aria-label={section.title}>
         <h3>
           {section.title} <Origin kind="ai" />
           <span className="origin chat">チャットで追加</span>
         </h3>
         {section.kind === "comparison" && (
           <div className="compare-rows">
             {(section.rows ?? []).map((row) => (
               <div key={row.label} className="compare-row">
                 <div className="compare-label">{row.label}</div>
                 <div className="compare-grid">
                   <div className="compare-side">
                     <strong>これまで</strong>
                     {row.before}
                   </div>
                   <div className="compare-arrow" aria-hidden="true">
                     →
                   </div>
                   <div className="compare-side">
                     <strong>更新後</strong>
                     {row.after}
                   </div>
                 </div>
               </div>
             ))}
           </div>
         )}
         {section.kind === "impact" && (
           <div className="impact-list">
             {(section.items ?? []).map((item) => (
               <div key={item.label} className="impact-item">
                 <strong>{item.label}</strong>
                 {item.text}
               </div>
             ))}
           </div>
         )}
         {section.kind === "text" && <p>{section.body}</p>}
       </section>
     );
   }

   export default function QuestDetail({ quest, extras = [], onClose }: Props) {
     const closeRef = useRef<HTMLButtonElement>(null);

     useEffect(() => {
       closeRef.current?.focus();
       const onKey = (e: KeyboardEvent) => {
         if (e.key === "Escape") onClose();
       };
       window.addEventListener("keydown", onKey);
       return () => window.removeEventListener("keydown", onKey);
     }, [onClose]);

     return (
       <div className="detail-layer" role="dialog" aria-label={`クエスト詳細: ${quest.title}`}>
         <div className="detail-toolbar">
           <button ref={closeRef} type="button" className="back-button" onClick={onClose}>
             ← クエストボードへ戻る
           </button>
           <span className="muted">
             {STATUS_LABEL[quest.status]}{quest.review && "(復習候補)"}・{IMPORTANCE_LABEL[quest.importance]}・約 {quest.minutes} 分
           </span>
         </div>

         <article className="strategy-sheet">
           <div className="strategy-kicker">{quest.services.join(" / ")}</div>
           <h2 className="strategy-title">{quest.title}</h2>

           <div className="generated-stack">
             <section className="generated-panel">
               <h3>
                 要約 <Origin kind="news" />
               </h3>
               <p>{quest.summary}</p>
             </section>

             <section className="generated-panel">
               <h3>
                 何が変わったか <Origin kind="news" />
               </h3>
               <ul>
                 {quest.changes.map((c) => (
                   <li key={c}>{c}</li>
                 ))}
               </ul>
             </section>

             <section className="generated-panel">
               <h3>
                 従来との違い <Origin kind="ai" />
               </h3>
               <div className="compare-grid">
                 <div className="compare-side">
                   <strong>これまで</strong>
                   {quest.before}
                 </div>
                 <div className="compare-arrow" aria-hidden="true">
                   →
                 </div>
                 <div className="compare-side">
                   <strong>更新後</strong>
                   {quest.after}
                 </div>
               </div>
             </section>

             <section className="generated-panel">
               <h3>
                 ユーザーへの影響 <Origin kind="ai" />
               </h3>
               <div className="impact-list">
                 <div className="impact-item">
                   <strong>変わる</strong>
                   {quest.impact.changes}
                 </div>
                 <div className="impact-item">
                   <strong>変わらない</strong>
                   {quest.impact.unchanged}
                 </div>
                 <div className="impact-item">
                   <strong>要検証</strong>
                   {quest.impact.check}
                 </div>
               </div>
             </section>

             <section className="generated-panel">
               <h3>
                 確認すべき事項 <Origin kind="ai" />
               </h3>
               <ul>
                 {quest.checks.map((c) => (
                   <li key={c}>{c}</li>
                 ))}
               </ul>
             </section>

             {extras.map((section) => (
               <ExtraSection key={section.id} section={section} />
             ))}

             <section className="generated-panel">
               <h3>元情報</h3>
               <a href={quest.source.url} target="_blank" rel="noreferrer">
                 {quest.source.label}
               </a>
             </section>
           </div>
         </article>
       </div>
     );
   }
   ```

4. `webapp/src/styles/quest.css` の、`.compare-grid {` の前に、次を足します。

   ```css
   .origin.chat {
     color: light-dark(#5a4a1f, #6b5a2a);
   }

   .extra-panel {
     border-left: 3px solid var(--wax);
   }

   .compare-rows {
     display: grid;
     gap: 10px;
   }

   .compare-label {
     margin-bottom: 4px;
     font-size: 12px;
     font-weight: 500;
   }
   ```

5. `webapp/src/components/GenerativeUI.tsx` を、次の内容に置き換えます(12.2 からの変更は、`update_quest_detail` と、開いているクエストの context に、追加済みの表示を入れることです)。

   ```tsx
   import { useAgentContext, useFrontendTool, useHumanInTheLoop } from "@copilotkit/react-core/v2";
   import { z } from "zod";
   import type { Quest } from "../data/quests";
   import {
     describeFilter,
     filterPatchSchema,
     type FilterChange,
     type FilterPatch,
     type QuestFilter,
   } from "../lib/questFilter";
   import {
     detailUpdateSchema,
     type DetailSection,
     type DetailUpdate,
   } from "../lib/detailSections";
   import DetailUpdateCard from "./DetailUpdateCard";
   import FilterChangeCard from "./FilterChangeCard";
   import Quiz, { quizSchema } from "./Quiz";

   interface Props {
     // ボードのクエストと、詳細を開いているクエストの ID、適用中の検索条件(エージェントに、状況として渡す)
     quests: Quest[];
     openedId: string | null;
     filter: QuestFilter;
     // メイン領域(クエストボード)の検索条件を変える。変更の内容を返す
     updateFilter: (patch: FilterPatch) => FilterChange;
     // クエストを取得し直して、ボードを更新する
     reloadQuests: () => Promise<{ count: number }>;
     // 詳細を開いているクエストに、チャットで追加した表示(クエストの ID ごと)
     detailExtras: Record<string, DetailSection[]>;
     // 詳細を開いているクエストの詳細に、表示を追加・更新する。結果を返す
     updateDetail: (questId: string, sections: DetailSection[]) => DetailUpdate;
   }

   // エージェントが呼び出せる、チャット内の UI と、画面を操作するツールを登録し、画面の状況を渡す
   // (CopilotKitProvider の中に置く)
   export default function GenerativeUI({
     quests,
     openedId,
     filter,
     updateFilter,
     reloadQuests,
     detailExtras,
     updateDetail,
   }: Props) {
     // 画面の状況: エージェントは、クエストの ID を知らないため、ここで渡す
     useAgentContext({
       description:
         "クエストボードにあるクエストの一覧。id は、show_quiz の questId などに、そのまま使う(推測しない)",
       value: quests.map((q) => ({
         id: q.id,
         title: q.title,
         services: q.services,
         importance: q.importance,
         minutes: q.minutes,
         status: q.status,
         publishedAt: q.publishedAt,
         summary: q.summary,
       })),
     });
     const opened = quests.find((q) => q.id === openedId);
     useAgentContext({
       description:
         "ユーザーが、いま詳細を開いているクエスト(なければ null)。「このクエスト」は、これを指す",
       value: opened
         ? {
             ...JSON.parse(JSON.stringify(opened)),
             // すでにチャットで追加した表示(更新するときは、同じ id を使う)
             chatAddedSections: detailExtras[opened.id] ?? [],
           }
         : null,
     });
     useAgentContext({
       description: "クエストボードで、適用中の検索条件(空なら、条件なし)",
       value: describeFilter(filter),
     });

     // 理解度チェック: 問題を表示し、ユーザーの初回の回答を、エージェントに返す
     // 回答が返るまで、エージェントの実行は止まる
     useHumanInTheLoop({
       name: "show_quiz",
       description:
         "クエストの内容に合わせた、単一選択の理解度チェックの問題を、チャットに表示する。questId は、クエスト一覧の id を、そのまま使う。ユーザーが回答すると、その内容(選んだ選択肢と、正誤)が返る",
       parameters: quizSchema,
       render: ({ args, respond, result }) => (
         <Quiz {...args} respond={respond} result={result} />
       ),
     });

     // クエストボードの検索条件の変更: ユーザーの依頼(期間、サービス、重要度など)を、メイン領域に反映する
     // 変更の内容(変更前、変更後、件数)を、チャットに表示し、エージェントにも返す
     useFrontendTool({
       name: "update_quest_filter",
       description:
         "クエストボードの検索条件を変える。ユーザーが、期間、AWS サービス、重要度、想定学習時間、状態で、クエストを絞り込みたいときに呼ぶ。指定した条件だけを変え、null で条件を解除する。すべて解除するときは reset を true にする。変更前後の条件と、表示される件数が返る",
       parameters: filterPatchSchema,
       handler: async (args) => updateFilter(args),
       render: ({ status, result }) => <FilterChangeCard status={status} result={result} />,
     });

     // クエスト詳細の更新: 質問への回答のうち、比較や影響など、広い表示が向くものを、メイン領域の詳細に出す
     // 更新の内容(追加・更新した表示)を、チャットに表示し、エージェントにも返す
     useFrontendTool({
       name: "update_quest_detail",
       description:
         "詳細を開いているクエストの詳細レイヤー(メイン領域)に、表示を追加または更新する。比較(これまでと更新後)や、影響の整理など、チャットには広すぎる情報を出すときに呼ぶ。短い説明は、チャットで答える。同じ id の表示は更新し、新しい id は追加する。詳細を開いていないクエストには使えない",
       parameters: detailUpdateSchema,
       handler: async ({ questId, sections }) => updateDetail(questId, sections),
       render: ({ status, result }) => <DetailUpdateCard status={status} result={result} />,
     });

     // クエストの取得し直し: エージェントが、クエストを保存したあとに呼び、ボードに反映する
     useFrontendTool({
       name: "reload_quests",
       description:
         "保存済みのクエストを取得し直して、クエストボードを更新する。save_quests でクエストを保存したあとに、必ず呼ぶ。更新後のクエストの数が返る",
       parameters: z.object({}),
       handler: async () => reloadQuests(),
       render: ({ status, result }) => {
         const count = (() => {
           try {
             return (JSON.parse(result ?? "") as { count: number }).count;
           } catch {
             return null;
           }
         })();
         return (
           <div className="notice" role="status">
             {status === "complete" && count !== null
               ? `クエストボードを更新しました(${count} 件)`
               : "クエストボードを更新しています…"}
           </div>
         );
       },
     });

     return null;
   }
   ```

6. `webapp/src/components/App.tsx` を、次の内容に置き換えます(12.2 からの変更は、追加した表示の保持と、`updateDetail` です)。

   ```tsx
   import { useCallback, useEffect, useRef, useState } from "react";
   import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
   import "@copilotkit/react-core/v2/styles.css";
   import "../styles/quest.css";
   import type { Quest, QuestStatus } from "../data/quests";
   import { mergeSections, type DetailSection, type DetailUpdate } from "../lib/detailSections";
   import { AUTH_DISABLED } from "../lib/outputs";
   import {
     EMPTY_FILTER,
     applyFilter,
     describeFilter,
     mergeFilter,
     type FilterChange,
     type FilterPatch,
     type QuestFilter,
   } from "../lib/questFilter";
   import AuthGate from "./AuthGate";
   import GenerativeUI from "./GenerativeUI";
   import QuestBoard from "./QuestBoard";
   import { QuestActionsContext, type QuestActions } from "./QuestActions";
   import QuestDetail from "./QuestDetail";

   const RUNTIME_URL = "/api/copilotkit";
   const QUESTS_URL = "/api/quests";

   function Workspace({ getToken }: { getToken?: () => string }) {
     // getToken は、レンダリングのたびに作り直されることがあるため、参照で持つ
     const tokenRef = useRef(getToken);
     tokenRef.current = getToken;

     const [quests, setQuests] = useState<Quest[] | null>(null);
     const [failed, setFailed] = useState(false);
     // 画面での状態の変更(詳細を開いたら、閲覧済みにする)。保存は、まだしない
     const [statuses, setStatuses] = useState<Record<string, QuestStatus>>({});
     // 不正解のままクリアした、復習候補の印
     const [reviews, setReviews] = useState<Record<string, boolean>>({});
     const [openId, setOpenId] = useState<string | null>(null);
     const chatRef = useRef<HTMLElement>(null);
     // クエストボードの検索条件。詳細を閉じても、維持する(仕様書 F-03)
     const [filter, setFilter] = useState<QuestFilter>(EMPTY_FILTER);
     const filterRef = useRef(filter);

     // クエストは、エージェントを通さず、API から取得する
     const fetchQuests = useCallback(async (): Promise<Quest[]> => {
       const token = tokenRef.current?.();
       const res = await fetch(QUESTS_URL, {
         headers: token ? { Authorization: `Bearer ${token}` } : {},
       });
       if (!res.ok) throw new Error(`HTTP ${res.status}`);
       return (await res.json()).quests as Quest[];
     }, []);

     // 最初の取得(読み込み中の表示を出す)
     const load = useCallback(async () => {
       setFailed(false);
       setQuests(null);
       try {
         setQuests(await fetchQuests());
       } catch {
         setFailed(true);
       }
     }, [fetchQuests]);

     // 取得し直す(画面は、そのまま。エージェントが、クエストを保存したあとに使う)
     const reloadQuests = useCallback(async (): Promise<{ count: number }> => {
       const latest = await fetchQuests();
       setQuests(latest);
       return { count: latest.length };
     }, [fetchQuests]);

     useEffect(() => {
       void load();
     }, [load]);

     const shown = quests?.map((q) => ({
       ...q,
       status: statuses[q.id] ?? q.status,
       review: reviews[q.id] ?? q.review,
     }));
     const opened = shown?.find((q) => q.id === openId);
     const shownRef = useRef(shown);
     shownRef.current = shown;

     // 検索条件を変える(画面の操作と、エージェントのツールの、どちらからも使う)
     // 変更前後の条件と、表示される件数を返す
     const updateFilter = useCallback((patch: FilterPatch): FilterChange => {
       const before = filterRef.current;
       const after = mergeFilter(before, patch);
       filterRef.current = after;
       setFilter(after);
       const all = shownRef.current ?? [];
       return {
         before: describeFilter(before),
         after: describeFilter(after),
         count: applyFilter(all, after).length,
         total: all.length,
       };
     }, []);

     // チャットの質問に応じて、詳細に追加された表示(クエストごと)。保存はしない
     const [detailExtras, setDetailExtras] = useState<Record<string, DetailSection[]>>({});
     const detailExtrasRef = useRef(detailExtras);
     const openIdRef = useRef(openId);
     openIdRef.current = openId;

     // 詳細を開いているクエストの詳細に、表示を追加・更新する(エージェントのツールから使う)
     const updateDetail = useCallback((questId: string, sections: DetailSection[]): DetailUpdate => {
       const quest = shownRef.current?.find((q) => q.id === questId);
       if (!quest) {
         return { added: [], updated: [], error: `クエスト(${questId})が見つかりません。context のクエストの id を使ってください` };
       }
       if (openIdRef.current !== questId) {
         return { title: quest.title, added: [], updated: [], error: "このクエストの詳細は、開かれていません。詳細を開いているクエストだけを更新できます" };
       }
       const { sections: merged, added, updated } = mergeSections(
         detailExtrasRef.current[questId] ?? [],
         sections,
       );
       detailExtrasRef.current = { ...detailExtrasRef.current, [questId]: merged };
       setDetailExtras(detailExtrasRef.current);
       return { title: quest.title, added, updated };
     }, []);

     // 詳細を開いたクエストは、閲覧済みにする(クリア済みは、そのまま)
     const open = (id: string) => {
       setOpenId(id);
       setStatuses((s) => {
         const current = s[id] ?? quests?.find((q) => q.id === id)?.status;
         return current === "todo" ? { ...s, [id]: "viewed" } : s;
       });
     };
     const close = useCallback(() => setOpenId(null), []);

     // チャット内の部品が、クエストボードの状態を読み、操作するための窓口
     const actions: QuestActions = {
       statusOf: (id) => shown?.find((q) => q.id === id)?.status,
       isReview: (id) => Boolean(shown?.find((q) => q.id === id)?.review),
       clear: (id, review) => {
         if (shown?.find((q) => q.id === id)?.status === "cleared") return;
         setStatuses((s) => ({ ...s, [id]: "cleared" }));
         setReviews((r) => ({ ...r, [id]: review }));
       },
       open,
       focusChat: () => chatRef.current?.querySelector("textarea")?.focus(),
     };

     return (
       <CopilotKitProvider
         runtimeUrl={RUNTIME_URL}
         headers={getToken ? () => ({ Authorization: `Bearer ${getToken()}` }) : undefined}
       >
         <QuestActionsContext.Provider value={actions}>
         <GenerativeUI
           quests={shown ?? []}
           openedId={openId}
           filter={filter}
           updateFilter={updateFilter}
           reloadQuests={reloadQuests}
           detailExtras={detailExtras}
           updateDetail={updateDetail}
         />
         <div className="app">
           <main className="board-area">
             {AUTH_DISABLED && <div className="mode-banner">mock モード(認証なし)</div>}
             <div className="board-scroll">
               {failed ? (
                 <div className="board-message" role="alert">
                   <p>クエストを取得できませんでした。</p>
                   <button type="button" className="tab active" onClick={load}>
                     もう一度取得する
                   </button>
                 </div>
               ) : !shown ? (
                 <div className="board-message" role="status">
                   クエストを読み込んでいます…
                 </div>
               ) : (
                 <QuestBoard
                   quests={shown}
                   filter={filter}
                   onFilterChange={updateFilter}
                   onOpen={open}
                 />
               )}
             </div>
             {opened && (
               <QuestDetail quest={opened} extras={detailExtras[opened.id]} onClose={close} />
             )}
           </main>
           <aside className="chat-area" aria-label="チャット" ref={chatRef}>
             <CopilotChat
               labels={{
                 welcomeMessageText: "クエストについて、なんでも聞いてください。",
                 chatInputPlaceholder: "クエストについて質問する",
               }}
             />
           </aside>
         </div>
         </QuestActionsContext.Provider>
       </CopilotKitProvider>
     );
   }

   export default function App() {
     if (AUTH_DISABLED) return <Workspace />;
     return <AuthGate>{(getToken) => <Workspace getToken={getToken} />}</AuthGate>;
   }
   ```

7. `agent/main.py` のシステムプロンプトの、「- 新しいクエストの依頼(」の行の前に、次を足します。

   ```text
   - 詳細を開いているクエストについての質問:
     - 短い説明は、チャットで答えます。
     - 比較(これまでと更新後の違い)や、影響の整理など、広い表示が向くものは、update_quest_detail で、クエストの詳細に出します。詳細に出したら、チャットには、要点を 1〜2 文で伝えます(表の内容を、繰り返しません)。
     - 表示の種類: comparison(比較表)、impact(項目ごとの影響)、text(短い文章)。context の chatAddedSections に、すでに追加した表示があります。内容を直すときは、同じ id で呼びます。
     - 詳細を開いていないときは使いません。どのクエストか聞き返します。内容は、クエストに書かれていることだけを根拠にします。
   ```

8. `webapp/mock/aimock.json` の、`fixtures` に、次の 2 つを足します。まず、ツールの結果への返答を、`fixtures` の先頭に足します(`toolCallId` の一致は、メッセージの一致より先に判定するためです)。

   ```json
   {
     "match": {
       "toolCallId": "detail-1"
     },
     "text": "クエストの詳細を更新しました。(モックの応答です)"
   },
   {
     "match": {
       "toolCallId": "detail-2"
     },
     "text": "クエストの詳細を更新しました。(モックの応答です)"
   },
   {
     "match": {
       "toolCallId": "detail-3"
     },
     "text": "クエストの詳細を更新しました。(モックの応答です)"
   },
   {
     "match": {
       "toolCallId": "detail-4"
     },
     "text": "クエストの詳細を更新しました。(モックの応答です)"
   },
   ```

   次に、ツールを呼び出すイベントを、`"message": "クエスト"` の(最後の)フィクスチャの前に足します。「比較表を更新」を、「比較表」より前に置きます(先に一致したものが使われるため)。

   ```json
   {
     "match": {
       "message": "比較表を更新"
     },
     "events": [
       {
         "type": "RUN_STARTED",
         "threadId": "mock-thread",
         "runId": "mock-run"
       },
       {
         "type": "TOOL_CALL_START",
         "toolCallId": "detail-2",
         "toolCallName": "update_quest_detail"
       },
       {
         "type": "TOOL_CALL_ARGS",
         "toolCallId": "detail-2",
         "delta": "{\"questId\": \"agentcore-agui\", \"sections\": [{\"id\": \"compare-protocol\", \"kind\": \"comparison\", \"title\": \"HTTP と AG-UI の違い(更新)\", \"rows\": [{\"label\": \"エンドポイント\", \"before\": \"/invocations に、独自の JSON を送る\", \"after\": \"/invocations で、AG-UI のイベントを受け付ける\"}, {\"label\": \"画面への反映\", \"before\": \"エージェントの応答を、自前で解釈する\", \"after\": \"CopilotKit が、イベントをそのまま描画する\"}, {\"label\": \"ヘルスチェック\", \"before\": \"決まりなし\", \"after\": \"/ping で応答する\"}]}]}"
       },
       {
         "type": "TOOL_CALL_END",
         "toolCallId": "detail-2"
       },
       {
         "type": "RUN_FINISHED",
         "threadId": "mock-thread",
         "runId": "mock-run"
       }
     ]
   },
   {
     "match": {
       "message": "比較表"
     },
     "events": [
       {
         "type": "RUN_STARTED",
         "threadId": "mock-thread",
         "runId": "mock-run"
       },
       {
         "type": "TOOL_CALL_START",
         "toolCallId": "detail-1",
         "toolCallName": "update_quest_detail"
       },
       {
         "type": "TOOL_CALL_ARGS",
         "toolCallId": "detail-1",
         "delta": "{\"questId\": \"agentcore-agui\", \"sections\": [{\"id\": \"compare-protocol\", \"kind\": \"comparison\", \"title\": \"HTTP と AG-UI の違い\", \"rows\": [{\"label\": \"エンドポイント\", \"before\": \"/invocations に、独自の JSON を送る\", \"after\": \"/invocations で、AG-UI のイベントを受け付ける\"}, {\"label\": \"画面への反映\", \"before\": \"エージェントの応答を、自前で解釈する\", \"after\": \"CopilotKit が、イベントをそのまま描画する\"}]}]}"
       },
       {
         "type": "TOOL_CALL_END",
         "toolCallId": "detail-1"
       },
       {
         "type": "RUN_FINISHED",
         "threadId": "mock-thread",
         "runId": "mock-run"
       }
     ]
   },
   {
     "match": {
       "message": "影響を整理"
     },
     "events": [
       {
         "type": "RUN_STARTED",
         "threadId": "mock-thread",
         "runId": "mock-run"
       },
       {
         "type": "TOOL_CALL_START",
         "toolCallId": "detail-3",
         "toolCallName": "update_quest_detail"
       },
       {
         "type": "TOOL_CALL_ARGS",
         "toolCallId": "detail-3",
         "delta": "{\"questId\": \"agentcore-agui\", \"sections\": [{\"id\": \"impact-list\", \"kind\": \"impact\", \"title\": \"影響の整理\", \"items\": [{\"label\": \"構成\", \"text\": \"エージェントを AG-UI に対応させれば、画面側の変更は少ない\"}, {\"label\": \"運用\", \"text\": \"ヘルスチェックの /ping が必要\"}, {\"label\": \"料金\", \"text\": \"ニュースには記載なし(要確認)\"}]}, {\"id\": \"note\", \"kind\": \"text\", \"title\": \"補足\", \"body\": \"詳細は、元情報を確認してください。\"}]}"
       },
       {
         "type": "TOOL_CALL_END",
         "toolCallId": "detail-3"
       },
       {
         "type": "RUN_FINISHED",
         "threadId": "mock-thread",
         "runId": "mock-run"
       }
     ]
   },
   {
     "match": {
       "message": "別のクエストの比較"
     },
     "events": [
       {
         "type": "RUN_STARTED",
         "threadId": "mock-thread",
         "runId": "mock-run"
       },
       {
         "type": "TOOL_CALL_START",
         "toolCallId": "detail-4",
         "toolCallName": "update_quest_detail"
       },
       {
         "type": "TOOL_CALL_ARGS",
         "toolCallId": "detail-4",
         "delta": "{\"questId\": \"lambda-streaming\", \"sections\": [{\"id\": \"x\", \"kind\": \"text\", \"title\": \"別のクエスト\", \"body\": \"詳細が開かれていないクエストです\"}]}"
       },
       {
         "type": "TOOL_CALL_END",
         "toolCallId": "detail-4"
       },
       {
         "type": "RUN_FINISHED",
         "threadId": "mock-thread",
         "runId": "mock-run"
       }
     ]
   },
   ```

### 13.3 動作を確認する

**手順**

1. aimock と、開発サーバー(mock モード)を、起動し直します。

   ```sh
   cd webapp
   npm run mock
   npm run dev:mock
   ```

2. 「AgentCore Runtime の AG-UI 対応」を開き、チャットで、次を、順に送ります(確認済み。画面の内容は、ブラウザのアクセシビリティツリーで確認しました)。

   | 送る文 | 結果 |
   |---|---|
   | 従来との違いを比較表で見せて | 詳細の「元情報」の前に、「HTTP と AG-UI の違い」(比較表。2 行)が、「AI 生成」「チャットで追加」の印つきで出る。チャットに、「クエスト詳細を更新しました / 追加: HTTP と AG-UI の違い」のカードが出る |
   | 比較表を更新して | 同じ表示が置き換わり、行が 3 行になる(表示は増えない)。カードは「更新」になる |
   | 影響を整理して | 「影響の整理」(項目ごとの影響)と、「補足」(文章)が、追加される |
   | 別のクエストの比較も出して | 詳細は変わらず、チャットに、「クエスト詳細を更新できませんでした。このクエストの詳細は、開かれていません」が出る |

3. 詳細を閉じて、開き直すと、追加した表示が、残っています(画面の中の状態のため、再読み込みでは、消えます)。

> [!NOTE]
> - **未確認**: 本物のエージェントが、質問に応じて、`update_quest_detail` を、適切な引数(`comparison` に `rows` など)で呼ぶこと。追加した表示の見た目(スクリーンショットの取得が、タイムアウトしたため、a11y ツリーでの確認だけです)。スマートフォンの幅での表示。ダークモード。
> - この章では、動作を、aimock のイベントで確認しています。プロンプトは、まだ、AWS にデプロイしていません。
> - 追加した表示は、保存しません。保存するときは、履歴(仕様書 F-07)と合わせて、決めます。

## 第14章 クエスト状態を保存する

第10章から第13章では、クエストを開いた状態やクリア状態を画面内だけで管理していました。現在は、学習体験の中心となる状態を、認証済み環境では DynamoDB に保存します。週刊レポートや回答履歴は、この段階では対象外です。

### 14.1 API を追加する

`/api/quests` に `PATCH` を追加しました。リクエスト本文は、次の形です。

```json
{
  "id": "agentcore-agui",
  "publishedAt": "2025-01-01",
  "status": "viewed",
  "review": false
}
```

`status` は `viewed` または `cleared` のみ受け付けます。未認証の場合は `401`、入力が不正な場合は `400` を返します。mock モードでは DynamoDB を使わず、開発サーバー内のメモリに状態を保持します。

### 14.2 DynamoDB に保存する

`updateQuestState` が `Quests` テーブルの対象アイテムを `UpdateItem` で更新します。キーは一覧取得と同じく、`userId` と `publishedAt#questId` です。対象クエストが存在しない場合に誤ってアイテムを作らないよう、`attribute_exists` の条件を付けています。

SSR Lambda には `dynamodb:UpdateItem` の権限も追加しました。既存の `Query` と合わせて、認証済みユーザーのクエスト一覧取得と状態更新を行います。

### 14.3 画面から状態を更新する

- todo のクエストを開くと、`viewed` に更新する
- クイズをクリアすると、`cleared` と復習フラグを更新する
- 画面は先に更新し、保存に失敗した場合はエラーを表示する
- すでに `cleared` のクエストは、再操作で不要な更新を送らない

これにより、認証済み環境では、再読み込み後も閲覧済み・クリア済み・復習対象の状態が残ります。回答内容そのものや回答イベントの履歴は保存していません。

### 14.4 今回の範囲と次の範囲

今回の本体実装に含めるのは、クエストの発見、詳細表示、質問、クイズ、クリア、状態保存です。次の段階で、回答イベントを `Activity` に記録し、そのデータを使った週刊レポートを実装します。

### 14.5 確認

```sh
cd webapp
npm run build
```

ビルドが通ることを確認したうえで、mock モードでは、開く・クリアする・再読み込みする、の順に状態が残ることを確認します。認証済み環境では、さらにサーバーをまたいでも DynamoDB から状態を取得できることを確認します。
