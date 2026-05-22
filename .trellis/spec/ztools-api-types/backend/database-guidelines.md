# Database Guidelines

> Current database reality for `ztools-api-types`.

There is no backend database layer for this package in the current repo.

Rules:

- Do not add LMDB, SQLite, or other runtime persistence logic under this package in this repo.
- Treat this package as synchronized type/package output only.
- If future work requires persistence, document it only after the package gains real local source code.
