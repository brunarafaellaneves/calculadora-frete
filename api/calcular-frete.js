```javascript
export default async function handler(req, res) {

    // ==========================================
    // 1. MÉTODO DA REQUISIÇÃO
    // ==========================================

    if (req.method !== "POST") {
        return res.status(405).json({
            erro: "Método não permitido."
        });
    }


    try {

        // ==========================================
        // 2. RECEBER DADOS
        // ==========================================

        const { cepDestino, quantidade } = req.body;

        // Remove caracteres do CEP
        const cep = String(cepDestino || "")
            .replace(/\D/g, "");

        const qtd = Number(quantidade);


        // ==========================================
        // 3. VALIDAR CEP
        // ==========================================

        if (!cep) {
            return res.status(400).json({
                erro: "CEP é obrigatório."
            });
        }

        if (cep.length !== 8) {
            return res.status(400).json({
                erro: "CEP inválido. Digite um CEP com 8 números."
            });
        }


        // ==========================================
        // 4. VALIDAR QUANTIDADE
        // ==========================================

        if (!quantidade) {
            return res.status(400).json({
                erro: "Quantidade de leques é obrigatória."
            });
        }

        if (!Number.isInteger(qtd) || qtd < 1 || qtd > 5) {
            return res.status(400).json({
                erro: "A quantidade deve ser entre 1 e 5 leques."
            });
        }


        // ==========================================
        // 5. PESO DO PACOTE
        // ==========================================

        // Cada leque pesa aproximadamente 150g
        const peso = qtd * 0.15;


        // ==========================================
        // 6. VERIFICAR TOKEN
        // ==========================================

        if (!process.env.SUPERFRETE_API_KEY) {

            console.error(
                "SUPERFRETE_API_KEY não configurada."
            );

            return res.status(500).json({
                erro: "Chave da SuperFrete não configurada no servidor."
            });
        }


        // ==========================================
        // 7. CONSULTAR SUPERFRETE
        // ==========================================

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

                    // CEP de origem
                    from: {
                        postal_code: "53150170"
                    },

                    // CEP de destino
                    to: {
                        postal_code: cep
                    },

                    // Serviços consultados
                    services: "1,2,17,3,33,31",

                    // Opções
                    options: {

                        own_hand: false,

                        receipt: false,

                        insurance_value: 0,

                        use_insurance_value: false

                    },

                    // Dimensões da embalagem
                    package: {

                        weight: peso,

                        height: 8,

                        width: 8,

                        length: 42

                    }

                })
            }
        );


        // ==========================================
        // 8. LER RESPOSTA
        // ==========================================

        const textoResposta =
            await resposta.text();

        let dados;


        try {

            dados =
                JSON.parse(textoResposta);

        } catch {

            console.error(
                "Resposta inválida da SuperFrete:",
                textoResposta
            );

            return res.status(502).json({

                erro:
                    "A SuperFrete retornou uma resposta inválida."

            });
        }


        // Log para facilitar diagnóstico
        console.log(
            "Resposta SuperFrete:",
            dados
        );


        // ==========================================
        // 9. VERIFICAR ERRO DA API
        // ==========================================

        if (!resposta.ok) {

            console.error(
                "Erro SuperFrete:",
                dados
            );

            return res.status(resposta.status).json({

                erro:
                    dados?.message ||
                    dados?.error ||
                    dados?.errors ||
                    "Erro ao consultar a SuperFrete."

            });
        }


        // ==========================================
        // 10. VALIDAR RESPOSTA
        // ==========================================

        if (!Array.isArray(dados)) {

            console.error(
                "Formato inesperado:",
                dados
            );

            return res.status(502).json({

                erro:
                    "Formato de resposta inesperado da SuperFrete."

            });
        }


        // ==========================================
        // 11. CRIAR OPÇÕES DE FRETE
        // ==========================================

        const opcoes = dados

            .filter(opcao =>

                opcao &&

                opcao.price !== null &&

                opcao.price !== undefined &&

                Number(opcao.price) > 0 &&

                !opcao.has_error

            )

            .map(opcao => ({

                nome:
                    opcao.name ||
                    "Frete",

                preco:
                    Number(opcao.price)
                        .toFixed(2)
                        .replace(".", ","),

                prazo:
                    opcao.delivery_time,

                transportadora:
                    opcao.company?.name ||
                    ""

            }))


            // ==========================================
            // 12. ORDENAR DO MAIS BARATO AO MAIS CARO
            // ==========================================

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


        // ==========================================
        // 13. NENHUMA OPÇÃO
        // ==========================================

        if (opcoes.length === 0) {

            return res.status(404).json({

                erro:
                    "Nenhuma opção de frete disponível para este CEP."

            });
        }


        // ==========================================
        // 14. RETORNAR RESULTADO
        // ==========================================

        return res.status(200).json({

            opcoes

        });


    } catch (erro) {

        // ==========================================
        // 15. ERRO GERAL
        // ==========================================

        console.error(
            "Erro no cálculo do frete:",
            erro
        );

        return res.status(500).json({

            erro:
                "Não foi possível calcular o frete.",

            detalhe:
                erro?.message ||
                "Erro desconhecido."

        });

    }

}
```
