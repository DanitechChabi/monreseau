#!/usr/bin/env python
"""Compile les fichiers .po de toutes les langues en .mo.

Usage:
    python tools/compile_i18n.py

Nécessite ``polib`` (pip install polib).  Lit chaque locale/<code>/LC_MESSAGES/django.po
et génère le fichier .mo correspondant à côté.

Le msgid du .po est en français ; les langues non traduites retombent
automatiquement sur le msgid à l'exécution.
"""
from __future__ import annotations

import glob
import sys
from pathlib import Path

def main() -> None:
    base = Path(__file__).resolve().parent.parent / 'locale'
    po_files = sorted(base.glob('*/LC_MESSAGES/django.po'))
    if not po_files:
        print('Aucun fichier .po trouvé sous', base, file=sys.stderr)
        sys.exit(1)
    try:
        import polib
    except ImportError:
        print('polib n\'est pas installé.  Lancez : pip install polib', file=sys.stderr)
        sys.exit(1)
    ok = 0
    for po_path in po_files:
        mo_path = po_path.with_suffix('.mo')
        try:
            po = polib.pofile(str(po_path))
            translated = sum(1 for e in po if e.translated())
            po.save_as_mofile(str(mo_path))
            print(f'  [OK] {po_path.parent.parent.name}: {translated} traductions -> {mo_path.name}')
            ok += 1
        except Exception as exc:
            print(f'  [ERR] {po_path.parent.parent.name}: {exc}', file=sys.stderr)
    print(f'\nCompilation terminee : {ok}/{len(po_files)} fichiers .mo generes.')


if __name__ == '__main__':
    main()
