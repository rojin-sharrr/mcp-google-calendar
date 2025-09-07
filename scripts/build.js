#!/usr/bin/env node

import * as esbuild from "esbuild";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: [join(__dirname, "../src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: join(__dirname, "../build/index.js"),
  format: "esm",
  banner: {
    js: "#!/usr/bin/env node\n",
  },
  packages: "external", // Don't bundle node_modules
  sourcemap: true,
};

if (isWatch) {
  const context = await esbuild.context(buildOptions);
  await Promise.all([context.watch()]);
  process.stderr.write("Watching for changes...\n");
} else {
  await Promise.all([esbuild.build(buildOptions)]);

  // Make the file executable on non-Windows platforms
  if (process.platform !== "win32") {
    const { chmod } = await import("fs/promises");
    await chmod(buildOptions.outfile, 0o755);
  }
}
