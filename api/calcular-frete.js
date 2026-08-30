export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {

        const { cepDestino, quantidade } = req.body;

        if (!cepDestino || !quantidade) {
            return res.status(400).json({
                erro: "CEP e quantidade são obrigatórios."
            });
        }

        if (quantidade < 1 || quantidade > 5) {
            return res.status(400).json({
                erro: "A quantidade deve ser entre 1 e 5 leques."
            });
        }

        // Cada leque pesa aproximadamente 150g
        const peso = quantidade * 0.15;

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
                        postal_code: cepDestino
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
                        length: 42
                    }

                })
            }
        );


        const dados = await resposta.json();


        if (!resposta.ok) {

            return res.status(resposta.status).json({
                erro:
                    dados.message ||
                    dados.error ||
                    JSON.stringify(dados)
            });

        }


        // ==========================================
        // FILTRAR E ORDENAR
        // ==========================================

        const opcoes = dados

            .filter(opcao =>
                opcao.price &&
                !opcao.has_error
            )

            .map(opcao => ({

                nome: opcao.name,

                preco: Number(opcao.price)
                    .toFixed(2)
                    .replace(".", ","),

                prazo: opcao.delivery_time,

                transportadora:
                    opcao.company?.name || ""

            }))

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
                    "Nenhuma opção de frete disponível para este CEP."
            });

        }


        return res.status(200).json({
            opcoes
        });


    } catch (erro) {

        console.error(
            "Erro:",
            erro
        );

        return res.status(500).json({
            erro:
                erro.message ||
                "Não foi possível calcular o frete."
        });

    }

}
