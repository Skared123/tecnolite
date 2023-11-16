const axios = require('axios')

// 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

const tecnolite = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': "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",
  },
  baseURL: 'https://0db9e3-2.myshopify.com/admin/api/2023-07',
});

module.exports = tecnolite