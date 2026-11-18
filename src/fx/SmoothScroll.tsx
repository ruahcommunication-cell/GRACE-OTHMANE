// Porté depuis Framer : SmoothScroll.tsx — défilement fluide à la molette (smoothness 7, wheelSpeed 1)
import { useEffect } from "react"

type Options = { enabled: boolean; lerp: number; wheelSpeed: number }
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const toLerp = (s: number) => 0.2 - (clamp(s, 1, 10) - 1) * (0.15 / 9)

function createEngine(o: Options) {
    const root = document.documentElement
    let current = window.scrollY
    let target = current
    let written = current
    let animating = false
    let raf = 0
    let last = 0
    const maxScroll = () => Math.max(0, root.scrollHeight - window.innerHeight)
    const write = (y: number) => {
        try {
            window.scrollTo({ top: y, left: window.scrollX, behavior: "instant" as ScrollBehavior })
        } catch {
            window.scrollTo(window.scrollX, y)
        }
        written = window.scrollY
    }
    const scrollsInside = (el: Element | null, dy: number) => {
        while (el && el !== document.body && el !== root) {
            if (el instanceof HTMLElement) {
                if (el.hasAttribute("data-smooth-scroll-prevent") || el.hasAttribute("data-lenis-prevent")) return true
                const oy = getComputedStyle(el).overflowY
                if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) {
                    if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true
                    if (dy < 0 && el.scrollTop > 0) return true
                }
            }
            el = el.parentElement
        }
        return false
    }
    const frame = (now: number) => {
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60
        last = now
        if (Math.abs(window.scrollY - written) > 2) {
            current = target = written = window.scrollY
            animating = false
            last = 0
            return
        }
        target = clamp(target, 0, maxScroll())
        const k = 1 - Math.pow(1 - o.lerp, dt * 60)
        current += (target - current) * k
        if (Math.abs(target - current) < 0.5) {
            current = target
            animating = false
        }
        write(current)
        if (animating) raf = requestAnimationFrame(frame)
        else last = 0
    }
    const onWheel = (e: WheelEvent) => {
        if (!o.enabled || e.defaultPrevented || e.ctrlKey || e.metaKey) return
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
        const dx = e.deltaX * unit
        const dy = e.deltaY * unit
        if (Math.abs(dx) > Math.abs(dy) || dy === 0) return
        if (scrollsInside(e.target as Element, dy)) return
        e.preventDefault()
        if (!animating) current = target = written = window.scrollY
        target = clamp(target + dy * o.wheelSpeed, 0, maxScroll())
        if (!animating) {
            animating = true
            raf = requestAnimationFrame(frame)
        }
    }
    window.addEventListener("wheel", onWheel, { passive: false })
    return () => {
        window.removeEventListener("wheel", onWheel)
        cancelAnimationFrame(raf)
    }
}

export default function SmoothScroll({ smoothness = 7, wheelSpeed = 1 }: { smoothness?: number; wheelSpeed?: number }) {
    useEffect(() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
        let destroy: (() => void) | null = null
        const attach = () => {
            if (destroy || reduced.matches) return
            destroy = createEngine({ enabled: true, lerp: toLerp(smoothness), wheelSpeed: clamp(wheelSpeed, 0.3, 3) })
        }
        const detach = () => {
            destroy?.()
            destroy = null
        }
        const onChange = () => (reduced.matches ? detach() : attach())
        attach()
        reduced.addEventListener?.("change", onChange)
        return () => {
            reduced.removeEventListener?.("change", onChange)
            detach()
        }
    }, [smoothness, wheelSpeed])
    return null
}
