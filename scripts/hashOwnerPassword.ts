import { createPasswordHash } from '../api/_lib/security'

const password = process.argv[2]
if (!password) throw new Error('Usage: npx tsx scripts/hashOwnerPassword.ts <password>')

console.log(createPasswordHash(password))
