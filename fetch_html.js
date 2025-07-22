const axios = require('axios');

async function fetchHtml() {
  try {
    const response = await axios.get('https://driverpracticaltest.dvsa.gov.uk/login', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
      }
    });
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
}

fetchHtml();
