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
