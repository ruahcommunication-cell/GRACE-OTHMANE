// Composant Framer « Services (Powers HUD) » : 5 pouvoirs qui défilent tout seuls toutes les 3,6 s,
// survol = on fige le pouvoir (variantes « Hold »), clic/tap = on le sélectionne.
import { useEffect, useRef, useState } from "react"
import PowerRadar, { PowerReadouts } from "./PowerRadar"

export interface Power { name: string; text: string; stats: string }

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>_"

function Scramble({ text, className }: { text: string; className?: string }) {
    const ref = useRef<HTMLParagraphElement>(null)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            el.textContent = text
            return
        }
        let raf = 0
        const start = performance.now()
        const tick = (now: number) => {
            const k = Math.min(1, (now - start) / 600)
            let out = ""
            for (let i = 0; i < text.length; i++) {
                const l = Math.min(1, Math.max(0, k * 1.5 - (i / text.length) * 0.5))
                out += l >= 1 || text[i] === " " ? text[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
            }
            el.textContent = out
            if (k < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [text])
    return <p ref={ref} className={className}>{text}</p>
}

export default function Powers({ label, count, activeLabel, liveLabel, axes, powers }: { label: string; count: string; activeLabel: string; liveLabel: string; axes: string; powers: Power[] }) {
    const [active, setActive] = useState(0)
    const [hold, setHold] = useState(false)
    const rootRef = useRef<HTMLElement>(null)
    const [seen, setSeen] = useState(false)

    // onAppear + délai 3,6 s : on passe au pouvoir suivant tant qu'on ne survole pas
    useEffect(() => {
        const el = rootRef.current
        if (!el) return
        const io = new IntersectionObserver((e) => e[0]?.isIntersecting && setSeen(true), { threshold: 0.2 })
        io.observe(el)
        return () => io.disconnect()
    }, [])
    useEffect(() => {
        if (!seen || hold) return
        const t = window.setTimeout(() => setActive((a) => (a + 1) % powers.length), 3600)
        return () => window.clearTimeout(t)
    }, [seen, hold, active, powers.length])

    const p = powers[active]
    const code = (i: number) => `SP-${String(i + 1).padStart(2, "0")}`
    return (
        <section ref={rootRef} className="pw" data-name="Powers HUD">
            <h2 className="sr-only">{label}</h2>
            <div className="pw-header">
                <p className="t-mono accent">//</p>
                <p className="t-mono">{label}</p>
                <p className="t-mono c-low">{count}</p>
            </div>
            <div className="pw-grid">
                <div className="pw-list">
                    {powers.map((pw, i) => {
                        const on = i === active
                        return (
                            <div
                                key={i}
                                className={`pw-row${on ? " on" : ""}`}
                                role="button"
                                tabIndex={0}
                                onMouseEnter={() => { setActive(i); setHold(true) }}
                                onMouseLeave={() => setHold(false)}
                                onClick={() => { setActive(i); setHold(true) }}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(i) } }}
                            >
                                <p className="t-mono pw-code">{code(i)}</p>
                                <div className="pw-name">
                                    <p className="t-power pw-spacer" aria-hidden="true">{pw.name}</p>
                                    <p className="t-power pw-text">{pw.name}</p>
                                </div>
                                <p className="t-mono pw-active">{activeLabel}</p>
                            </div>
                        )
                    })}
                </div>
                <div className="pw-gap" />
                <div className="pw-panel">
                    <div className="pw-bar">
                        <p className="t-mono" style={{ color: "var(--signal)" }}>Analyse / {code(active)}</p>
                        <p className="t-mono c-low">{liveLabel}</p>
                    </div>
                    <div className="pw-radar"><PowerRadar stats={p.stats} axes={axes} /></div>
                    <div className="pw-info">
                        <Scramble text={p.name} className="t-panel-title" />
                        <p className="t-small c-mid pw-desc">{p.text}</p>
                        <div className="pw-read"><PowerReadouts stats={p.stats} axes={axes} /></div>
                    </div>
                </div>
            </div>
        </section>
    )
}
