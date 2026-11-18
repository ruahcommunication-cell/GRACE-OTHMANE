// Porté depuis Framer : NativeFX.tsx (overrides). Les calques sont repérés par data-name,
// comme data-framer-name dans Framer.

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>_"
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const named = (root: ParentNode, name: string) => root.querySelector(`[data-name="${name}"]`) as HTMLElement | null
const namedAll = (root: ParentNode, name: string) => Array.from(root.querySelectorAll(`[data-name="${name}"]`)) as HTMLElement[]
const reducedMQ = () => window.matchMedia("(prefers-reduced-motion: reduce)")

function pinnedProgress(el: HTMLElement) {
    const r = el.getBoundingClientRect()
    return clamp01(-r.top / Math.max(1, r.height - window.innerHeight))
}

function withAlpha(color: string, a: number) {
    const m = color.match(/rgba?\(([^)]+)\)/)
    if (!m) return color
    const p = m[1].split(",").map((x) => parseFloat(x))
    return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${a * (p.length > 3 ? p[3] : 1)})`
}

function firstTextNode(el: HTMLElement): Text | null {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let n = walker.nextNode() as Text | null
    while (n && !n.data.trim()) n = walker.nextNode() as Text | null
    return n
}
const textOf = (el: HTMLElement | null) => (el ? firstTextNode(el)?.data ?? "" : "")
function setText(el: HTMLElement | null, value: string) {
    if (!el) return
    const node = firstTextNode(el)
    if (node && node.data !== value) node.data = value
}

// Origin Scrub : les mots de la déclaration s'allument au scroll, la ligne se remplit, les étapes s'éclairent.
export function originScrub(root: HTMLElement) {
    let para: HTMLElement | null = null
    let baseColor = ""
    let words: { el: HTMLElement; hot: boolean; color: string }[] = []
    let last: number[] = []
    const split = (p: HTMLElement) => {
        para = p
        baseColor = getComputedStyle(p).color
        words = []
        const textNodes: Text[] = []
        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
        let n: Text | null
        while ((n = walker.nextNode() as Text | null)) textNodes.push(n)
        for (const t of textNodes) {
            const host = t.parentElement as HTMLElement
            const cs = getComputedStyle(host)
            const hot = cs.fontStyle === "italic"
            const frag = document.createDocumentFragment()
            for (const w of t.data.split(/\s+/).filter(Boolean)) {
                const span = document.createElement("span")
                span.textContent = w
                span.dataset.fxWord = ""
                span.style.cssText = "display:inline-block;margin-right:0.24em;will-change:transform,opacity;transition:color 0.3s ease;opacity:0.14;transform:translate3d(0, 0.12em, 0)"
                if (hot) span.style.color = baseColor
                frag.appendChild(span)
                words.push({ el: span, hot, color: cs.color })
            }
            t.replaceWith(frag)
        }
        last = words.map(() => -1)
    }
    const reduced = reducedMQ()
    let cur = 0
    let prev = performance.now()
    const frame = (now: number) => {
        if (!root.isConnected) return
        const dt = Math.min(0.05, (now - prev) / 1000)
        prev = now
        const r = root.getBoundingClientRect()
        const p = named(root, "Statement")?.querySelector("p, h1, h2, h3, h4, h5, h6") as HTMLElement | null
        if (p && r.bottom > -200 && r.top < window.innerHeight + 200) {
            if (p !== para || !p.querySelector("[data-fx-word]")) split(p)
            const counter = named(root, "Counter")
            const fill = named(root, "Progress Fill")
            const stops = namedAll(root, "Stop")
            const onColor = baseColor
            const offColor = withAlpha(baseColor, 0.33)
            const prog = pinnedProgress(root)
            const red = reduced.matches
            cur = red ? prog : cur + (prog - cur) * Math.min(1, dt * 8)
            const lit = clamp01((cur - 0.05) / 0.8) * words.length
            words.forEach((w, i) => {
                const level = Math.round(clamp01(lit - i) * 20) / 20
                if (level === last[i]) return
                last[i] = level
                w.el.style.opacity = String(0.14 + level * 0.86)
                w.el.style.transform = red ? "none" : `translate3d(0, ${(1 - level) * 0.12}em, 0)`
                if (w.hot) {
                    w.el.style.color = level > 0.5 ? w.color : baseColor
                    w.el.style.textShadow = level > 0.5 ? `0 0 ${18 * level}px ${withAlpha(w.color, 0.4)}` : "none"
                }
            })
            const sp = clamp01((cur - 0.05) / 0.75)
            if (fill) fill.style.transform = `scaleX(${sp})`
            stops.forEach((el, i) => {
                const on = sp >= i / Math.max(1, stops.length - 1) - 0.001
                const label = el.querySelector("p") as HTMLElement | null
                if (label) {
                    label.style.transition = "color 0.3s ease"
                    label.style.color = on ? onColor : offColor
                }
                const dot = named(el, "Dot On")
                if (dot) {
                    dot.style.transition = "opacity 0.3s ease"
                    dot.style.opacity = on ? "1" : "0"
                }
            })
            setText(counter, String(Math.round(sp * 100)).padStart(3, "0") + "%")
        }
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
}

// Suit Up hero : pilote le HUD natif à partir de la progression du scan
export function suitUpHero(root: HTMLElement & { __suitUp?: { scan: number; raw: number } }) {
    let copy: Record<string, string> | null = null
    const scrambleTo = (el: HTMLElement | null, from: string, to: string, k: number, time: number) => {
        const len = Math.max(from.length, to.length)
        let out = ""
        for (let i = 0; i < len; i++) {
            const l = clamp01(k * 1.6 - (i / len) * 0.6)
            if (l <= 0) out += from[i] ?? ""
            else if (l >= 1) out += to[i] ?? ""
            else out += GLYPHS[Math.floor((Math.sin(time * 40 + i * 13.1) * 0.5 + 0.5) * GLYPHS.length) % GLYPHS.length]
        }
        setText(el, out)
    }
    const reduced = reducedMQ()
    const start = performance.now()
    let prev = start
    let scan = 0
    const frame = (now: number) => {
        if (!root.isConnected) return
        const dt = Math.min(0.05, (now - prev) / 1000)
        prev = now
        const r = root.getBoundingClientRect()
        if (r.bottom > 0 && r.top < window.innerHeight) {
            const nameA = named(root, "Name 1")
            const nameB = named(root, "Name 2")
            const pct = named(root, "Percent")
            const fill = named(root, "Meter Fill")
            const status = named(root, "Status Value")
            const file = named(root, "File Label")
            const hint = named(root, "Hint")
            if (!copy) {
                copy = {
                    nameA: textOf(nameA),
                    nameB: textOf(nameB),
                    aliasA: textOf(named(root, "Alias 1")),
                    aliasB: textOf(named(root, "Alias 2")),
                    stateStart: textOf(status),
                    stateMid: textOf(named(root, "State Mid")),
                    stateEnd: textOf(named(root, "State End")),
                    fileStart: textOf(file),
                    fileEnd: textOf(named(root, "File Label End")),
                }
            }
            const time = (now - start) / 1000
            const animate = !reduced.matches
            const raw = root.__suitUp?.raw ?? pinnedProgress(root)
            if (root.__suitUp) scan = root.__suitUp.scan
            else scan += (clamp01((raw - 0.08) / 0.72) - scan) * Math.min(1, dt * 7)
            setText(pct, String(Math.round(scan * 100)).padStart(3, "0") + "%")
            if (fill) fill.style.transform = `scaleX(${scan})`
            setText(status, scan < 0.02 ? copy.stateStart : scan > 0.98 ? copy.stateEnd : copy.stateMid)
            setText(file, scan > 0.98 ? copy.fileEnd : copy.fileStart)
            if (hint) hint.style.opacity = String(1 - clamp01(raw * 8))
            const nkRaw = clamp01((scan - 0.45) / 0.4)
            const nk = animate ? nkRaw : nkRaw >= 0.5 ? 1 : 0
            scrambleTo(nameA, copy.nameA, copy.aliasA, nk, time)
            scrambleTo(nameB, copy.nameB, copy.aliasB, nk, time)
            if (nameA) nameA.style.transform = `translate3d(${-scan * 4}vw, 0, 0)`
            if (nameB) nameB.style.transform = `translate3d(${scan * 4}vw, 0, 0)`
        }
        requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
}

// Décode le texte à travers des glyphes aléatoires à chaque changement de contenu
export function scramble(el: HTMLElement) {
    if (reducedMQ().matches) return
    let raf = 0
    let last = ""
    const opts = { subtree: true, childList: true, characterData: true }
    const write = (node: Text, value: string) => {
        mo.disconnect()
        node.data = value
        mo.observe(el, opts)
    }
    const run = () => {
        const node = firstTextNode(el)
        if (!node) return
        const target = node.data
        if (target === last) return
        last = target
        cancelAnimationFrame(raf)
        const start = performance.now()
        const tick = (now: number) => {
            const k = clamp01((now - start) / 600)
            let out = ""
            for (let i = 0; i < target.length; i++) {
                const l = clamp01(k * 1.5 - (i / target.length) * 0.5)
                out += l >= 1 || target[i] === " " ? target[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
            }
            write(node, k < 1 ? out : target)
            if (k < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
    }
    const mo = new MutationObserver(run)
    mo.observe(el, opts)
    run()
}

// Apparitions au scroll (équivalent des appearEffect Framer)
export function appear() {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-appear]"))
    if (!("IntersectionObserver" in window)) return els.forEach((e) => e.classList.add("is-in"))
    const io = new IntersectionObserver(
        (entries) => {
            for (const e of entries) {
                if (!e.isIntersecting) continue
                e.target.classList.add("is-in")
                io.unobserve(e.target)
            }
        },
        { threshold: 0.15 }
    )
    els.forEach((e) => io.observe(e))
}
