import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "ImmersionKit Mining Helper",
  version: "0.1.0",
  description:
    "Send ImmersionKit example sentence media to the latest Anki note.",
  permissions: ["storage"],
  host_permissions: [
    "https://www.immersionkit.com/*",
    "https://immersionkit.com/*",
    "https://apiv2.immersionkit.com/*",
    "https://*.linodeobjects.com/*",
    "http://127.0.0.1/*",
  ],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://www.immersionkit.com/*", "https://immersionkit.com/*"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  options_page: "src/options/index.html",
});
