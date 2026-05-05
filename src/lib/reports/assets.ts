import { existsSync, readFileSync } from 'fs'
import path from 'path'
import type { ReportAssets } from '@/components/reports/pdf/types'

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

export function loadPublicAssetAsDataUri(relativePath: string) {
  try {
    const normalizedPath = relativePath.replace(/^\/+/, '')
    const filePath = path.join(process.cwd(), 'public', normalizedPath)

    if (!existsSync(filePath)) return null

    const extension = path.extname(filePath).toLowerCase()
    const mimeType = MIME_BY_EXTENSION[extension]
    if (!mimeType) return null

    const file = readFileSync(filePath)
    return `data:${mimeType};base64,${file.toString('base64')}`
  } catch {
    return null
  }
}

export function loadReportAssets(): ReportAssets {
  return {
    logoWhite: loadPublicAssetAsDataUri('brand/faus/faus-logo-white.png'),
    logoBlack: loadPublicAssetAsDataUri('brand/faus/faus-logo-black.png'),
  }
}
