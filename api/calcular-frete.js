export default async function handler(req, res) {

    // ==========================================================
    // CONFIGURAÇÕES
    // ==========================================================

    // Taxa fixa adicionada ao frete mostrado no site
    const TAXA_FRETE = 1.50;

    // Peso de cada leque
    const PESO_POR_LEQUE = 0.170;


    // ==========================================================
    // VALIDAR MÉTODO
    // ==========================================================

    if (req.method !== "POST") {

        return res.status(405).json({
            erro: "Método não permitido."
        });

    }


    try {

        // ======================================================
        // RECEBER DADOS
        // ======================================================

        const {
            cepDestino,
            quantidade
        } = req.body || {};


        // ======================================================
        // VALIDAR CEP E QUANTIDADE
        // ======================================================

        if (!cepDestino || !quantidade) {

            return res.status(400).json({
                erro: "CEP e quantidade são obrigatórios."
            });

        }


        const quantidadeNumerica = Number(quantidade);


        if (
            !Number.isInteger(quantidadeNumerica) ||
            quantidadeNumerica < 1 ||
            quantidadeNumerica > 5
        ) {

            return res.status(400).json({
                erro: "A quantidade deve ser entre 1 e 5 leques."
            });

        }


        // ======================================================
        // LIMPAR CEP
        // ======================================================

        const cep = String(cepDestino)
            .replace(/\D/g, "");


        if (cep.length !== 8) {

            return res.status(400).json({
                erro: "CEP inválido."
            });

        }


        // ======================================================
        // CALCULAR PESO
        // ======================================================

        /*
            1 leque = 170g
            2 leques = 340g
            3 leques = 510g
            4 leques = 680g
            5 leques = 850g
        */

        const peso =
            quantidadeNumerica * PESO_POR_LEQUE;


        const pesoEmGramas =
            peso * 1000;


        console.log(
            "Quantidade:",
            quantidadeNumerica
        );

        console.log(
            "Peso enviado:",
            peso,
            "kg"
        );

        console.log(
            "Peso em gramas:",
            pesoEmGramas,
            "g"
        );


        // ======================================================
        // CALCULAR FRETE
        // ======================================================

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

                    // ------------------------------------------
                    // ORIGEM
                    // ------------------------------------------

                    from: {
                        postal_code: "53150170"
                    },


                    // ------------------------------------------
                    // DESTINO
                    // ------------------------------------------

                    to: {
                        postal_code: cep
                    },


                    // ------------------------------------------
                    // SERVIÇOS
                    // ------------------------------------------

                    services:
                        "1,2,17,3,33,31",


                    // ------------------------------------------
                    // OPÇÕES
                    // ------------------------------------------

                    options: {

                        own_hand: false,

                        receipt: false,

                        insurance_value: 0,

                        use_insurance_value: false

                    },


                    // ------------------------------------------
                    // PACOTE
                    // ------------------------------------------

                    package: {

                        weight: peso,

                        height: 8,

                        width: 8,

                        length: 44

                    }

                })

            }
        );


        // ======================================================
        // LER RESPOSTA COM SEGURANÇA
        // ======================================================

        const textoResposta =
            await resposta.text();


        let dados;


        try {

            dados =
                JSON.parse(textoResposta);

        } catch (erroJson) {

            console.error(
                "Resposta não-JSON da SuperFrete:",
                textoResposta
            );

            return res.status(502).json({

                erro:
                    "A SuperFrete retornou uma resposta inválida.",

                detalhe:
                    textoResposta.substring(0, 500)

            });

        }


        // ======================================================
        // VERIFICAR ERRO DA SUPERFRETE
        // ======================================================

        if (!resposta.ok) {

            console.error(
                "Erro SuperFrete:",
                dados
            );

            return res.status(
                resposta.status
            ).json({

                erro:
                    dados.message ||
                    dados.error ||
                    dados.erro ||
                    JSON.stringify(dados)

            });

        }


        // ======================================================
        // VERIFICAR FORMATO DA RESPOSTA
        // ======================================================

        if (!Array.isArray(dados)) {

            console.error(
                "Resposta inesperada:",
                dados
            );

            return res.status(500).json({

                erro:
                    "A SuperFrete retornou um formato inesperado.",

                detalhe:
                    dados

            });

        }


        // ======================================================
        // FILTRAR E FORMATAR OPÇÕES
        // ======================================================

        const opcoes = dados

            .filter(opcao => {

                return (
                    opcao &&
                    opcao.price &&
                    !opcao.has_error
                );

            })


            .map(opcao => {

                const preco =
                    Number(opcao.price);


                return {

                    nome:
                        opcao.name || "",

                    preco:
                        (
                            preco +
                            TAXA_FRETE
                        )
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


        // ======================================================
        // NENHUMA OPÇÃO
        // ======================================================

        if (opcoes.length === 0) {

            return res.status(404).json({

                erro:
                    "Nenhuma opção de frete disponível para este CEP."

            });

        }


        // ======================================================
        // RETORNAR PARA O SITE
        // ======================================================

        return res.status(200).json({

            opcoes

        });


    } catch (erro) {

        console.error(
            "Erro no servidor:",
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
