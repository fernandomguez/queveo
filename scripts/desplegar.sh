#!/usr/bin/env bash
# Despliega la app en GitHub Pages (rama gh-pages).
# Uso: npm run deploy -- "mensaje del despliegue"
# Hazlo desde la rama main, con todo comiteado.
set -euo pipefail
cd "$(dirname "$0")/.."

mensaje="${1:-actualización}"

[ -f src/environments/environment.ts ] || {
  echo "Falta src/environments/environment.ts: copia environment.example.ts y pon tu clave de TMDB."
  exit 1
}
[ -z "$(git status --porcelain --untracked-files=no)" ] || {
  echo "Hay cambios sin comitear. Comitea antes de desplegar."
  exit 1
}

# MSYS_NO_PATHCONV evita que Git Bash convierta /queveo/ en una ruta de Windows.
MSYS_NO_PATHCONV=1 npx ng build --base-href=/queveo/
salida=dist/apiPelis/browser

# Las fuentes salen con ruta absoluta (/fonts/...): en Pages cuelgan de /queveo/.
sed -i 's#url(/fonts/#url(fonts/#g' "$salida"/styles-*.css

# La rama gh-pages se prepara en una carpeta temporal para no tocar tu proyecto.
git fetch -q origin gh-pages
temporal="$(mktemp -d)"
git worktree add -q --detach "$temporal" origin/gh-pages
trap 'git worktree remove --force "$temporal" 2>/dev/null || true; git worktree prune 2>/dev/null || true' EXIT

find "$temporal" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r "$salida"/. "$temporal"/

cd "$temporal"
git add -A
if git diff --cached --quiet; then
  echo "No hay nada nuevo que desplegar."
  exit 0
fi
git commit -q -m "deploy: $mensaje"
git push origin HEAD:gh-pages
echo "Desplegado: https://fernandomguez.github.io/queveo/ (tarda un minuto en actualizarse)"
