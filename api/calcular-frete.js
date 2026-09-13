
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
        // VALIDAÇÃO
        // -----------------------------

        const qtd = Number(quantidade);

        if (!cepDestino) {
            return res.status(400).json({
                erro: "CEP de destino é obrigatório.",
                opcoes: []
            });
        }

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

        // Cada leque = 170 g
        const peso = Number((qtd * 0.170).toFixed(3));

        // -----------------------------
        // COTAÇÃO
        // -----------------------------

        const payload = {
            from: {
                postal_code: "53150-170"
            },

            to: {
                postal_code: cep
            },

            services: "1,2,17,3,31,33",

            options: {
                own_hand: false,
                receipt: false,
                insurance_value: 0,
                use_insurance_value: false
            },

            package: {
                weight: peso,
                height: 8,
                width: 8,
                length: 44
            }
        };

        const resposta = await fetch(
            "https://api.superfrete.com/api/v0/calculator",
            {
                method: "POST",

                headers: {
                    "Authorization":
                        `Bearer ${process.env.SUPERFRETE_API_KEY}`,

                    "User-Agent":
                        "Wild Flower Store Frete (contato)",

                    "Accept":
                        "application/json",

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify(payload)
            }
        );

        const texto = await resposta.text();

        let dados;

        try {
            dados = JSON.parse(texto);
        } catch {
            console.error(
                "Resposta inválida da SuperFrete:",
                texto
            );

            return res.status(502).json({
                erro: "A SuperFrete retornou uma resposta inválida.",
                opcoes: []
            });
        }

        // -----------------------------
        // ERRO DA SUPERFRETE
        // -----------------------------

        if (!resposta.ok) {
            console.error(
                "Erro SuperFrete:",
                JSON.stringify(dados)
            );

            return res.status(resposta.status).json({
                erro:
                    dados?.message ||
                    dados?.error ||
                    "Erro ao calcular o frete na SuperFrete.",
                opcoes: []
            });
        }

        // -----------------------------
        // NORMALIZA RESPOSTA
        // -----------------------------

        const servicos = Array.isArray(dados)
            ? dados
            : Array.isArray(dados?.services)
                ? dados.services
                : Array.isArray(dados?.data)
                    ? dados.data
                    : [];

        if (servicos.length === 0) {
            console.error(
                "Resposta sem serviços:",
                JSON.stringify(dados)
            );

            return res.status(404).json({
                erro:
                    "Nenhuma opção de frete encontrada para este CEP.",
                opcoes: []
            });
        }

        // -----------------------------
        // TRANSFORMA PREÇOS
        // -----------------------------

        const opcoes = servicos
            .filter(servico => {
                if (!servico) return false;

                if (
                    servico.has_error === true ||
                    servico.error
                ) {
                    return false;
                }

                const preco =
                    servico.price ??
                    servico.total_with_discount ??
                    servico.total;

                return (
                    preco !== undefined &&
                    preco !== null
                );
            })
            .map(servico => {

                const precoBase = Number(
                    servico.price ??
                    servico.total_with_discount ??
                    servico.total
                );

                const precoFinal =
                    precoBase + TAXA_FRETE;

                return {
                    nome:
                        servico.name ||
                        servico.service ||
                        "Frete",

                    prazo:
                        servico.delivery_time ??
                        servico.delivery_time_business_days ??
                        servico.deadline ??
                        "-",

                    preco:
                        precoFinal
                            .toFixed(2)
                            .replace(".", ","),

                    precoSuperFrete:
                        precoBase
                            .toFixed(2)
                            .replace(".", ","),

                    codigo:
                        servico.code ??
                        servico.id ??
                        "",

                    transportadora:
                        servico.carrier ||
                        servico.company?.name ||
                        ""
                };
            })
            .sort((a, b) => {
                const valorA = Number(
                    a.preco.replace(",", ".")
                );

                const valorB = Number(
                    b.preco.replace(",", ".")
                );

                return valorA - valorB;
            });

        if (opcoes.length === 0) {
            return res.status(404).json({
                erro:
                    "Nenhuma opção de frete disponível.",
                opcoes: []
            });
        }

        // -----------------------------
        // RESPOSTA PARA O SITE
        // -----------------------------

        return res.status(200).json({
            opcoes
        });

    } catch (erro) {

        console.error(
            "Erro interno:",
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
