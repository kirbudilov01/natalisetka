const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function getStats() {
  const res = await fetch(`${API}/stats`)
  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}

export async function getEconomy() {
  const res = await fetch(`${API}/economy`)
  if (!res.ok) throw new Error('Failed to fetch economy')
  return res.json()
}

export async function generateConcept(
  characterId: number,
  format: string,
  videoCount: number,
) {
  const res = await fetch(`${API}/generate-concept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      character_id: characterId,
      format,
      video_count: videoCount,
    }),
  })
  if (!res.ok) throw new Error('Failed to generate concept')
  return res.json() as Promise<{ prompts: Array<{ scene: string; pose: string }> }>
}

export async function generateVideos(
  characterId: number,
  format: string,
  videoCount: number,
  prompts: Array<{ scene: string; pose: string }>,
  chatId: string | null,
) {
  const res = await fetch(`${API}/generate-videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      character_id: characterId,
      format,
      video_count: videoCount,
      prompts,
      chat_id: chatId,
    }),
  })
  if (!res.ok) throw new Error('Failed to submit job')
  return res.json() as Promise<{ job_id: string; estimated_cost_usd: number }>
}

export async function getJob(jobId: string) {
  const res = await fetch(`${API}/job/${jobId}`)
  if (!res.ok) throw new Error('Failed to fetch job')
  return res.json()
}

export async function listAccesses() {
  const res = await fetch(`${API}/accesses`)
  if (!res.ok) throw new Error('Failed to fetch accesses')
  return res.json()
}

export async function createAccess(input: {
  service_name: string
  account_login: string
  password: string
  notes?: string
}) {
  const res = await fetch(`${API}/accesses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create access')
  return res.json()
}

export async function revealAccess(id: string) {
  const res = await fetch(`${API}/accesses/${id}/reveal`)
  if (!res.ok) throw new Error('Failed to reveal access')
  return res.json()
}

export async function deleteAccess(id: string) {
  const res = await fetch(`${API}/accesses/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete access')
  return res.json()
}

export async function listJobs(chatId?: string | null) {
  const url = chatId ? `${API}/jobs?chat_id=${encodeURIComponent(chatId)}` : `${API}/jobs`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch jobs')
  return res.json()
}

export async function getBalance() {
  const res = await fetch(`${API}/balance`)
  if (!res.ok) throw new Error('Failed to fetch balance')
  return res.json() as Promise<{ usd_remaining: number; label: string }>
}
