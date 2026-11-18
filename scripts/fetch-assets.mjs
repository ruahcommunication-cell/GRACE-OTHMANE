// Télécharge tous les médias Framer référencés dans le code et le contenu vers public/assets/framer/
import fs from "node:fs"
import path from "node:path"

const ROOTS = ["src"]
const OUT = path.resolve("public/assets/framer")
const NAME = /(?:framerusercontent\.com\/(?:images|assets)\/)?\b([A-Za-z0-9]{20,32}\.(?:png|jpe?g|webp|gif|svg|mp4|webm|pdf))\b/g

const files = []
const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(astro|tsx?|md|json|ya?ml|mjs)$/.test(e.name)) files.push(p)
    }
}
ROOTS.forEach(walk)

const names = new Set()
for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(NAME)) names.add(m[1])

fs.mkdirSync(OUT, { recursive: true })
let ok = 0, skip = 0, fail = 0
await Promise.all(
    [...names].map(async (n) => {
        const dest = path.join(OUT, n)
        if (fs.existsSync(dest)) return skip++
        const kind = /\.(mp4|webm|pdf)$/i.test(n) ? "assets" : "images"
        try {
            const r = await fetch(`https://framerusercontent.com/${kind}/${n}`)
            if (!r.ok) throw new Error(String(r.status))
            fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
            ok++
        } catch (e) {
            fail++
            console.warn(`[fetch-assets] ${n} : ${e.message}`)
        }
    })
)
console.log(`[fetch-assets] ${ok} téléchargés, ${skip} déjà présents, ${fail} échecs`)
