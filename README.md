# DTOR
DTOR = DRMS x Zephtor

## DRMS Shop / Scraper

*The node service can also host the static DRMS files by running the server from the `DRMS/scraper` directory; you'll then be able to open http://localhost:4000/products.html (or whatever port you choose via the `PORT` environment variable) and use the `/api/scrape` endpoint on the same origin.*


The `DRMS` directory contains a small static site that shows a ThinkPad-themed
shop. Products are normally defined in `DRMS/src/data/products.json`. You
only need to list eBay item IDs there – the client will automatically contact
the scraper API to pull the description, price, images, link, etc., and
populate both the card and the modal. Example JSON:

```json
[
  {"id":"198030460034"},
  {"id":"326485878428"},
  {"id":"198030460036"}
]
```

Clicking on any product card brings up a modal window (ThinkPad‑style) showing
all available images, price, and a "Buy Now" link; the scraper API must be
running for full details. If the API isn’t accessible, the modal will fall back
on whatever minimal information has been loaded. A fallback loader pulls live
search results from eBay RSS when there is no local JSON file.

For demonstration purposes there's also a simple server-side scraper under
`DRMS/scraper` which has been extended to use the official eBay APIs when an
`EBAY_APP_ID` environment variable is provided.  The AppID is a free key you
obtain from the [eBay Developers Program](https://developer.ebay.com/).


```sh
cd DRMS/scraper
npm install   # or yarn
node scrape.js <ebay-item-id>  # prints product data as JSON
```

You can also start a small HTTP API that exposes the same scraper and the
new eBay API helpers:

```sh
cd DRMS/scraper
npm install
EBAY_APP_ID=<yourappid> PORT=4000 node server.js
# then visit http://localhost:4000/products.html
# or call https://localhost:4000/api/scrape?id=<item-id>
# or keyword search: http://localhost:4000/api/search?q=thinkpad
```



The scraper uses `axios` and `cheerio` to fetch & parse the public eBay item
page. It works as a proof-of-concept but may break due to eBay's anti-bot
measures; for production use the official eBay APIs.

