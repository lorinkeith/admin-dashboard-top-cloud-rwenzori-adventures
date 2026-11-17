import test from 'node:test'
import assert from 'node:assert/strict'
import nodemailer from '../../top-cloud-rwenzori-adventures/node_modules/nodemailer/dist/esm/nodemailer.js'
import { getSmtpConfig } from '../../top-cloud-rwenzori-adventures/server/smtp.js'
import { onRequestPost } from '../../top-cloud-rwenzori-adventures/functions/api/contact.js'

const env = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SMTP_HOST: 'smtp.example.invalid',
  SMTP_PORT: '587',
  SMTP_USER: 'info@example.invalid',
  SMTP_PASSWORD: 'test&#x33;*#*',
  SMTP_FROM_EMAIL: 'Top Cloud Tours <info@example.invalid>',
  CONTACT_RECIPIENT_EMAILS: 'info@example.invalid',
}
const inquiry = { formType: 'inquiry', fullName: 'Visitor', email: 'visitor@example.invalid', phone: '123', message: '<script>hello</script>' }
const booking = { ...inquiry, formType: 'booking', selectedTour: 'Rwenzori', country: 'Uganda', travelDate: '2027-01-10', adults: 2, children: 1, notes: 'Window seat' }
const request = body => new Request('https://example.invalid/api/contact', { method: 'POST', body: JSON.stringify(body) })

test('configured Resend sends both forms even when SMTP credentials are present', async () => {
  const originalFetch = globalThis.fetch
  const originalTransport = nodemailer.createTransport
  const messages = []
  const order = []
  const resendEnv = { ...env, RESEND_API_KEY: 're_test', RESEND_FROM_EMAIL: 'Top Cloud Tours <info@topcloudtours.com>' }
  nodemailer.createTransport = () => { assert.fail('Resend configuration must bypass SMTP') }
  globalThis.fetch = async (url, init) => {
    if (url === 'https://api.resend.com/emails') {
      order.push('email')
      assert.equal(init.headers.Authorization, 'Bearer re_test')
      messages.push(JSON.parse(init.body))
      return Response.json({ id: 'test-message-id' })
    }
    assert.ok(url.endsWith('/rest/v1/form_submissions'))
    order.push('save')
    return new Response(null, { status: 201 })
  }
  try {
    for (const body of [inquiry, booking]) {
      const response = await onRequestPost({ request: request(body), env: resendEnv })
      assert.equal((await response.json()).notificationSent, true)
    }
    assert.deepEqual(order, ['save', 'email', 'save', 'email'])
    for (const message of messages) {
      assert.equal(message.from, 'Top Cloud Rwenzori Adventures <info@topcloudtours.com>')
      assert.deepEqual(message.to, [env.CONTACT_RECIPIENT_EMAILS])
      assert.equal(message.reply_to, inquiry.email)
    }
    assert.ok(messages[1].text.includes(booking.notes))
    await onRequestPost({ request: request(inquiry), env: { ...resendEnv, RESEND_FROM_EMAIL: 'Top Cloud Tours <onboarding@resend.dev>' } })
    assert.ok(messages[2].from.endsWith('<info@topcloudtours.com>'))
  } finally {
    globalThis.fetch = originalFetch
    nodemailer.createTransport = originalTransport
  }
})

test('Resend rejection preserves the saved request and does not start a second delivery', async () => {
  const originalFetch = globalThis.fetch
  const originalTransport = nodemailer.createTransport
  nodemailer.createTransport = () => { assert.fail('A Resend failure must not start SMTP delivery') }
  globalThis.fetch = async url => url === 'https://api.resend.com/emails'
    ? Response.json({ message: 'Private provider details' }, { status: 403 })
    : new Response(null, { status: 201 })
  try {
    const response = await onRequestPost({ request: request(inquiry), env: { ...env, RESEND_API_KEY: 're_test' } })
    const result = await response.json()
    assert.equal(result.saved, true)
    assert.equal(result.notificationSent, false)
    assert.ok(!JSON.stringify(result).includes('Private provider details'))
  } finally {
    globalThis.fetch = originalFetch
    nodemailer.createTransport = originalTransport
  }
})

test('SMTP preserves literal passwords and configures encrypted ports and recipients', () => {
  const config = getSmtpConfig(env)
  assert.equal(config.options.auth.pass, env.SMTP_PASSWORD)
  assert.equal(config.options.secure, false)
  assert.equal(config.options.requireTLS, true)
  assert.deepEqual(config.to, [env.CONTACT_RECIPIENT_EMAILS])
  assert.equal(config.from, env.SMTP_FROM_EMAIL)
  assert.equal(getSmtpConfig({ ...env, SMTP_PORT: '465' }).options.secure, true)
  assert.equal(getSmtpConfig({ ...env, CONTACT_RECIPIENT_EMAILS: 'one@example.invalid,two@example.invalid' }).to.length, 2)
  for (const change of [{ SMTP_PASSWORD: '' }, { SMTP_PORT: 'invalid' }, { SMTP_FROM_EMAIL: 'bad' }, { CONTACT_RECIPIENT_EMAILS: 'invalid' }]) {
    assert.throws(() => getSmtpConfig({ ...env, ...change }))
  }
})

test('both submission types save before SMTP sends complete details to the business mailbox', async () => {
  const originalFetch = globalThis.fetch
  const originalTransport = nodemailer.createTransport
  const order = []
  const messages = []
  const records = []
  globalThis.fetch = async (_url, init) => {
    order.push('save')
    records.push(JSON.parse(init.body))
    return new Response(null, { status: 201 })
  }
  nodemailer.createTransport = options => {
    assert.equal(options.auth.pass, env.SMTP_PASSWORD)
    return {
      async sendMail(message) {
        order.push('email')
        messages.push(message)
        return { accepted: [env.CONTACT_RECIPIENT_EMAILS], rejected: [] }
      },
      close() {},
    }
  }
  try {
    for (const payload of [inquiry, booking]) {
      const response = await onRequestPost({ request: request(payload), env })
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { saved: true, notificationSent: true, message: 'Your request was received successfully. Our team will contact you shortly.' })
    }
    assert.deepEqual(order, ['save', 'email', 'save', 'email'])
    assert.deepEqual(records.map(record => record.type), ['inquiry', 'booking'])
    for (const message of messages) {
      assert.deepEqual(message.to, [env.CONTACT_RECIPIENT_EMAILS])
      assert.equal(message.replyTo, inquiry.email)
      assert.equal(message.from, env.SMTP_FROM_EMAIL)
      assert.ok(message.text.includes(inquiry.phone))
    }
    assert.ok(messages[0].html.includes('&lt;script&gt;'))
    assert.ok(messages[1].text.includes(booking.selectedTour))
    assert.ok(messages[1].text.includes(booking.notes))
  } finally {
    globalThis.fetch = originalFetch
    nodemailer.createTransport = originalTransport
  }
})

test('SMTP failure reports the saved submission and database failure prevents email', async () => {
  const originalFetch = globalThis.fetch
  const originalTransport = nodemailer.createTransport
  let sent = 0
  nodemailer.createTransport = () => ({ async sendMail() { sent++; throw Object.assign(new Error('provider details'), { code: 'EAUTH' }) }, close() {} })
  try {
    globalThis.fetch = async () => new Response(null, { status: 201 })
    const result = await (await onRequestPost({ request: request(inquiry), env })).json()
    assert.equal(result.saved, true)
    assert.equal(result.notificationSent, false)
    assert.ok(!JSON.stringify(result).includes('provider details'))
    globalThis.fetch = async () => new Response(null, { status: 403 })
    assert.equal((await onRequestPost({ request: request(booking), env })).status, 502)
    assert.equal(sent, 1)
  } finally {
    globalThis.fetch = originalFetch
    nodemailer.createTransport = originalTransport
  }
})
