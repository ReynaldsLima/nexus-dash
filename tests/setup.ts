import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env.test.local') })

if (!process.env.SUPABASE_TEST_URL) {
  console.warn('[tests/setup] SUPABASE_TEST_URL not set — RLS integration tests will be skipped')
}
if (!process.env.SUPABASE_TEST_SERVICE_KEY) {
  console.warn('[tests/setup] SUPABASE_TEST_SERVICE_KEY not set — RLS integration tests will be skipped')
}
