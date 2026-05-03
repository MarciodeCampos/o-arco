# Cloud Plan

Este pacote está preparado para rodar em nuvem ou em workers operacionais.

**Arquitetura:**
Cloud Orchestrator → Job Queue → Worker Operacional → Pipeline Local/Cloud → Result Upload → Quality Report → City Assets

**Tipos de execução suportados:**
1. local manual
2. worker dedicado
3. VPS
4. container Docker
5. execução sob demanda por job
6. execução futura em fila cloud

**Tipos de job previstos:**
- build_city_grid
- collect_businesses
- normalize_businesses
- match_properties
- build_city_assets
- update_reviews
- update_contacts
- detect_new_businesses
