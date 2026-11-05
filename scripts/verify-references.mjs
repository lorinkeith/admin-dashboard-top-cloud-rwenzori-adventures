import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const expected = JSON.parse(await readFile(new URL('../verification/reference-hashes.json', import.meta.url), 'utf8'))
const excluded = new Set(['.git', 'node_modules', 'dist', 'build', '.vite', '.wrangler', 'coverage', '__pycache__'])
async function list(directory, prefix = '') {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue
    const relative = prefix + entry.name
    if (entry.isDirectory()) files.push(...await list(new URL(entry.name + '/', directory), relative + '/'))
    else if (entry.isFile()) files.push(relative)
  }
  return files
}
let checked = 0
let pathDifferences = 0
for (const [folder, hashes] of Object.entries(expected)) {
  const directory = new URL(folder + '/', root)
  const normalized = Object.fromEntries(Object.entries(hashes).map(([name, hash]) => [name.replaceAll('\\', '/'), hash]))
  const files = await list(directory)
  const actual = {}
  for (const name of files) actual[name] = createHash('sha256').update(await readFile(new URL(encodeURI(name), directory))).digest('hex')
  const added = files.filter(name => !(name in normalized))
  for (const [name, hash] of Object.entries(normalized)) {
    if (!(name in actual)) {
      const renamed = added.find(candidate => actual[candidate] === hash)
      if (!renamed) throw new Error(`${folder}/${name}: reference file missing`)
      console.warn(`Reference path difference (identical bytes): ${folder}/${name} -> ${renamed}`)
      pathDifferences++
      checked++
      continue
    }
    if (actual[name] !== hash) throw new Error(`${folder}/${name}: reference file changed`)
    checked++
  }
  for (const name of added) if (!Object.values(normalized).includes(actual[name])) throw new Error(`${folder}/${name}: unexpected new reference file`)
}
console.log(`Verified ${checked} reference file contents unchanged; ${pathDifferences} path differences. Generated directories and Git metadata excluded.`)
if (pathDifferences) process.exitCode = 1
