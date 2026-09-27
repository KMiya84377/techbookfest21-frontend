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
