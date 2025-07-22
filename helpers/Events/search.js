// ./helpers/Events/search.js
import fetch from 'node-fetch'
import { downloadSpotify } from '../../machine/spotifydl.js'

const emojiList = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣']

export default async function on({ ev }) {
  ev.on({
    cmd: ['spotify'],
    tag: 'search',
    args: 'Cari lagu dari Spotify'
  }, async ({ msg, args }) => {
    const { author, channel, client } = msg

    if (!args) return msg.noReply(`❌ Hmm... kamu belum kasih querynya, tuh 😅\nContoh penggunaan: \`spotify message in a bottle\``)

    const res = await fetch(`https://ytdlpyton.nvlgroup.my.id/spotify/search?query=${encodeURIComponent(args)}`)
      .then(r => r.json())
      .catch(() => null)

    if (!res?.results?.length) return msg.noReply("😕 Aku ngga nemu lagu yang cocok sama pencarian kamu nih, coba cari yang lain deh~")

    const results = res.results.slice(0, 5)
    let text = `🎵 Nih hasil pencarian dari: *${args}*\n\n`
    results.forEach((r, i) => {
      text += `${i + 1}. ${r.title} — ${r.artist}\n`
    })
    text += `\nPilih nomor sesuai lagu yang kamu cari atau pilih ❌ buat batalin~\n\`(otomatis di batalin kalau kamu ngga milih satu-pun dari pilihan dalam 1 menit ⏳)\``

    const sentMsg = await msg.noReply(text)

    for (let i = 0; i < results.length; i++) {
      await sentMsg.react(emojiList[i])
    }
    await sentMsg.react('❌')

    const filter = async (reaction, user) => {
      try {
        if (reaction.partial) await reaction.fetch()
        if (user.partial) await user.fetch()
      } catch (e) {
        console.log('❌ Gagal fetch partial:', e)
        return false
      }

      return [...emojiList, '❌'].includes(reaction.emoji.name) && user.id === author.id
    }

    sentMsg.awaitReactions({ filter, max: 1, time: 60_000, errors: ['time'] })
      .then(async collected => {
        const reaction = collected.first()
        if (!reaction) return

        const emojiName = reaction.emoji.name

        sentMsg.reactions.cache.forEach(r => {
          r.users.remove(client.user.id).catch(() => null)
        })

        if (emojiName === '❌') {
          return sentMsg.edit('Command di bantalkan~')
        }

        const emojiIndex = emojiList.indexOf(emojiName)
        const selected = results[emojiIndex]

        await sentMsg.edit('🎶 Lagi aku siapin dulu lagunya, tunggu bentar yaa~')

        try {
          const file = await downloadSpotify(selected.spotify_url)
          if (!file || !file.buffer) {
            return msg.noReply("😣 Maaf... lagunya gak bisa didownload sekarang. Coba lagi nanti, yaa~")
          }

          try {
            await channel.send({
              content: '✅ Done... Nih lagunya~',
              files: [{
                attachment: file.buffer,
                name: `${file.title || selected.title} — ${file.artist || selected.artist}.mp3`
              }]
            })
            return
          } catch (err) {
            console.error("❌ Error kirim lagu:", err)
            return msg.noReply("⚠️ Maaf, gagal kirim lagunya. Mungkin ukuran file-nya kegedean atau koneksi lagi lemot :'(")
          }

        } catch (e) {
          console.log("❌ Download Error:", e)
          msg.noReply("⚠️ Ups... ada masalah pas download. Mungkin koneksinya lagi lemot atau API-nya lagi rewel ;-;")
        }
      })
      .catch(() => {
        sentMsg.reactions.cache.forEach(r => {
          r.users.remove(msg.client.user.id).catch(() => null)
        })
        sentMsg.edit('⌛ Waktu habis... Commandnya ku batalin yaa~').catch(() => null)
      })
  })
}