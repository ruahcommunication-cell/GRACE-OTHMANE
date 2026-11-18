// Porté depuis Framer : MissionTunnel.tsx — couloir Three.js épinglé, le scroll fait voler la caméra devant chaque projet
import { useEffect, useRef, type CSSProperties } from "react"
import * as THREE from "three"
import { ca, rc, useThemeKey, DISPLAY_STACK, T } from "./shared"

export interface MissionItem {
    title: string
    discipline: string
    client: string
    year: string
    link: string
    image?: string
}

const MONO_STACK = "'JetBrains Mono', ui-monospace, monospace"

const PLANE_VERT = `
uniform float uVel;
uniform float uHover;
varying vec2 vUv;
void main() {
    vUv = uv;
    vec3 p = position;
    float bend = sin(uv.x * 3.14159);
    p.z += bend * uVel * 0.55 - bend * uHover * 0.12;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const PLANE_FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform float uImgAspect;
uniform float uPlaneAspect;
uniform float uVel;
uniform float uFocus;
uniform float uFade;
uniform float uHover;
uniform float uLoaded;
uniform float uTime;
uniform vec3 uAccent;
uniform vec3 uBg;
varying vec2 vUv;

vec2 cover(vec2 uv) {
    vec2 s = vec2(1.0);
    if (uImgAspect > uPlaneAspect) s.x = uPlaneAspect / uImgAspect; else s.y = uImgAspect / uPlaneAspect;
    vec2 zoom = s * (1.0 - uHover * 0.06);
    return (uv - 0.5) * zoom + 0.5;
}

void main() {
    vec2 uv = cover(vUv);
    float shift = uVel * 0.014 + (1.0 - uFocus) * 0.004;
    float r = texture2D(uTex, uv + vec2(shift, 0.0)).r;
    float g = texture2D(uTex, uv).g;
    float b = texture2D(uTex, uv - vec2(shift, 0.0)).b;
    vec3 col = vec3(r, g, b);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 mono = vec3(lum) * vec3(0.9, 0.95, 1.05);
    col = mix(mono * 0.82, col, uFocus);
    col *= 0.92 + 0.08 * sin(vUv.y * 420.0 + uTime * 4.0);
    vec2 e = min(vUv, 1.0 - vUv);
    float edge = min(e.x * uPlaneAspect, e.y);
    float frame = (1.0 - smoothstep(0.0, 0.012, edge)) * (0.35 + 0.65 * uHover);
    col = mix(col, uAccent, frame * uFocus);
    col = mix(uBg, col, uLoaded);
    col = mix(uBg, col, uFade);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
}
`

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>_"
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

interface Props {
    items: MissionItem[]
    screensPerProject?: number
    background?: string
    lineColor?: string
    accent?: string
    suit?: string
    style?: CSSProperties
}

export default function MissionTunnel(props: Props) {
    const themeKey = useThemeKey()
    const { items, screensPerProject = 0.7, background = T.bg, lineColor = T.high, accent = T.accent, suit = T.signal, style } = props
    const displayFamily = DISPLAY_STACK
    const displayWeight = 900
    const rootHeight = `${Math.round((items.length * screensPerProject + 0.2) * 100)}vh`
    const rootRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const titleRef = useRef<HTMLAnchorElement>(null)
    const indexRef = useRef<HTMLDivElement>(null)
    const metaRef = useRef<HTMLDivElement>(null)
    const railRef = useRef<HTMLDivElement>(null)
    const hudRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const root = rootRef.current
        const stage = stageRef.current
        const canvas = canvasRef.current
        if (!root || !stage || !canvas) return

        let disposed = false
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
        const bgColor = new THREE.Color(rc(background))
        renderer.setClearColor(bgColor, 1)

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80)
        const N = items.length
        const SPACING = 7
        const CAM_DIST = 4.4

        const accentColor = new THREE.Color(rc(accent))
        const lineCol = new THREE.Color(rc(lineColor))
        const suitCol = new THREE.Color(rc(suit))

        const frameGroup = new THREE.Group()
        scene.add(frameGroup)
        const depth = (N - 1) * SPACING + 30
        const fw = 5.2
        const fh = 3.1
        const framePositions: number[] = []
        const frameColors: number[] = []
        let fi = 0
        for (let z = 8; z > -depth; z -= 1.75) {
            const hot = fi % 4 === 0
            const c = hot ? accentColor : lineCol
            const k = hot ? 0.75 : 0.16
            const pts = [
                [-fw, -fh], [fw, -fh], [fw, -fh], [fw, fh], [fw, fh], [-fw, fh], [-fw, fh], [-fw, -fh],
            ]
            for (const [x, y] of pts) {
                framePositions.push(x, y, z)
                frameColors.push(c.r * k, c.g * k, c.b * k)
            }
            fi++
        }
        const rails = [[-fw, -fh], [fw, -fh], [-fw, fh], [fw, fh], [-fw * 0.5, -fh], [fw * 0.5, -fh], [0, -fh]]
        for (const [x, y] of rails) {
            framePositions.push(x, y, 8, x, y, -depth)
            const k = 0.12
            frameColors.push(lineCol.r * k, lineCol.g * k, lineCol.b * k, 0, 0, 0)
        }
        const frameGeo = new THREE.BufferGeometry()
        frameGeo.setAttribute("position", new THREE.Float32BufferAttribute(framePositions, 3))
        frameGeo.setAttribute("color", new THREE.Float32BufferAttribute(frameColors, 3))
        const frameMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, fog: true })
        frameGroup.add(new THREE.LineSegments(frameGeo, frameMat))
        scene.fog = new THREE.Fog(bgColor, 4, 30)

        const STREAKS = 360
        const streakPos = new Float32Array(STREAKS * 6)
        const streakSeed: { x: number; y: number; z: number }[] = []
        for (let i = 0; i < STREAKS; i++) {
            const side = Math.random()
            let x = (Math.random() * 2 - 1) * fw
            let y = (Math.random() * 2 - 1) * fh
            if (side < 0.5) x = Math.sign(x || 1) * (fw * (0.7 + Math.random() * 0.3))
            else y = Math.sign(y || 1) * (fh * (0.6 + Math.random() * 0.4))
            streakSeed.push({ x, y, z: 8 - Math.random() * depth })
        }
        const streakGeo = new THREE.BufferGeometry()
        streakGeo.setAttribute("position", new THREE.BufferAttribute(streakPos, 3))
        const streakMat = new THREE.LineBasicMaterial({ color: suitCol, transparent: true, opacity: 0.55, fog: true })
        const streaks = new THREE.LineSegments(streakGeo, streakMat)
        scene.add(streaks)

        const loader = new THREE.TextureLoader()
        loader.setCrossOrigin("anonymous")
        type Plane = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; baseX: number; z: number; hover: number }
        const planes: Plane[] = []
        const planeGeo = new THREE.PlaneGeometry(1, 1, 24, 8)
        for (let i = 0; i < N; i++) {
            const mat = new THREE.ShaderMaterial({
                vertexShader: PLANE_VERT,
                fragmentShader: PLANE_FRAG,
                uniforms: {
                    uTex: { value: null },
                    uImgAspect: { value: 1.5 },
                    uPlaneAspect: { value: 16 / 10 },
                    uVel: { value: 0 },
                    uFocus: { value: 0 },
                    uFade: { value: 0 },
                    uHover: { value: 0 },
                    uLoaded: { value: 0 },
                    uTime: { value: 0 },
                    uAccent: { value: accentColor },
                    uBg: { value: bgColor },
                },
            })
            const mesh = new THREE.Mesh(planeGeo, mat)
            mesh.userData.index = i
            scene.add(mesh)
            const src = items[i]?.image
            if (src) {
                const url = src.includes("framerusercontent.com") && !src.includes("?") ? `${src}?scale-down-to=1024` : src
                loader.load(url, (tex) => {
                    if (disposed) return
                    tex.colorSpace = THREE.SRGBColorSpace
                    tex.minFilter = THREE.LinearFilter
                    mat.uniforms.uTex.value = tex
                    mat.uniforms.uImgAspect.value = tex.image.width / tex.image.height
                    mat.uniforms.uLoaded.value = 1
                })
            }
            planes.push({ mesh, mat, baseX: 0, z: -i * SPACING, hover: 0 })
        }

        let width = 1
        let height = 1
        let narrow = false
        const layout = () => {
            const rect = stage.getBoundingClientRect()
            width = Math.max(1, rect.width)
            height = Math.max(1, rect.height)
            renderer.setSize(width, height, false)
            camera.aspect = width / height
            camera.updateProjectionMatrix()
            narrow = width / height < 1
            const visH = 2 * CAM_DIST * Math.tan((camera.fov * Math.PI) / 360)
            const visW = visH * camera.aspect
            const pw = narrow ? visW * 0.88 : Math.min(visW * 0.5, 3.8)
            const ph = pw / 1.6
            planes.forEach((p, i) => {
                p.baseX = narrow ? 0 : (i % 2 === 0 ? 1 : -1) * (visW * 0.5 - pw * 0.5 - visW * 0.06)
                p.mesh.scale.set(pw, ph, 1)
                p.mesh.position.set(p.baseX, narrow ? visH * 0.12 : 0.1, p.z)
                p.mat.uniforms.uPlaneAspect.value = pw / ph
            })
        }
        layout()
        const ro = new ResizeObserver(layout)
        ro.observe(stage)

        const pointer = new THREE.Vector2(0, 0)
        const smoothPointer = { x: 0, y: 0 }
        let pointerInStage = false
        const raycaster = new THREE.Raycaster()
        let hovered = -1
        const onMove = (e: PointerEvent) => {
            const rect = stage.getBoundingClientRect()
            const x = (e.clientX - rect.left) / rect.width
            const y = (e.clientY - rect.top) / rect.height
            pointerInStage = x >= 0 && x <= 1 && y >= 0 && y <= 1
            pointer.set(x * 2 - 1, -(y * 2 - 1))
        }
        const onClick = (e: MouseEvent) => {
            const rect = stage.getBoundingClientRect()
            const tap = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1))
            raycaster.setFromCamera(tap, camera)
            const hit = raycaster.intersectObjects(planes.map((pl) => pl.mesh), false)[0]
            const idx = hit ? hit.object.userData.index : hovered
            if (idx == null || idx < 0) return
            const href = items[idx]?.link
            if (!href) return
            e.preventDefault()
            window.location.href = href
        }
        window.addEventListener("pointermove", onMove, { passive: true })
        stage.addEventListener("click", onClick)

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        let shownIndex = -1
        let scrambleStart = 0
        const setHud = (i: number, now: number) => {
            if (i === shownIndex) return
            shownIndex = i
            scrambleStart = now
            const it = items[i]
            if (indexRef.current) indexRef.current.textContent = String(i + 1).padStart(2, "0")
            if (metaRef.current) {
                const spans = metaRef.current.querySelectorAll("span[data-k]")
                const vals = [it.discipline, it.client, it.year]
                spans.forEach((s, k) => (s.textContent = vals[k] ?? ""))
            }
            if (titleRef.current) {
                titleRef.current.href = it.link || "#"
                titleRef.current.setAttribute("aria-label", it.title || "")
            }
            if (railRef.current) {
                Array.from(railRef.current.children).forEach((c, k) => {
                    const el = c as HTMLElement
                    el.style.background = k === i ? accent : `${ca(lineColor, 0.25)}`
                    el.style.transform = `scaleX(${k === i ? 1 : 0.45})`
                })
            }
            if (hudRef.current) {
                const right = !narrow && i % 2 === 1
                hudRef.current.style.left = narrow ? "6vw" : right ? "auto" : "6vw"
                hudRef.current.style.right = narrow ? "6vw" : right ? "6vw" : "auto"
                hudRef.current.style.alignItems = right ? "flex-end" : "flex-start"
                hudRef.current.style.textAlign = right ? "right" : "left"
            }
        }
        const runScramble = (now: number) => {
            const el = titleRef.current
            if (!el || shownIndex < 0) return
            const target = (items[shownIndex]?.title || "").toUpperCase()
            const k = reduced ? 1 : clamp01((now - scrambleStart) / 650)
            let out = ""
            for (let i = 0; i < target.length; i++) {
                const l = clamp01(k * 1.5 - (i / target.length) * 0.5)
                out += l >= 1 || target[i] === " " ? target[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
            }
            if (el.textContent !== out) el.textContent = out
        }

        let inView = true
        let raf = 0
        let prev = performance.now()
        const t0 = prev
        const io = new IntersectionObserver((entries) => {
            inView = entries[0]?.isIntersecting ?? true
            if (inView && !raf) {
                prev = performance.now()
                raf = requestAnimationFrame(frame)
            }
        })
        io.observe(root)

        let camZ = CAM_DIST
        let camX = 0
        let vel = 0

        const frame = (now: number) => {
            raf = 0
            if (disposed) return
            const dt = Math.min(0.05, (now - prev) / 1000)
            prev = now
            const time = (now - t0) / 1000

            const rr = root.getBoundingClientRect()
            const travel = Math.max(1, rr.height - window.innerHeight)
            const p = clamp01(-rr.top / travel)
            const f = p * (N - 1)
            const targetZ = CAM_DIST - f * SPACING
            const prevZ = camZ
            camZ += (targetZ - camZ) * Math.min(1, dt * (reduced ? 20 : 4.5))
            const v = Math.abs(camZ - prevZ) / Math.max(dt, 0.001)
            vel += (Math.min(v / 12, 1.4) - vel) * Math.min(1, dt * 5)

            const focusIdx = Math.min(N - 1, Math.max(0, Math.round((CAM_DIST - camZ) / SPACING)))
            setHud(focusIdx, now)
            runScramble(now)

            smoothPointer.x += (pointer.x - smoothPointer.x) * Math.min(1, dt * 3)
            smoothPointer.y += (pointer.y - smoothPointer.y) * Math.min(1, dt * 3)
            const focusPlane = planes[focusIdx]
            camX += ((narrow ? 0 : focusPlane.baseX * 0.18) - camX) * Math.min(1, dt * 3)
            camera.position.set(camX + smoothPointer.x * 0.35, smoothPointer.y * 0.22, camZ)
            camera.lookAt(camX * 0.6, 0, camZ - 10)
            camera.rotation.z = -smoothPointer.x * 0.02 + (narrow ? 0 : Math.sin(time * 0.3) * 0.004)

            raycaster.setFromCamera(pointer, camera)
            const hits = pointerInStage ? raycaster.intersectObjects(planes.map((pl) => pl.mesh), false) : []
            hovered = hits.length ? hits[0].object.userData.index : -1
            stage.style.cursor = hovered >= 0 ? "pointer" : "default"

            planes.forEach((pl, i) => {
                const dz = camZ - pl.z
                const focus = clamp01(1 - Math.abs(dz - CAM_DIST) / (SPACING * 0.6))
                const fade = clamp01(1 - (dz - CAM_DIST) / (SPACING * 3.2)) * clamp01(dz / 1.2)
                pl.hover += ((hovered === i ? 1 : 0) - pl.hover) * Math.min(1, dt * 6)
                const u = pl.mat.uniforms
                u.uFocus.value = focus
                u.uFade.value = fade
                u.uVel.value = reduced ? 0 : vel
                u.uHover.value = pl.hover
                u.uTime.value = time
                pl.mesh.rotation.y = (narrow ? 0 : (pl.baseX > 0 ? -1 : 1) * 0.18) * (1 - focus)
                pl.mesh.visible = dz > 0.2
            })

            const len = 0.15 + vel * 2.4
            for (let i = 0; i < STREAKS; i++) {
                const s = streakSeed[i]
                if (s.z > camZ + 2) s.z -= depth
                if (s.z < camZ - 34) s.z += depth
                const o = i * 6
                streakPos[o] = s.x
                streakPos[o + 1] = s.y
                streakPos[o + 2] = s.z
                streakPos[o + 3] = s.x
                streakPos[o + 4] = s.y
                streakPos[o + 5] = s.z + len
            }
            streakGeo.attributes.position.needsUpdate = true
            streakMat.opacity = 0.18 + Math.min(vel, 1) * 0.6

            renderer.render(scene, camera)
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
            ro.disconnect()
            io.disconnect()
            window.removeEventListener("pointermove", onMove)
            stage.removeEventListener("click", onClick)
            document.removeEventListener("visibilitychange", onVis)
            planes.forEach((pl) => {
                pl.mat.uniforms.uTex.value?.dispose?.()
                pl.mat.dispose()
            })
            planeGeo.dispose()
            frameGeo.dispose()
            frameMat.dispose()
            streakGeo.dispose()
            streakMat.dispose()
            renderer.dispose()
        }
    }, [themeKey, items, background, lineColor, accent, suit])

    const mono: CSSProperties = { fontFamily: MONO_STACK, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: lineColor }
    const first = items[0]

    return (
        <div ref={rootRef} style={{ ...style, position: "relative", width: "100%", height: rootHeight }}>
            <div ref={stageRef} style={{ position: "sticky", top: 0, width: "100%", height: "100vh", maxHeight: "100%", overflow: "hidden", background }}>
                <style>{`
                    @media (max-width: 809.98px) {
                        .ae-mt-meta { flex-direction: column; row-gap: 6px !important; }
                        .ae-mt-meta .ae-mt-sep { display: none; }
                    }
                `}</style>
                <canvas ref={canvasRef} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
                <div aria-hidden="true" style={{ position: "absolute", left: 0, right: 0, top: 0, height: "max(140px, 16%)", background: `linear-gradient(${ca(background, 0.94)}, ${ca(background, 0)})`, pointerEvents: "none" }} />
                <div ref={railRef} aria-hidden="true" style={{ position: "absolute", right: "2.4vw", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, pointerEvents: "none" }}>
                    {items.map((_, i) => (
                        <span key={i} style={{ display: "block", height: 2, width: 22, transformOrigin: "right", transform: `scaleX(${i === 0 ? 1 : 0.45})`, background: i === 0 ? accent : `${ca(lineColor, 0.25)}`, transition: "transform 0.4s ease, background 0.4s ease" }} />
                    ))}
                </div>
                <div ref={hudRef} style={{ position: "absolute", left: "6vw", bottom: "9vh", display: "flex", flexDirection: "column", gap: 14, maxWidth: "min(88vw, 640px)", alignItems: "flex-start" }}>
                    <div ref={indexRef} style={{ fontFamily: displayFamily, fontVariationSettings: '"opsz" 72', fontWeight: displayWeight, fontSize: "clamp(56px, 9vw, 150px)", lineHeight: 0.8, color: "transparent", WebkitTextStroke: `1px ${accent}` }}>
                        01
                    </div>
                    <a ref={titleRef} href={first?.link || "#"} aria-label={first?.title || undefined} style={{ fontFamily: displayFamily, fontVariationSettings: '"opsz" 72', fontWeight: displayWeight, fontSize: "clamp(40px, 5.6vw, 96px)", lineHeight: 0.9, color: lineColor, textDecoration: "none", letterSpacing: "0.01em" }}>
                        {(first?.title || "").toUpperCase()}
                    </a>
                    <div ref={metaRef} className="ae-mt-meta" style={{ ...mono, display: "flex", columnGap: 18, rowGap: 8, flexWrap: "wrap", opacity: 0.75 }}>
                        <span data-k="0">{first?.discipline}</span>
                        <span style={{ display: "flex", gap: 18, whiteSpace: "nowrap" }}>
                            <span aria-hidden="true" className="ae-mt-sep" style={{ color: accent }}>/</span>
                            <span data-k="1">{first?.client}</span>
                        </span>
                        <span style={{ display: "flex", gap: 18, whiteSpace: "nowrap" }}>
                            <span aria-hidden="true" className="ae-mt-sep" style={{ color: accent }}>/</span>
                            <span data-k="2">{first?.year}</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
