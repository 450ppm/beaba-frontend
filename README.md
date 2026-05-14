# Beaba — Frontend

> Interface React du kit de monitoring [Beaba](https://github.com/450ppm/beaba-backend).
>
> **[beaba.450ppm.be](https://beaba.450ppm.be)** — projet citoyen porté par [450ppm](https://450ppm.be).

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Vite](https://img.shields.io/badge/build-vite-646cff.svg)](https://vite.dev)
[![Backend](https://img.shields.io/badge/backend-beaba--backend-339933.svg)](https://github.com/450ppm/beaba-backend)

React + Vite. Déployé sur Cloudflare Pages, communique avec le backend Node.js [beaba-backend](https://github.com/450ppm/beaba-backend) via API REST cross-domain.

---

## Aperçu

- **Dashboard** bento avec 6 KPIs (puissance instantanée, conso jour/semaine, appareils actifs, température moyenne, météo extérieure, CO₂ atmosphérique vs seuil Paris 450 ppm).
- **Carte du logement** — graphe force-directed (react-force-graph-2d) montrant le foyer → pièces → prises → appareils.
- **Confort & condensation** — diagramme psychrométrique SVG custom : positions des pièces dans le plan T°/HR, courbes de risque de condensation et moisissure dérivées de la météo extérieure courante, simulateur interactif.
- **Chaudière & ECS** — timeline avec cycles détectés colorés en bandes, KPIs (durée moyenne, fréquence, score de sous-dimensionnement, surchauffes, pertes au repos), diagnostic textuel.
- **Setup wizard** pour démarrer une campagne pas à pas.
- **Rapport** de fin de campagne (lecture web + version imprimable).
- **Admin** pour gestion utilisateurs (rôle admin uniquement).

---

## Stack

| Brique | Choix |
|---|---|
| Framework | React 19 |
| Build | Vite 8 |
| Routing | react-router-dom |
| Charts | Recharts |
| Graphe | react-force-graph-2d |
| HTTP | axios |
| Auth | cookie JWT cross-domain (posé par le backend) |

Pas de TypeScript, pas de state-manager global lourd. Le contexte React (`AuthContext`, `CampaignContext`) suffit ; les composants gèrent leur état local + un hook `usePolling` léger pour les fetch périodiques.

---

## Démarrage rapide

```bash
git clone https://github.com/450ppm/beaba-frontend.git
cd beaba-frontend
npm install
echo "VITE_API_URL=https://api.beaba.450ppm.be" > .env.local
npm run dev      # http://localhost:5173
```

Pour pointer vers un backend local de dev :

```bash
echo "VITE_API_URL=http://localhost:3000" > .env.local
```

Cookies cross-domain : en dev local, le backend doit poser `sameSite=lax` (pas de `COOKIE_DOMAIN` set) — voir le backend pour le détail.

---

## Build de production

```bash
npm run build       # genere dist/
npm run preview     # serveur statique local pour verifier dist/
```

Sur **Cloudflare Pages** :
- Build command : `npm run build`
- Build output : `dist`
- Variable d'environnement : `VITE_API_URL=https://api.beaba.450ppm.be`

Chaque push sur `master` rebuild automatiquement.

### Piège connu : asset CSS qui répond 500 sur Cloudflare Pages

Symptôme : un déploiement marche bien, mais après un push, un fichier `index-XXXX.css` répond `HTTP 500` avec `Content-Length: 0` et `cf-cache-status: BYPASS`. Le JS du même build fonctionne.

Cause : l'asset s'est mal uploadé côté Pages, et tant que le content-hash reste le même, le re-déploiement réutilise le même fichier poisoned.

Solution : faire une vraie modification CSS (pas un commentaire, Vite les supprime à la minification) pour forcer un nouveau content-hash. Voir l'historique des commits `Force new CSS hash`.

---

## Structure

```
src/
├── App.jsx                    # routes React Router
├── api.js                     # axios instance + interceptor 401
├── context/
│   ├── AuthContext.jsx        # user, login, logout, refresh
│   └── CampaignContext.jsx    # campagne active du kit
├── hooks/
│   └── usePolling.js          # fetch periodique avec auto-refresh
├── lib/
│   ├── comfort.js             # mirror du modele physique backend
│   ├── weatherCodes.js        # WMO codes -> emoji + label
│   └── ...
├── components/
│   ├── Header.jsx             # logo + nom foyer + bouton logout
│   ├── CampaignBanner.jsx     # bandeau campagne
│   ├── DashboardCharts.jsx    # charts Electricite/Confort/Meteo
│   ├── CartoView.jsx          # graphe force-directed
│   ├── ComfortChart.jsx       # diagramme psychrometrique SVG
│   ├── KpiCard.jsx            # carte KPI generique
│   ├── ApplianceList.jsx
│   ├── SensorList.jsx
│   ├── RoomCard.jsx
│   ├── PlugDetailModal.jsx
│   ├── DateNav.jsx            # navigation jour/semaine/mois
│   └── ...
├── pages/
│   ├── LandingPage.jsx
│   ├── LoginPage.jsx
│   ├── Dashboard.jsx
│   ├── ComfortPage.jsx
│   ├── ChaudierePage.jsx
│   ├── SetupWizard.jsx
│   ├── NewCampaignPage.jsx
│   ├── MeterReadingsPage.jsx
│   ├── ReportPage.jsx
│   ├── ReportPrintPage.jsx
│   └── AdminPage.jsx
└── index.css                  # styles globaux (theme sombre)
```

---

## Design system

Pas de framework UI, pas de Tailwind. CSS modules informels (un `.css` par composant) + variables CSS pour les couleurs d'accent dans `KpiCard.css` :

| Accent | Couleur | Usage |
|---|---|---|
| `--accent-orange` | `#f59e0b` | Électricité, chaudière |
| `--accent-blue` | `#3b82f6` | Température |
| `--accent-green` | `#10b981` | Confort OK |
| `--accent-red` | `#ef4444` | Alarme, sur-seuil |
| `--accent-cyan` | `#06b6d4` | Météo, confort & condensation |

Fond global : `#0d0d1a` (très sombre, légèrement bleuté).

---

## Contribuer

Issues et PRs bienvenues. Lire [`CONTRIBUTING.md`](CONTRIBUTING.md). Pour les changements multi-repos (backend + frontend), ouvrir des PRs miroirs dans chaque dépôt avec un lien croisé dans la description.

---

## Licence

[AGPL-3.0](LICENSE) — cohérent avec le backend pour préserver l'ouverture de tout dérivé servi via le réseau.
