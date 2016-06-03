# medic-analytics
Software for creating read-only replicas of CouchDB data inside PostgreSQL v9.4

The focus is on Medic Mobile data currently stored in CouchDB, but applications
might extend beyond that.

## Required Environment Variables

Environment Variables will be used for configuration. A number of variables
are required.

* `POSTGRESQL_URL`: a URL used by pg libs to connect to postgres.
  * tcp: `postgres://user:password@site:port/dbname`
  * unix domain socket: e.g. `postgres:///dbname?host=/var/run/postgresql`
  * parameters: e.g. `postgres://localhost/dbname?client_encoding=UTF8`
* `COUCHDB_URL`: a full path URL to the couchdb database, with any required credentials.
  * e.g. `https://user:pass@localhost/medic`
* `COUCH2PG_SLEEP_MINS`: number of minutes between checking for updates.

Optional variables:

* `COUCH2PG_DOC_LIMIT`: number of documents to grab concurrently. Defaults to 100. Increasing this number will cut down on HTTP GETs and may improve performance, decreasing this number will cut down on node memory usage, and may increase stability.
* `COUCH2PG_DEBUG`: returns more debug output from the xmlforms module.

## Required database setup

We support PostgreSQL 9.4 and greater. The user passed in the postgres url needs to have full creation rights on the given database.

### `read_only` role

While not required for this software, it is assumed for some use cases that
there is also a `read_only` role. In such a case, `full_access` should be set
so that `read_only` is granted read access. While logged in as `full_access`,
or using `SET ROLE full_access;`, this can be done with the following:

```
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO full_access;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO read_only;
```

`full_access` should also be able to read anything `read_only` can read. While
logged in as `read_only` or using `SET ROLE read_only;`, access can be granted
with `GRANT read_only TO full_access;`.

### `no_delete` role and `static` schema

Again, while not required for this software, it is assumed for some use cases
that `no_delete` will be used to maintain datasets that should be immutable
by this adapter and the `full_access` user. This utilizes a schema called
`static`.

Create the `no_delete` role, create the `static` schema, expose the `static`
schema to other roles, and then set `no_delete` default permissions:
```
CREATE ROLE no_delete;
CREATE SCHEMA static;
GRANT USAGE, CREATE ON SCHEMA static TO no_delete;
GRANT USAGE ON SCHEMA static TO read_only;
SET ROLE no_delete;
ALTER DEFAULT PRIVILEGES IN SCHEMA static GRANT ALL ON TABLES TO no_delete;
ALTER DEFAULT PRIVILEGES IN SCHEMA static GRANT SELECT ON TABLES TO read_only;
RESET ROLE;
```

Here, anything created by `no_delete` is readable by `read_only` (and thus
`full_access`), meanwhile `full_access` has no write ability in the `static`
schema.

## Running tests

Some environment variables that may be required for the integration tests to run correctly:
 * `INT_PG_HOST`: postgres host, defaults to `localhost`
 * `INT_PG_PORT`: postgres port, defaults to `5432` 
 * `INT_PG_USER`: postgres user, defaults to none (system default). This user must be able to create databases on the given host.
 * `INT_PG_PASS`: user's password, defaults to none (system default)
 * `INT_PG_DB`: test databse to use, defaults to `medic-analytics-test`
 * `INT_COUCHDB_URL`: url to test couchdb, defaults to `http://admin:pass@localhost:5894/medic-analytics-test`. The user must have the ability to destory and create databases on that host.

You may be able to get away with not setting any of these, or only needing to set some of these depending on your development environment.

NB: the integration tests destroy and re-create the given databases each time they are run. Use test databases.

TODO: see if this is still relevant: https://github.com/medic/medic-analytics/issues/15

## Example usage

Run `node index`

## Common problems

### Cannot read property 'version'

```
[TypeError: Cannot read property 'version' of undefined]
```

This error is normal when first running the import process. It means that the
design document, which contains the version in Kanso, has not yet been imported
and so the XML Forms and Contacts code cannot determine whether or not it
should run.

If this software is in use with a system that isn't using Kanso, the error will
never go away. It might be annoying but it will not adversely affect
performance.

## couch2pg

Moves couch data into postgres.

### Example usage

Run `node libs/couch2pg/mainloop`.

### Process

1. Ensure Postgres has jsonb storage location ready.
1. All record UUIDs are taken in from CouchDB using GET `_all_docs` and `include_docs=false`
1. Fetched UUIDs are compared against existing records in Postgres.
1. Missing docs are taken in from CouchDB using POST `_all_docs` and `include_docs=true`.
1. Fetched docs are iterated into distinct JSON objects.
1. Each JSON object is added to Postgres as jsonb.

## xmlforms

Create table representations of OpenRosa/XForms data in PostgreSQL.

### Example usage

Run `node libs/xmlforms/main`.

### Process

1. contacts
  1. Make sure version is either 0.6 or 2.6.
  1. Determine if contacts have been generated.
  1. If version .6 and contacts missing, create contacts framework.
1. form reports
  1. Make sure there's a place for metadata storage (and index it)
  1. Fetch contents of reports in Couch table which don't already have metadata in the system.
  1. Parse common features from reports.
  1. Create `formview_` tables to store each version of each form if they are missing.
  1. Write form report meta data.
  1. Write form reports out to the correct `formview_` tables.
1. materialized views
  1. refresh them!
