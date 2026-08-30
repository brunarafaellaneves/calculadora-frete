```javascript
export default async function handler(req, res) {

    if (req.method !== "POST") {
        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {

        const { cepDestino, quantidade } = req.body;

        const cep = String(cepDestino || "").replace(/\D/g, "");
        const qtd = Number(quantidade);

        // ==============================
        // VALIDAÇÕES
        // ==============================

        if (cep.length !== 8) {
            return res.status(400).json({
                erro: "CEP inválido."
            });
        }

        if (!Number.isInteger(qtd) || qtd < 1 || qtd > 5) {
            return res.status(400).json({
                erro: "A quantidade deve ser entre 1 e 5 leques."
            });
        }

        if (!process.env.SUPERFRETE_API_KEY) {
            return res.status(500).json({
                erro: "SUPERFRETE_API_KEY não configurada."
            });
        }

        // 150g por leque
        const peso = qtd * 0.15;


        // ==============================
        // SUPERFRETE
        // ==============================

        const resposta = await fetch(
            "https://api.superfrete.com/api/v0/calculator",
            {
                method: "POST",

                headers: {
                    "Authorization": `Bearer ${process.env.SUPERFRETE_API_KEY}`,
                    "User-Agent": "Wild Flower Store (SEU_EMAIL_AQUI)",
                    "Accept": "application/json",
                    "Content-Type": "application/json"
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
                        length: 42
                    }

                })
            }
        );


        // ==============================
        // RESPOSTA
        // ==============================

        const dados = await resposta.json();

        console.log("SuperFrete:", dados);


        // ==============================
        // ERRO DA SUPERFRETE
        // ==============================

        if (!resposta.ok) {

            return res.status(resposta.status).json({
                erro:
                    dados?.message ||
                    dados?.error ||
                    "Erro ao consultar a SuperFrete."
            });
        }


        // ==============================
        // GARANTIR ARRAY
        // ==============================

        if (!Array.isArray(dados)) {

            return res.status(500).json({
                erro: "Resposta inesperada da SuperFrete."
            });
        }


        // ==============================
        // FRETES
        // ==============================

        const opcoes = dados
            .filter(opcao =>
                opcao &&
                opcao.price !== null &&
                opcao.price !== undefined &&
                !opcao.has_error
            )
            .map(opcao => ({

                nome: opcao.name || "Frete",

                preco: Number(opcao.price)
                    .toFixed(2)
                    .replace(".", ","),

                prazo: opcao.delivery_time,

                transportadora:
                    opcao.company?.name || "",

                // Mantemos o valor numérico
                // somente para ordenar
                precoNumerico:
                    Number(opcao.price)

            }))
            .sort((a, b) =>
                a.precoNumerico - b.precoNumerico
            )
            .map(opcao => {

                // Não enviamos precoNumerico para o HTML
                const {
                    precoNumerico,
                    ...resultado
                } = opcao;

                return resultado;
            });


        // ==============================
        // NENHUM FRETE
        // ==============================

        if (opcoes.length === 0) {

            return res.status(404).json({
                erro:
                    "Nenhuma opção de frete disponível para este CEP."
            });
        }


        // ==============================
        // RETORNO
        // ==============================

        return res.status(200).json({
            opcoes
        });


    } catch (erro) {

        console.error(
            "Erro no cálculo do frete:",
            erro
        );

        return res.status(500).json({
            erro:
                "Não foi possível calcular o frete."
        });
    }
}
```
