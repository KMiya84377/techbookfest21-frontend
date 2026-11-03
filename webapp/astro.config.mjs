// @ts-check
import { defineConfig } from 'astro/config';
import deployConfig from './astro-deploy.config.json' with { type: 'json' };

import node from "@astrojs/node";
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  .../** @type {Pick<import("astro").AstroUserConfig, "output" | "base" | "trailingSlash" | "redirects" | "image">} */ (deployConfig),
  adapter: node({ mode: 'standalone' }),
  integrations: [
    react(),
    {
      // ローカル開発(astro dev)だけに登録する API。pages/ の外に置き、本番ビルドには入れない
      name: 'local-only-routes',
      hooks: {
        'astro:config:setup': ({ command, injectRoute }) => {
          if (command === 'dev') {
            injectRoute({ pattern: '/api/agent-news', entrypoint: './src/pages/api/_local/agent-news.ts' });
            injectRoute({ pattern: '/api/agent-learning-records', entrypoint: './src/pages/api/_local/agent-learning-records.ts' });
          }
        },
      },
    },
  ],
  vite: {
    server: { proxy: {
      "/aws-blocks/api": { target: process.env.BLOCKS_API_URL ?? "http://127.0.0.1:3000", changeOrigin: false },
      "/.blocks-sandbox": { target: process.env.BLOCKS_API_URL ?? "http://127.0.0.1:3000", changeOrigin: false },
    } },
    resolve: {
      noExternal: ['@copilotkit/react-core']
    },
    plugins: [
      tailwindcss(),
      {
        // 依存をすべてサーバーのバンドルに含める(Lambda に node_modules を置かないため)
        // 開発サーバーでは、この設定で起動に失敗するため、ビルドのときだけ有効にする
        name: 'bundle-ssr-dependencies',
        config(_, { command }) {
          return command === "build" ? { ssr: { noExternal: true, resolve: { conditions: ["aws-runtime", "node", "module"] } } } : {};
        }
      },
      {
        // 開発サーバーのモード("mock" など)を、コードへ埋め込む。ビルドでは空文字にして、モックのコードを消す
        name: 'dev-mode-define',
        config(_, { command, mode }) {
          return { define: { __DEV_MODE__: JSON.stringify(command === "serve" ? mode : "") } };
        }
      },
      {
        // 本番ビルドには mock/ を入れない。mock/ への import を、読み込むと失敗する空のモジュールへ差し替える
        // (モックの分岐は __DEV_MODE__ で畳まれて、通常は読み込まれない)
        name: 'strip-mock',
        apply: 'build',
        enforce: 'pre',
        async resolveId(source, importer, options) {
          if (!importer || importer.startsWith('\0')) return null;
          const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
          return resolved && /\/webapp\/mock\//.test(resolved.id.replaceAll('\\', '/')) ? '\0strip-mock' : null;
        },
        load(id) {
          return id === '\0strip-mock'
            ? 'throw new Error("mock/ は本番ビルドに含まれません(モックの分岐が本番で実行されました)");'
            : null;
        }
      }
    ]
  }
});
