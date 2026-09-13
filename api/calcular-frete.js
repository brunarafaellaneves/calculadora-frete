export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {

        const { cepDestino, quantidade } = req.body || {};

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

        const cep = String(cepDestino).replace(/\D/g, "");

        if (cep.length !== 8) {
            return res.status(400).json({
                erro: "CEP inválido."
            });
        }

        // 170g por leque
        const peso = quantidadeNumerica * 0.170;

        console.log("=================================");
        console.log("CEP:", cep);
        console.log("Quantidade:", quantidadeNumerica);
        console.log("Peso:", peso, "kg");
        console.log("Peso:", peso * 1000, "g");
        console.log("=================================");


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


        // ======================================================
        // PEGAR RESPOSTA BRUTA
        // ======================================================

        const respostaTexto = await resposta.text();


        console.log("=================================");
        console.log("STATUS SUPERFRETE:", resposta.status);
        console.log("RESPOSTA SUPERFRETE:");
        console.log(respostaTexto);
        console.log("=================================");


        // ======================================================
        // RETORNAR RESPOSTA BRUTA
        // ======================================================

        return res.status(200).json({

            statusSuperFrete: resposta.status,

            respostaSuperFrete: respostaTexto

        });


    } catch (erro) {

        console.error("ERRO:", erro);

        return res.status(500).json({

            erro:
                erro.message ||
                "Erro desconhecido."

        });

    }

}
