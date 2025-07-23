// path: ./helpers/Events/owner.js

import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import fetch from 'node-fetch'
import { pathToFileURL } from 'url'
import { getDirectoriesRecursive } from '../../toolkit/func.js'
// ❗ PENTING: Import event handler untuk mengakses fungsi reload
import eventHandler from '../events.js'

export default async function on({ ev }) {
  ev.on({
    cmd: ['update'],
    tag: 'owner',
    isOwner: true,
  }, async ({ msg, args }) => {
    // ... (kode untuk parsing URL, tidak ada yang berubah di sini)
    const urls = args.split(/\s+/).filter(str => str.startsWith('http'))
    if (!urls.length) return msg.reply("❌ URL kosong. Kirim link file GitHub/CDN.")

    const reply = (txt) => msg.reply(txt).catch(() => {})
    const loadingMsg = await reply('🔄 Updating...')

    // ... (kode untuk mencari path file, tidak ada yang berubah)
    const fols = await getDirectoriesRecursive()
    let modified = ''
    let newfile = ''
    let failed = '\n*❗ Failed:*'
    const reloaded = []
    const urlPath = urls.map(link => {
        // ... Logika Anda untuk mencocokkan URL dengan path lokal ...
    }).filter(Boolean)
    
    // ... (kode error handling jika URL tidak valid)

    // --- MODIFIKASI DIMULAI DI SINI ---
    for (let [url, fpath] of urlPath) {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          failed += `\n- ${url}\n> Gagal fetch file`
          continue
        }

        const buff = await res.text()
        const isExists = fs.existsSync(fpath)
        // Menulis file ke disk
        await fs.writeFileSync(fpath, buff)

        if (isExists) {
          modified += `\n- \`modified\`: ${fpath}`
        } else {
          newfile += `\n- \`new\`: ${fpath}`
        }

        // 🚀 INI BAGIAN RELOAD OTOMATISNYA
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
    // --- MODIFIKASI SELESAI ---

    let result = `*[ 🛠️ UPDATE ]*\n\n*📂 File Changed:*${modified}${newfile}\n`
    if (reloaded.length) result += `\n*🔁 Auto-Reloaded:*\n${reloaded.join('\n')}`
    if (failed.length > 12) result += failed

    console.log(chalk.green(`=== UPDATE FINISHED ===`))
    // ... (sisa kode untuk mengirim balasan)
    
    await loadingMsg.edit(result).catch(() => reply(result))
  })
}
