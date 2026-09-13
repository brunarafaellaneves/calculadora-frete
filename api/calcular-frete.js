```javascript
export default async function handler(req, res) {

    // ==========================================================
    // CONFIGURAÇÕES
    // ==========================================================

    // Valor fixo adicionado ao frete mostrado ao cliente
    const TAXA_FRETE = 1.50;

    // Cada leque pesa 170g
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
        } = req.body;


        // ======================================================
        // VALIDAR DADOS
        // ======================================================

        if (!cepDestino || !quantidade) {

            return res.status(400).json({
                erro: "CEP e quantidade são obrigatórios."
            });

        }


        const quantidadeNumerica =
            Number(quantidade);


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
        // CALCULAR PESO
        // ======================================================

        const peso =
            quantidadeNumerica * PESO_POR_LEQUE;


        const pesoEmGramas =
            peso * 1000;


        console.log(
            "======================================"
        );

        console.log(
            "Quantidade:",
            quantidadeNumerica
        );

        console.log(
            "Peso:",
            peso,
            "kg"
        );

        console.log(
            "Peso:",
            pesoEmGramas,
            "g"
        );


        // ======================================================
        // SERVIÇOS
        // ======================================================

        /*
            Mini Envios tem limite de 300g.

            Portanto:

            1 leque = 170g
            -> Mini Envios permitido

            2 leques = 340g
            -> Mini Envios NÃO permitido

            3 leques = 510g
            -> Mini Envios NÃO permitido

            4 leques = 680g
            -> Mini Envios NÃO permitido

            5 leques = 850g
            -> Mini Envios NÃO permitido
        */


        let services;


        if (pesoEmGramas <= 300) {

            // Até 300g pode utilizar Mini Envios
            services = "1,2,17,3,33,31";

            console.log(
                "Faixa de peso: até 300g"
            );

        } else {

            // Acima de 300g NÃO solicitar Mini Envios
            services = "1,2,3,33,31";

            console.log(
                "Faixa de peso: acima de 300g"
            );

        }


        console.log(
            "Serviços enviados:",
            services
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

                    services: services,


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

                        weight: peso,

                        height: 8,

                        width: 8,

                        length: 44

                    }

                })

            }
        );


        // ======================================================
        // LER RESPOSTA
        // ======================================================

        const dados =
            await resposta.json();


        // ======================================================
        // TRATAR ERRO
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
                    JSON.stringify(dados)

            });

        }


        // ======================================================
        // VALIDAR RESPOSTA
        // ======================================================

        if (!Array.isArray(dados)) {

            console.error(
                "Resposta inesperada:",
                dados
            );

            return res.status(500).json({

                erro:
                    "A resposta da SuperFrete não está no formato esperado."

            });

        }


        // ======================================================
        // FILTRAR OPÇÕES
        // ======================================================

        const opcoes =
            dados

                .filter(opcao => {

                    // Precisa ter preço
                    if (!opcao.price) {
                        return false;
                    }

                    // Não pode ter erro
                    if (opcao.has_error) {
                        return false;
                    }

                    // Segurança:
                    // se passou de 300g, não aceitar Mini Envios
                    if (
                        pesoEmGramas > 300 &&
                        (
                            opcao.name
                                ?.toLowerCase()
                                .includes("mini")
                        )
                    ) {

                        return false;

                    }

                    return true;

                })


                // ==================================================
                // FORMATAR
                // ==================================================

                .map(opcao => ({

                    nome:
                        opcao.name || "",

                    preco:
                        (
                            Number(opcao.price) +
                            TAXA_FRETE
                        )
                            .toFixed(2)
                            .replace(".", ","),

                    prazo:
                        opcao.delivery_time || "",

                    transportadora:
                        opcao.company?.name || ""

                }))


                // ==================================================
                // ORDENAR PELO MENOR PREÇO
                // ==================================================

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


        // ======================================================
        // NENHUMA OPÇÃO
        // ======================================================

        if (opcoes.length === 0) {

            return res.status(404).json({

                erro:
                    "Nenhuma opção de frete disponível para este CEP e peso."

            });

        }


        // ======================================================
        // RETORNO
        // ======================================================

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
```
