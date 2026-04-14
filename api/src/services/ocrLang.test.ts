import { afterEach, describe, expect, it } from 'vitest'
import { resolveOcrLanguages } from './ocrLang.js'

describe('resolveOcrLanguages', () => {
  const prevLang = process.env.OCR_LANG
  const prevLangs = process.env.OCR_LANGS

  afterEach(() => {
    if (prevLang === undefined) delete process.env.OCR_LANG
    else process.env.OCR_LANG = prevLang
    if (prevLangs === undefined) delete process.env.OCR_LANGS
    else process.env.OCR_LANGS = prevLangs
  })

  it('defaults to eng', () => {
    delete process.env.OCR_LANG
    delete process.env.OCR_LANGS
    expect(resolveOcrLanguages()).toBe('eng')
  })

  it('uses OCR_LANG when valid', () => {
    delete process.env.OCR_LANGS
    process.env.OCR_LANG = 'fra'
    expect(resolveOcrLanguages()).toBe('fra')
  })

  it('falls back to eng when OCR_LANG is invalid', () => {
    delete process.env.OCR_LANGS
    process.env.OCR_LANG = 'not-a-code'
    expect(resolveOcrLanguages()).toBe('eng')
  })

  it('joins OCR_LANGS into tesseract multi-lang string', () => {
    delete process.env.OCR_LANG
    process.env.OCR_LANGS = 'eng, fra'
    expect(resolveOcrLanguages()).toBe('eng+fra')
  })
})
