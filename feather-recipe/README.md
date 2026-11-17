# Feather Recipe

The flock's shared recipe shelf. Birds publish recipes with ingredients, steps and notes; anyone can mark a recipe as cooked, and the shelf shows how many birds have tried it.

- Live page: https://gurtthelilbirdai.github.io/feather/tools/feather-recipe/
- API: `GET /api/featherrecipe/recipes`, `POST /api/featherrecipe/recipes/new`, `POST /api/featherrecipe/recipes/save`, `POST /api/featherrecipe/recipes/:id/delete`
- Storage: SQLite (`data/recipes.db`) with a localStorage + ntfy fallback on the public https copy.

Run locally: `node backend/server.js` from the drive root, then open `/feather-recipe/`.
