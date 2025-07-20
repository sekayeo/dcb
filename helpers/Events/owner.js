import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import { URL } from 'url'
import { getDirectoriesRecursive } from '../../toolkit/func.js'

export default async function on({ ev }) {
  ev.on({
    cmd: ['update'],
    tag: 'owner',
    isOwner: true,
    urls: { msg: true }
  }, async ({ msg, args }) => {
    const urls = args.split(/\s+/).filter(str => str.startsWith('http'))
    if (!urls.length) return msg.reply("❌ URL kosong. Kirim link file GitHub/CDN.")

    const reply = (txt) => msg.reply(txt).catch(() => {})
    const edit = (txt) => msg.edit?.(txt).catch(() => {})

    const fols = await getDirectoriesRecursive()
    await reply("🔄 Updating...")

    let modified = ''
    let newfile = ''
    let failed = '\n*❗ Failed:*'

    const urlPath = urls.map(link => {
      try {
        const { pathname, host } = new URL(link)
        let parts = pathname.split('/')
        let idx = parts.indexOf('heads')
        if (idx === -1 || idx + 1 >= parts.length) {
          failed += `\n- ${link}\n> Tidak ditemukan path setelah 'heads/'`
          return null
        }

        const pathParts = parts.slice(idx + 2)
        const filename = pathParts.at(-1)
        const _path = pathParts.slice(0, -1).join('/')

        for (const folder of fols) {
          const folderPath = folder.replace('./', '').replace(/\/$/, '')
          if (folderPath.includes(_path) && _path) {
            return [link, `${folder}${filename}`]
          }
          if (['index.js', 'package'].some(f => filename.includes(f))) {
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

    if (!urlPath.length) {
      return msg.reply(`❌ *Update dibatalkan!* Semua URL tidak valid.\n${failed}`)
    }

    for (let [url, fpath] of urlPath) {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          failed += `\n- ${url}\n> Gagal fetch file`
          continue
        }

        const buff = await res.text()
        const isExists = fs.existsSync(fpath)

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

    let result = `*[ 🛠️ UPDATE ]*\n\n*📂 File Changed:*${modified}${newfile}\n`
    if (failed.length > 12) result += failed
    
    console.log('=== UPDATE FINISHED ===')
console.log('Modified:', modified)
console.log('New file:', newfile)
console.log('Failed:', failed)
console.log('Final result:', result)
    
    if (typeof msg.edit === 'function') {
      msg.edit(result).catch(err => console.error('[EDIT ERROR]', err))
    } else {
      msg.reply(result).catch(err => console.error('[REPLY ERROR]', err))
  }
  })
}
