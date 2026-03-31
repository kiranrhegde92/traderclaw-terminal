import { NextRequest, NextResponse } from 'next/server'
import { parseExcel, parsePDF }      from '@/lib/data/upload-parser'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file     = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const name   = file.name.toLowerCase()

    let result
    if (name.endsWith('.pdf')) {
      result = await parsePDF(buffer)
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      result = parseExcel(buffer)
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use .xlsx, .xls, .csv, or .pdf' }, { status: 400 })
    }

    return NextResponse.json({ data: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
