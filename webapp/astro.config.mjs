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
