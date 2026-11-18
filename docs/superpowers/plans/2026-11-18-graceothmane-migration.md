# graceothmane.com — Migration Framer → Astro/Netlify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Reproduire à l'identique le site Framer « GRACE OTHMANE » en site Astro statique sur Netlify (graceothmane.com), avec admin Decap CMS.

**Architecture:** Astro (sortie statique), les pages lisent des collections de contenu (`src/content/*`). Les 9 composants code Framer sont portés en îlots React. Le contenu est éditable par Decap (`public/admin`, backend GitHub) et par Claude.

**Tech Stack:** Astro 5, @astrojs/react, framer-motion (déjà utilisé par les composants Framer), Decap CMS, Netlify Forms.

**Spec:** `docs/design.md`

## Global Constraints
- Breakpoints : Desktop ≥ 1200px, Tablet 810–1199.98px, Phone ≤ 809.98px.
- Tokens couleur exacts : Background rgb(7,8,10) · Surface rgb(14,16,19) · Surface Raised rgb(21,24,28) · Line rgba(237,237,240,.12) · Line Strong .26 · Outline .33 · High rgb(237,237,240) · Mid .66 · Low .5 · Accent rgb(255,90,31) · On Accent rgb(7,8,10) · Signal rgb(49,168,255) · Nav Glass rgba(11,11,12,.82). Thème ivoire = valeurs du snippet `ruah-theme`.
- Polices : Big Shoulders, Switzer, Inter, JetBrains Mono (auto-hébergées).
- Textes copiés mot pour mot depuis Framer ; aucune reformulation.
- SEO : title « ruah studio — Grace Othmane, graphiste designer », description identique, favicon/OG identiques.
- Routes : `/`, `/work`, `/work/[slug]`, `/about`, `/contact`, `/404`.

## Review Focus
1. Mode ivoire choisi puis rechargement → le thème persiste sans flash (try/catch sur localStorage).
2. `prefers-reduced-motion` → animations coupées comme dans Framer (`reducedMotion: true`).
3. Envoi d'un formulaire sans JS / avec un champ vide requis → validation HTML, page de succès Netlify.
4. Projet ajouté via l'admin sans image galerie → la page projet se construit sans erreur.
5. Mobile 390px → aucun débordement horizontal (titres géants « OUVRONS LE DOSSIER »).

---

### Task 1: Extraction Framer
**Files:** Create `scripts/framer-dump/*.json`, `public/assets/**`
- [ ] Exporter via le connecteur Framer : arbre sérialisé de chaque page et du layout « Site », composants canvas, sources des 9 fichiers code, CustomCodeNodes, items des collections Projects/Experience/Testimonials/Documents.
- [ ] Télécharger toutes les images et le CV (framerusercontent.com) dans `public/assets/`.
- [ ] Vérif : chaque URL d'asset référencée dans les dumps existe en local.

### Task 2: Squelette Astro + design tokens + layout
**Files:** `package.json`, `astro.config.mjs`, `src/styles/tokens.css`, `src/layouts/Site.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`, `public/fonts/*`
- [ ] Layout = nav (logo mascotte + RUAH STUDIO, Travaux/À propos/Contact, toggle thème) + slot + footer « Signal ».
- [ ] Vérif : `npm run build` OK ; capture 1440/810/390 comparée à la page 404 Framer.

### Task 3: Contenu (collections Astro) + admin Decap
**Files:** `src/content.config.ts`, `src/content/projects/*.md`, `src/content/experience/*.json`, `src/content/testimonials/*.json`, `public/cv/*`, `public/admin/index.html`, `public/admin/config.yml`
- [ ] Schémas = champs Framer (Projects : title, client, year, discipline, summary, role, duration, cover, imageWide, imageTall, imageClosing, overview (md), outcome, sortOrder, fileNo, galerie[]).
- [ ] Decap : backend `github`, repo `ruahcommunication-cell/grace-othmane`, branche `main`, media `public/assets/uploads`.
- [ ] Vérif : build OK avec un projet sans galerie (Review Focus 4).

### Task 4: Pages
**Files:** `src/pages/index.astro`, `work/index.astro`, `work/[slug].astro`, `about.astro`, `contact.astro`, `404.astro`
- [ ] Reproduire chaque section depuis les dumps (tailles, espacements, couleurs exactes).
- [ ] Formulaires `data-netlify="true"`, champs identiques (Contact, RDV) + honeypot.
- [ ] Vérif : captures côte à côte avec Framer aux 3 largeurs ; pas de scroll horizontal à 390px (RF 5).

### Task 5: Animations (îlots React) + code personnalisé
**Files:** `src/fx/*.tsx` (AlterEgoReveal, MissionTunnel, HoloImage, NativeFX, PowerRadar, SmoothScroll, SuitUpFX, SignalHeadline, ThemeToggle), `src/components/Mascotte.astro`
- [ ] Porter chaque fichier : retirer `addPropertyControls`/imports `framer`, garder la logique.
- [ ] ThemeToggle : classe `ruah-ivory` sur `<html>`, script inline anti-flash (RF 1).
- [ ] Reduced motion respecté (RF 2). Widget ElevenLabs + mascotte repris tels quels.
- [ ] Vérif : visuel identique, pas d'erreur console.

### Task 6: Déploiement
- [ ] Push sur `ruahcommunication-cell/grace-othmane`, site Netlify connecté, notifications de formulaires vers ruahcommunication@gmail.com.
- [ ] DNS OVH → Netlify, HTTPS, domaine graceothmane.com.
- [ ] Vérif finale : site en ligne, formulaires reçus, `/admin` connecté.
