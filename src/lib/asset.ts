// Les médias d'origine viennent du CDN de Framer. Au build sur Netlify, scripts/fetch-assets.mjs
// les télécharge dans public/assets/framer/ : on sert alors la copie locale.
import fs from "node:fs"
import path from "node:path"

const LOCAL_DIR = path.resolve("public/assets/framer")

export function fx(name: string): string {
    if (!name) return name
    if (name.startsWith("/") || name.startsWith("data:")) return name // fichier déjà local (ex. ajouté via l'admin)
    const file = name.replace(/^https:\/\/framerusercontent\.com\/(images|assets)\//, "")
    if (fs.existsSync(path.join(LOCAL_DIR, file))) return `/assets/framer/${file}`
    const kind = /\.(mp4|webm|mov|pdf)$/i.test(file) ? "assets" : "images"
    return `https://framerusercontent.com/${kind}/${file}`
}
