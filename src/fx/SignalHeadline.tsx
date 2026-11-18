// Porté depuis Framer : SignalHeadline.tsx — le titre géant du footer qui ondule sous le pointeur
import { useEffect, useRef, type CSSProperties } from "react"
import { compile, toRgb, useThemeKey, whenFontReady, DISPLAY_STACK, T } from "./shared"

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uText;
uniform sampler2D uTrail;
uniform vec3 uBg;
uniform vec3 uInk;
uniform vec3 uAccent;
uniform vec3 uSuit;
uniform vec2 uMouse;
uniform float uMouseOn;

float trailAt(vec2 uv) { return texture2D(uTrail, uv).r; }

void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    vec2 tuv = vec2(uv.x, 1.0 - uv.y);
    vec2 px = 3.0 / uRes;
    float t = trailAt(tuv);
    float gx = trailAt(tuv + vec2(px.x, 0.0)) - trailAt(tuv - vec2(px.x, 0.0));
    float gy = trailAt(tuv + vec2(0.0, px.y)) - trailAt(tuv - vec2(0.0, px.y));
    vec2 grad = vec2(gx, gy);
    float wave = sin(t * 18.0 - uTime * 6.0) * t;
    vec2 off = grad * 0.9 + grad * wave * 0.6;

    float split = t * 0.012;
    float r = texture2D(uText, tuv + off + vec2(split, 0.0)).a;
    float g = texture2D(uText, tuv + off).a;
    float b = texture2D(uText, tuv + off - vec2(split, 0.0)).a;

    vec2 cell = gl_FragCoord.xy / 18.0;
    vec2 local = fract(cell) - 0.5;
    float dotm = 1.0 - smoothstep(0.06, 0.1, length(local));
    vec2 m = uMouse / uRes;
    float near = exp(-length((uv - m) * vec2(uRes.x / uRes.y, 1.0)) * 6.0) * uMouseOn;
    vec3 col = uBg + uInk * dotm * (0.05 + near * 0.25 + t * 0.4);

    vec3 ink = mix(uInk, uAccent, smoothstep(0.05, 0.35, t));
    vec3 textCol = vec3(r, g, b);
    float a = max(max(r, g), b);
    col = mix(col, ink * textCol / max(a, 0.001), a);
    col += uSuit * (r - b) * 0.25;
    gl_FragColor = vec4(col, 1.0);
}
`

interface Props {
    headline?: string
    background?: string
    textColor?: string
    accent?: string
    suit?: string
    gutterDesktop?: number
    gutterTablet?: number
    gutterPhone?: number
    sizing?: "fill" | "screen"
    compact?: boolean
    style?: CSSProperties
}

export default function SignalHeadline(props: Props) {
    const themeKey = useThemeKey()
    const {
        headline = "OUVRONS/LE DOSSIER",
        background = T.bg,
        textColor = T.high,
        accent = T.accent,
        suit = T.signal,
        gutterDesktop = 40,
        gutterTablet = 24,
        gutterPhone = 20,
        sizing = "screen",
        compact = false,
        style,
    } = props
    const sizeStyle: CSSProperties =
        sizing === "screen" ? { height: compact ? "72vh" : "100vh", minHeight: compact ? 560 : 640 } : { height: "100%" }
    const displayFamily = DISPLAY_STACK
    const displayWeight = 900

    const rootRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const root = rootRef.current
        const stage = stageRef.current
        const canvas = canvasRef.current
        if (!root || !stage || !canvas) return
        const gl = canvas.getContext("webgl", { antialias: false, alpha: false })
        if (!gl) return
        const vs = compile(gl, gl.VERTEX_SHADER, VERT)
        const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
        if (!vs || !fs) return
        const prog = gl.createProgram()
        if (!prog) return
        gl.attachShader(prog, vs)
        gl.attachShader(prog, fs)
        gl.linkProgram(prog)
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
        gl.useProgram(prog)
        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        const aPos = gl.getAttribLocation(prog, "aPos")
        gl.enableVertexAttribArray(aPos)
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
        const u = (n: string) => gl.getUniformLocation(prog, n)
        const U = { res: u("uRes"), time: u("uTime"), text: u("uText"), trail: u("uTrail"), bg: u("uBg"), ink: u("uInk"), accent: u("uAccent"), suit: u("uSuit"), mouse: u("uMouse"), mouseOn: u("uMouseOn") }

        const makeTex = (unit: number) => {
            const tex = gl.createTexture()
            gl.activeTexture(gl.TEXTURE0 + unit)
            gl.bindTexture(gl.TEXTURE_2D, tex)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            return tex
        }
        const textTex = makeTex(0)
        const trailTex = makeTex(1)
        gl.uniform1i(U.text, 0)
        gl.uniform1i(U.trail, 1)

        const textCanvas = document.createElement("canvas")
        const tx = textCanvas.getContext("2d")
        const trail = document.createElement("canvas")
        const tc = trail.getContext("2d")
        if (!tx || !tc) return
        const TRAIL_SCALE = 0.35

        let width = 1
        let height = 1
        let dpr = 1
        let disposed = false
        const gutterPx = () => {
            const vw = window.innerWidth
            return vw < 810 ? gutterPhone : vw < 1200 ? gutterTablet : gutterDesktop
        }
        const drawText = () => {
            if (disposed) return
            textCanvas.width = Math.round(width * dpr)
            textCanvas.height = Math.round(height * dpr)
            tx.clearRect(0, 0, textCanvas.width, textCanvas.height)
            const lines = headline.split("/").map((l) => l.trim()).filter(Boolean)
            const padX = gutterPx()
            const maxW = (width - padX * 2) * dpr
            const font = (size: number) => `${displayWeight} ${size}px ${displayFamily}`
            let size = 400 * dpr
            tx.font = font(size)
            const widest = Math.max(...lines.map((l) => tx.measureText(l).width))
            const narrow = window.innerWidth < 810
            size = Math.min(size * (maxW / widest), (height * dpr * (narrow ? 0.32 : 0.5)) / (lines.length * 0.86))
            tx.font = font(size)
            tx.fillStyle = "#fff"
            tx.textBaseline = "alphabetic"
            const lineH = size * 0.84
            const blockH = lineH * lines.length
            const top = height * dpr * (narrow ? 0.4 : 0.46) - blockH * 0.5
            lines.forEach((l, i) => {
                const w = tx.measureText(l).width
                const x = i % 2 === 0 ? padX * dpr : textCanvas.width - padX * dpr - w
                tx.fillText(l, x, top + lineH * (i + 1) - size * 0.08)
            })
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, textTex)
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas)
        }
        const resize = () => {
            const r = stage.getBoundingClientRect()
            width = Math.max(1, r.width)
            height = Math.max(1, r.height)
            dpr = Math.min(window.devicePixelRatio || 1, 1.75)
            canvas.width = Math.round(width * dpr)
            canvas.height = Math.round(height * dpr)
            trail.width = Math.max(1, Math.round(width * TRAIL_SCALE))
            trail.height = Math.max(1, Math.round(height * TRAIL_SCALE))
            tc.fillStyle = "#000"
            tc.fillRect(0, 0, trail.width, trail.height)
            drawText()
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(stage)
        const stopFontWatch = whenFontReady(`${displayWeight} 100px ${displayFamily}`, drawText)

        const colors = {
            bg: toRgb(background, [0.03, 0.03, 0.04]),
            ink: toRgb(textColor, [0.93, 0.93, 0.94]),
            accent: toRgb(accent, [1, 0.35, 0.12]),
            suit: toRgb(suit, [0.19, 0.66, 1]),
        }

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
        const target = { x: width * 0.5, y: height * 0.5 }
        const pos = { ...target }
        let last = { ...pos }
        let inside = false
        let lastMove = -1e9
        let mouseOn = 0
        const onMove = (e: PointerEvent) => {
            const r = stage.getBoundingClientRect()
            const x = e.clientX - r.left
            const y = e.clientY - r.top
            inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height
            if (!inside) return
            target.x = x
            target.y = y
            lastMove = performance.now()
        }
        window.addEventListener("pointermove", onMove, { passive: true })

        let inView = true
        let raf = 0
        let prev = performance.now()
        const t0 = prev
        const io = new IntersectionObserver((e) => {
            inView = e[0]?.isIntersecting ?? true
            if (inView && !raf) {
                prev = performance.now()
                raf = requestAnimationFrame(frame)
            }
        })
        io.observe(root)

        const stamp = (x: number, y: number, r: number, s: number) => {
            const g = tc.createRadialGradient(x, y, 0, x, y, r)
            g.addColorStop(0, `rgba(255,255,255,${s})`)
            g.addColorStop(1, "rgba(255,255,255,0)")
            tc.fillStyle = g
            tc.fillRect(x - r, y - r, r * 2, r * 2)
        }

        const frame = (now: number) => {
            raf = 0
            if (disposed) return
            const dt = Math.min(0.05, (now - prev) / 1000)
            prev = now
            const reduced = reducedMotion.matches
            const time = reduced ? 0 : (now - t0) / 1000
            const idle = now - lastMove > 2500
            if (idle && !reduced) {
                target.x = width * (0.5 + Math.sin(time * 0.5) * 0.32)
                target.y = height * (0.45 + Math.sin(time * 0.9) * 0.12)
            }
            const active = reduced ? inside && !idle : (inside && !idle) || idle
            pos.x += (target.x - pos.x) * Math.min(1, dt * 9)
            pos.y += (target.y - pos.y) * Math.min(1, dt * 9)

            tc.globalCompositeOperation = "source-over"
            tc.fillStyle = `rgba(0,0,0,${1 - Math.pow(0.93, dt * 60)})`
            tc.fillRect(0, 0, trail.width, trail.height)
            if (active) {
                tc.globalCompositeOperation = "lighter"
                const dx = pos.x - last.x
                const dy = pos.y - last.y
                const dist = Math.hypot(dx, dy)
                const r = 90 * TRAIL_SCALE * (idle ? 0.8 : 1)
                const steps = Math.max(1, Math.ceil(dist / (r * 0.4)))
                for (let i = 1; i <= steps; i++) {
                    const k = i / steps
                    stamp((last.x + dx * k) * TRAIL_SCALE, (last.y + dy * k) * TRAIL_SCALE, r, idle ? 0.06 : 0.14)
                }
            }
            last = { ...pos }
            mouseOn += ((inside && !idle ? 1 : 0) - mouseOn) * Math.min(1, dt * 4)

            gl.activeTexture(gl.TEXTURE1)
            gl.bindTexture(gl.TEXTURE_2D, trailTex)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trail)

            gl.viewport(0, 0, canvas.width, canvas.height)
            gl.uniform2f(U.res, canvas.width, canvas.height)
            gl.uniform1f(U.time, time)
            gl.uniform3fv(U.bg, colors.bg)
            gl.uniform3fv(U.ink, colors.ink)
            gl.uniform3fv(U.accent, colors.accent)
            gl.uniform3fv(U.suit, colors.suit)
            gl.uniform2f(U.mouse, pos.x * dpr, (height - pos.y) * dpr)
            gl.uniform1f(U.mouseOn, mouseOn)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
            if (inView && document.visibilityState === "visible") raf = requestAnimationFrame(frame)
        }
        const onVis = () => {
            if (document.visibilityState === "visible" && !raf && inView) {
                prev = performance.now()
                raf = requestAnimationFrame(frame)
            }
        }
        document.addEventListener("visibilitychange", onVis)
        raf = requestAnimationFrame(frame)

        return () => {
            disposed = true
            if (raf) cancelAnimationFrame(raf)
            stopFontWatch()
            ro.disconnect()
            io.disconnect()
            window.removeEventListener("pointermove", onMove)
            document.removeEventListener("visibilitychange", onVis)
            gl.deleteTexture(textTex)
            gl.deleteTexture(trailTex)
            gl.deleteBuffer(buf)
            gl.deleteProgram(prog)
            gl.deleteShader(vs)
            gl.deleteShader(fs)
        }
    }, [themeKey, headline, background, textColor, accent, suit, displayFamily, gutterDesktop, gutterTablet, gutterPhone])

    const lines = headline.split("/").map((l) => l.trim()).filter(Boolean)

    return (
        <div ref={rootRef} className={sizing === "screen" ? "sf-screen" : undefined} style={{ ...style, position: "relative", width: "100%", ...sizeStyle, background, overflow: "hidden" }}>
            <style>{`
                @media (max-width: 1199.98px) {
                    .sf-screen { height: ${compact ? "min(64vh, 620px)" : "min(88vh, 860px)"} !important; min-height: ${compact ? 480 : 600}px !important; }
                }
                @media (max-width: 809.98px) {
                    .sf-screen { height: ${compact ? "min(70vh, 600px)" : "min(84vh, 720px)"} !important; min-height: ${compact ? 560 : 640}px !important; }
                }
            `}</style>
            <div ref={stageRef} style={{ position: "absolute", inset: 0 }}>
                <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
                <h2 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", margin: 0 }}>{lines.join(" ")}</h2>
            </div>
        </div>
    )
}
