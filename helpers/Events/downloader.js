import fetch from 'node-fetch';
import fs from 'fs';
import { AttachmentBuilder } from 'discord.js';
import config from '../../toolkit/set/config.json' assert { type: 'json' };

export default function (ev) {
  ev.on({
    cmd: ['ytmp3', 'ytm4a', 'play', 'ytmp4'],
    tag: 'downloader',
    args: 'Harap sertakan URL atau judul video YouTube-nya!'
  }, async ({ msg, args, command }) => {
    const q = args?.trim();
    if (!q) return msg.reply('❌ Harap sertakan URL atau judul video YouTube-nya!');

    let { key, url } = config.api.xterm;

    try {
      await msg.reply('🔍 Mencari video...');
      const searchRes = await fetch(`${url}/api/search/youtube?query=${encodeURIComponent(q)}&key=${key}`);
      const searchJson = await searchRes.json();
      const item = searchJson?.data?.items?.[0];
      if (!item) return msg.reply('❌ Video tidak ditemukan.');

      await msg.reply('📥 Mendownload...');
      const dlType = command === 'ytmp4' ? 'mp4' : 'mp3';
      const dlUrl = `${url}/api/downloader/youtube?key=${key}&url=https://www.youtube.com/watch?v=${item.id}&type=${dlType}`;
      const dlRes = await fetch(dlUrl);
      const dlJson = await dlRes.json();
      const fileUrl = dlJson?.data?.dlink;
      const filename = `${item.title}.${dlType}`;

      if (!fileUrl) return msg.reply('❌ Gagal mendapatkan link download.');
      
      const buffer = await fetch(fileUrl).then(res => res.buffer());
      const attachment = new AttachmentBuilder(buffer, { name: filename });

      await msg.reply({ content: `✅ Berhasil!\n**${item.title}**`, files: [attachment] });
    } catch (err) {
      console.error(err);
      await msg.reply('❌ Terjadi kesalahan saat mengunduh video.');
    }
  });
}
