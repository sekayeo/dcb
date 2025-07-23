// path: ./helpers/Events/owner.js

import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import fetch from 'node-fetch'
import { getDirectoriesRecursive } from '../../toolkit/func.js'
// ❗ PENTING: Import event handler untuk mengakses fungsi reload
import eventHandler from '../events.js'

export default async function on({ ev }) {
  ev.on({
    cmd: ['update'],
    tag: 'owner',
    isOwner: true,
  }, async ({ msg, args }) => {
    const urls = args.split(/\s+/).filter(str => str.startsWith('http'))
    if (!urls.length) return msg.reply("❌ URL kosong. Kirim link file GitHub/CDN mentah.")

    const reply = (txt) => msg.reply(txt).catch(() => {})
    const loadingMsg = await reply('🔄 Updating...')

    const fols = await getDirectoriesRecursive()
    let modified = ''
    let newfile = ''
    let failed = '\n*❗ Failed:*'
    const reloaded = []

    const urlPath = urls.map(link => {
      try {
        const { pathname } = new URL(link)
        // Logika ini disesuaikan dengan struktur URL GitHub raw
        const parts = pathname.split('/')
        // Contoh: /username/repo/main/helpers/Events/owner.js -> [helpers, Events, owner.js]
        const pathParts = parts.slice(3) 
        const filename = pathParts.at(-1)
        const _path = pathParts.slice(0, -1).join('/')

        for (const folder of fols) {
          const folderPath = folder.replace('./', '').replace(/\/$/, '')
          if (folderPath.includes(_path) && _path) {
            return [link, `${folder}${filename}`]
          }
        }
        
        // Handle untuk file di root seperti index.js atau package.json
        if (['index.js', 'package.json'].some(f => filename.includes(f))) {
            return [link, `./${filename}`]
        }

        failed += `\n- ${link}\n> Tidak cocok dengan struktur direktori lokal`
        return null
      } catch (e) {
        failed += `\n- ${link}\n> ${e.message}`
        return null
      }
    }).filter(Boolean)

    if (!urlPath.length && failed.length > 12) {
      return loadingMsg.edit(`❌ *Update dibatalkan!* Semua URL tidak valid atau tidak cocok dengan path lokal.\n${failed}`)
    }

    for (let [url, fpath] of urlPath) {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          failed += `\n- ${url}\n> Gagal fetch file (Status: ${res.status})`
          continue
        }

        const buff = await res.text()
        const isExists = fs.existsSync(fpath)
        // Menulis file ke disk
        await fs.promises.writeFile(fpath, buff)

        if (isExists) {
          modified += `\n- \`modified\`: ${fpath}`
        } else {
          newfile += `\n- \`new\`: ${fpath}`
        }

        // --- RELOAD OTOMATIS JIKA FILE .JS ---
        if (fpath.endsWith('.js')) {
          try {
            // Panggil fungsi reload dari event.js
            await eventHandler.loadCommandFile(path.resolve(fpath))
            reloaded.push(`- \`reloaded\`: ${fpath}`)
          } catch (e) {
            console.error(chalk.red(`[UPDATE-RELOAD FAILED] for ${fpath}: ${e.message}`))
            failed += `\n- ${fpath}\n> Gagal reload otomatis: ${e.message}`
          }
        }
      } catch (e) {
        failed += `\n- ${url}\n> ${e.message}`
      }
    }

    let result = `*[ 🛠️ UPDATE ]*\n`
    if (modified) result += `\n*📝 Modified:*\n${modified}`
    if (newfile) result += `\n*✨ New Files:*\n${newfile}`
    if (reloaded.length) result += `\n\n*🔁 Auto-Reloaded:*\n${reloaded.join('\n')}`
    if (failed.length > 12) result += `\n\n${failed}`

    console.log(chalk.green(`=== UPDATE FINISHED ===`))
    
    await loadingMsg.edit(result).catch(() => reply(result))
  })
}
