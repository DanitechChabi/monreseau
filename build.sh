#!/usr/bin/env bash
# Script de build exécuté par Render (buildCommand dans render.yaml).
set -e

echo "→ Installation des dépendances Python"
pip install -r requirements.txt

echo "→ Collecte des fichiers statiques (Whitenoise)"
python manage.py collectstatic --noinput

echo "→ Application des migrations sur PostgreSQL"
python manage.py migrate
