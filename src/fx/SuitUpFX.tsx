// Porté depuis Framer : SuitUpFX.tsx — le scan du portrait qui révèle l'alter ego au scroll
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
uniform vec3 uLine;
uniform vec3 uAccent;
uniform vec3 uSuit;
uniform vec2 uMouse;
uniform float uMouseOn;
uniform float uScan;
uniform float uVel;

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
float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 p = frag / uRes.y;
    vec2 m = uMouse / uRes.y;
    float md = length(p - m);

    float t = texture2D(uTrail, vec2(frag.x / uRes.x, 1.0 - frag.y / uRes.y)).r;
    float n = snoise(p * 2.4 + vec2(uTime * 0.28, -uTime * 0.2)) * 0.6
            + snoise(p * 5.2 - vec2(uTime * 0.42, uTime * 0.24)) * 0.4;
    float blob = smoothstep(0.30, 0.345, t + n * 0.16);

    vec2 iuv = (frag - uBoxMin) / uBoxSize;
    float edgeY = 1.08 - uScan * 1.2;
    float wob = snoise(vec2(iuv.x * 6.0, uTime * 0.9)) * 0.018 + snoise(vec2(iuv.x * 22.0, uTime * 2.3)) * 0.006;
    float d = iuv.y - (edgeY + wob);
    float scanMask = smoothstep(-0.004, 0.004, d);
    float mask = max(blob, scanMask);

    float band = floor(frag.y / (6.0 + 10.0 * hash(floor(uTime * 12.0))));
    float near = exp(-abs(d) * 26.0);
    float jitter = (hash(band + floor(uTime * 20.0)) - 0.5) * (near * 0.05 + uVel * 0.02);
    jitter *= step(0.55, hash(band * 1.7 + floor(uTime * 9.0)));

    vec4 acc = vec4(0.0);
    float bump = exp(-md * md * 12.0) * 0.32 * uMouseOn + t * 0.28;
    float f = fbm(p * 1.2 + vec2(uTime * 0.01, uTime * 0.016)) + bump;
    float lv = f * 7.0;
    float ld = abs(fract(lv + 0.5) - 0.5);
    float w = fwidth(lv);
    float line = 1.0 - smoothstep(0.0, w * 1.2, ld);
    float scanBand = exp(-abs(frag.y - (uBoxMin.y + uBoxSize.y * edgeY)) / uRes.y * 18.0) * step(0.001, uScan) * step(uScan, 0.999);
    float hot = clamp(blob + scanBand, 0.0, 1.0);
    float la = line * mix(0.1, 0.85, hot);
    acc = vec4(mix(uLine, uAccent, hot) * la, la);

    if (iuv.x >= -0.1 && iuv.x <= 1.1 && iuv.y >= 0.0 && iuv.y <= 1.0) {
        vec2 tuv = vec2(iuv.x + jitter, 1.0 - iuv.y);
        float fade = smoothstep(0.0, 0.1, iuv.y);
        vec4 b = texture2D(uBase, tuv);
        float inX = step(0.0, tuv.x) * step(tuv.x, 1.0);

        float split = near * 0.012 + uVel * 0.004;
        vec4 hR = texture2D(uHover, tuv + vec2(split, 0.0));
        vec4 hG = texture2D(uHover, tuv);
        vec4 hB = texture2D(uHover, tuv - vec2(split, 0.0));
        vec4 h = vec4(hR.r, hG.g, hB.b, hG.a);
        float sideFade = smoothstep(0.0, 0.12, tuv.x) * smoothstep(0.0, 0.12, 1.0 - tuv.x) * smoothstep(0.0, 0.06, tuv.y);
        h.a *= sideFade;

        float hCover = smoothstep(0.05, 0.6, h.a);
        float ba = b.a * fade * uHasBase * inX * (1.0 - mask * uHasHover * hCover);
        acc = vec4(b.rgb * ba, ba) + acc * (1.0 - ba);

        float ha = h.a * fade * inX * mask * uHasHover;
        acc = vec4(h.rgb * ha, ha) + acc * (1.0 - ha);

        float seam = exp(-abs(d) * 160.0) * step(0.001, uScan) * step(uScan, 0.999);
        float figure = max(b.a, h.a) * fade * inX;
        vec3 sc = mix(uAccent, vec3(1.0, 0.85, 0.7), exp(-abs(d) * 600.0));
        float sa = seam * figure;
        acc = vec4(sc * sa, sa) + acc * (1.0 - sa * 0.6);
    }

    float beamY = uBoxMin.y + uBoxSize.y * edgeY;
    float beam = exp(-abs(frag.y - beamY) * 0.35) * 0.55 * step(0.001, uScan) * step(uScan, 0.999);
    float sweep = 0.4 + 0.6 * smoothstep(0.0, 1.0, sin(frag.x / uRes.x * 3.14159));
    acc.rgb += uAccent * beam * sweep;
    acc.a = max(acc.a, beam * sweep * 0.8);

    gl_FragColor = acc;
}
`

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

interface Props {
    image: string
    hoverImage: string
    alt?: string
    lineColor?: string
    accent?: string
    suit?: string
    imageHeight?: number
    brushSize?: number
    scrollLayer?: string
    style?: CSSProperties
}

export default function SuitUpFX(props: Props) {
    const themeKey = useThemeKey()
    const { image, hoverImage, alt = "Portrait", lineColor = T.high, accent = T.accent, suit = T.signal, imageHeight = 0.9, brushSize = 150, scrollLayer = "Suit Up", style } = props
    const stageRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fallbackRef = useRef<HTMLImageElement>(null)

    useEffect(() => {
        const stage = stageRef.current
        const canvas = canvasRef.current
        if (!stage || !canvas) return
        const root = (stage.closest(`[data-name="${scrollLayer}"]`) || stage) as HTMLElement & { __suitUp?: { scan: number; raw: number } }

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
            line: u("uLine"), accent: u("uAccent"), suit: u("uSuit"), mouse: u("uMouse"), mouseOn: u("uMouseOn"),
            scan: u("uScan"), vel: u("uVel"),
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
        let pendingReveal = false
        let revealTimer = 0
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
            pendingReveal = true
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
        let drawReady = false
        const resize = () => {
            const rect = stage.getBoundingClientRect()
            const nextDpr = Math.min(window.devicePixelRatio || 1, 2)
            width = Math.max(1, stage.clientWidth || rect.width)
            height = Math.max(1, stage.clientHeight || rect.height)
            const cw = Math.round(width * nextDpr)
            const ch = Math.round(height * nextDpr)
            dpr = nextDpr
            if (canvas.width === cw && canvas.height === ch) return
            canvas.width = cw
            canvas.height = ch
            trail.width = Math.max(1, Math.round(width * TRAIL_SCALE))
            trail.height = Math.max(1, Math.round(height * TRAIL_SCALE))
            tctx.fillStyle = "#000"
            tctx.fillRect(0, 0, trail.width, trail.height)
            if (drawReady) draw()
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(stage)

        const colors = {
            line: toRgb(lineColor, [0.93, 0.93, 0.94]),
            accent: toRgb(accent, [1, 0.35, 0.12]),
            suit: toRgb(suit, [0.19, 0.66, 1]),
        }

        const target = { x: width * 0.5, y: height * 0.35 }
        const pos = { x: target.x, y: target.y }
        let last = { x: pos.x, y: pos.y }
        let pointerInside = false
        let lastPointerTime = -1e9
        let wasActive = false
        let mouseOn = 0

        const onPointerMove = (e: PointerEvent) => {
            const rect = stage.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height
            pointerInside = inside
            if (!inside) return
            target.x = x
            target.y = y
            lastPointerTime = performance.now()
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
        let prev = performance.now()
        const io = new IntersectionObserver((entries) => {
            inView = entries[0]?.isIntersecting ?? true
            if (inView && !raf) {
                prev = performance.now()
                raf = requestAnimationFrame(frame)
            }
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
        let scan = 0
        let vel = 0
        let drawTime = 0
        let drawVel = 0

        const frame = (now: number) => {
            raf = 0
            if (disposed) return
            const dt = Math.min(0.05, (now - prev) / 1000)
            prev = now
            const animate = !reducedMotion.matches
            const rr = root.getBoundingClientRect()
            const vh = window.innerHeight
            const travel = Math.max(1, rr.height - vh)
            const raw = clamp01(-rr.top / travel)
            const targetScan = clamp01((raw - 0.08) / 0.72)
            const prevScan = scan
            scan += (targetScan - scan) * Math.min(1, dt * 7)
            const sv = Math.abs(scan - prevScan) / Math.max(dt, 0.001)
            vel += (Math.min(sv, 3) - vel) * Math.min(1, dt * 6)
            root.__suitUp = { scan, raw }

            const idle = now - lastPointerTime > 2200
            const active = pointerInside && !idle
            const follow = 1 - Math.pow(0.82, dt * 60)
            pos.x += (target.x - pos.x) * follow
            pos.y += (target.y - pos.y) * follow
            if (active && !wasActive) {
                pos.x = target.x
                pos.y = target.y
                last = { x: pos.x, y: pos.y }
            }
            wasActive = active

            const fade = 1 - Math.pow(0.94, dt * 60)
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
            drawTime = animate ? (now - start) / 1000 : 0
            drawVel = animate ? vel : 0
            draw()
            if (inView && document.visibilityState === "visible") raf = requestAnimationFrame(frame)
        }

        const draw = () => {
            gl.activeTexture(gl.TEXTURE2)
            gl.bindTexture(gl.TEXTURE_2D, trailTex)
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trail)

            const narrow = width < 700
            const zoom = 1 + scan * 0.06
            const boxH = height * (narrow ? Math.min(imageHeight, 0.78) : imageHeight) * zoom * dpr
            const boxW = boxH * baseAspect
            const boxX = width * 0.5 * dpr - boxW / 2
            const boxY = 0

            gl.viewport(0, 0, canvas.width, canvas.height)
            gl.uniform2f(U.res, canvas.width, canvas.height)
            gl.uniform1f(U.time, drawTime)
            gl.uniform1f(U.hasBase, hasBase)
            gl.uniform1f(U.hasHover, hasHover)
            gl.uniform2f(U.boxMin, boxX, boxY)
            gl.uniform2f(U.boxSize, boxW, boxH)
            gl.uniform3fv(U.line, colors.line)
            gl.uniform3fv(U.accent, colors.accent)
            gl.uniform3fv(U.suit, colors.suit)
            gl.uniform2f(U.mouse, pos.x * dpr, (height - pos.y) * dpr)
            gl.uniform1f(U.mouseOn, mouseOn)
            gl.uniform1f(U.scan, scan)
            gl.uniform1f(U.vel, drawVel)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

            if (pendingReveal && hasBase) {
                pendingReveal = false
                canvas.style.opacity = "1"
                revealTimer = window.setTimeout(() => {
                    if (fallbackRef.current) fallbackRef.current.style.opacity = "0"
                }, 650)
            }
        }
        drawReady = true

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
            window.clearTimeout(revealTimer)
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
    }, [themeKey, image, hoverImage, lineColor, accent, suit, imageHeight, brushSize, scrollLayer])

    return (
        <div ref={stageRef} className="fx-suitup-stage" style={{ ...style, position: "relative", width: "100%", height: "100%", overflow: "hidden", touchAction: "pan-y", pointerEvents: "none" }}>
            <style dangerouslySetInnerHTML={{ __html: `.fx-suitup-stage{container-type:inline-size}.fx-suitup-fallback{height:${imageHeight * 100}%}@container (max-width: 699.98px){.fx-suitup-fallback{height:${Math.min(imageHeight, 0.78) * 100}%}}` }} />
            <img
                ref={fallbackRef}
                className="fx-suitup-fallback"
                src={image}
                alt={alt}
                draggable={false}
                style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 0,
                    width: "auto",
                    maxWidth: "none",
                    transform: "translateX(-50%)",
                    transition: "opacity 0.4s ease",
                    pointerEvents: "none",
                    WebkitMaskImage: "linear-gradient(to top, transparent 0%, #000 10%)",
                    maskImage: "linear-gradient(to top, transparent 0%, #000 10%)",
                }}
            />
            <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", opacity: 0, transition: "opacity 0.6s ease", pointerEvents: "none" }} />
        </div>
    )
}
