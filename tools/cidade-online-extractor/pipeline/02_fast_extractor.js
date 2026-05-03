const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

async function run() {
  const routePath = process.env.TARGET_GRID;
  const progressPath = process.env.TARGET_PROGRESS;
  const masterDataPath = process.env.TARGET_RAW;
  const taxonomyPath = process.env.TAXONOMY_PATH;

  if (!fs.existsSync(routePath)) { return; }

  const route = JSON.parse(fs.readFileSync(routePath, 'utf8'));
  let progressIndex = 0;
  
  if (fs.existsSync(progressPath)) {
      const p = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
      progressIndex = p.lastIndexProcessed + 1;
  }

  let scrapedDatabase = [];
  if (fs.existsSync(masterDataPath)) {
      scrapedDatabase = JSON.parse(fs.readFileSync(masterDataPath, 'utf8'));
  }

  const browser = await puppeteer.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  let categorias = [];
  if (fs.existsSync(taxonomyPath)) {
      categorias = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
  } else {
      categorias = ["restaurante", "farmácia", "supermercado"];
  }

  for (let i = progressIndex; i < route.length; i++) {
      const block = route[i];
      for (const categoria of categorias) {
          const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(categoria)}/@${block.centerLat},${block.centerLng},18z`;
          try {
              await page.goto(searchUrl, { waitUntil: 'networkidle2' });
              await new Promise(r => setTimeout(r, 2000));
          
          const feedSelector = 'div[role="feed"]';
          await page.waitForSelector(feedSelector, { timeout: 8000 }).catch(()=>{});
          
          let previousHeight = 0;
          let scrollAttempts = 0;
          while (scrollAttempts < 3) {
              await page.evaluate((selector) => {
                  const feed = document.querySelector(selector);
                  if (feed) feed.scrollBy(0, 1000);
              }, feedSelector);
              await new Promise(r => setTimeout(r, 1000));
              const currentHeight = await page.evaluate((sel) => {
                  const feed = document.querySelector(sel);
                  return feed ? feed.scrollHeight : 0;
              }, feedSelector);
              if (currentHeight === previousHeight) break;
              previousHeight = currentHeight;
              scrollAttempts++;
          }

          const placeUrls = await page.evaluate(() => {
              const urls = [];
              document.querySelectorAll('a[href*="/maps/place/"]').forEach(a => { if (a.href) urls.push(a.href); });
              return [...new Set(urls)];
          });

          for (let u = 0; u < placeUrls.length; u++) {
              const url = placeUrls[u];
              if (scrapedDatabase.some(c => c.google_url === url)) continue; 
              
              try {
                  await page.goto(url, { waitUntil: 'networkidle2' });
                  await new Promise(r => setTimeout(r, 1500));

                  const details = await page.evaluate(() => {
                      const data = { nome: document.querySelector('h1')?.innerText || '', categoria: '', endereco: '', telefone: '', website: '', nota_reviews: '' };
                      const catBtn = document.querySelector('button[jsaction="pane.rating.category"]');
                      if (catBtn) data.categoria = catBtn.innerText;
                      document.querySelectorAll('button[data-item-id]').forEach(btn => {
                          const id = btn.getAttribute('data-item-id') || '';
                          const txt = btn.innerText || btn.getAttribute('aria-label') || '';
                          if (id === 'address' || txt.includes('Endereço:')) data.endereco = btn.innerText.replace('Endereço: ', '').trim();
                          if (id.includes('phone') || txt.includes('Telefone:')) data.telefone = btn.innerText.replace('Telefone: ', '').trim();
                          if (id === 'authority' || txt.includes('Website:')) data.website = btn.innerText.replace('Website: ', '').trim();
                      });
                      const rDiv = document.querySelector('div[class*="fontDisplayLarge"]');
                      if (rDiv && rDiv.parentElement) data.nota_reviews = rDiv.parentElement.innerText.replace(/\n/g, ' ');
                      return data;
                  });
                  
                  const cMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
                  if (cMatch) { details.lat = parseFloat(cMatch[1]); details.lng = parseFloat(cMatch[2]); }
                  details.google_url = url;
                  details.bloco_origem = i;
                  scrapedDatabase.push(details);

              } catch (err) {}
          }
          fs.writeFileSync(masterDataPath, JSON.stringify(scrapedDatabase, null, 2));
          } catch (err) {}
      } 
      fs.writeFileSync(progressPath, JSON.stringify({ lastIndexProcessed: i, totalCommerces: scrapedDatabase.length }));
  }
  await browser.close();
}

run().catch(console.error);
