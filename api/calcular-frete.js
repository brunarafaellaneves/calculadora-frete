export default async function handler(req, res) {

    // Taxa fixa adicionada ao frete mostrado ao cliente
    const TAXA_FRETE = 1.50;

    if (req.method !== "POST") {
        return res.status(405).json({
            erro: "Método não permitido.",
            opcoes: []
        });
    }

    try {

        const { cepDestino, quantidade } = req.body;

        // ==============================
        // VALIDAÇÕES
        // ==============================

        if (!cepDestino || !quantidade) {
            return res.status(400).json({
                erro: "CEP e quantidade são obrigatórios.",
                opcoes: []
            });
        }

        const quantidadeNumerica = Number(quantidade);

        if (
            !Number.isInteger(quantidadeNumerica) ||
            quantidadeNumerica < 1 ||
            quantidadeNumerica > 5
        ) {
            return res.status(400).json({
                erro: "A quantidade deve ser entre 1 e 5 leques.",
                opcoes: []
            });
        }

        // Remove caracteres que eventualmente venham no CEP
        const cep = String(cepDestino).replace(/\D/g, "");

        if (cep.length !== 8) {
            return res.status(400).json({
                erro: "CEP de destino inválido.",
                opcoes: []
            });
        }

        // ==============================
        // PESO
        // ==============================

        // Cada leque = 170g
        const peso = quantidadeNumerica * 0.170;

        // Peso cúbico:
        // comprimento × largura × altura / 6000
        const altura = 8;
        const largura = 8;
        const comprimento = 44;

        const pesoCubico =
            (comprimento * largura * altura) / 6000;

        // ==============================
        // CHAMADA SUPERFRETE
        // ==============================

        const resposta = await fetch(
            "https://api.superfrete.com/api/v0/calculator",
            {
                method: "POST",

                headers: {
                    "Authorization":
                        `Bearer ${process.env.SUPERFRETE_API_KEY}`,

                    "User-Agent":
                        "Wild Flower Store (brunarafaellaneves@gmail.com)",

                    "Accept":
                        "application/json",

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    from: {
                        postal_code: "53150170"
                    },

                    to: {
                        postal_code: cep
                    },

                    // Serviços consultados
                    services: "1,2,17,3,33,31",

                    options: {
                        own_hand: false,
                        receipt: false,
                        insurance_value: 0,
                        use_insurance_value: false
                    },

                    package: {
                        weight: peso,
                        height: altura,
                        width: largura,
                        length: comprimento
                    }

                })
            }
        );

        // ==============================
        // TRATAMENTO DA RESPOSTA
        // ==============================

        const textoResposta = await resposta.text();

        let dados;

        try {
            dados = JSON.parse(textoResposta);
        } catch (erroJson) {

            console.error(
                "Resposta não-JSON da SuperFrete:",
                textoResposta
            );

            return res.status(502).json({
                erro: "A SuperFrete retornou uma resposta inválida.",
                opcoes: [],

                debug: {
                    statusHttp: resposta.status,
                    respostaSuperFrete: textoResposta
                }
            });
        }

        // ==============================
        // ERRO DA SUPERFRETE
        // ==============================

        if (!resposta.ok) {

            console.error(
                "Erro SuperFrete:",
                dados
            );

            return res.status(resposta.status).json({
                erro:
                    dados.message ||
                    dados.error ||
                    JSON.stringify(dados),

                opcoes: [],

                debug: {
                    statusHttp: resposta.status,
                    respostaSuperFrete: dados,

                    entrada: {
                        cepOrigem: "53150170",
                        cepDestino: cep,
                        quantidade: quantidadeNumerica,
                        pesoRealKg: peso,
                        pesoRealGramas: peso * 1000,
                        pesoCubicoKg: pesoCubico,
                        dimensoes: {
                            altura,
                            largura,
                            comprimento
                        }
                    }
                }
            });
        }

        // ==============================
        // GARANTE QUE A RESPOSTA É ARRAY
        // ==============================

        if (!Array.isArray(dados)) {

            console.error(
                "Resposta inesperada da SuperFrete:",
                dados
            );

            return res.status(502).json({
                erro: "Formato de resposta inesperado da SuperFrete.",
                opcoes: [],

                debug: {
                    respostaSuperFrete: dados
                }
            });
        }

        // ==============================
        // TRANSFORMA AS OPÇÕES
        // ==============================

        const opcoes = dados
            .filter(opcao =>
                opcao &&
                opcao.price &&
                !opcao.has_error
            )
            .map(opcao => {

                const precoApi = Number(opcao.price);

                const precoFinal =
                    precoApi + TAXA_FRETE;

                return {

                    // Nome exibido no site
                    nome: opcao.name,

                    // Preço que veio diretamente da API
                    precoApi: precoApi
                        .toFixed(2)
                        .replace(".", ","),

                    // Preço mostrado ao cliente
                    preco: precoFinal
                        .toFixed(2)
                        .replace(".", ","),

                    // Prazo
                    prazo: opcao.delivery_time,

                    // Transportadora
                    transportadora:
                        opcao.company?.name || "",

                    // Informações adicionais da API
                    serviceId:
                        opcao.id ||
                        opcao.service ||
                        opcao.service_id ||
                        null,

                    hasError:
                        opcao.has_error || false
                };
            })
            .sort((a, b) => {

                const precoA =
                    Number(
                        a.preco.replace(",", ".")
                    );

                const precoB =
                    Number(
                        b.preco.replace(",", ".")
                    );

                return precoA - precoB;
            });

        // ==============================
        // NENHUMA OPÇÃO
        // ==============================

        if (opcoes.length === 0) {

            return res.status(404).json({

                erro:
                    "Nenhuma opção de frete disponível para este CEP.",

                opcoes: [],

                debug: {

                    entrada: {
                        cepOrigem: "53150170",
                        cepDestino: cep,
                        quantidade: quantidadeNumerica,

                        pesoRealKg: peso,

                        pesoRealGramas:
                            peso * 1000,

                        pesoCubicoKg:
                            Number(pesoCubico.toFixed(4)),

                        dimensoes: {
                            altura,
                            largura,
                            comprimento
                        }
                    },

                    taxaFrete:
                        TAXA_FRETE,

                    respostaSuperFrete:
                        dados
                }
            });
        }

        // ==============================
        // RESPOSTA FINAL
        // ==============================

        return res.status(200).json({

            opcoes,

            // Informações para conferirmos
            // exatamente o que foi enviado
            debug: {

                entrada: {

                    cepOrigem:
                        "53150170",

                    cepDestino:
                        cep,

                    quantidade:
                        quantidadeNumerica,

                    pesoRealKg:
                        Number(peso.toFixed(3)),

                    pesoRealGramas:
                        peso * 1000,

                    pesoCubicoKg:
                        Number(
                            pesoCubico.toFixed(4)
                        ),

                    dimensoes: {
                        altura,
                        largura,
                        comprimento
                    }
                },

                calculo: {

                    pesoPorLequeGramas:
                        170,

                    pesoTotalGramas:
                        peso * 1000,

                    pesoCubicoGramas:
                        Number(
                            (pesoCubico * 1000).toFixed(1)
                        ),

                    taxaFrete:
                        TAXA_FRETE
                },

                respostaOriginalSuperFrete:
                    dados
            }
        });

    } catch (erro) {

        console.error(
            "Erro no backend:",
            erro
        );

        return res.status(500).json({

            erro:
                erro.message ||
                "Não foi possível calcular o frete.",

            opcoes: [],

            debug: {
                erroCompleto:
                    String(erro)
            }
        });
    }
}
