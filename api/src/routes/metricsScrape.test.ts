import { afterEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import type { Server } from 'node:http'
import { AddressInfo } from 'node:net'

describe('metricsScrape route', () => {
  afterEach(() => {
    delete process.env.METRICS_SCRAPE_TOKEN
    vi.resetModules()
  })

  async function withServer(
    fn: (base: string) => Promise<void>
  ): Promise<void> {
    const { default: metricsScrapeRoutes } = await import('./metricsScrape.js')
    const app = express()
    app.use('/metrics', metricsScrapeRoutes)
    const server: Server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s))
    })
    try {
      const { port } = server.address() as AddressInfo
      await fn(`http://127.0.0.1:${port}`)
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    }
  }

  it('returns 404 when scrape token is unset', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/metrics`)
      expect(res.status).toBe(404)
    })
  })

  it('rejects bad token', async () => {
    process.env.METRICS_SCRAPE_TOKEN = 'secret-token'
    await withServer(async (base) => {
      const res = await fetch(`${base}/metrics`, {
        headers: { Authorization: 'Bearer wrong' },
      })
      expect(res.status).toBe(401)
    })
  })

  it('serves prometheus text with bearer token', async () => {
    process.env.METRICS_SCRAPE_TOKEN = 'secret-token'
    await withServer(async (base) => {
      const res = await fetch(`${base}/metrics`, {
        headers: { Authorization: 'Bearer secret-token' },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type') || '').toContain('text/plain')
      const text = await res.text()
      expect(text).toContain('brs_process_uptime_seconds')
    })
  })
})
