export default async function handler(req, res) {

    // Aceita somente POST
    if (req.method !== "POST") {
        return res.status(405).json({
            erro: "Método não permitido."
        });
    }

    try {

        // ==============================
        // 1. RECEBER DADOS DO SITE
        // ==============================

        const { cepDestino, quantidade } = req.body;

        // Remove tudo que não for número do CEP
        const cep = String(cepDestino || "").replace(/\D/g, "");

        const qtd = Number(quantidade);


        // ==============================
        // 2. VALIDAR CEP
        // ==============================

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


        // ==============================
        // 3. VALIDAR QUANTIDADE
        // ==============================

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


        // ==============================
        // 4. CONFIGURAÇÃO DO PACOTE
        // ==============================

        // Peso aproximado:
        // 1 leque = 150g = 0.15kg
        const peso = qtd * 0.15;


        // ==============================
        // 5. VERIFICAR TOKEN
        // ==============================

        if (!process.env.SUPERFRETE_API_KEY) {

            console.error(
                "SUPERFRETE_API_KEY não configurada."
            );

            return res.status(500).json({
                erro: "Chave da SuperFrete não configurada no servidor."
            });
        }


        // ==============================
        // 6. CHAMAR API SUPERFRETE
        // ==============================

        const resposta = await fetch(
            "https://sandbox.superfrete.com/api/v0/calculator",
            {
                method: "POST",

                headers: {

                    "Authorization":
                        `Bearer ${process.env.SUPERFRETE_API_KEY}`,

                    "User-Agent":
                        "Leques K-Pop (integracao@superfrete.com)",

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

                    // CEP informado pelo cliente
                    to: {
                        postal_code: cep
                    },

                    // Serviços que queremos consultar
                    services: "1,2,17,3,33,31",

                    // Opções adicionais
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


        // ==============================
        // 7. LER RESPOSTA DA API
        // ==============================

        const textoResposta =
            await resposta.text();

        let dados;

        try {

            dados =
                JSON.parse(textoResposta);

        } catch (erro) {

            console.error(
                "Resposta inválida da SuperFrete:",
                textoResposta
            );

            return res.status(502).json({

                erro:
                    "A SuperFrete retornou uma resposta inválida."

            });
        }


        // Mostra a resposta no log
        console.log(
            "Resposta da SuperFrete:",
            dados
        );


        // ==============================
        // 8. VERIFICAR ERRO DA API
        // ==============================

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


        // ==============================
        // 9. VALIDAR FORMATO DA RESPOSTA
        // ==============================

        if (!Array.isArray(dados)) {

            console.error(
                "Formato inesperado:",
                dados
            );

            return res.status(502).json({

                erro:
                    "Formato de resposta inesperado da SuperFrete.",

                resposta: dados

            });
        }


        // ==============================
        // 10. FILTRAR FRETES VÁLIDOS
        // ==============================

        const opcoes = dados

            .filter(opcao => {

                return (

                    opcao &&

                    opcao.price !== null &&

                    opcao.price !== undefined &&

                    Number(opcao.price) > 0 &&

                    !opcao.has_error

                );

            })

            .map(opcao => {

                return {

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
                };

            });


        // ==============================
        // 11. NENHUM FRETE DISPONÍVEL
        // ==============================

        if (opcoes.length === 0) {

            return res.status(404).json({

                erro:
                    "Nenhuma opção de frete disponível para este CEP."

            });
        }


        // ==============================
        // 12. RETORNAR FRETES PARA O SITE
        // ==============================

        return res.status(200).json({

            opcoes

        });


    } catch (erro) {

        // ==============================
        // 13. ERRO INESPERADO
        // ==============================

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
