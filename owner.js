import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import fetch from 'node-fetch'
import { URL } from 'url'
import { getDirectoriesRecursive } from '../../toolkit/func.js'

export default async function on({ ev }) {
  ev.on({
    cmd: ['update'],
    tag: 'owner',
    isOwner: true,
    urls: {
      formats: ['https://raw.githubusercontent.com/sekayeo/dcb/refs/heads/'],
      msg: true
    }
  }, async ({ msg, args, urls: metaUrls }) => {
    const urls = args
      .split(/\s+/)
      .filter(str => str.startsWith('http'))

    if (!urls || !Array.isArray(urls) || !urls.length) {
      return await msg.reply("❌ URL tidak valid. Kirim link file dari GitHub/CDN untuk update.")
    }

    const whitelistPrefixes = metaUrls?.formats || []

    const reply = (txt) => msg.reply(txt).catch(() => {})
    const edit = (txt) => msg.edit?.(txt).catch(() => {})

    let failed = '\n*❗ Failed:*'
    let fols = await getDirectoriesRecursive()

    // Cek dan filter URL valid dulu sebelum proses update
    let urlPath = urls.map(link => {
      try {
        const { pathname, host } = new URL(link)
        const isValidPrefix = whitelistPrefixes.some(prefix => link.startsWith(prefix))
        if (!isValidPrefix) {
          failed += `\n- ${link}\n> URL tidak sesuai format`
          return null
        }

        let f = pathname.split('heads/')[1]
        if (!f) {
          failed += `\n- ${link}\n> Tidak bisa ambil path file`
          return null
        }

        f = f.split('/')?.slice(1)?.join('/')?.split('/')
        const filename = f.slice(-1)[0]
        if (!filename) {
          failed += `\n- ${link}\n> File kosong`
          return null
        }

        const _path = f.slice(0, -1).join('/')

        for (const folder of fols) {
          const folderPath = folder.split('./')[1].slice(0, -1)

          if (folderPath.includes(_path) && _path) {
            return [link, `${folder}${filename}`]
          }

          if (['index.js', 'package'].some(a => filename.includes(a))) {
            return [link, `./${filename}`]
          }
        }

        failed += `\n- ${link}\n> Tidak cocok dengan struktur direktori`
        return null
      } catch (e) {
        failed += `\n- ${link}\n> ${e.message}`
        return null
      }
    }).filter(Boolean)

    // ❌ Kalau tidak ada file valid, langsung balikin pesan gagal
    if (urlPath.length === 0) {
      let text = `❌ *Update gagal!* URL yang di berikan tidak valid.\n${failed}`
      return await msg.reply(text)
    }

    // ✅ Kalau valid, lanjut update
    await reply('🔄 Updating...')

    let changed = '*📂 File Changed:*'
    let modified = ''
    let newfile = ''

    for (let [url, fpath] of urlPath) {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          failed += `\n- ${url}\n> Gagal fetch file`
          continue
        }
        const isExists = fs.existsSync(fpath)
        const buff = await res.text()

        if (isExists) {
          modified += `\n- \`modified\`: ${fpath}`
        } else {
          newfile += `\n- \`new\`: ${fpath}`
        }

        await fs.writeFileSync(fpath, buff)
      } catch (e) {
        failed += `\n- ${url}\n> ${e.message}`
      }
    }

    let text = `*[ 🛠️ UPDATE ]*\n\n${changed}${modified}${newfile}\n`
    if (failed.length > 12) text += failed
    edit(text)
  })
}