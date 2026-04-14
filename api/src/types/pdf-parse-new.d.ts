declare module 'pdf-parse-new' {
  interface PdfData {
    numpages: number
    numrender: number
    info?: Record<string, unknown>
    metadata?: Record<string, unknown>
    text: string
    version?: string
  }
  function pdfParse(buffer: Buffer): Promise<PdfData>
  export = pdfParse
}
