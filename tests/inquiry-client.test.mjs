import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = (await readFile(new URL('../../top-cloud-rwenzori-adventures/src/utils/formSubmission.ts', import.meta.url), 'utf8'))
  .replace("import { supabase } from '../lib/supabaseClient'", '')
  .replace('import.meta.env.VITE_CONTACT_API_URL', "''")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const load = client => {
  const exports = {}
  new Function('supabase', 'exports', compiled)(client, exports)
  return exports.submitContactForm
}
const inquiry = { formType: 'inquiry', fullName: ' Test Visitor ', email: ' VISITOR@example.invalid ', phone: ' 0000000000 ', message: ' Safari question ' }

test('contact inquiries save directly without email/server availability or public read permission', async () => {
  const records = []
  const submit = load({ from(table) {
    assert.equal(table, 'form_submissions')
    return { async insert(record) { records.push(record); return { error: null } } }
  } })
  assert.equal((await submit({ ...inquiry, status: 'processed', type: 'booking', id: 'forged' })).saved, true)
  assert.deepEqual(records, [{ type: 'inquiry', full_name: 'Test Visitor', email: 'visitor@example.invalid', phone: '0000000000', message: 'Safari question', raw_payload: {} }])
})

test('inquiries reject invalid fields before inserting and never report database failures as success', async () => {
  let calls = 0
  const submit = load({ from() { return { async insert() { calls++; return { error: { message: 'Denied' } } } } } })
  for (const invalid of [{ email: 'invalid' }, { message: '' }, { message: 'x'.repeat(501) }, { phone: '' }, { fullName: 'x'.repeat(201) }]) {
    await assert.rejects(submit({ ...inquiry, ...invalid }), /Please enter/)
  }
  assert.equal(calls, 0)
  await assert.rejects(submit(inquiry), /could not be saved/)
  assert.equal(calls, 1)
  await assert.rejects(load(null)(inquiry), /not configured/)
})
