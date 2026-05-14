# Contribuer au frontend Beaba

Cette page complète le [guide de contribution principal](https://github.com/450ppm/beaba-backend/blob/master/CONTRIBUTING.md). Les règles générales (style commit, code de conduite, sécurité, licence AGPL) y sont décrites.

## Setup dev

```bash
npm install
echo "VITE_API_URL=http://localhost:3000" > .env.local   # ou ton API distante
npm run dev
```

## Conventions spécifiques au frontend

- **Pas de TypeScript** pour l'instant, garder JS pur.
- **Pas de framework UI** (pas de Tailwind, pas de MUI). On garde des CSS modules informels (un `.css` par composant).
- **Variables CSS d'accent** (`--accent-orange`, etc.) — voir `src/components/KpiCard.css`.
- **Fond sombre** (`#0d0d1a`) cohérent partout. Cartes en glass-morphism (`background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12-16px; backdrop-filter: blur(...)`).
- **Pas d'animations gratuites** : transitions courtes (~150-200 ms) pour les hovers, c'est tout.
- **Mobile-friendly** : tester chaque page en largeur 360px minimum. Le bento du dashboard collapse à 1 colonne en dessous de 1024px.

## Tester un changement UI

- Vérifier que les cartes restent alignées (le bento utilise `align: stretch` de CSS Grid pour homogénéiser les hauteurs).
- Tester avec une campagne `setup`, `active`, `completed` — chaque état rend une page différente.
- Tester avec et sans capteurs configurés (les empty states sont importants).
- Tester avec une vue temporelle sur le passé (DateNav) pour valider que les pages ne plantent pas sans live data.

## Bonnes idées d'amélioration

- **Tests Vitest + Testing Library** sur les composants critiques (KpiCard, DateNav, ComfortChart).
- **Internationalisation** (aujourd'hui tout est en français hardcodé).
- **Accessibilité** : audit complet (lecteur d'écran, contraste WCAG AA, navigation clavier).
- **Mode clair** : option utilisateur. Aujourd'hui c'est tout en sombre.
- **PWA** : manifest + service worker pour installation sur le téléphone du ménage.
- **Skeleton loaders** pendant les fetch initiaux plutôt que des "—" qui clignotent.

## Licence

Toute contribution est publiée sous **AGPL-3.0**.
