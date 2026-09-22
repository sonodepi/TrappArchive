#!/bin/bash
# Stampa in faccia a ogni sessione lo stato del progetto, prima che scriva
# una riga di codice.
#
# Esiste per un difetto vero, non per completezza: una sessione e' partita da
# `main` e ha riscritto da zero una cosa che su un altro branch era gia' fatta,
# perche' l'orchestratore che le ha dato l'hand-off sapeva del branch giusto e
# non gliel'ha detto. Una regola scritta in CLAUDE.md dipende dalla buona
# volonta' di chi legge; questo no: lo esegue l'harness.
#
# Non fallisce mai la sessione. Niente `set -e`: se la rete non c'e' o git
# risponde male, si stampa quel che si puo' e si va avanti.

set -uo pipefail

PROGETTO="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$PROGETTO" 2>/dev/null || exit 0
# Non `[ -d .git ]`: dentro un worktree git .git e' un FILE, non una
# cartella, e il controllo sbagliato faceva uscire l'hook in silenzio
# proprio dove serve di piu' — un worktree per agente e' come lavora
# un ufficio di agenti in parallelo.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# La rete puo' non esserci (aereo, treno, PC scollegato): si prova, e se non
# risponde entro 20 secondi si continua con quello che c'e' in locale.
if command -v timeout >/dev/null 2>&1; then
  timeout 20 git fetch --all --prune --quiet 2>/dev/null
else
  git fetch --all --prune --quiet 2>/dev/null
fi

RAMO=$(git branch --show-current 2>/dev/null)

echo "=== TrappArchive: dove siamo ==="
echo "Cartella: $PROGETTO"
echo "Branch:   ${RAMO:-(nessuno, sei su un commit staccato)}"
echo

echo "--- Branch remoti, dal piu' recente ---"
# origin/HEAD si accorcia in "origin", quindi un grep su "origin/HEAD" non lo
# prende: si filtra sul refname intero.
git for-each-ref --sort=-committerdate refs/remotes/origin \
  --format='%(refname);%(refname:short);%(committerdate:relative);%(contents:subject)' \
  2>/dev/null \
  | grep -v '^refs/remotes/origin/HEAD;' \
  | head -12 \
  | while IFS=';' read -r _intero corto quando oggetto; do
      printf '  %-44s %-14s %s\n' "$corto" "$quando" "$oggetto"
    done
echo

# Il confronto che conta: il branch su cui mi hanno messo e' indietro rispetto
# a `main`? Se si', c'e' del lavoro che non sto vedendo.
if [ -n "$RAMO" ] && git rev-parse --verify --quiet origin/main >/dev/null; then
  LETTURA=$(git rev-list --left-right --count origin/main...HEAD 2>/dev/null)
  INDIETRO=$(echo "$LETTURA" | cut -f1)
  AVANTI=$(echo "$LETTURA" | cut -f2)
  if [ "${INDIETRO:-0}" -gt 0 ] 2>/dev/null; then
    echo "!!! Questo branch e' INDIETRO di $INDIETRO commit rispetto a origin/main"
    echo "    (e avanti di ${AVANTI:-0})."
    echo "    Regola 1 di CLAUDE.md: fermati e dillo all'utente prima di"
    echo "    riscrivere qualcosa che su un altro branch e' gia' fatto."
    echo
  fi
fi

if [ -f docs/registro/IN_CORSO.md ]; then
  echo "--- Chi sta lavorando su cosa (docs/registro/IN_CORSO.md) ---"
  cat docs/registro/IN_CORSO.md
  echo
fi

echo "--- Da leggere prima di toccare il codice ---"
echo "CLAUDE.md, docs/STATO_E_PROSSIMO_PASSO.md, docs/AUDIT.md"
echo "Skill del progetto: .claude/skills/ (vincono sulle skill generiche)"
echo "==============================="

# Le dipendenze si installano solo nei contenitori in cloud, che partono da un
# clone vuoto a ogni sessione. Sul PC dell'utente node_modules c'e' gia', e un
# npm install a ogni apertura sarebbe solo attesa.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ ! -d node_modules ]; then
  echo
  echo "Contenitore in cloud senza node_modules: installo le dipendenze."
  npm install --no-audit --no-fund 2>&1 | tail -3
fi

exit 0
