#!/usr/bin/env node

/*
 * Simple command-line utility that scrapes an eBay item page and prints
 * a JSON representation. Usage:
 *
 *   node scrape.js <item-id>
 *
 * Example:
 *   node scrape.js 233945991091
 *
 * The script uses axios to fetch the page and cheerio to parse HTML. It
 * extracts title, price, images, condition, seller, and description where
 * available. It's meant for demonstration and may break if eBay changes
 * markup. For production use the official eBay APIs.
 */

const axios = require('axios');
const cheerio = require('cheerio');

async function scrape(id) {
  const url = `https://www.ebay.com/itm/${id}`;
  const res = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    },
  });
  const $ = cheerio.load(res.data);

  const title = $('#itemTitle').text().replace('Details about  \u00a0', '').trim();
  const price =
    $('#prcIsum').text().trim() ||
    $('#mm-saleDscPrc').text().trim() ||
    $('[itemprop="price"]').attr('content') ||
    '';
  const condition = $('#vi-itm-cond').text().trim();
  const seller = $('span.mbg-nw').first().text().trim();
  const images = [];
  // thumbnails
  $('#vi_main_img_fs ul li img').each((_, el) => {
    const src = $(el).attr('src');
    if (src) {
      images.push(src.replace('s-l64', 's-l1600'));
    }
  });
  // main image fallback
  if (images.length === 0) {
    const main = $('#icImg').attr('src');
    if (main) images.push(main);
  }

  const desc = $('#viTabs_0_is').text().trim();

  return {id, url, title, price, condition, seller, images, desc};
}

// export the scraper function for reuse
module.exports = { scrape };

// if the file is executed directly, run the CLI helper
if (require.main === module) {
  (async function(){
    const id = process.argv[2];
    if (!id) {
      console.error('Bitte eBay-Artikel-ID angeben');
      process.exit(1);
    }
    try {
      const data = await scrape(id);
      console.log(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Fehler beim Scrapen:', err.message);
      process.exit(1);
    }
  })();
}
