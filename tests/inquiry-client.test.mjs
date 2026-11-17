import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = (await readFile(new URL('../../top-cloud-rwenzori-adventures/src/utils/formSubmission.ts', import.meta.url), 'utf8'))
  .replace('import.meta.env.VITE_CONTACT_API_URL', "''")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const load = fetch => {
  const exports = {}
  new Function('fetch', 'exports', compiled)(fetch, exports)
  return exports.submitContactForm
}
const inquiry = { formType: 'inquiry', fullName: 'Test Visitor', email: 'visitor@example.invalid', phone: '0000000000', message: 'Safari question' }

test('both forms use the contact endpoint so database saving and email run together', async () => {
  const records = []
  const submit = load(async (url, init) => {
    assert.equal(url, '/api/contact')
    assert.equal(init.method, 'POST')
    records.push(JSON.parse(init.body))
    return Response.json({ saved: true, notificationSent: true, message: 'Received' })
  })
  assert.equal((await submit(inquiry)).saved, true)
  await submit({ ...inquiry, formType: 'booking' })
  assert.deepEqual(records.map(record => record.formType), ['inquiry', 'booking'])
})

test('inquiries validate fields and failures remain visible', async () => {
  let calls = 0
  const submit = load(async () => { calls++; return Response.json({ message: 'Could not save' }, { status: 502 }) })
  for (const invalid of [{ email: 'invalid' }, { message: '' }, { message: 'x'.repeat(501) }, { phone: '' }, { fullName: 'x'.repeat(201) }]) {
    await assert.rejects(submit({ ...inquiry, ...invalid }), /Please enter/)
  }
  assert.equal(calls, 0)
  await assert.rejects(submit(inquiry), /Could not save/)
  await assert.rejects(load(async () => new Response('<html>SPA fallback</html>'))(inquiry), /invalid response/)
  const result = await load(async () => Response.json({ saved: true, notificationSent: false, message: 'Saved for our team' }))(inquiry)
  assert.equal(result.notificationSent, false)
})
