const fs = require('fs');

function haversineDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371e3;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function run() {
    const normBizPath = process.env.TARGET_NORM;
    const propertiesPath = process.env.TARGET_PROPS;
    const outPath = process.env.TARGET_MATCHES;

    if (!fs.existsSync(normBizPath)) return;
    let properties = [];
    if (fs.existsSync(propertiesPath)) properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));

    const businesses = JSON.parse(fs.readFileSync(normBizPath, 'utf8'));
    const matchesResult = [];

    businesses.forEach(biz => {
        let bestCandidate = null;
        let minDistance = Infinity;

        if (biz.lat && biz.lng) {
            properties.forEach(prop => {
                const propLat = prop.lat || prop.latitude;
                const propLng = prop.lng || prop.longitude;
                const dist = haversineDistance(biz.lat, biz.lng, propLat, propLng);
                if (dist < minDistance) { minDistance = dist; bestCandidate = prop; }
            });
        }

        let confidence = 0; let matchStatus = "no_match"; let matchMethod = "none";
        let matchedPropertyId = null; let propLat = null; let propLng = null;
        let inscricao = null; let officialAddress = null;

        if (bestCandidate && minDistance < 100) {
            propLat = bestCandidate.lat || bestCandidate.latitude;
            propLng = bestCandidate.lng || bestCandidate.longitude;
            inscricao = bestCandidate.inscricao || bestCandidate.id || "N/A";
            officialAddress = bestCandidate.endereco || bestCandidate.logradouro || "N/A";
            matchedPropertyId = inscricao;

            if (minDistance <= 15) confidence += 60;
            else if (minDistance <= 30) confidence += 40;
            else if (minDistance <= 50) confidence += 20;

            if (biz.address_raw && officialAddress !== "N/A") {
                const n = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const bAddr = n(biz.address_raw);
                if (n(officialAddress).split(' ').filter(t => t.length > 3).some(token => bAddr.includes(token))) confidence += 30;
            }

            if (confidence >= 80) matchStatus = "strong_match";
            else if (confidence >= 40) matchStatus = "probable_match";
            else matchStatus = "review_needed";
            matchMethod = "geo_distance_and_address_heuristic";
        }

        matchesResult.push({
            business_id: biz.business_id, business_name: biz.name, business_category: biz.category,
            business_lat: biz.lat, business_lng: biz.lng, matched_property_id: matchedPropertyId,
            inscricao, official_address: officialAddress, property_lat: propLat, property_lng: propLng,
            distance_meters: minDistance === Infinity ? null : Number(minDistance.toFixed(2)),
            confidence, match_status: matchStatus, match_method: matchMethod, business: biz,
            property: bestCandidate ? { inscricao, officialAddress, lat: propLat, lng: propLng } : null
        });
    });
    fs.writeFileSync(outPath, JSON.stringify(matchesResult, null, 2));
    console.log(`[+] Casamento Territorial concluído. Salvo em ${outPath}`);
}
run();
