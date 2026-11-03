import { fileURLToPath } from "node:url";
import { startDevServer } from "@aws-blocks/blocks/scripts";

// Astro自身はAGENTS.mdに従いbackgroundモードで別途起動する。
await startDevServer({
  backendPath: fileURLToPath(new URL("../index.ts", import.meta.url)),
  port: Number(process.env.BLOCKS_DEV_PORT ?? 3000),
  host: "127.0.0.1",
  frontendPort: 4321,
});
