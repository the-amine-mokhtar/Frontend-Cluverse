# Training du modèle de scoring

Ce dossier contient le pipeline d'entraînement du modèle ML de scoring oral.

## Données attendues

Placez un ou plusieurs fichiers CSV dans `training/data/` avec ces colonnes:

- `speech_rate`
- `pitch_variation`
- `filler_rate`
- `energy_level`
- `pause_count`
- `score`

`score` est la cible annotée manuellement (0-100).

## Lancer l'entraînement

```bash
python training/train_scorer.py
```

Le script:

- charge tous les CSV de `training/data/`
- entraîne une pipeline `StandardScaler + RandomForestRegressor`
- évalue avec MAE et R²
- sauvegarde le modèle dans `app/models/scorer.pkl`

## Notes

- Plus vos annotations sont cohérentes, plus le modèle sera stable.
- Commencez avec au moins 200 échantillons pour une première base exploitable.
- Réentraînez après chaque lot significatif de nouvelles sessions annotées.
