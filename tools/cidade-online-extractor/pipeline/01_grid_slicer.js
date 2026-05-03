const fs = require('fs');

const config = {
    city_id: process.env.CITY_ID,
    outputFile: process.env.TARGET_GRID,
    boundingBox: {
        minLat: parseFloat(process.env.BOUNDING_MIN_LAT),
        maxLat: parseFloat(process.env.BOUNDING_MAX_LAT),
        minLng: parseFloat(process.env.BOUNDING_MIN_LNG),
        maxLng: parseFloat(process.env.BOUNDING_MAX_LNG)
    },
    gridDivisions: {
        latSteps: parseInt(process.env.GRID_LAT_STEPS) || 20,
        lngSteps: parseInt(process.env.GRID_LNG_STEPS) || 20
    }
};

function generateGrid() {
    const { minLat, maxLat, minLng, maxLng } = config.boundingBox;
    const { latSteps, lngSteps } = config.gridDivisions;

    const latStepSize = (maxLat - minLat) / latSteps;
    const lngStepSize = (maxLng - minLng) / lngSteps;

    const grid = [];
    let blockIdCounter = 1;

    for (let i = 0; i < latSteps; i++) {
        for (let j = 0; j < lngSteps; j++) {
            const currentMinLat = minLat + (i * latStepSize);
            const currentMaxLat = currentMinLat + latStepSize;
            const currentMinLng = minLng + (j * lngStepSize);
            const currentMaxLng = currentMinLng + lngStepSize;

            const centerLat = currentMinLat + (latStepSize / 2);
            const centerLng = currentMinLng + (lngStepSize / 2);

            grid.push({
                block_id: `blk_${config.city_id}_${String(blockIdCounter).padStart(5, '0')}`,
                minLat: Number(currentMinLat.toFixed(6)),
                maxLat: Number(currentMaxLat.toFixed(6)),
                minLng: Number(currentMinLng.toFixed(6)),
                maxLng: Number(currentMaxLng.toFixed(6)),
                centerLat: Number(centerLat.toFixed(6)),
                centerLng: Number(centerLng.toFixed(6)),
                city_id: config.city_id,
                status: "pending"
            });
            blockIdCounter++;
        }
    }

    fs.writeFileSync(config.outputFile, JSON.stringify(grid, null, 2));

    console.log("=== Geração de Rota Geográfica ===");
    console.log(`Cidade: ${config.city_id}`);
    console.log(`Divisões do Grid: ${latSteps}x${lngSteps}`);
    console.log(`Total de blocos gerados: ${grid.length}`);
    console.log(`Salvo em: ${config.outputFile}`);
}

generateGrid();
