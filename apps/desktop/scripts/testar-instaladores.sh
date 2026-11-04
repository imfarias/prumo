#!/usr/bin/env bash
# CT-X03, CT-X04 e CT-X05: instala o .deb, confere o .desktop e o ícone, roda --verificar-instalacao (xvfb),
# remove e confere; roda o .AppImage sem instalar.
# Uso: bash testar-instaladores.sh <pasta-com-os-instaladores>
set -euo pipefail
PASTA="$1"
LIMITE_MB=150
falhar() { echo "FALHOU: $*"; exit 1; }

DEB=$(realpath "$(ls "$PASTA"/prumo_*_amd64.deb | head -n1)")  # apt só trata caminho absoluto ou ./ como arquivo
APPIMAGE=$(realpath "$(ls "$PASTA"/Prumo-*.AppImage | head -n1)")
for f in "$DEB" "$APPIMAGE"; do
  mb=$(( $(stat -c %s "$f") / 1048576 ))
  echo "$(basename "$f"): ${mb} MB"
  [ "$mb" -lt "$LIMITE_MB" ] || falhar "$(basename "$f") tem ${mb} MB (limite ${LIMITE_MB})"
done

command -v xvfb-run >/dev/null || sudo apt-get install -y xvfb

verificar() {
  local rotulo="$1"; shift
  local saida="/tmp/verificacao-$rotulo.txt"
  rm -f "$saida"
  xvfb-run -a "$@" "--verificar-instalacao=$saida" || falhar "$rotulo --verificar-instalacao saiu com erro: $(cat "$saida" 2>/dev/null)"
  grep -q '^ok ' "$saida" || falhar "$rotulo: $(cat "$saida")"
  echo "$rotulo verificado: $(cat "$saida")"
}

# --- .deb ---
sudo apt-get install -y "$DEB"
[ -x /opt/Prumo/prumo ] || falhar '/opt/Prumo/prumo ausente'
DESKTOP=/usr/share/applications/prumo.desktop
[ -f "$DESKTOP" ] || falhar "$DESKTOP ausente"
grep -q '^MimeType=.*inode/directory' "$DESKTOP" || falhar 'MimeType=inode/directory ausente no .desktop'
grep -q '^Icon=prumo' "$DESKTOP" || falhar 'ícone ausente no .desktop'
ls /usr/share/icons/hicolor/*/apps/prumo.png >/dev/null 2>&1 || falhar 'ícone não instalado'
verificar deb /opt/Prumo/prumo
sudo apt-get remove -y prumo
[ ! -e /opt/Prumo/prumo ] || falhar '.deb: /opt/Prumo/prumo ficou'
[ ! -e "$DESKTOP" ] || falhar '.deb: .desktop ficou'
echo '.deb: instalar, verificar e remover ok'

# --- .AppImage ---
chmod +x "$APPIMAGE"
verificar appimage "$APPIMAGE" --appimage-extract-and-run --no-sandbox
echo '.AppImage: verificar ok'
