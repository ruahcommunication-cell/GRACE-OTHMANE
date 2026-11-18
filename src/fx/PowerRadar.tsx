// Porté depuis Framer : PowerRadar.tsx — radar animé + relevés chiffrés d'un profil de « pouvoir »
import { useEffect, useRef, type CSSProperties } from "react"
import { rc, alpha, T } from "./shared"

const MONO_STACK = "'JetBrains Mono', ui-monospace, monospace"
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const cac = (color: string, a: number) => {
    const c = rc(color)
    return c ? alpha(c, a) : "rgba(0,0,0,0)"
}
export const parseStats = (s: string) =>
    (s || "")
        .split(",")
        .map((v) => clamp01(parseFloat(v) / 100) || 0.5)
        .slice(0, 8)

// Une valeur partagée par groupe : le radar et les relevés défilent ensemble
const shared = new Map<string, { cur: number[]; t: number }>()
function useEased(key: string, target: number[], onFrame: (cur: number[], time: number, reduced: boolean) => void, deps: unknown[]) {
    useEffect(() => {
        const store = shared.get(key) ?? { cur: target.map(() => 0), t: 0 }
        shared.set(key, store)
        const cur = store.cur
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
        let raf = 0
        let prev = performance.now()
        const t0 = prev
        const frame = (now: number) => {
            const dt = Math.min(0.05, (now - prev) / 1000)
            prev = now
            const reduced = reducedMotion.matches
            if (store.t !== now) {
                store.t = now
                for (let i = 0; i < target.length; i++) cur[i] = reduced ? target[i] : (cur[i] ?? 0) + (target[i] - (cur[i] ?? 0)) * Math.min(1, dt * 5)
            }
            onFrame(cur, reduced ? 0 : (now - t0) / 1000, reduced)
            raf = requestAnimationFrame(frame)
        }
        raf = requestAnimationFrame(frame)
        return () => cancelAnimationFrame(raf)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, target.join(","), ...deps])
}

interface RadarProps {
    stats: string
    axes: string
    group?: string
    textColor?: string
    accent?: string
    suit?: string
    style?: CSSProperties
}

export default function PowerRadar({ stats, axes, group = "powers", textColor = T.high, accent = T.accent, suit = T.signal, style }: RadarProps) {
    const axisList = axes.split(",").map((a) => a.trim()).filter(Boolean)
    const n = Math.max(3, axisList.length)
    const target = Array.from({ length: n }, (_, i) => parseStats(stats)[i] ?? 0.5)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    useEased(
        group,
        target,
        (cur, time, reduced) => {
            const canvas = canvasRef.current
            if (!canvas) return
            const ctx = canvas.getContext("2d")
            if (!ctx) return
            const rect = canvas.getBoundingClientRect()
            if (rect.bottom < 0 || rect.top > window.innerHeight) return
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            const w = Math.max(1, rect.width)
            const h = Math.max(1, rect.height)
            if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
                canvas.width = Math.round(w * dpr)
                canvas.height = Math.round(h * dpr)
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, w, h)
            const cx = w / 2
            const cy = h / 2
            ctx.font = `500 11px ${MONO_STACK}`
            const labelHalf = Math.max(0, ...axisList.map((a) => ctx.measureText(a.toUpperCase()).width / 2))
            const R = Math.max(40, Math.min(Math.min(w, h) * 0.38, w / 2 - labelHalf - 26 - 8, h / 2 - 18 - 12))
            const ang = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2
            ctx.lineWidth = 1
            for (let r = 1; r <= 4; r++) {
                ctx.strokeStyle = r === 4 ? cac(textColor, 0.25) : cac(textColor, 0.09)
                ctx.beginPath()
                for (let i = 0; i <= n; i++) {
                    const x = cx + Math.cos(ang(i)) * R * (r / 4)
                    const y = cy + Math.sin(ang(i)) * R * (r / 4)
                    if (i === 0) ctx.moveTo(x, y)
                    else ctx.lineTo(x, y)
                }
                ctx.stroke()
            }
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            for (let i = 0; i < n; i++) {
                ctx.strokeStyle = cac(textColor, 0.09)
                ctx.beginPath()
                ctx.moveTo(cx, cy)
                ctx.lineTo(cx + Math.cos(ang(i)) * R, cy + Math.sin(ang(i)) * R)
                ctx.stroke()
                ctx.fillStyle = cac(textColor, 0.6)
                ctx.fillText((axisList[i] || "").toUpperCase(), cx + Math.cos(ang(i)) * (R + 26), cy + Math.sin(ang(i)) * (R + 18))
            }
            const anyCtx = ctx as CanvasRenderingContext2D & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient }
            const grad = !reduced && anyCtx.createConicGradient ? anyCtx.createConicGradient(time * 1.4 - 0.6, cx, cy) : null
            if (grad) {
                grad.addColorStop(0, "rgba(0,0,0,0)")
                grad.addColorStop(0.09, cac(suit, 0.2))
                grad.addColorStop(0.1, "rgba(0,0,0,0)")
                grad.addColorStop(1, "rgba(0,0,0,0)")
                ctx.fillStyle = grad
                ctx.beginPath()
                ctx.arc(cx, cy, R, 0, Math.PI * 2)
                ctx.fill()
            }
            ctx.beginPath()
            for (let i = 0; i <= n; i++) {
                const k = i % n
                const jitter = 1 + Math.sin(time * 3 + k * 2.1) * 0.012
                const x = cx + Math.cos(ang(k)) * R * cur[k] * jitter
                const y = cy + Math.sin(ang(k)) * R * cur[k] * jitter
                if (i === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
            }
            ctx.fillStyle = cac(accent, 0.15)
            ctx.fill()
            ctx.strokeStyle = rc(accent)
            ctx.lineWidth = 1.5
            ctx.shadowColor = rc(accent)
            ctx.shadowBlur = 14
            ctx.stroke()
            ctx.shadowBlur = 0
            for (let k = 0; k < n; k++) {
                const x = cx + Math.cos(ang(k)) * R * cur[k]
                const y = cy + Math.sin(ang(k)) * R * cur[k]
                ctx.fillStyle = "#fff"
                ctx.fillRect(x - 2, y - 2, 4, 4)
            }
        },
        [axes, accent, suit, textColor]
    )
    return (
        <div style={{ ...style, position: "relative", width: "100%", height: "100%" }}>
            <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        </div>
    )
}

export function PowerReadouts({ stats, axes, group = "powers", textColor = T.high }: { stats: string; axes: string; group?: string; textColor?: string }) {
    const axisList = axes.split(",").map((a) => a.trim()).filter(Boolean)
    const n = Math.max(3, axisList.length)
    const target = Array.from({ length: n }, (_, i) => parseStats(stats)[i] ?? 0.5)
    const refs = useRef<(HTMLSpanElement | null)[]>([])
    useEased(
        group,
        target,
        (cur) => {
            refs.current.forEach((el, i) => {
                if (!el) return
                const v = String(Math.round((cur[i] ?? 0) * 100)).padStart(3, "0")
                if (el.textContent !== v) el.textContent = v
            })
        },
        []
    )
    const mono: CSSProperties = { fontFamily: MONO_STACK, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: textColor }
    return (
        <div className="pr-readouts" style={{ ...mono, display: "grid", gridTemplateColumns: `repeat(${axisList.length}, max-content)`, columnGap: 18, rowGap: 8 }}>
            <style>{`@media (max-width: 809.98px) { .pr-readouts { grid-template-columns: repeat(3, max-content) !important; } }`}</style>
            {axisList.map((ax, i) => (
                <span key={i} style={{ display: "flex", gap: 6 }}>
                    <span style={{ opacity: 0.5 }}>{ax.slice(0, 3)}</span>
                    <span ref={(el) => { refs.current[i] = el }} style={{ fontVariantNumeric: "tabular-nums" }}>
                        {String(Math.round((target[i] ?? 0) * 100)).padStart(3, "0")}
                    </span>
                </span>
            ))}
        </div>
    )
}
