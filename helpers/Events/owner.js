import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import fetch from 'node-fetch'
import { pathToFileURL } from 'url'
import { getDirectoriesRecursive } from '../../toolkit/func.js'

export default async function on({ ev }) {
  ev.on({
    cmd: ['update'],
    tag: 'owner',
    isOwner: true,
    urls: { msg: true }
  }, async ({ msg, args }) => {
    const urls = args.split(/\s+/).filter(str => str.startsWith('http'))
    if (!urls.length) return msg.noReply("❌ Mohon kirimkan link file dari GitHub/CDN.")

    const reply = (txt) => msg.noReply(txt).catch(() => {})
    const edit = (txt) => msg.edit?.(txt).catch(() => {})
    const fols = await getDirectoriesRecursive()
    const loadingMsg = await reply('🔄 Updating...')

    let modified = ''
    let newfile = ''
    let failed = '\n*❗ Failed:*'
    const reloaded = []

    const urlPath = urls.map(link => {
      try {
        const { pathname } = new URL(link)
        const parts = pathname.split('/')
        const idx = parts.indexOf('heads')
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
      return msg.noReply(`❌ *Update dibatalkan!* Semua URL tidak valid.\n${failed}`)
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
        await fs.writeFileSync(fpath, buff)

        if (isExists) {
          modified += `\n- \`modified\`: ${fpath}`
        } else {
          newfile += `\n- \`new\`: ${fpath}`
        }

        if (fpath.endsWith('.js')) {
          const fileUrl = pathToFileURL(path.resolve(fpath)).href

          // Hapus semua command lama dari file ini
          ev.events = ev.events.filter(e => e.__source !== fpath)

          // Import ulang file dan inject ulang command-nya
          try {
            const imported = await import(`${fileUrl}?update=${Date.now()}`)
            if (typeof imported.default === 'function') {
              const on = (meta, callback) => {
                if (!meta?.cmd || !Array.isArray(meta.cmd)) throw new Error("Command must be array")
                ev.events.push({ ...meta, callback, __source: fpath })
              }

              await imported.default({ ev: { ...ev, on }, is: ev.is })
              reloaded.push(`- \`reloaded\`: ${fpath}`)
            }
          } catch (e) {
            failed += `\n- ${url}\n> Gagal reload: ${e.message}`
          }
        }
      } catch (e) {
        failed += `\n- ${url}\n> ${e.message}`
      }
    }

    let result = `*[ 🛠️ UPDATE ]*\n\n*📂 File Changed:*${modified}${newfile}\n`
    if (reloaded.length) result += `\n*🔁 Reloaded:*\n${reloaded.join('\n')}`
    if (failed.length > 12) result += `\n${failed}`

    console.log(chalk.green(`=== UPDATE FINISHED ===`))
    console.log(modified, newfile, reloaded, failed)

    if (loadingMsg?.edit) {
      loadingMsg.edit(result).catch(err => console.error('[EDIT ERROR]', err))
    } else {
      msg.noReply(result).catch(err => console.error('[REPLY ERROR]', err))
    }
  })
}
