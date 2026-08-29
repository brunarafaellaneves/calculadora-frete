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

        const peso = quantidade * 0.15;

        const resposta = await fetch(
            "https://superfrete.com/api/v0/calculator",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.SUPERFRETE_API_KEY}`
                },

                body: JSON.stringify({

                    from: {
                        postal_code: "53150170"
                    },

                    to: {
                        postal_code: cepDestino
                    },

                    services: "1,2",

                    package: {
                        weight: peso,
                        width: 8,
                        height: 8,
                        length: 42
                    }

                })
            }
        );


        const dados = await resposta.json();


        if (!resposta.ok) {

            return res.status(resposta.status).json({
                erro: dados.message || "Erro ao consultar a SuperFrete."
            });

        }


        const opcoes = dados
            .filter(opcao => opcao.price)
            .map(opcao => ({

                nome: opcao.name,

                preco: Number(opcao.price)
                    .toFixed(2)
                    .replace(".", ","),

                prazo: opcao.delivery_time

            }));


        return res.status(200).json({
            opcoes
        });


    } catch (erro) {

        console.error(erro);

        return res.status(500).json({
            erro: "Não foi possível calcular o frete."
        });

    }

}
