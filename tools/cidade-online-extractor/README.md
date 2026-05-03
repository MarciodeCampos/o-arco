# Cidade Online Extractor

**Descrição:**
Pipeline modular para pavimentação comercial de cidades brasileiras, organizado por código IBGE, país, estado e cidade.

**Fluxo:**
01_grid_slicer.js → 02_fast_extractor.js → 03_normalize_businesses.js → 04_property_matcher.js → 05_city_assets_builder.js

**Comandos:**
```bash
npm run grid -- --city 4202008
npm run extract -- --city 4202008
npm run normalize -- --city 4202008
npm run match -- --city 4202008
npm run assets -- --city 4202008
npm run pipeline -- --city 4202008
```

- `config/cities.json`: fonte de configuração por cidade
- `config/category_taxonomy.json`: base de ramos comerciais
- `data/` não deve ser versionado com dados reais
- outputs ficam em `data/BR/UF/CODIGOIBGE_Cidade/`
