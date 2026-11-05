import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost } from '../../top-cloud-rwenzori-adventures/functions/api/contact.js'
import { onRequestPost as importReviews } from '../functions/api/fetch-tripadvisor-reviews.js'

const env = { SUPABASE_URL: 'https://topcloud-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }
const request = body => new Request('https://example.invalid/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const inquiry = { formType: 'inquiry', fullName: 'Test Visitor', email: 'visitor@example.invalid', phone: '+256 747 558826', message: 'Safari question' }

test('inquiries persist without privileged keys; notification configuration is optional', async () => {
  const previous = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 201 }) }
  try {
    const response = await onRequestPost({ request: request(inquiry), env })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).saved, true)
    assert.equal(calls.length, 1)
    const payload = JSON.parse(calls[0].init.body)
    assert.equal(payload.type, 'inquiry')
    assert.equal(payload.email, inquiry.email)
    assert.ok(!('status' in payload))
    assert.ok(!('Authorization' in calls[0].init.headers))
  } finally { globalThis.fetch = previous }
})

test('database failure is never reported as a successful booking or inquiry', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response(null, { status: 403 })
  try {
    assert.equal((await onRequestPost({ request: request(inquiry), env })).status, 502)
    assert.equal((await onRequestPost({ request: request(inquiry), env: {} })).status, 503)
    assert.equal((await onRequestPost({ request: request({ ...inquiry, formType: 'invalid' }), env })).status, 400)
  } finally { globalThis.fetch = previous }
})

test('review importer rejects unsigned requests before any upstream fetch', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('Must not fetch') }
  try { assert.equal((await importReviews({ request: request({ url: 'https://www.tripadvisor.com/Attraction_Review-test' }), env })).status, 403) }
  finally { globalThis.fetch = previous }
})
