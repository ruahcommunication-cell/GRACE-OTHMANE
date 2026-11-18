// Porté depuis Framer : HoloImage.tsx — image scannée à l'apparition, monochrome jusqu'au survol qui fait éclore la couleur
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import { compile, rc, useThemeKey, T } from "./shared"

function toRgb(input: string, fallback: [number, number, number]): [number, number, number] {
    const c = rc(input)
    if (c.startsWith("#")) {
        let h = c.slice(1)
        if (h.length === 3) h = h.split("").map((x) => x + x).join("")
        const v = parseInt(h.slice(0, 6), 16)
        return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
    }
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (m) {
        const p = m[1].split(",").map((x) => parseFloat(x))
        return [p[0] / 255, p[1] / 255, p[2] / 255]
    }
    return fallback
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uImgAspect;
uniform float uTime;
uniform float uReveal;
uniform float uHover;
uniform vec2 uMouse;
uniform float uVel;
uniform float uRest;
uniform vec3 uAccent;
uniform vec3 uBg;
uniform float uFx;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
    float boxAsp = uRes.x / uRes.y;
    vec2 s = vec2(1.0);
    if (uImgAspect > boxAsp) s.x = boxAsp / uImgAspect; else s.y = uImgAspect / boxAsp;
    vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
    vec2 toward = (uMouse - 0.5) * 0.03 * uHover;
    vec2 tuv = (uv - 0.5) * s * (1.0 - 0.05 * uHover) + 0.5 + toward;

    float edgeY = uReveal * 1.12 - 0.06;
    float band = floor(gl_FragCoord.y / 5.0);
    float jit = (hash(vec2(band, floor(uTime * 18.0))) - 0.5) * exp(-abs(uv.y - edgeY) * 40.0) * 0.06;
    float split = (0.003 + uVel * 0.02) * uFx + exp(-abs(uv.y - edgeY) * 30.0) * 0.012;
    vec2 g = tuv + vec2(jit, 0.0);
    vec3 col = vec3(texture2D(uTex, g + vec2(split, 0.0)).r, texture2D(uTex, g).g, texture2D(uTex, g - vec2(split, 0.0)).b);

    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 mono = vec3(lum) * vec3(0.92, 0.96, 1.04);
    vec2 d = (uv - uMouse) * vec2(boxAsp, 1.0);
    float r = uHover * 1.6 * max(boxAsp, 1.0);
    float bloom = 1.0 - smoothstep(r - 0.25, r, length(d));
    float colorAmt = clamp(max(bloom * uHover, uRest), 0.0, 1.0);
    col = mix(mono * mix(1.0, 0.92, uFx), col, colorAmt);
    float ring = (smoothstep(r - 0.06, r - 0.02, length(d)) - smoothstep(r - 0.02, r, length(d))) * uHover * (1.0 - smoothstep(0.85, 1.0, uHover));
    col += uAccent * ring * 0.8;

    col *= mix(1.0, 0.93 + 0.07 * sin(gl_FragCoord.y * 1.6), uFx);
    col += (hash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.04 * uFx;

    float shown = step(uv.y, edgeY);
    vec2 grid = abs(fract(gl_FragCoord.xy / 24.0) - 0.5);
    float gl = 1.0 - smoothstep(0.46, 0.5, max(grid.x, grid.y));
    vec3 hidden = uBg + uAccent * gl * 0.08;
    col = mix(hidden, col, shown);
    float seam = exp(-abs(uv.y - edgeY) * 220.0) * step(0.001, uReveal) * step(uReveal, 0.999);
    col += uAccent * seam * 1.2;

    vec2 q = vUv - 0.5;
    col *= 1.0 - dot(q, q) * 0.5 * mix(0.3, 1.0, uFx);
    gl_FragColor = vec4(col, 1.0);
}
`

interface Props {
    src: string
    alt?: string
    label?: string
    accent?: string
    background?: string
    colorAtRest?: boolean
    effect?: "full" | "subtle" | "off"
    labelColor?: string
    zoom?: boolean
    style?: CSSProperties
}

export default function HoloImage(props: Props) {
    const themeKey = useThemeKey()
    const { src, alt = "", label = "", accent = T.accent, background = T.bg, colorAtRest = false, effect = "subtle", labelColor = T.high, zoom = false, style } = props
    const fxOff = effect === "off"
    const fxAmount = effect === "full" ? 1 : 0.35
    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const imgRef = useRef<HTMLImageElement>(null)

    useEffect(() => {
        if (fxOff) return
        const root = rootRef.current
        const canvas = canvasRef.current
        if (!root || !canvas || !src) return
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
        const U = { tex: u("uTex"), res: u("uRes"), asp: u("uImgAspect"), time: u("uTime"), reveal: u("uReveal"), hover: u("uHover"), mouse: u("uMouse"), vel: u("uVel"), rest: u("uRest"), accent: u("uAccent"), bg: u("uBg"), fx: u("uFx") }
        const tex = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
        gl.uniform1i(U.tex, 0)
        if (imgRef.current) imgRef.current.style.opacity = "0"

        let disposed = false
        let loaded = false
        let aspect = 1.5
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
            if (disposed) return
            try {
                gl.bindTexture(gl.TEXTURE_2D, tex)
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
                aspect = img.naturalWidth / img.naturalHeight
                loaded = true
                startReveal()
                kick()
            } catch {
                if (imgRef.current) imgRef.current.style.opacity = "1"
            }
        }
        img.onerror = () => {
            if (imgRef.current) imgRef.current.style.opacity = "1"
        }
        img.src = src.includes("framerusercontent.com") && !src.includes("?") ? `${src}?scale-down-to=1600` : src

        const resize = () => {
            const r = root.getBoundingClientRect()
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            canvas.width = Math.round(Math.max(1, r.width) * dpr)
            canvas.height = Math.round(Math.max(1, r.height) * dpr)
            kick()
        }

        const accentRgb = toRgb(accent, [1, 0.35, 0.12])
        const bgRgb = toRgb(background, [0.03, 0.03, 0.04])
        const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }
        let hoverT = 0
        let hover = 0
        let vel = 0
        let reveal = 0
        let revealing = false
        let revealStart = 0
        let inView = false
        let wellInView = false
        let raf = 0
        let prev = performance.now()
        const t0 = prev

        const onMove = (e: PointerEvent) => {
            const r = root.getBoundingClientRect()
            const nx = (e.clientX - r.left) / r.width
            const ny = (e.clientY - r.top) / r.height
            const inside = nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1
            if (inside) {
                vel = Math.min(1, vel + Math.hypot(nx - mouse.tx, ny - mouse.ty) * 2)
                mouse.tx = nx
                mouse.ty = ny
                if (hoverT === 0) {
                    mouse.x = nx
                    mouse.y = ny
                }
            }
            hoverT = inside ? 1 : 0
            kick()
        }
        root.addEventListener("pointermove", onMove)
        root.addEventListener("pointerenter", onMove)
        const onLeave = () => {
            hoverT = 0
            kick()
        }
        root.addEventListener("pointerleave", onLeave)

        function startReveal() {
            if (!loaded || !wellInView || revealing || reveal > 0) return
            revealing = true
            revealStart = performance.now()
        }
        const io = new IntersectionObserver(
            (e) => {
                const entry = e[0]
                inView = entry?.isIntersecting ?? false
                wellInView = !!entry && inView && (entry.intersectionRatio >= 0.2 || entry.intersectionRect.height >= window.innerHeight * 0.2)
                startReveal()
                kick()
            },
            { threshold: [0, 0.05, 0.15, 0.25, 0.35, 0.5, 0.75, 1] }
        )
        io.observe(root)
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

        const frame = (now: number) => {
            raf = 0
            if (disposed) return
            const dt = Math.min(0.05, (now - prev) / 1000)
            prev = now
            if (revealing) {
                const k = Math.min(1, (now - revealStart) / (reduced ? 1 : 1400))
                reveal = 0.5 - 0.5 * Math.cos(Math.PI * k)
                if (k >= 1) revealing = false
            }
            hover += (hoverT - hover) * Math.min(1, dt * (hoverT ? 2.6 : 4))
            mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 10)
            mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 10)
            vel *= Math.pow(0.02, dt)

            gl.viewport(0, 0, canvas.width, canvas.height)
            gl.uniform2f(U.res, canvas.width, canvas.height)
            gl.uniform1f(U.asp, aspect)
            gl.uniform1f(U.time, (now - t0) / 1000)
            gl.uniform1f(U.reveal, loaded ? reveal : 0)
            gl.uniform1f(U.hover, hover)
            gl.uniform2f(U.mouse, mouse.x, mouse.y)
            gl.uniform1f(U.vel, reduced ? 0 : vel)
            gl.uniform1f(U.rest, colorAtRest ? 1 : 0)
            gl.uniform3fv(U.accent, accentRgb)
            gl.uniform3fv(U.bg, bgRgb)
            gl.uniform1f(U.fx, fxAmount)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
            canvas.style.opacity = loaded ? "1" : "0"

            const busy = revealing || Math.abs(hover - hoverT) > 0.002 || vel > 0.002 || hoverT > 0
            if (busy && inView && document.visibilityState === "visible") raf = requestAnimationFrame(frame)
        }
        const kick = () => {
            if (!raf && inView) {
                prev = performance.now()
                raf = requestAnimationFrame(frame)
            }
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(root)
        return () => {
            disposed = true
            if (imgRef.current) imgRef.current.style.opacity = "1"
            if (raf) cancelAnimationFrame(raf)
            ro.disconnect()
            io.disconnect()
            root.removeEventListener("pointermove", onMove)
            root.removeEventListener("pointerenter", onMove)
            root.removeEventListener("pointerleave", onLeave)
            gl.deleteTexture(tex)
            gl.deleteBuffer(buf)
            gl.deleteProgram(prog)
            gl.deleteShader(vs)
            gl.deleteShader(fs)
        }
    }, [themeKey, fxOff, fxAmount, src, accent, background, colorAtRest])

    const [open, setOpen] = useState(false)
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false)
        }
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        window.addEventListener("keydown", onKey)
        return () => {
            window.removeEventListener("keydown", onKey)
            document.body.style.overflow = prevOverflow
        }
    }, [open])
    const canZoom = zoom && !!src
    const lightbox =
        open && typeof document !== "undefined"
            ? createPortal(
                  <div role="dialog" aria-modal="true" aria-label={alt || label || "Image"} onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: `color-mix(in srgb, ${T.bg} 94%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", padding: "4vmin", cursor: "zoom-out", animation: "holo-lb-in .25s ease" }}>
                      <style>{`@keyframes holo-lb-in{from{opacity:0}to{opacity:1}}`}</style>
                      <img src={src} alt={alt} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", boxShadow: "0 30px 80px rgba(0,0,0,.6)" }} />
                      <button type="button" aria-label="Fermer" onClick={(e) => { e.stopPropagation(); setOpen(false) }} style={{ position: "absolute", top: 20, right: 20, width: 44, height: 44, border: `1px solid ${accent}`, background: "transparent", color: labelColor, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 18, cursor: "pointer" }}>
                          ✕
                      </button>
                  </div>,
                  document.body
              )
            : null

    const corner = (pos: CSSProperties): CSSProperties => ({ position: "absolute", width: 14, height: 14, borderColor: accent, borderStyle: "solid", borderWidth: 0, ...pos })

    return (
        <div
            ref={rootRef}
            onClick={canZoom ? () => setOpen(true) : undefined}
            role={canZoom ? "button" : undefined}
            tabIndex={canZoom ? 0 : undefined}
            onKeyDown={canZoom ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true) } } : undefined}
            aria-label={canZoom ? `Agrandir : ${alt || label}` : undefined}
            style={{ ...style, position: "relative", width: "100%", height: "100%", overflow: "hidden", background, cursor: canZoom ? "zoom-in" : undefined }}
        >
            {lightbox}
            <img ref={imgRef} src={src} alt={alt} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: colorAtRest ? undefined : "grayscale(1)", transition: "opacity .3s ease" }} />
            {!fxOff && <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0 }} />}
            <div aria-hidden="true" style={{ position: "absolute", inset: 10, pointerEvents: "none" }}>
                <div style={corner({ left: 0, top: 0, borderLeftWidth: 1, borderTopWidth: 1 })} />
                <div style={corner({ right: 0, top: 0, borderRightWidth: 1, borderTopWidth: 1 })} />
                <div style={corner({ left: 0, bottom: 0, borderLeftWidth: 1, borderBottomWidth: 1 })} />
                <div style={corner({ right: 0, bottom: 0, borderRightWidth: 1, borderBottomWidth: 1 })} />
                {label ? (
                    <span style={{ position: "absolute", left: 24, top: 0, padding: "5px 8px 4px", lineHeight: 1, background: `color-mix(in srgb, ${background} 82%, transparent)`, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: labelColor }}>{label}</span>
                ) : null}
            </div>
        </div>
    )
}
