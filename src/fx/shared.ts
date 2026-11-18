// Utilitaires communs aux animations portées depuis Framer
import { useEffect, useState } from "react"

// Résout une couleur : les tokens arrivent sous forme var(--token-…, fallback)
export function rc(color: string): string {
    const c = (color || "").trim()
    const m = c.match(/^var\(\s*(--[^,\s)]+)\s*(?:,\s*(.+))?\)$/)
    if (!m) return c
    if (typeof document !== "undefined" && document.body) {
        const v = getComputedStyle(document.body).getPropertyValue(m[1]).trim()
        if (v) return v
    }
    return (m[2] || "").trim()
}

export function alpha(c: string, a: number): string {
    if (c.startsWith("#")) {
        let h = c.slice(1)
        if (h.length === 3) h = h.split("").map((x) => x + x).join("")
        const v = parseInt(h.slice(0, 6), 16)
        return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`
    }
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (m) {
        const p = m[1].split(",").map((x) => parseFloat(x))
        return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${a * (p.length > 3 && !isNaN(p[3]) ? p[3] : 1)})`
    }
    return c
}

export function ca(color: string, a: number): string {
    const c = (color || "").trim()
    if (c.startsWith("var(")) return `color-mix(in srgb, ${c} ${Math.round(a * 1000) / 10}%, transparent)`
    return alpha(c, a)
}

export const cac = (color: string, a: number) => alpha(rc(color), a)

export function toRgb(input: string, fallback: [number, number, number]): [number, number, number] {
    if (typeof document === "undefined" || !input) return fallback
    const value = rc(input)
    const ctx = document.createElement("canvas").getContext("2d")
    if (!ctx) return fallback
    ctx.fillStyle = "#000"
    ctx.fillStyle = value
    const out = ctx.fillStyle as string
    if (out.startsWith("#")) {
        const hex = out.slice(1)
        return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
    }
    const nums = out.match(/[\d.]+/g)
    if (!nums || nums.length < 3) return fallback
    return [Number(nums[0]) / 255, Number(nums[1]) / 255, Number(nums[2]) / 255]
}

export function compile(gl: WebGLRenderingContext, type: number, src: string) {
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader)
        return null
    }
    return shader
}

// Rappelle cb quand la police est vraiment chargée
export function whenFontReady(spec: string, cb: () => void) {
    if (typeof document === "undefined" || !document.fonts) return () => {}
    let alive = true
    const run = () => {
        document.fonts.load(spec).then(() => alive && cb()).catch(() => {})
    }
    run()
    document.fonts.addEventListener?.("loadingdone", run)
    const t1 = window.setTimeout(run, 700)
    const t2 = window.setTimeout(run, 2000)
    return () => {
        alive = false
        document.fonts.removeEventListener?.("loadingdone", run)
        window.clearTimeout(t1)
        window.clearTimeout(t2)
    }
}

// Redessine quand le visiteur change de thème (ThemeToggle)
export function useThemeKey() {
    const [k, setK] = useState(0)
    useEffect(() => {
        const on = () => setK((x) => x + 1)
        window.addEventListener("ruah-theme", on)
        return () => window.removeEventListener("ruah-theme", on)
    }, [])
    return k
}

export const tok = (id: string, fb: string) => `var(--token-${id}, ${fb})`
export const T = {
    bg: tok("b4f7ec45-478a-49ed-b81e-ab6f2a1e1c40", "rgb(7, 8, 10)"),
    surface: tok("343bc8fb-04d8-40cf-bee9-adcaa7991c80", "rgb(14, 16, 19)"),
    surfaceRaised: tok("c26605d3-137e-4442-b34f-8804fe3610bf", "rgb(21, 24, 28)"),
    line: tok("4da91ebd-ad7a-4e50-88bb-b5f32fbea86b", "rgba(237, 237, 240, 0.12)"),
    high: tok("35c01d6b-956d-4bc8-95a3-ba7e8b6ab2c0", "rgb(237, 237, 240)"),
    mid: tok("292e2ce1-8598-465c-9cc8-2376d33afe4a", "rgba(237, 237, 240, 0.66)"),
    low: tok("e2034c53-d6c4-4ca5-b6e0-383bd1b43573", "rgba(237, 237, 240, 0.5)"),
    accent: tok("64ed0298-3d29-4030-bb65-914b61b9b2de", "rgb(255, 90, 31)"),
    onAccent: tok("5b935389-2803-4e96-a6f9-09a3c91dd159", "rgb(7, 8, 10)"),
    signal: tok("2a29a7fb-1137-4b1a-b28a-63453be4a6be", "rgb(49, 168, 255)"),
    lineStrong: tok("9e2d5be3-8cb5-49d8-843d-98803219d637", "rgba(237, 237, 240, 0.26)"),
    outline: tok("LVOtUnFo5", "rgba(237, 237, 240, 0.33)"),
}

export const DISPLAY_STACK = "'Big Shoulders Variable', 'Big Shoulders', 'Arial Narrow', sans-serif"
