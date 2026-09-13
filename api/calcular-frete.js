export default async function handler(req, res) {

    const TAXA_FRETE = 1.50;

    if (req.method !== "POST") {
        return res.status(405).json({
            erro: "Método não permitido.",
            opcoes: []
        });
    }

    try {

        const { cepDestino, quantidade } = req.body;

        if (!cepDestino || quantidade === undefined) {
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

        const cep = String(cepDestino).replace(/\D/g, "");

        if (cep.length !== 8) {
            return res.status(400).json({
                erro: "CEP de destino inválido.",
                opcoes: []
            });
        }

        // ==========================================
        // PESO
        // ==========================================

        const PESO_POR_LEQUE = 0.170;

        const peso = Number(
            (quantidadeNumerica * PESO_POR_LEQUE).toFixed(3)
        );

        // ==========================================
        // DIMENSÕES
        // ==========================================

        const altura = 8;
        const largura = 8;
        const comprimento = 44;

        const pesoCubico = Number(
            (
                (altura * largura * comprimento) / 6000
            ).toFixed(4)
        );

        console.log("=================================");
        console.log("CALCULANDO FRETE");
        console.log("Quantidade:", quantidadeNumerica);
        console.log("Peso enviado:", peso, "kg");
        console.log("Peso cúbico:", pesoCubico, "kg");
        console.log("CEP destino:", cep);
        console.log("=================================");

        // ==========================================
        // SUPERFRETE
        // ==========================================

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

        const textoResposta = await resposta.text();

        let dados;

        try {
            dados = JSON.parse(textoResposta);
        } catch (erro) {

            console.error(
                "Resposta inválida da SuperFrete:",
                textoResposta
            );

            return res.status(502).json({
                erro: "A SuperFrete retornou uma resposta inválida.",
                opcoes: []
            });
        }

        if (!resposta.ok) {

            console.error(
                "Erro SuperFrete:",
                dados
            );

            return res.status(resposta.status).json({
                erro:
                    dados.message ||
                    dados.error ||
                    "Erro ao calcular frete.",
                opcoes: []
            });
        }

        if (!Array.isArray(dados)) {

            console.error(
                "Resposta inesperada:",
                dados
            );

            return res.status(502).json({
                erro: "Formato de resposta inesperado.",
                opcoes: []
            });
        }

        // ==========================================
        // OPÇÕES
        // ==========================================

        const opcoes = dados
            .filter(opcao =>
                opcao &&
                opcao.price &&
                !opcao.has_error
            )
            .map(opcao => {

                const precoApi =
                    Number(opcao.price);

                const precoFinal =
                    precoApi + TAXA_FRETE;

                return {

                    nome:
                        opcao.name,

                    preco:
                        precoFinal
                            .toFixed(2)
                            .replace(".", ","),

                    prazo:
                        opcao.delivery_time,

                    transportadora:
                        opcao.company?.name || "",

                    precoApi:
                        precoApi
                            .toFixed(2)
                            .replace(".", ","),

                    serviceId:
                        opcao.id ||
                        opcao.service ||
                        opcao.service_id ||
                        null

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

        if (opcoes.length === 0) {

            return res.status(404).json({

                erro:
                    "Nenhuma opção de frete disponível para este CEP.",

                opcoes: [],

                debug: {

                    quantidade:
                        quantidadeNumerica,

                    pesoEnviado:
                        peso,

                    pesoEnviadoGramas:
                        peso * 1000,

                    pesoCubico:
                        pesoCubico,

                    dimensoes:
                        `${altura} x ${largura} x ${comprimento}`,

                    respostaSuperFrete:
                        dados

                }

            });
        }

        // ==========================================
        // RESPOSTA
        // ==========================================

        return res.status(200).json({

            opcoes,

            debug: {

                quantidade:
                    quantidadeNumerica,

                pesoPorLeque:
                    0.170,

                pesoEnviado:
                    peso,

                pesoEnviadoGramas:
                    peso * 1000,

                pesoCubico:
                    pesoCubico,

                pesoCubicoGramas:
                    pesoCubico * 1000,

                dimensoes: {
                    altura,
                    largura,
                    comprimento
                },

                cepOrigem:
                    "53150170",

                cepDestino:
                    cep,

                taxaFrete:
                    TAXA_FRETE

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

            opcoes: []

        });

    }

}
