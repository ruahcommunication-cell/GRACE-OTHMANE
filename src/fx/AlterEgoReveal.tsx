// Porté depuis Framer : AlterEgoReveal.tsx — portrait détouré sur lignes de niveau ; une goutte liquide suit le pointeur et révèle l'alter ego
import { useEffect, useRef, type CSSProperties } from "react"
import { compile, toRgb, useThemeKey, T } from "./shared"

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`
const FRAG = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uBase;
uniform sampler2D uHover;
uniform sampler2D uTrail;
uniform float uHasBase;
uniform float uHasHover;
uniform vec2 uBoxMin;
uniform vec2 uBoxSize;
uniform float uFeather;
uniform vec3 uBg;
uniform vec3 uLine;
uniform vec3 uAccent;
uniform float uLineOpacity;
uniform float uBgStyle;
uniform float uEdgeNoise;
uniform vec2 uMouse;
uniform float uMouseOn;
uniform float uTransparent;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}
float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * snoise(p); p *= 2.02; a *= 0.5; }
    return v;
}

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 p = frag / uRes.y;
    vec2 m = uMouse / uRes.y;
    float md = length(p - m);
    float t = texture2D(uTrail, vec2(frag.x / uRes.x, 1.0 - frag.y / uRes.y)).r;
    float n = snoise(p * 2.4 + vec2(uTime * 0.28, -uTime * 0.2)) * 0.6
            + snoise(p * 5.2 - vec2(uTime * 0.42, uTime * 0.24)) * 0.4;
    float mask = smoothstep(0.30, 0.345, t + n * 0.2 * uEdgeNoise);
    vec4 acc = uTransparent > 0.5 ? vec4(0.0) : vec4(uBg, 1.0);
    if (uBgStyle < 0.5) {
        float bump = exp(-md * md * 12.0) * 0.32 * uMouseOn + t * 0.28;
        float f = fbm(p * 1.25 + vec2(uTime * 0.01, uTime * 0.016)) + bump;
        float lv = f * 7.0;
        float d = abs(fract(lv + 0.5) - 0.5);
        float w = fwidth(lv);
        float line = 1.0 - smoothstep(0.0, w * 1.2, d);
        if (uTransparent > 0.5) {
            float la = line * mix(uLineOpacity, 0.9, mask);
            acc = vec4(mix(uLine, uAccent, mask) * la, la);
        } else {
            vec3 lc = mix(uLine * uLineOpacity, uAccent * 0.9, mask);
            acc.rgb = uBg + lc * line;
        }
    }
    vec2 iuv = (frag - uBoxMin) / uBoxSize;
    if (iuv.x >= 0.0 && iuv.x <= 1.0 && iuv.y >= 0.0 && iuv.y <= 1.0) {
        vec2 tuv = vec2(iuv.x, 1.0 - iuv.y);
        float fade = uFeather > 0.001 ? smoothstep(0.0, uFeather, iuv.y) : 1.0;
        vec4 b = texture2D(uBase, tuv);
        float ba = b.a * fade * uHasBase * (1.0 - mask * uHasHover);
        acc = vec4(b.rgb * ba, ba) + acc * (1.0 - ba);
        vec4 h = texture2D(uHover, tuv);
        float ha = h.a * fade * mask * uHasHover;
        acc = vec4(h.rgb * ha, ha) + acc * (1.0 - ha);
    }
    gl_FragColor = acc;
}
`

interface Props {
    image: string
    hoverImage: string
    alt?: string
    background?: string
    lineColor?: string
    accent?: string
    lineOpacity?: number
    imageX?: number
    imageBottom?: number
    imageHeight?: number
    feather?: number
    brushSize?: number
    persistence?: number
    lag?: number
    edgeNoise?: number
    idleAutoplay?: boolean
    style?: CSSProperties
}

export default function AlterEgoReveal(props: Props) {
    const themeKey = useThemeKey()
    const { image, hoverImage, alt = "", background = T.bg, lineColor = T.high, accent = T.accent, lineOpacity = 0.12, imageX = 0.5, imageBottom = 0, imageHeight = 0.92, feather = 0.08, brushSize = 150, persistence = 0.94, lag = 0.82, edgeNoise = 0.8, idleAutoplay = true, style } = props
    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fallbackRef = useRef<HTMLImageElement>(null)

    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        if (!root || !canvas) return
        const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: true, alpha: true })
        if (!gl) return
        gl.getExtension("OES_standard_derivatives")
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
        const u = (name: string) => gl.getUniformLocation(prog, name)
        const U = {
            res: u("uRes"), time: u("uTime"), base: u("uBase"), hover: u("uHover"), trail: u("uTrail"),
            hasBase: u("uHasBase"), hasHover: u("uHasHover"), boxMin: u("uBoxMin"), boxSize: u("uBoxSize"),
            feather: u("uFeather"), bg: u("uBg"), line: u("uLine"), accent: u("uAccent"),
            lineOpacity: u("uLineOpacity"), bgStyle: u("uBgStyle"), edgeNoise: u("uEdgeNoise"),
            mouse: u("uMouse"), mouseOn: u("uMouseOn"), transparent: u("uTransparent"),
        }
        const makeTex = (unit: number) => {
            const tex = gl.createTexture()
            gl.activeTexture(gl.TEXTURE0 + unit)
            gl.bindTexture(gl.TEXTURE_2D, tex)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
            return tex
        }
        const baseTex = makeTex(0)
        const hoverTex = makeTex(1)
        const trailTex = makeTex(2)
        gl.uniform1i(U.base, 0)
        gl.uniform1i(U.hover, 1)
        gl.uniform1i(U.trail, 2)

        let disposed = false
        let baseAspect = 9 / 16
        let hasBase = 0
        let hasHover = 0
        const loadInto = (src: string | undefined, unit: number, tex: WebGLTexture | null, onReady: (img: HTMLImageElement) => void) => {
            if (!src) return
            const img = new Image()
            img.crossOrigin = "anonymous"
            img.decoding = "async"
            img.onload = () => {
                if (disposed) return
                try {
                    gl.activeTexture(gl.TEXTURE0 + unit)
                    gl.bindTexture(gl.TEXTURE_2D, tex)
                    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
                    onReady(img)
                } catch {}
            }
            img.src = src
        }
        loadInto(image, 0, baseTex, (img) => {
            baseAspect = img.naturalWidth / img.naturalHeight
            hasBase = 1
            canvas.style.opacity = "1"
            if (fallbackRef.current) fallbackRef.current.style.opacity = "0"
        })
        loadInto(hoverImage, 1, hoverTex, () => {
            hasHover = 1
        })

        const trail = document.createElement("canvas")
        const tctx = trail.getContext("2d")
        if (!tctx) return
        const TRAIL_SCALE = 0.5
        let width = 0
        let height = 0
        let dpr = 1
        const resize = () => {
            const rect = root.getBoundingClientRect()
            width = Math.max(1, rect.width)
            height = Math.max(1, rect.height)
            dpr = Math.min(window.devicePixelRatio || 1, 2)
            const cw = Math.round(width * dpr)
            const ch = Math.round(height * dpr)
            if (canvas.width === cw && canvas.height === ch) return false
            canvas.width = cw
            canvas.height = ch
            const tw = Math.max(1, Math.round(width * TRAIL_SCALE))
            const th = Math.max(1, Math.round(height * TRAIL_SCALE))
            if (trail.width !== tw || trail.height !== th) {
                trail.width = tw
                trail.height = th
                tctx.fillStyle = "#000"
                tctx.fillRect(0, 0, trail.width, trail.height)
            }
            return true
        }
        resize()
        const ro = new ResizeObserver(() => {
            if (resize() && !disposed) draw()
        })
        ro.observe(root)

        const colors = {
            bg: toRgb(background, [0.04, 0.04, 0.05]),
            line: toRgb(lineColor, [0.93, 0.93, 0.94]),
            accent: toRgb(accent, [1, 0.31, 0.1]),
        }
        const target = { x: width * imageX, y: height * 0.35 }
        const pos = { x: target.x, y: target.y }
        let last = { x: pos.x, y: pos.y }
        let pointerInside = false
        let lastPointerTime = -1e9
        let hasHovered = false
        let wasActive = false
        let mouseOn = 0
        const noHover = window.matchMedia("(hover: none)")
        const onPointerMove = (e: PointerEvent) => {
            const rect = root.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height
            pointerInside = inside
            if (!inside) return
            target.x = x
            target.y = y
            lastPointerTime = performance.now()
            if (e.pointerType === "mouse") hasHovered = true
        }
        const onPointerLeave = () => {
            pointerInside = false
        }
        window.addEventListener("pointermove", onPointerMove, { passive: true })
        window.addEventListener("pointerdown", onPointerMove, { passive: true })
        document.addEventListener("pointerleave", onPointerLeave)

        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
        let inView = true
        let raf = 0
        const io = new IntersectionObserver((entries) => {
            inView = entries[0]?.isIntersecting ?? true
            if (inView && !raf) raf = requestAnimationFrame(frame)
        })
        io.observe(root)
        const stamp = (x: number, y: number, r: number, strength: number) => {
            const g = tctx.createRadialGradient(x, y, 0, x, y, r)
            g.addColorStop(0, `rgba(255,255,255,${strength})`)
            g.addColorStop(0.55, `rgba(255,255,255,${strength * 0.55})`)
            g.addColorStop(1, "rgba(255,255,255,0)")
            tctx.fillStyle = g
            tctx.fillRect(x - r, y - r, r * 2, r * 2)
        }
        const start = performance.now()
        let prev = start
        let drawTime = 0
        const frame = (now: number) => {
            raf = 0
            if (disposed) return
            const dt = Math.min(0.05, (now - prev) / 1000)
            prev = now
            const time = (now - start) / 1000
            const idle = now - lastPointerTime > 2200
            const animate = !reducedMotion.matches
            const wander = idleAutoplay && idle && animate && (!hasHovered || noHover.matches)
            if (wander) {
                const boxH = height * imageHeight
                const cx = width * imageX
                const cy = height - height * imageBottom - boxH * 0.68
                target.x = cx + Math.sin(time * 0.55) * boxH * 0.17 + Math.sin(time * 1.3) * boxH * 0.04
                target.y = cy + Math.cos(time * 0.43) * boxH * 0.12
            }
            const active = (pointerInside && !idle) || wander
            const follow = 1 - Math.pow(lag, dt * 60)
            pos.x += (target.x - pos.x) * follow
            pos.y += (target.y - pos.y) * follow
            if (active && !wasActive) {
                pos.x = target.x
                pos.y = target.y
                last = { x: pos.x, y: pos.y }
            }
            wasActive = active
            const fade = 1 - Math.pow(persistence, dt * 60)
            tctx.globalCompositeOperation = "source-over"
            tctx.fillStyle = `rgba(0,0,0,${fade})`
            tctx.fillRect(0, 0, trail.width, trail.height)
            if (active) {
                tctx.globalCompositeOperation = "lighter"
                const dx = pos.x - last.x
                const dy = pos.y - last.y
                const dist = Math.hypot(dx, dy)
                const speed = dist / Math.max(dt, 0.001)
                const r = brushSize * TRAIL_SCALE * (0.75 + Math.min(speed / 1400, 0.45))
                const steps = Math.max(1, Math.ceil(dist / (r * 0.25)))
                const strength = 0.16 + Math.min(speed / 2600, 0.14)
                for (let i = 1; i <= steps; i++) {
                    const k = i / steps
                    stamp((last.x + dx * k) * TRAIL_SCALE, (last.y + dy * k) * TRAIL_SCALE, r, strength)
                }
            }
            last = { x: pos.x, y: pos.y }
            mouseOn += ((active ? 1 : 0) - mouseOn) * Math.min(1, dt * 4)
            drawTime = animate ? time : 0
            draw()
            if (inView && document.visibilityState === "visible") raf = requestAnimationFrame(frame)
        }
        function draw() {
            gl.activeTexture(gl.TEXTURE2)
            gl.bindTexture(gl.TEXTURE_2D, trailTex)
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trail)
            const boxH = height * imageHeight * dpr
            const boxW = boxH * baseAspect
            const boxX = width * imageX * dpr - boxW / 2
            const boxY = height * imageBottom * dpr
            gl.viewport(0, 0, canvas.width, canvas.height)
            gl.uniform2f(U.res, canvas.width, canvas.height)
            gl.uniform1f(U.time, drawTime)
            gl.uniform1f(U.hasBase, hasBase)
            gl.uniform1f(U.hasHover, hasHover)
            gl.uniform2f(U.boxMin, boxX, boxY)
            gl.uniform2f(U.boxSize, boxW, boxH)
            gl.uniform1f(U.feather, feather)
            gl.uniform3fv(U.bg, colors.bg)
            gl.uniform3fv(U.line, colors.line)
            gl.uniform3fv(U.accent, colors.accent)
            gl.uniform1f(U.lineOpacity, lineOpacity)
            gl.uniform1f(U.bgStyle, 0)
            gl.uniform1f(U.edgeNoise, edgeNoise)
            gl.uniform2f(U.mouse, pos.x * dpr, (height - pos.y) * dpr)
            gl.uniform1f(U.mouseOn, mouseOn)
            gl.uniform1f(U.transparent, 0)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        }
        const onVisibility = () => {
            if (document.visibilityState === "visible" && !raf) {
                prev = performance.now()
                raf = requestAnimationFrame(frame)
            }
        }
        document.addEventListener("visibilitychange", onVisibility)
        raf = requestAnimationFrame(frame)
        return () => {
            disposed = true
            if (raf) cancelAnimationFrame(raf)
            ro.disconnect()
            io.disconnect()
            window.removeEventListener("pointermove", onPointerMove)
            window.removeEventListener("pointerdown", onPointerMove)
            document.removeEventListener("pointerleave", onPointerLeave)
            document.removeEventListener("visibilitychange", onVisibility)
            gl.deleteTexture(baseTex)
            gl.deleteTexture(hoverTex)
            gl.deleteTexture(trailTex)
            gl.deleteBuffer(buf)
            gl.deleteProgram(prog)
            gl.deleteShader(vs)
            gl.deleteShader(fs)
        }
    }, [themeKey, image, hoverImage, background, lineColor, accent, lineOpacity, imageX, imageBottom, imageHeight, feather, brushSize, persistence, lag, edgeNoise, idleAutoplay])

    return (
        <div ref={rootRef} style={{ ...style, position: "relative", width: "100%", height: "100%", overflow: "hidden", background, touchAction: "pan-y" }}>
            <img
                ref={fallbackRef}
                src={image}
                alt={alt}
                draggable={false}
                style={{ position: "absolute", left: `${imageX * 100}%`, bottom: `${imageBottom * 100}%`, height: `${imageHeight * 100}%`, width: "auto", maxWidth: "none", transform: "translateX(-50%)", transition: "opacity 0.4s ease", pointerEvents: "none", userSelect: "none", WebkitMaskImage: `linear-gradient(to top, transparent 0%, #000 ${feather * 100}%)`, maskImage: `linear-gradient(to top, transparent 0%, #000 ${feather * 100}%)` }}
            />
            <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", opacity: 0, transition: "opacity 0.6s ease", pointerEvents: "none" }} />
        </div>
    )
}
