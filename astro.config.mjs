import { defineConfig } from "astro/config"
import react from "@astrojs/react"

export default defineConfig({
  site: "https://graceothmane.com",
  integrations: [react()],
  trailingSlash: "never",
  build: { format: "file" },
})
