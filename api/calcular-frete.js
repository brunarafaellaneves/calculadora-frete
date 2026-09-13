export default async function handler(req, res) {
    const TAXA_FRETE = 1.50;

    // --------------------------------
    // MÉTODO
    // --------------------------------

    if (req.method !== "POST") {
        return res.status(405).json({
            erro: "Método não permitido.",
            opcoes: []
        });
    }

    try {
        const { cepDestino, quantidade } = req.body;

        // --------------------------------
        // VALIDAÇÃO DA QUANTIDADE
        // --------------------------------

        const qtd = Number(quantidade);

        if (!Number.isInteger(qtd) || qtd < 1 || qtd > 5) {
            return res.status(400).json({
                erro: "A quantidade deve ser entre 1 e 5 leques.",
                opcoes: []
            });
        }

        // --------------------------------
        // VALIDAÇÃO DO CEP
        // --------------------------------

        if (!cepDestino) {
            return res.status(400).json({
                erro: "CEP de destino é obrigatório.",
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

        // --------------------------------
        // PESO
        // --------------------------------
        //
        // 1 leque  = faixa de até 300g
        // 2 a 5    = faixa de até 1kg
        //
        // A calculadora da SuperFrete trabalha
        // com essas faixas de peso.

        const peso = qtd === 1 ? 0.300 : 1.000;

        // --------------------------------
        // DIMENSÕES DA CAIXA
        // --------------------------------

        const altura = 8;
        const largura = 8;
        const comprimento = 44;

        // --------------------------------
        // API SUPERFRETE
        // --------------------------------

        const resposta = await fetch(
            "https://api.superfrete.com/api/v0/calculator",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
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

                    services: "1,2,17,3,31,33",

                    options: {
                        own_hand: false,
                        receipt: false,
                        insurance_value: 0
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

        // --------------------------------
        // LER RESPOSTA
        // --------------------------------

        const texto = await resposta.text();

        let dados;

        try {
            dados = JSON.parse(texto);
        } catch (erro) {
            console.error(
                "Resposta inválida da SuperFrete:",
                texto
            );

            return res.status(502).json({
                erro:
                    "A SuperFrete retornou uma resposta inválida.",
                opcoes: []
            });
        }

        // --------------------------------
        // ERRO DA API
        // --------------------------------

        if (!resposta.ok) {
            console.error(
                "Erro da SuperFrete:",
                dados
            );

            return res.status(resposta.status).json({
                erro:
                    dados?.message ||
                    dados?.error ||
                    "Erro ao calcular o frete.",
                opcoes: []
            });
        }

        // --------------------------------
        // LOCALIZAR SERVIÇOS
        // --------------------------------

        const servicos =
            Array.isArray(dados)
                ? dados
                : Array.isArray(dados?.services)
                    ? dados.services
                    : Array.isArray(dados?.data)
                        ? dados.data
                        : [];

        if (servicos.length === 0) {
            console.error(
                "Nenhum serviço retornado:",
                dados
            );

            return res.status(404).json({
                erro:
                    "Nenhuma opção de frete disponível para este CEP.",
                opcoes: []
            });
        }

        // --------------------------------
        // TRANSFORMAR RESULTADOS
        // --------------------------------

        const opcoes = servicos
            .filter(servico => {

                if (!servico) {
                    return false;
                }

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

                const precoSuperFrete = Number(
                    servico.price ??
                    servico.total_with_discount ??
                    servico.total
                );

                const precoFinal =
                    precoSuperFrete + TAXA_FRETE;

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

            // --------------------------------
            // ORDENAR DO MAIS BARATO AO MAIS CARO
            // --------------------------------

            .sort((a, b) => {

                const valorA = Number(
                    a.preco.replace(",", ".")
                );

                const valorB = Number(
                    b.preco.replace(",", ".")
                );

                return valorA - valorB;
            });

        // --------------------------------
        // NENHUM FRETE
        // --------------------------------

        if (opcoes.length === 0) {
            return res.status(404).json({
                erro:
                    "Nenhuma opção de frete disponível para este CEP.",
                opcoes: []
            });
        }

        // --------------------------------
        // RESPOSTA
        // --------------------------------

        return res.status(200).json({
            opcoes
        });

    } catch (erro) {

        console.error(
            "Erro ao calcular frete:",
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
