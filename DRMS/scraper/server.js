#!/usr/bin/env node

/*
 * Server that provides a thin API to eBay.  The intention is to run this
 * locally (or on a small host) and have the front-end call it instead of
 * scraping eBay directly.  It supports:
 *
 *  - GET /api/scrape?id=<itemId>  => returns item details (via eBay Shopping API)
 *  - GET /api/search?q=<keywords> => returns a list of items (via eBay Finding API)
 *
 * The service also serves the static DRMS files from the parent directory so
 * you can open the shop on the same origin.
 *
 * It will fall back to the old scraping logic if no EBAY_APP_ID is provided or
 * if the API call fails.
 */

const express = require('express');
const axios = require('axios');
const {scrape} = require('./scrape');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// eBay AppID (Shopping/Finding API).  Set via environment variable before
// starting the server, e.g.:
//   EBAY_APP_ID=yourappid PORT=4000 node server.js
const EBAY_APP_ID = process.env.EBAY_APP_ID || '';

// serve DRMS static site from parent directory
app.use(express.static(path.join(__dirname, '..')));

// helper that talks to the Shopping API
async function fetchEbayItemById(id){
  if(!EBAY_APP_ID) throw new Error('EBAY_APP_ID not configured');
  const url = 'https://open.api.ebay.com/shopping';
  const params = {
    callname: 'GetSingleItem',
    responseencoding: 'JSON',
    appid: EBAY_APP_ID,
    siteid: 0,
    version: 967,
    ItemID: id,
    IncludeSelector: 'Details,Description,ItemSpecifics,ShippingCosts,Images',
  };
  const res = await axios.get(url, {params});
  const item = res.data?.Item;
  if(!item) throw new Error('no item data');
  return {
    id,
    url: item.ViewItemURLForNaturalSearch || item.ViewItemURL || '',
    title: item.Title || '',
    price: item.CurrentPrice?.Value ? `${item.CurrentPrice.Value} ${item.CurrentPrice.CurrencyID}` : '',
    condition: item.ConditionDisplayName || '',
    seller: item.Seller?.UserID || '',
    images: (item.PictureURL || []).slice(0,10),
    desc: item.Description || '',
  };
}

// search endpoint (Finding API)
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({error: 'missing query'});
  if (!EBAY_APP_ID) return res.status(500).json({error: 'EBAY_APP_ID not set'});
  try {
    const findUrl = 'https://svcs.ebay.com/services/search/FindingService/v1';
    const params = {
      'OPERATION-NAME': 'findItemsByKeywords',
      'SERVICE-VERSION': '1.0.0',
      'SECURITY-APPNAME': EBAY_APP_ID,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      keywords: q,
      'paginationInput.entriesPerPage': '20',
    };
    const r = await axios.get(findUrl, {params});
    const items = r.data?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || [];
    const results = items.map(it=>({
      id: it.itemId?.[0] || '',
      title: it.title?.[0] || '',
      link: it.viewItemURL?.[0] || '',
      image: it.galleryURL?.[0] || '',
      price: it.sellingStatus?.[0]?.currentPrice?.[0]?._ || '',
    }));
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.message});
  }
});

// item detail / scraping endpoint
app.get('/api/scrape', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({error: 'missing id'});
  try {
    let data;
    try {
      data = await fetchEbayItemById(id);
    } catch(apiErr) {
      if (!EBAY_APP_ID) {
        // fallback to HTML scraping
        data = await scrape(id);
      } else {
        throw apiErr;
      }
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
});

app.listen(port, () => {
  console.log(`DRMS eBay API server listening on http://localhost:${port}`);
});
