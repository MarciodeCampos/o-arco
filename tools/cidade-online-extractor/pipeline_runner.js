const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
let cityCode = null;
let step = 'all';

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--city') cityCode = args[i+1];
    if (args[i] === '--step') step = args[i+1];
}

if (!cityCode) {
    console.log('[!] Erro: Especifique a cidade com --city (ex: --city 4202008)');
    process.exit(1);
}

const citiesConfigPath = path.join(__dirname, 'config', 'cities.json');
const citiesConfig = JSON.parse(fs.readFileSync(citiesConfigPath, 'utf8'));
const cityConf = citiesConfig[cityCode];

if (!cityConf) {
    console.log(`[!] Erro: Cidade ${cityCode} não configurada em cities.json.`);
    process.exit(1);
}

// Paths absolutos da infraestrutura local
const baseOutputDir = path.join(__dirname, cityConf.output_dir);
const envVars = {
    ...process.env,
    CITY_ID: cityConf.city_id,
    CITY_PREFIX: cityConf.output_prefix,
    BOUNDING_MIN_LAT: cityConf.boundingBox.minLat,
    BOUNDING_MAX_LAT: cityConf.boundingBox.maxLat,
    BOUNDING_MIN_LNG: cityConf.boundingBox.minLng,
    BOUNDING_MAX_LNG: cityConf.boundingBox.maxLng,
    GRID_LAT_STEPS: cityConf.gridDivisions.latSteps,
    GRID_LNG_STEPS: cityConf.gridDivisions.lngSteps,
    TARGET_GRID: path.join(baseOutputDir, 'input', 'search_route.json'),
    TARGET_RAW: path.join(baseOutputDir, 'raw', 'businesses_raw.json'),
    TARGET_PROGRESS: path.join(baseOutputDir, 'tmp', 'progress_fast.json'),
    TARGET_NORM: path.join(baseOutputDir, 'normalized', 'businesses_normalized.json'),
    TARGET_PROPS: path.join(baseOutputDir, cityConf.property_base_path),
    TARGET_MATCHES: path.join(baseOutputDir, 'matches', 'business_property_matches.json'),
    TARGET_ASSETS: path.join(baseOutputDir, 'assets', 'city_assets.json'),
    TAXONOMY_PATH: path.join(__dirname, 'config', 'category_taxonomy.json')
};

['input', 'raw', 'normalized', 'matches', 'assets', 'reports', 'tmp'].forEach(d => {
    const dPath = path.join(baseOutputDir, d);
    if (!fs.existsSync(dPath)) fs.mkdirSync(dPath, { recursive: true });
});

function runStep(scriptName) {
    console.log(`\n>>> Executando ${scriptName} para a cidade ${cityConf.city_name} (${cityCode})`);
    const scriptPath = path.join(__dirname, 'pipeline', scriptName);
    const result = spawnSync('node', [scriptPath], { env: envVars, stdio: 'inherit' });
    if (result.status !== 0) {
        console.error(`[!] Erro ao executar ${scriptName}`);
        process.exit(1);
    }
}

const steps = {
    grid: '01_grid_slicer.js',
    extract: '02_fast_extractor.js',
    normalize: '03_normalize_businesses.js',
    match: '04_property_matcher.js',
    assets: '05_city_assets_builder.js'
};

if (step === 'all' || step === 'pipeline') {
    runStep(steps.grid);
    runStep(steps.extract);
    runStep(steps.normalize);
    runStep(steps.match);
    runStep(steps.assets);
} else if (steps[step]) {
    runStep(steps[step]);
} else {
    console.log(`[!] Passo desconhecido: ${step}`);
}
