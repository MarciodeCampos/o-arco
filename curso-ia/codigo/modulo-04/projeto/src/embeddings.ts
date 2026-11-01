/**
 * Três formas de gerar embeddings, atrás da mesma interface:
 *
 *  - "local":   modelo multilíngue rodando na sua máquina (transformers.js). Grátis, sem chave.
 *               Baixa o modelo (até algumas centenas de MB) do Hugging Face na primeira execução.
 *  - "voyage":  API da Voyage AI (paga, alta qualidade). Requer VOYAGE_API_KEY.
 *  - "hash":    "embedding de brinquedo" por n-gramas de caracteres. Não entende significado,
 *               só grafia parecida. Serve para testes offline e para comparar com os reais.
 *
 * Importante: documentos e consultas devem usar o MESMO embedder. Trocou de modelo, reindexe tudo.
 */

export interface Embedder {
  nome: string;
  dimensao: number;
  documentos(textos: string[]): Promise<number[][]>;
  consulta(texto: string): Promise<number[]>;
}

export function normalizar(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

export const cosseno = (a: number[], b: number[]) => {
  let p = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    p += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return p / (Math.sqrt(na * nb) || 1);
};

// ---------------------------------------------------------------- hash (brinquedo, offline)
export class EmbedderHash implements Embedder {
  nome = "hash";
  constructor(public dimensao = 512) {}

  private vetor(texto: string): number[] {
    const v = new Array(this.dimensao).fill(0);
    const t = ` ${texto.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
    for (let i = 0; i < t.length - 2; i++) {
      const tri = t.slice(i, i + 3);
      let h = 2166136261; // FNV-1a
      for (const c of tri) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
      v[(h >>> 0) % this.dimensao] += 1;
    }
    return normalizar(v);
  }
  async documentos(textos: string[]) {
    return textos.map((t) => this.vetor(t));
  }
  async consulta(texto: string) {
    return this.vetor(texto);
  }
}

// ---------------------------------------------------------------- local (transformers.js)
export class EmbedderLocal implements Embedder {
  nome = "local";
  dimensao = 384;
  // Modelo multilíngue (inclui português). A família E5 pede prefixos "query: " e "passage: ".
  constructor(private modelo = "Xenova/multilingual-e5-small") {}
  private extrator?: (t: string[], o: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

  private async carregar() {
    if (!this.extrator) {
      const { pipeline } = await import("@huggingface/transformers");
      try {
        this.extrator = (await pipeline("feature-extraction", this.modelo)) as unknown as typeof this.extrator;
      } catch (erro) {
        throw new Error(
          `Não foi possível carregar o modelo ${this.modelo} (${erro instanceof Error ? erro.message : erro}).\n` +
            "Na primeira execução ele é baixado do Hugging Face (até algumas centenas de MB) e depois fica em cache.\n" +
            "Verifique a conexão, ou use --embedder hash (offline) ou --embedder voyage (API).",
        );
      }
    }
    return this.extrator!;
  }
  async documentos(textos: string[]) {
    const ext = await this.carregar();
    const saida: number[][] = [];
    for (let i = 0; i < textos.length; i += 16) {
      const lote = textos.slice(i, i + 16).map((t) => `passage: ${t}`);
      saida.push(...(await ext(lote, { pooling: "mean", normalize: true })).tolist());
    }
    return saida;
  }
  async consulta(texto: string) {
    const ext = await this.carregar();
    return (await ext([`query: ${texto}`], { pooling: "mean", normalize: true })).tolist()[0];
  }
}

// ---------------------------------------------------------------- Voyage AI (API)
export class EmbedderVoyage implements Embedder {
  nome = "voyage";
  constructor(
    public dimensao = 1024,
    private modelo = process.env.VOYAGE_MODEL ?? "voyage-3.5",
    private chave = process.env.VOYAGE_API_KEY,
  ) {
    if (!this.chave) throw new Error("Defina VOYAGE_API_KEY para usar o embedder voyage");
  }
  private async chamar(textos: string[], tipo: "document" | "query"): Promise<number[][]> {
    const r = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.chave}` },
      body: JSON.stringify({ input: textos, model: this.modelo, input_type: tipo, output_dimension: this.dimensao }),
    });
    if (!r.ok) throw new Error(`Voyage ${r.status}: ${await r.text()}`);
    const json = (await r.json()) as { data: { embedding: number[]; index: number }[] };
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
  async documentos(textos: string[]) {
    const saida: number[][] = [];
    for (let i = 0; i < textos.length; i += 64) saida.push(...(await this.chamar(textos.slice(i, i + 64), "document")));
    return saida;
  }
  async consulta(texto: string) {
    return (await this.chamar([texto], "query"))[0];
  }
}

export function criarEmbedder(nome: string): Embedder {
  if (nome === "hash") return new EmbedderHash();
  if (nome === "local") return new EmbedderLocal();
  if (nome === "voyage") return new EmbedderVoyage();
  throw new Error(`Embedder desconhecido: ${nome} (use local, voyage ou hash)`);
}
