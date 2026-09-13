
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

        // -----------------------------
        // VALIDAÇÕES
        // -----------------------------

        if (!cepDestino || quantidade === undefined) {
            return res.status(400).json({
                erro: "CEP e quantidade são obrigatórios.",
                opcoes: []
            });
        }

        const qtd = Number(quantidade);

        if (!Number.isInteger(qtd) || qtd < 1 || qtd > 5) {
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

        // -----------------------------
        // PESO
        // -----------------------------

        // Cada leque = 170g
        const peso = Number((qtd * 0.170).toFixed(3));

        // -----------------------------
        // DIMENSÕES
        // -----------------------------

        const pacote = {
            height: 8,
            width: 8,
            length: 44
        };

        // -----------------------------
        // API SUPERFRETE
        // -----------------------------

        const resposta = await fetch(
            "https://api.superfrete.com/api/v0/calculator",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization":
                        `Bearer ${process.env.SUPERFRETE_API_KEY}`
                },

                body: JSON.stringify({
                    from: {
                        postal_code: "53150-170"
                    },

                    to: {
                        postal_code: cep
                    },

                    services: "1,2,17,3,33,31",

                    package: {
                        weight: peso,
                        height: pacote.height,
                        width: pacote.width,
                        length: pacote.length
                    }
                })
            }
        );

        const texto = await resposta.text();

        let dados;

        try {
            dados = JSON.parse(texto);
        } catch {
            return res.status(502).json({
                erro: "A SuperFrete retornou uma resposta inválida.",
                opcoes: []
            });
        }

        if (!resposta.ok) {
            return res.status(resposta.status).json({
                erro:
                    dados?.message ||
                    dados?.error ||
                    "Erro ao calcular o frete.",
                opcoes: []
            });
        }

        // -----------------------------
        // TRANSFORMA RESULTADO
        // -----------------------------

        if (!Array.isArray(dados)) {
            return res.status(502).json({
                erro: "Formato de resposta inesperado da SuperFrete.",
                opcoes: []
            });
        }

        const opcoes = dados
            .filter(item => {
                return (
                    item &&
                    !item.has_error &&
                    item.price !== undefined &&
                    item.price !== null
                );
            })
            .map(item => {
                const precoSuperFrete = Number(item.price);

                return {
                    nome:
                        item.name ||
                        item.service ||
                        "Serviço",

                    prazo:
                        item.delivery_time ??
                        item.delivery_time_business_days ??
                        0,

                    preco:
                        (precoSuperFrete + TAXA_FRETE)
                            .toFixed(2)
                            .replace(".", ","),

                    precoSuperFrete:
                        precoSuperFrete
                            .toFixed(2)
                            .replace(".", ","),

                    codigo:
                        item.id ||
                        item.code ||
                        "",

                    transportadora:
                        item.company?.name ||
                        item.carrier ||
                        ""
                };
            })
            .sort((a, b) => {
                const precoA = Number(
                    a.preco.replace(",", ".")
                );

                const precoB = Number(
                    b.preco.replace(",", ".")
                );

                return precoA - precoB;
            });

        if (opcoes.length === 0) {
            return res.status(404).json({
                erro:
                    "Nenhuma opção de frete disponível para este CEP.",
                opcoes: []
            });
        }

        // -----------------------------
        // RESPOSTA
        // -----------------------------

        return res.status(200).json({
            opcoes,

            // Mantido apenas para conferência
            debug: {
                quantidade: qtd,
                peso: peso,
                pesoEmGramas: peso * 1000,
                dimensoes: pacote
            }
        });

    } catch (erro) {
        console.error("Erro calcular-frete:", erro);

        return res.status(500).json({
            erro:
                erro.message ||
                "Não foi possível calcular o frete.",
            opcoes: []
        });
    }
}
