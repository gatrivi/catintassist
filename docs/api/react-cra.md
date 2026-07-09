# React — Create React App (not Vite)

## Official
- React: https://react.dev/
- CRA / `react-scripts`: this app uses `react-scripts` scripts in `package.json`

## This repo scripts
```bash
npm start          # react-scripts start
npm test           # react-scripts test --watchAll=false
npm run build      # scripts/build-with-local-temp.js
```
- **No** `npm run lint` script — ESLint via CRA (`eslintConfig` extends `react-app`)
- **No** Vite (`vite.config.*` absent)

## Agent rules
- Do not suggest Vite-only APIs (`import.meta.env` Vite shape) without checking
- Prefer existing hooks/components; no new state libraries unless asked
