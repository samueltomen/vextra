# Vextra UI V1 - Evidence

Prototype UI local, sans backend réel. Les captures ont été réalisées avec
Chrome headless sur Vite :

- dashboard desktop `1440x900` ;
- dashboard mobile `390x844` ;
- dashboard loading, empty et error ;
- formulaire de création desktop et mobile ;
- succès de création avec token affiché une fois ;
- détail d'un moniteur en retard.

Le mode `?state=loading|empty|error` du dashboard est limité au développement et
aux tests. Il permet de vérifier les états sans ajouter de faux états au backend.
