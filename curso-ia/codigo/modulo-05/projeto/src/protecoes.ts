/**
 * Proteções para expor um servidor MCP pela rede.
 * Um servidor MCP é uma API: tudo o que vale para APIs vale aqui, e mais um pouco,
 * porque quem chama é um agente que pode entrar em loop ou ser manipulado.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { appendFileSync } from "node:fs";

export interface Credencial {
  clientId: string;
  escopos: string[];
}

/**
 * Lê tokens de MCP_TOKENS no formato "token1:cliente1,token2:cliente2".
 * Em produção, use OAuth 2.1 (a especificação MCP define o fluxo) ou o provedor de
 * identidade da empresa. Tokens fixos servem para serviços internos e para aprender.
 */
export type Tokens = { hash: Buffer; credencial: Credencial }[];

export function carregarTokens(env = process.env.MCP_TOKENS ?? ""): Tokens {
  const tokens: Tokens = [];
  for (const par of env.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [token, clientId] = par.split(":");
    if (!token || !clientId || token.length < 16) throw new Error(`Token inválido em MCP_TOKENS (mínimo 16 caracteres): ${clientId ?? par}`);
    // Guardamos só o hash: se a memória do processo vazar, os tokens não vazam junto.
    tokens.push({ hash: hash(token), credencial: { clientId, escopos: ["docs:ler"] } });
  }
  return tokens;
}

const hash = (s: string) => createHash("sha256").update(s).digest();

/** Compara em tempo constante (evita descobrir o token medindo o tempo de resposta). */
export function autenticar(cabecalho: string | undefined, tokens: Tokens): Credencial | null {
  const m = cabecalho?.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const h = hash(m[1]);
  for (const t of tokens) if (timingSafeEqual(t.hash, h)) return t.credencial;
  return null;
}

/**
 * Limite de taxa por cliente (balde de fichas): cada cliente tem `capacidade` fichas,
 * que se reabastecem a `porSegundo`. Cada requisição gasta uma. Sem ficha → 429.
 * Protege o seu orçamento e a sua infraestrutura de um agente em loop.
 */
export class LimitadorDeTaxa {
  private baldes = new Map<string, { fichas: number; atualizado: number }>();
  constructor(
    private capacidade = 30,
    private porSegundo = 1,
    private agora: () => number = () => Date.now(),
  ) {}

  permitir(cliente: string): { ok: boolean; tenteEmS: number } {
    const t = this.agora();
    const b = this.baldes.get(cliente) ?? { fichas: this.capacidade, atualizado: t };
    b.fichas = Math.min(this.capacidade, b.fichas + ((t - b.atualizado) / 1000) * this.porSegundo);
    b.atualizado = t;
    this.baldes.set(cliente, b);
    if (b.fichas >= 1) {
      b.fichas -= 1;
      return { ok: true, tenteEmS: 0 };
    }
    return { ok: false, tenteEmS: Math.ceil((1 - b.fichas) / this.porSegundo) };
  }
}

/** Auditoria em JSON Lines: quem chamou, qual ferramenta, com quais argumentos, resultado e tempo. */
export function criarAuditoria(arquivo: string) {
  return (evento: { ferramenta: string; argumentos: unknown; cliente?: string; ok: boolean; ms: number }) => {
    appendFileSync(arquivo, JSON.stringify({ quando: new Date().toISOString(), ...evento, ms: Math.round(evento.ms) }) + "\n");
  };
}
