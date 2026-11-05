import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const root = new URL('../', import.meta.url)
const toModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const compile = async path => ts.transpileModule(await readFile(new URL(path, root), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const typesUrl = toModule(await compile('src/types/heroSlider.ts'))
const utilsUrl = toModule((await compile('src/utils/heroSlider.ts')).replace('../types/heroSlider', typesUrl))
const { validateHeroSlide, normalizeHeroSlider, reorderHeroSlides, isSafeHeroLink, heroPositionStyle } = await import(utilsUrl)
const valid = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', image_url: 'https://example.invalid/a.jpg', title: 'Safari', pre_title: '', subtitle: '', button_text: 'Explore', button_url: '/tours', text_position: 'bottom-right', sort_order: 0, is_active: true }

test('admin and public share the same normalization and validation contract', async () => {
  const publicSource = await readFile(new URL('../top-cloud-rwenzori-adventures/src/utils/heroSlider.ts', root), 'utf8')
  assert.equal(publicSource.replace(/\r\n/g, '\n'), (await readFile(new URL('src/utils/heroSlider.ts', root), 'utf8')).replace(/\r\n/g, '\n'))
})
test('CTA links reject script, protocol-relative, and disguised external URLs', () => {
  for (const value of ['javascript:alert(1)', '//evil.invalid', '/\\evil.invalid', '\nhttps://example.invalid', 'data:text/html,abc']) assert.equal(isSafeHeroLink(value), false)
  for (const value of ['/tours', '/', '#inquiry', 'https://example.invalid/tours', 'mailto:safaris@example.invalid', 'tel:+256747558826']) assert.equal(isSafeHeroLink(value), true)
})
test('required content and paired optional CTA are validated', () => {
  assert.equal(validateHeroSlide(valid), null)
  assert.ok(validateHeroSlide({ ...valid, image_url: '' }))
  assert.ok(validateHeroSlide({ ...valid, title: '  ' }))
  assert.ok(validateHeroSlide({ ...valid, button_url: '' }))
  assert.equal(validateHeroSlide({ ...valid, button_text: '', button_url: '' }), null)
  assert.ok(validateHeroSlide({ ...valid, title: 'a'.repeat(181) }))
})
test('all nine positions are accepted; corrupt records and duplicate IDs are isolated', () => {
  for (const position of ['top-left','top-center','top-right','center-left','center','center-right','bottom-left','bottom-center','bottom-right']) assert.equal(validateHeroSlide({ ...valid, text_position: position }), null)
  const result = normalizeHeroSlider({ slides: [null, {}, { ...valid, sort_order: 3 }, valid, { ...valid, id: 'second', sort_order: 1, is_active: false }], autoplay: false, duration_seconds: 10 })
  assert.deepEqual(result.slides.map(s => s.id), ['second', valid.id])
  assert.equal(result.slides[0].is_active, false)
  assert.equal(result.autoplay, false)
  assert.equal(result.duration_seconds, 10)
  assert.deepEqual(normalizeHeroSlider(null), { slides: [], autoplay: true, duration_seconds: 5 })
  assert.equal(normalizeHeroSlider({ duration_seconds: -1 }).duration_seconds, 5)
})
test('reorder changes array order and contiguous sort positions without changing IDs', () => {
  const slides = [valid, { ...valid, id: 'second', sort_order: 1 }]
  const moved = reorderHeroSlides(slides, 1, -1)
  assert.deepEqual(moved.map(s => [s.id,s.sort_order]), [['second',0],[valid.id,1]])
  assert.equal(slides[0].id, valid.id)
  assert.deepEqual(reorderHeroSlides(slides, 0, -1), slides)
})
test('preview and public positioning cover every vertical and horizontal preset', () => {
  const positions = ['top-left','top-center','top-right','center-left','center','center-right','bottom-left','bottom-center','bottom-right']
  const vertical = ['flex-start', 'center', 'flex-end']
  const horizontal = ['flex-start', 'center', 'flex-end']
  for (let i = 0; i < positions.length; i++) {
    const style = heroPositionStyle(positions[i])
    assert.equal(style.justifyContent, vertical[Math.floor(i / 3)])
    assert.equal(style.alignItems, horizontal[i % 3])
  }
})

const calls = { uploads: [], removed: [], rpc: [] }
let rows = []
let nextRows = []
let rpcError = null
globalThis.__heroClient = {
  from: () => ({ select: async () => ({ data: rows, error: null }) }),
  rpc: async (name, args) => {
    calls.rpc.push({ name, args })
    if (name === 'is_hero_slider_admin') return { data: true, error: null }
    if (name === 'get_hero_slider_editor_state') return { data: {}, error: null }
    if (!rpcError) rows = nextRows
    return { data: { page_key: 'home' }, error: rpcError }
  },
  storage: { from: name => ({
    upload: async (path, file) => { calls.uploads.push({ name, path, file }); return { error: null } },
    getPublicUrl: path => ({ data: { publicUrl: `https://example.invalid/storage/v1/object/public/${name}/${path}` } }),
    remove: async paths => { calls.removed.push(...paths); return { error: null } },
  }) },
}
const clientUrl = toModule('export const supabase = globalThis.__heroClient')
const serviceUrl = toModule((await compile('src/services/heroSliderService.ts')).replace('../lib/supabaseClient',clientUrl).replace('../utils/heroSlider',utilsUrl))
const { uploadHeroImage, saveHomepageWithHero, getHeroSliderEditorState } = await import(serviceUrl)
test('authorized dashboard admins can access the editor', async () => {
  assert.equal((await getHeroSliderEditorState()).allowed, true)
  assert.deepEqual(calls.rpc.slice(-2).map(call => call.name), ['is_hero_slider_admin', 'get_hero_slider_editor_state'])
})
test('images upload to Storage and only their URL is persisted', async () => {
  await assert.rejects(uploadHeroImage(new File(['x'], 'bad.svg', { type: 'image/svg+xml' })))
  const url = await uploadHeroImage(new File(['image-content'], 'hero.jpg', { type: 'image/jpeg' }))
  assert.equal(calls.uploads.length, 1)
  assert.equal(calls.uploads[0].name, 'hero-slides')
  assert.match(calls.uploads[0].path, /^home\/[a-f0-9-]+\.jpg$/)
  assert.match(url, /^https:\/\//)
  nextRows = [{ image_url: url }]
  await saveHomepageWithHero({ heroSlider: { slides: [{ ...valid, image_url: url }], autoplay: true, duration_seconds: 5 } }, false)
  assert.equal(calls.rpc.at(-1).args.p_publish, false)
  assert.equal(calls.rpc.at(-1).args.p_content.heroSlider.slides[0].image_url, url)
  assert.equal(calls.removed.length, 0)
})
test('replacing a draft retains images used by the published snapshot', async () => {
  const oldUrl = rows[0].image_url
  nextRows = [{ image_url: oldUrl }, { image_url: valid.image_url }]
  await saveHomepageWithHero({ heroSlider: { slides: [valid], autoplay: true, duration_seconds: 5 } }, false)
  assert.equal(calls.removed.length, 0)
  nextRows = [{ image_url: valid.image_url }]
  await saveHomepageWithHero({ heroSlider: { slides: [valid], autoplay: true, duration_seconds: 5 } }, true)
  assert.equal(calls.removed.length, 1)
  assert.equal(calls.rpc.at(-1).args.p_publish, true)
})
test('a failed save never removes files and exposes a friendly error', async () => {
  rpcError = { message: 'private database diagnostic' }
  const previous = calls.removed.length
  await assert.rejects(saveHomepageWithHero({ heroSlider: { slides: [valid], autoplay: true, duration_seconds: 5 } }, true), error => !error.message.includes('private database diagnostic'))
  assert.equal(calls.removed.length, previous)
})
