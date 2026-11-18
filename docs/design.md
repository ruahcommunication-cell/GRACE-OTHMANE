# graceothmane.com — Design (18/11/2026)

## Intention
Quitter Framer, dont l'hébergement est trop limité, sans rien perdre : reproduire **exactement** le portfolio Framer « GRACE OTHMANE » (projet pCma6D2z9Srbox6uHg6j) en site codé, hébergé gratuitement sur Netlify, sous le domaine **graceothmane.com**.

## Objectifs
- Rendu identique au site Framer : pages, textes, images, couleurs, polices, animations, mode clair (ivoire) / sombre, mascotte + assistant vocal ElevenLabs.
- Responsive identique : Desktop ≥ 1200 px, Tablette 810–1199 px, Mobile < 810 px.
- Contenu modifiable de deux façons : (1) Grace via un espace admin `/admin` ; (2) Claude, en éditant directement les fichiers.
- Formulaires Contact et RDV fonctionnels, messages reçus par e-mail.

## Non-objectifs
- Pas de refonte, pas de nouveau contenu, pas de nouvelles sections.

## Anti-objectifs
- Un site qui « ressemble » au Framer sans être identique.
- Un site plus lent ou moins fluide que le Framer.
- Un admin trop complexe pour être utilisé sans aide.

## Approches envisagées
1. **Mises à jour par Claude seulement** : simple, mais Grace dépend de Claude pour chaque changement.
2. **Espace admin (Decap CMS)** : Grace reste autonome, comme avec le CMS Framer.
→ **Choix de Grace : les deux.** Le contenu vit dans des fichiers du dépôt : l'admin les édite, Claude aussi.

## Décisions techniques (choix de Claude)
- **Astro** (site statique, très rapide) + îlots **React**, pour porter fidèlement les 9 composants code Framer (AlterEgoReveal, MissionTunnel, HoloImage, NativeFX, PowerRadar, SmoothScroll, SuitUpFX, SignalHeadline, ThemeToggle).
- **Contenu** dans des fichiers Markdown/JSON : Projets (13), Expériences (10), Avis clients (5), Documents (CV). Ce sont les mêmes champs que les collections Framer.
- **Images et CV** téléchargés depuis Framer et stockés dans le dépôt.
- **Polices** auto-hébergées : Big Shoulders, Switzer (Fontshare), Inter, JetBrains Mono.
- **Formulaires** : Netlify Forms (gratuit, notification par e-mail).
- **Admin** : Decap CMS, connexion via GitHub.
- **Code personnalisé repris** : thème ivoire, widget ElevenLabs (agent_0901m7mtrw35fbns35zjprj5x8nz), mascotte « ruah-mascotte ».
- **Métadonnées SEO**, favicon et image de partage repris à l'identique.

## Ce que Grace doit faire
- Créer un compte GitHub et un compte Netlify (gratuits).
- Acheter graceothmane.com (~12–15 €/an).
- Garder le site Framer en ligne jusqu'à validation du nouveau site.

## Laissé au constructeur
- Détails de portage des animations, structure des dossiers, configuration de Decap.
- Vérification visuelle page par page, en comparant aux captures du site Framer.
