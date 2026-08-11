# ADR: investor database platform boundaries

- Status: Accepted
- Date: 2026-08-11
- Resolves: #2

## Context

`investor` now has two PostgreSQL-backed data planes that were introduced independently:

- `market_data`: point-in-time rates / FX observations, provenance and derivation lineage
- `company_intelligence`: company, filing, financial fact, raw document, reconciliation and provenance data

Both already have schema-specific smoke tests. What was missing was one repository-level contract proving that both schemas can be materialized into the same `investor` database without object-name collisions or initialization-order coupling.

PostgreSQL explicitly supports multiple named schemas inside one database and recommends schemas as a way to organize objects into logical groups. Objects can share the same unqualified name when they live in different schemas. See the PostgreSQL 18 documentation: https://www.postgresql.org/docs/18/ddl-schemas.html

## Decision

1. The canonical database name remains `investor`.
2. Market time-series data remains under the explicitly qualified `market_data` schema.
3. Company / filing / financial intelligence remains under the explicitly qualified `company_intelligence` schema.
4. Each data plane owns its own source, ingestion, provenance and lineage tables; a new shared table is not introduced merely to remove similarly named concepts.
5. SQL and services must continue to use schema-qualified canonical objects where the data plane matters.
6. A repository-level CI contract materializes both schemas into one PostgreSQL instance, reapplies both initialization paths, and runs both existing smoke suites on the combined database.
7. A future cross-plane physical relation or shared canonical entity requires an explicit migration and ADR rather than an implicit dependency through `search_path`.

## Why this boundary

The two planes have different grain and revision semantics:

- `market_data.observation` is keyed by series, observation date and revision and records calculated/interpolated/proxy lineage between observations.
- `company_intelligence.fact` preserves filing/XBRL context, units, dimensions and revisions and records lineage between financial facts.

Keeping those meanings in separate schemas prevents similarly named objects such as `source` and `ingestion_run` from becoming an accidental shared abstraction. PostgreSQL schema qualification provides the namespace boundary while allowing both planes to be queried in one database when an analysis needs them together.

## Mechanical acceptance contract

`.github/workflows/database-platform-contract.yml` must pass on changes to either database plane or this ADR. It:

1. starts one PostgreSQL 18.4 service database named `investor`;
2. applies `market_data` schema, seed and views;
3. applies `company_intelligence` schema, views and seeds;
4. repeats both initialization paths to verify repository-level idempotency;
5. runs both existing SQL smoke suites against the same database;
6. verifies both schemas and representative canonical tables coexist in that one database.

A green plane-specific workflow alone is therefore no longer sufficient evidence for database-platform compatibility; the combined contract is the cross-plane gate.
