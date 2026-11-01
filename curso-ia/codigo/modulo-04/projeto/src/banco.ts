/**
 * Armazenamento em Postgres com pgvector. Usamos o PGlite: um Postgres completo
 * compilado para WebAssembly, que roda dentro do Node, sem instalar nada.
 * O SQL é o mesmo de um Postgres de produção (Supabase, Neon, RDS, Cloud SQL...).
 */
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import type { Trecho } from "./chunking.js";

export interface Resultado {
  id: string;
  doc: string;
  tituloDoc: string;
  secao: string;
  texto: string;
  pontuacao: number;
}

const vetorSql = (v: number[]) => `[${v.join(",")}]`;

export class Banco {
  private constructor(private db: PGlite) {}

  /** `caminho` = pasta onde o banco é salvo; omita para um banco só em memória (testes). */
  static async abrir(caminho?: string): Promise<Banco> {
    const db = await PGlite.create(caminho ?? "memory://", { extensions: { vector } });
    await db.exec("CREATE EXTENSION IF NOT EXISTS vector;");
    return new Banco(db);
  }

  async criarTabela(dimensao: number, embedder: string) {
    await this.db.exec(`
      DROP TABLE IF EXISTS trechos;
      DROP TABLE IF EXISTS meta;
      CREATE TABLE meta (chave text PRIMARY KEY, valor text);
      CREATE TABLE trechos (
        id          text PRIMARY KEY,
        doc         text NOT NULL,
        titulo_doc  text NOT NULL,
        secao       text NOT NULL,
        texto       text NOT NULL,
        indexado    text NOT NULL,
        emb         vector(${dimensao}) NOT NULL,
        -- busca textual em português: radicais ("garantias" → "garant") e stopwords
        tsv         tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', indexado)) STORED
      );
      -- HNSW: índice aproximado de vizinhos mais próximos; GIN: índice de busca textual
      CREATE INDEX ON trechos USING hnsw (emb vector_cosine_ops);
      CREATE INDEX ON trechos USING gin (tsv);
    `);
    await this.db.query("INSERT INTO meta VALUES ('embedder', $1), ('dimensao', $2)", [embedder, String(dimensao)]);
  }

  async embedderIndexado(): Promise<string | null> {
    try {
      const r = await this.db.query<{ valor: string }>("SELECT valor FROM meta WHERE chave = 'embedder'");
      return r.rows[0]?.valor ?? null;
    } catch {
      return null;
    }
  }

  async inserir(trechos: Trecho[], embeddings: number[][]) {
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < trechos.length; i++) {
        const t = trechos[i];
        await tx.query(
          "INSERT INTO trechos (id, doc, titulo_doc, secao, texto, indexado, emb) VALUES ($1,$2,$3,$4,$5,$6,$7)",
          [t.id, t.doc, t.tituloDoc, t.secao, t.texto, t.textoIndexado, vetorSql(embeddings[i])],
        );
      }
    });
  }

  /** Busca vetorial: os k trechos de menor distância de cosseno. Pontuação = similaridade (1 − distância). */
  async buscarVetorial(consulta: number[], k: number): Promise<Resultado[]> {
    const r = await this.db.query<Resultado>(
      `SELECT id, doc, titulo_doc AS "tituloDoc", secao, texto, 1 - (emb <=> $1) AS pontuacao
         FROM trechos ORDER BY emb <=> $1 LIMIT $2`,
      [vetorSql(consulta), k],
    );
    return r.rows;
  }

  /** Busca textual (estilo BM25) com o full-text search do Postgres, termos combinados com OU. */
  async buscarTextual(consulta: string, k: number): Promise<Resultado[]> {
    const termos = consulta
      .normalize("NFC")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);
    if (!termos.length) return [];
    const r = await this.db.query<Resultado>(
      `SELECT id, doc, titulo_doc AS "tituloDoc", secao, texto,
              ts_rank_cd(tsv, websearch_to_tsquery('portuguese', $1)) AS pontuacao
         FROM trechos
        WHERE tsv @@ websearch_to_tsquery('portuguese', $1)
        ORDER BY pontuacao DESC LIMIT $2`,
      [termos.join(" or "), k],
    );
    return r.rows;
  }

  async todos(): Promise<Resultado[]> {
    const r = await this.db.query<Resultado>(
      `SELECT id, doc, titulo_doc AS "tituloDoc", secao, texto, 0 AS pontuacao FROM trechos ORDER BY doc, id`,
    );
    return r.rows;
  }

  async fechar() {
    await this.db.close();
  }
}
