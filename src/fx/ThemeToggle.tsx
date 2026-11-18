// Porté depuis Framer : ThemeToggle.tsx — bouton soleil / lune (nuit ↔ ivoire)
import { useEffect, useState } from "react"
import { T } from "./shared"

const KEY = "ruah-theme"

export default function ThemeToggle() {
    const [ivory, setIvory] = useState(false)
    useEffect(() => {
        const read = () => setIvory(document.documentElement.classList.contains("ruah-ivory"))
        read()
        window.addEventListener("ruah-theme", read)
        return () => window.removeEventListener("ruah-theme", read)
    }, [])
    const toggle = () => {
        const next = !ivory
        const el = document.documentElement
        el.classList.add("ruah-theme-anim")
        el.classList.toggle("ruah-ivory", next)
        try {
            localStorage.setItem(KEY, next ? "ivory" : "dark")
        } catch (e) {}
        window.dispatchEvent(new Event("ruah-theme"))
        window.setTimeout(() => el.classList.remove("ruah-theme-anim"), 600)
    }
    const icon = { position: "absolute", inset: 0, margin: "auto", transition: "transform .5s cubic-bezier(.16,1,.3,1), opacity .3s ease" } as const
    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={ivory}
            title={ivory ? "Mode sombre" : "Mode clair ivoire"}
            aria-label={ivory ? "Passer en mode sombre" : "Passer en mode clair ivoire"}
            style={{ position: "relative", width: 36, height: 36, padding: 0, borderRadius: 999, border: `1px solid ${T.lineStrong}`, background: "transparent", color: T.high, cursor: "pointer", overflow: "hidden", flexShrink: 0 }}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ ...icon, opacity: ivory ? 0 : 1, transform: ivory ? "rotate(-90deg) scale(.5)" : "none" }}>
                <circle cx="12" cy="12" r="4.2" />
                <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ ...icon, opacity: ivory ? 1 : 0, transform: ivory ? "none" : "rotate(90deg) scale(.5)" }}>
                <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
            </svg>
        </button>
    )
}
