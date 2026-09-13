export default async function handler(req, res) {

    const TAXA_FRETE = 1.50;
    const PESO_POR_LEQUE = 0.170;

    if (req.method !== "POST") {
        return res.status(405).json({
            erro: "Método não permitido.",
            opcoes: []
        });
    }

    try {

        const { cepDestino, quantidade } = req.body || {};

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

        const cep = String(cepDestino).replace(/\D/g, "");

        if (cep.length !== 8) {
            return res.status(400).json({
                erro: "CEP inválido.",
                opcoes: []
            });
        }

        // ==========================================================
        // PESO
        // ==========================================================

        const peso = quantidadeNumerica * PESO_POR_LEQUE;

        console.log(
            `Quantidade: ${quantidadeNumerica} | ` +
            `Peso: ${peso} kg | ` +
            `${peso * 1000} g`
        );


        // ==========================================================
        // CALCULAR FRETE
        // ==========================================================

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
                        height: 8,
                        width: 8,
                        length: 44
                    }

                })
            }
        );


        // ==========================================================
        // LER RESPOSTA
        // ==========================================================

        const texto = await resposta.text();

        let dados;

        try {
            dados = JSON.parse(texto);
        } catch (erro) {

            console.error(
                "SuperFrete retornou algo que não é JSON:",
                texto
            );

            return res.status(502).json({
                erro: "Erro na resposta da SuperFrete.",
                opcoes: []
            });
        }


        // ==========================================================
        // ERRO DA SUPERFRETE
        // ==========================================================

        if (!resposta.ok) {

            console.error(
                "Erro SuperFrete:",
                dados
            );

            return res.status(resposta.status).json({
                erro:
                    dados.message ||
                    dados.error ||
                    dados.erro ||
                    "Erro ao calcular frete.",
                opcoes: []
            });
        }


        // ==========================================================
        // GARANTIR QUE A RESPOSTA É UMA LISTA
        // ==========================================================

        if (!Array.isArray(dados)) {

            console.error(
                "Resposta inesperada da SuperFrete:",
                dados
            );

            return res.status(500).json({
                erro: "Resposta inesperada da SuperFrete.",
                opcoes: []
            });
        }


        // ==========================================================
        // FILTRAR E FORMATAR
        // ==========================================================

        const opcoes = dados
            .filter(opcao =>
                opcao &&
                opcao.price &&
                !opcao.has_error
            )
            .map(opcao => {

                const preco =
                    Number(opcao.price) + TAXA_FRETE;

                return {
                    nome: opcao.name || "",

                    preco:
                        preco
                            .toFixed(2)
                            .replace(".", ","),

                    prazo:
                        opcao.delivery_time || "",

                    transportadora:
                        opcao.company?.name || ""
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


        // ==========================================================
        // NENHUMA OPÇÃO
        // ==========================================================

        if (opcoes.length === 0) {

            return res.status(404).json({
                erro:
                    "Nenhuma opção de frete disponível para este CEP.",
                opcoes: []
            });
        }


        // ==========================================================
        // RETORNO
        // ==========================================================

        return res.status(200).json({
            opcoes: opcoes
        });


    } catch (erro) {

        console.error(
            "Erro no endpoint:",
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
