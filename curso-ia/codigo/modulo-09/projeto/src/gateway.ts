/**
 * O núcleo do gateway: uma função `gerar` que todas as aplicações chamam em vez de
 * chamarem o provedor direto. Em ordem:
 *
 *   1. autoriza o cliente e a tarefa
 *   2. confere a cota diária de custo
 *   3. escolhe a versão do prompt (estável ou canário)
 *   4. procura no cache
 *   5. tenta a cadeia de modelos da tarefa (reserva em erro transitório ou recusa)
 *   6. registra tudo num log estruturado (custo, latência, modelo, versão, cache, reservas)
 */
import { createHash, randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { ESFORCO, ROTAS, custoUsd, type Cliente, type Tarefa } from "./politicas.js";
import { escolherVersao, type ArquivoDePrompt } from "./prompts.js";

export interface Pedido {
  tarefa: Tarefa;
  mensagens: Anthropic.MessageParam[];
  maxTokens?: number;
  /** Desligue o cache quando a resposta precisa ser sempre nova. */
  usarCache?: boolean;
}

export interface Registro {
  id: string;
  quando: string;
  cliente: string;
  tarefa: Tarefa;
  versaoPrompt: string;
  modelo: string | null;
  tentativas: { modelo: string; erro?: string }[];
  cache: boolean;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
  latenciaMs: number;
  status: "ok" | "erro" | "recusado_cota" | "proibido";
}

export class ErroGateway extends Error {
  constructor(
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/** Erros que valem tentar no próximo modelo da cadeia. Erros do pedido (400) não. */
const transitorio = (e: unknown) =>
  e instanceof Anthropic.RateLimitError ||
  e instanceof Anthropic.InternalServerError ||
  e instanceof Anthropic.APIConnectionError ||
  (e instanceof Anthropic.APIError && (e.status === 529 || e.status === 503));

export class Gateway {
  private cache = new Map<string, { texto: string; expira: number }>();
  private gastoHoje = new Map<string, { dia: string; usd: number }>();
  readonly registros: Registro[] = [];

  constructor(
    private client: Anthropic,
    private clientes: Map<string, Cliente>,
    private prompts: Record<Tarefa, ArquivoDePrompt>,
    private opcoes: { ttlCacheMs?: number; agora?: () => Date; aoRegistrar?: (r: Registro) => void } = {},
  ) {}

  private agora() {
    return this.opcoes.agora?.() ?? new Date();
  }

  gastoDoDia(cliente: string): number {
    const g = this.gastoHoje.get(cliente);
    return g && g.dia === this.agora().toISOString().slice(0, 10) ? g.usd : 0;
  }

  private somarGasto(cliente: string, usd: number) {
    const dia = this.agora().toISOString().slice(0, 10);
    const g = this.gastoHoje.get(cliente);
    this.gastoHoje.set(cliente, { dia, usd: (g?.dia === dia ? g.usd : 0) + usd });
  }

  async gerar(idCliente: string, pedido: Pedido, idRequisicao: string = randomUUID()): Promise<{ texto: string; registro: Registro }> {
    const inicio = performance.now();
    const reg: Registro = {
      id: idRequisicao,
      quando: this.agora().toISOString(),
      cliente: idCliente,
      tarefa: pedido.tarefa,
      versaoPrompt: "-",
      modelo: null,
      tentativas: [],
      cache: false,
      tokensEntrada: 0,
      tokensSaida: 0,
      custoUsd: 0,
      latenciaMs: 0,
      status: "ok",
    };
    const finalizar = (status: Registro["status"]) => {
      reg.status = status;
      reg.latenciaMs = Math.round(performance.now() - inicio);
      this.registros.push(reg);
      this.opcoes.aoRegistrar?.(reg);
    };

    // 1. autorização
    const cliente = this.clientes.get(idCliente);
    if (!cliente || !cliente.tarefas.includes(pedido.tarefa)) {
      finalizar("proibido");
      throw new ErroGateway(403, `Cliente sem permissão para a tarefa "${pedido.tarefa}"`);
    }
    // 2. cota
    if (this.gastoDoDia(cliente.id) >= cliente.orcamentoDiarioUsd) {
      finalizar("recusado_cota");
      throw new ErroGateway(429, `Orçamento diário de US$ ${cliente.orcamentoDiarioUsd} esgotado`);
    }
    // 3. prompt versionado
    const { versao, sistema } = escolherVersao(this.prompts[pedido.tarefa], idRequisicao);
    reg.versaoPrompt = versao;

    // 4. cache (chave = tarefa + versão do prompt + mensagens; mudar o prompt invalida o cache)
    const chave = createHash("sha256").update(JSON.stringify([pedido.tarefa, versao, pedido.mensagens])).digest("hex");
    if (pedido.usarCache !== false) {
      const c = this.cache.get(chave);
      if (c && c.expira > this.agora().getTime()) {
        reg.cache = true;
        finalizar("ok");
        return { texto: c.texto, registro: reg };
      }
    }

    // 5. cadeia de modelos com reserva
    for (const modelo of ROTAS[pedido.tarefa]) {
      try {
        const r = await this.client.messages.create(
          {
            model: modelo,
            max_tokens: pedido.maxTokens ?? 2000,
            system: sistema,
            messages: pedido.mensagens,
            output_config: { effort: ESFORCO[pedido.tarefa] },
          },
          { maxRetries: 1 }, // poucas tentativas no mesmo modelo: a reserva é o próximo da cadeia
        );
        if (r.stop_reason === "refusal") {
          reg.tentativas.push({ modelo, erro: "recusa" });
          continue;
        }
        const texto = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        reg.tentativas.push({ modelo });
        reg.modelo = modelo;
        reg.tokensEntrada = r.usage.input_tokens;
        reg.tokensSaida = r.usage.output_tokens;
        reg.custoUsd = custoUsd(modelo, r.usage.input_tokens, r.usage.output_tokens);
        this.somarGasto(cliente.id, reg.custoUsd);
        if (pedido.usarCache !== false) this.cache.set(chave, { texto, expira: this.agora().getTime() + (this.opcoes.ttlCacheMs ?? 10 * 60_000) });
        finalizar("ok");
        return { texto, registro: reg };
      } catch (e) {
        reg.tentativas.push({ modelo, erro: e instanceof Error ? e.constructor.name : String(e) });
        if (!transitorio(e)) {
          finalizar("erro");
          throw new ErroGateway(e instanceof Anthropic.BadRequestError ? 400 : 502, "Falha no provedor");
        }
      }
    }
    finalizar("erro");
    throw new ErroGateway(503, "Todos os modelos da cadeia falharam");
  }
}
