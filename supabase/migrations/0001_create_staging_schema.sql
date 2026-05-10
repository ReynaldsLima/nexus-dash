-- Phase 0: Create staging schema for non-prod testing
-- Both prod (public) and staging schemas share the same auth.users table.
-- Test users should use a test- prefix on email (e.g., test-admin@wrdigitalgroup.com.br)
-- to distinguish them from prod users at the application level.

CREATE SCHEMA IF NOT EXISTS staging;

GRANT USAGE ON SCHEMA staging TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA staging GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
