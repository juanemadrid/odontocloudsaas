import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

function parseEnv(text) {
  const values = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

function requireValue(value, name) {
  if (!value) throw new Error(`Missing required setting: ${name}`)
  return value
}

function checksum(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function objectToken(bucket, name) {
  return checksum(Buffer.from(`${bucket}/${name}`)).slice(0, 12)
}

async function listFiles(client, bucket, prefix = '') {
  const files = []
  const pageSize = 1000

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`Unable to list bucket ${bucket}: ${error.message}`)

    for (const entry of data ?? []) {
      const fullName = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id) {
        files.push({ name: fullName, metadata: entry.metadata ?? {} })
      } else {
        files.push(...(await listFiles(client, bucket, fullName)))
      }
    }

    if (!data || data.length < pageSize) break
  }

  return files
}

const localEnv = parseEnv(await readFile('.env', 'utf8'))
const sourceUrl = requireValue(localEnv.VITE_SUPABASE_URL, 'VITE_SUPABASE_URL')
const sourceKey = requireValue(
  localEnv.SUPABASE_SERVICE_KEY || localEnv.VITE_SUPABASE_SERVICE_KEY,
  'SUPABASE_SERVICE_KEY',
)
const targetUrl = requireValue(process.env.TARGET_SUPABASE_URL, 'TARGET_SUPABASE_URL')
const targetKey = requireValue(
  process.env.TARGET_SUPABASE_SERVICE_KEY,
  'TARGET_SUPABASE_SERVICE_KEY',
)

const clientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
}
const source = createClient(sourceUrl, sourceKey, clientOptions)
const target = createClient(targetUrl, targetKey, clientOptions)

const { data: sourceBuckets, error: sourceBucketsError } = await source.storage.listBuckets()
if (sourceBucketsError) throw new Error(`Unable to list source buckets: ${sourceBucketsError.message}`)

const { data: targetBuckets, error: targetBucketsError } = await target.storage.listBuckets()
if (targetBucketsError) throw new Error(`Unable to list target buckets: ${targetBucketsError.message}`)

const targetBucketIds = new Set((targetBuckets ?? []).map((bucket) => bucket.id))
for (const bucket of sourceBuckets ?? []) {
  if (targetBucketIds.has(bucket.id)) continue
  const { error } = await target.storage.createBucket(bucket.id, {
    public: bucket.public,
    fileSizeLimit: bucket.file_size_limit ?? undefined,
    allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
  })
  if (error) throw new Error(`Unable to create target bucket ${bucket.id}: ${error.message}`)
}

let copiedFiles = 0
let copiedBytes = 0

for (const bucket of sourceBuckets ?? []) {
  const files = await listFiles(source, bucket.id)
  console.log(`Bucket ${bucket.id}: ${files.length} objects`)

  for (const file of files) {
    const token = objectToken(bucket.id, file.name)
    const { data: sourceBlob, error: downloadError } = await source.storage
      .from(bucket.id)
      .download(file.name)
    if (downloadError) throw new Error(`Source download failed for object ${token}: ${downloadError.message}`)

    const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer())
    const sourceChecksum = checksum(sourceBuffer)
    const { error: uploadError } = await target.storage.from(bucket.id).upload(file.name, sourceBuffer, {
      upsert: true,
      contentType: file.metadata.mimetype || file.metadata.contentType || 'application/octet-stream',
      cacheControl: file.metadata.cacheControl || '3600',
    })
    if (uploadError) throw new Error(`Target upload failed for object ${token}: ${uploadError.message}`)

    const { data: targetBlob, error: verifyError } = await target.storage
      .from(bucket.id)
      .download(file.name)
    if (verifyError) throw new Error(`Target verification failed for object ${token}: ${verifyError.message}`)

    const targetBuffer = Buffer.from(await targetBlob.arrayBuffer())
    if (sourceChecksum !== checksum(targetBuffer)) {
      throw new Error(`Checksum mismatch for object ${token}`)
    }

    copiedFiles += 1
    copiedBytes += sourceBuffer.length
  }
}

console.log(`Migration verified: ${copiedFiles} objects, ${copiedBytes} bytes`)
