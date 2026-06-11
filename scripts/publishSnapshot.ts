import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { publicSnapshotSchema } from '../src/schemas/publicSnapshot'

const inputPath = process.argv[2]

if (!inputPath) {
  throw new Error('Usage: npm run snapshot:publish -- <export-file>')
}

const input = JSON.parse(await readFile(resolve(inputPath), 'utf8')) as unknown
const snapshot = publicSnapshotSchema.parse(input)
const destination = resolve('public/data/snapshot.json')

await writeFile(destination, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`Published sanitized snapshot to ${destination}`)
