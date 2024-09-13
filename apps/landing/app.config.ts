import fs from "node:fs";
import path from "node:path";
import contentCollections from "@content-collections/vite";
import mattraxUI from "@mattrax/ui/vite";
import { defineConfig } from "@solidjs/start/config";
import { monorepoRoot } from "./loadEnv";

if (typeof process.env.VITE_MATTRAX_CLOUD_ORIGIN !== "string")
	throw new Error("Missing 'VITE_MATTRAX_CLOUD_ORIGIN' env variable!");
const waitlistEndpoint = new URL(
	"/api/waitlist",
	process.env.VITE_MATTRAX_CLOUD_ORIGIN,
).toString();

export default defineConfig({
	ssr: true,
	server: {
		prerender: {
			crawlLinks: true,
			routes: ["/", "/docs"],
		},
		routeRules: {
			"/api/waitlist": { proxy: waitlistEndpoint },
		},
	},
	vite: {
		envDir: monorepoRoot,
		plugins: [
			// We don't use the Solid Start adapter due to https://github.com/sdorra/content-collections/pull/269
			contentCollections({
				configPath: "src/content-collections.ts",
				isEnabled(config) {
					return config.router?.name === "ssr";
				},
			}),
			mattraxUI,
		],
		server: {
			fs: {
				allow: ["../../node_modules"],
			},
		},

		build: {
			assetsInlineLimit: 0,
		},
	},
});

process.on("exit", () => {
	const routesFile = path.join("dist", "_routes.json");

	if (fs.existsSync(routesFile)) {
		fs.writeFileSync(
			routesFile,
			JSON.stringify({
				version: 1,
				include: ["/*"],
				exclude: ["/_build/*", "/assets/*", "/favicon.ico", "/ogp.png"],
			}),
		);
		console.log("Patched `_routes.json`...");
	} else {
		console.log("`_routes.json` not found. Skipping patch...");
	}
});
