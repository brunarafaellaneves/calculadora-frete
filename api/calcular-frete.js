export default async function handler(req, res) {

    // ============================================================
    // CONFIGURAÇÕES
    // ============================================================

    // Valor fixo adicionado ao frete mostrado ao cliente
    const TAXA_FRETE = 1.50;

    // Cada leque pesa exatamente 170 gramas
    const PESO_POR_LEQUE = 0.170;


    // ============================================================
    // VALIDAR MÉTODO
    // ============================================================

    if (req.method !== "POST") {

        return res.status(405).json({
            erro: "Método não permitido."
        });

    }


    try {

        // ========================================================
        // RECEBER DADOS
        // ========================================================

        const {
            cepDestino,
            quantidade
        } = req.body;


        // ========================================================
        // VALIDAR CEP
        // ========================================================

        if (!cepDestino) {

            return res.status(400).json({
                erro: "CEP é obrigatório."
            });

        }


        // ========================================================
        // VALIDAR QUANTIDADE
        // ========================================================

        if (
            quantidade === undefined ||
            quantidade === null ||
            quantidade === ""
        ) {

            return res.status(400).json({
                erro: "Quantidade é obrigatória."
            });

        }


        // Garante que a quantidade seja número
        const quantidadeNumerica =
            Number(quantidade);


        if (
            !Number.isInteger(quantidadeNumerica) ||
            quantidadeNumerica < 1 ||
            quantidadeNumerica > 5
        ) {

            return res.status(400).json({
                erro:
                    "A quantidade deve ser entre 1 e 5 leques."
            });

        }


        // ========================================================
        // CALCULAR PESO
        // ========================================================

        /*
            Cada leque = 170 g

            1 leque = 0.170 kg
            2 leques = 0.340 kg
            3 leques = 0.510 kg
            4 leques = 0.680 kg
            5 leques = 0.850 kg
        */

        const peso =
            quantidadeNumerica * PESO_POR_LEQUE;


        // ========================================================
        // LOG PARA CONFERÊNCIA
        // ========================================================

        console.log(
            "Cálculo do pacote:",
            {
                quantidade: quantidadeNumerica,
                pesoKg: peso,
                pesoGramas: peso * 1000
            }
        );


        // ========================================================
        // CHAMAR SUPERFRETE
        // ========================================================

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

                    // ------------------------------------------------
                    // ORIGEM
                    // ------------------------------------------------

                    from: {
                        postal_code: "53150170"
                    },


                    // ------------------------------------------------
                    // DESTINO
                    // ------------------------------------------------

                    to: {
                        postal_code:
                            String(cepDestino)
                                .replace(/\D/g, "")
                    },


                    // ------------------------------------------------
                    // SERVIÇOS
                    // ------------------------------------------------

                    services:
                        "1,2,17,3,33,31",


                    // ------------------------------------------------
                    // OPÇÕES
                    // ------------------------------------------------

                    options: {

                        own_hand: false,

                        receipt: false,

                        insurance_value: 0,

                        use_insurance_value: false

                    },


                    // ------------------------------------------------
                    // PACOTE
                    // ------------------------------------------------

                    package: {

                        // Peso TOTAL dos leques
                        weight: peso,

                        height: 8,

                        width: 8,

                        length: 44

                    }

                })

            }
        );


        // ========================================================
        // LER RESPOSTA
        // ========================================================

        const dados =
            await resposta.json();


        // ========================================================
        // TRATAR ERRO DA SUPERFRETE
        // ========================================================

        if (!resposta.ok) {

            console.error(
                "Erro retornado pela SuperFrete:",
                dados
            );

            return res.status(
                resposta.status
            ).json({

                erro:
                    dados.message ||
                    dados.error ||
                    JSON.stringify(dados)

            });

        }


        // ========================================================
        // GARANTIR QUE A RESPOSTA É UMA LISTA
        // ========================================================

        if (!Array.isArray(dados)) {

            console.error(
                "Resposta inesperada da SuperFrete:",
                dados
            );

            return res.status(500).json({

                erro:
                    "A resposta da SuperFrete não está no formato esperado."

            });

        }


        // ========================================================
        // FILTRAR E ORDENAR
        // ========================================================

        const opcoes = dados

            .filter(opcao =>

                opcao.price &&
                !opcao.has_error

            )

            .map(opcao => {

                const precoOriginal =
                    Number(opcao.price);


                const precoComTaxa =
                    precoOriginal +
                    TAXA_FRETE;


                return {

                    nome:
                        opcao.name || "",


                    preco:
                        precoComTaxa
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
                        a.preco
                            .replace(",", ".")
                    );


                const precoB =
                    Number(
                        b.preco
                            .replace(",", ".")
                    );


                return precoA - precoB;

            });


        // ========================================================
        // NENHUMA OPÇÃO
        // ========================================================

        if (opcoes.length === 0) {

            return res.status(404).json({

                erro:
                    "Nenhuma opção de frete disponível para este CEP."

            });

        }


        // ========================================================
        // RETORNO
        // ========================================================

        return res.status(200).json({

            opcoes

        });


    } catch (erro) {

        // ========================================================
        // ERRO GERAL
        // ========================================================

        console.error(
            "Erro no cálculo do frete:",
            erro
        );


        return res.status(500).json({

            erro:
                erro.message ||
                "Não foi possível calcular o frete."

        });

    }

}
```
