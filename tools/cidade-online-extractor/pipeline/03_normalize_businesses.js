const fs = require('fs');

function run() {
    const rawPath = process.env.TARGET_RAW;
    const normPath = process.env.TARGET_NORM;
    const taxonomyPath = process.env.TAXONOMY_PATH;
    const cityId = process.env.CITY_ID;
    const cityPrefix = process.env.CITY_PREFIX;

    if (!fs.existsSync(rawPath)) return;
    const rawData = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    const normalizedMap = new Map();
    let counter = 1;

    rawData.forEach(biz => {
        const name = (biz.nome || '').trim();
        if (!name) return;

        const category_raw = (biz.categoria || '').trim();
        let category = category_raw || "Comércio";

        let category_group = "Serviços e Comércio";
        const catLower = category.toLowerCase();
        if (catLower.includes('restaurante') || catLower.includes('padaria')) category_group = "Alimentação";
        else if (catLower.includes('farmácia') || catLower.includes('clínica')) category_group = "Saúde";
        else if (catLower.includes('advogado')) category_group = "Serviços Profissionais";
        else if (catLower.includes('roupa') || catLower.includes('calçado')) category_group = "Moda";
        else if (catLower.includes('imobiliária')) category_group = "Imobiliário";

        let phone_raw = (biz.telefone || '').trim();
        let phone = phone_raw;
        let is_whatsapp_probable = false;
        
        if (phone) {
            const digitsOnly = phone.replace(/\D/g, '');
            if (digitsOnly.length === 11 && digitsOnly[2] === '9') is_whatsapp_probable = true;
        }

        let address_raw = (biz.endereco || '').trim().replace(/[\uE000-\uF8FF]/g, ''); 
        const latRound = biz.lat ? biz.lat.toFixed(4) : "0";
        const lngRound = biz.lng ? biz.lng.toFixed(4) : "0";

        const keyUrl = biz.google_url ? `url|${biz.google_url}` : null;
        const keyCoord = `coord|${name.toLowerCase()}|${latRound}|${lngRound}`;

        const isDuplicate = Array.from(normalizedMap.values()).some(existing => {
            if (keyUrl && existing.source.url === biz.google_url) return true;
            if (existing.name.toLowerCase() === name.toLowerCase() && existing.lat?.toFixed(4) === latRound) return true;
            return false;
        });

        if (isDuplicate) return;

        const safeCat = category_group.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\W+/g, "");
        const business_id = `${cityPrefix}_${safeCat}_${String(counter).padStart(6, '0')}`;

        const normBiz = {
            business_id, city_id: cityId, name, category_raw, category, category_group,
            address_raw, phone, is_whatsapp_probable, website: (biz.website || '').trim(),
            lat: biz.lat, lng: biz.lng, rating_raw: (biz.nota_reviews || '').trim(),
            source: { type: "commercial_observation", url: biz.google_url, block_origin: biz.bloco_origem, collected_at: new Date().toISOString() },
            status: "unclaimed", profile_status: "prebuilt",
            claim_enabled: true, offers_enabled: true, commission_enabled: true, radio_ads_enabled: true
        };

        normalizedMap.set(business_id, normBiz);
        counter++;
    });

    fs.writeFileSync(normPath, JSON.stringify(Array.from(normalizedMap.values()), null, 2));
    console.log(`[+] Normalização concluída para ${cityId}. Total: ${normalizedMap.size}`);
}
run();
