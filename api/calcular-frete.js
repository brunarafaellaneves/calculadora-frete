export default async function handler(req, res) {

    const TAXA_FRETE = 1.50;

    if (req.method !== "POST") {
        return res.status(405).json({
            erro: "Método não permitido.",
            opcoes: []
        });
    }

    try {

        const { cepDestino, quantidade } = req.body;

        // ==========================================
        // VALIDAÇÕES
        // ==========================================

        if (!cepDestino || quantidade === undefined) {
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
                erro: "CEP de destino inválido.",
                opcoes: []
            });
        }

        // ==========================================
        // PESO
        // ==========================================

        // Cada leque = 170g
        const peso = Number(
            (quantidadeNumerica * 0.170).toFixed(3)
        );

        // ==========================================
        // DIMENSÕES
        // ==========================================

        const altura = 8;
        const largura = 8;
        const comprimento = 44;

        // ==========================================
        // CHAMAR A MESMA CALCULADORA
        // USADA PELO SITE DA SUPERFRETE
        // ==========================================

        const resposta = await fetch(
            "https://us-central1-freight-calculator-8d6c1.cloudfunctions.net/apiCorreiosV3Calculator",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },

                body: JSON.stringify({

                    data: {

                        origin_postcode:
                            "53150-170",

                        destination_postcode:
                            cep,

                        weight:
                            peso,

                        format_code:
                            1,

                        depth:
                            String(comprimento),

                        height:
                            String(altura),

                        width:
                            String(largura),

                        diameter:
                            null,

                        self_hand:
                            null,

                        declared_value_option:
                            null,

                        declared_value:
                            null,

                        acknowledgment_of_receipt:
                            null,

                        is_seller:
                            true,

                        device_os:
                            "browser",

                        update_count:
                            true,

                        ignore_discount:
                            null,

                        appVersion:
                            "5.19.1"

                    }

                })

            }
        );

        const texto = await resposta.text();

        let dados;

        try {
            dados = JSON.parse(texto);
        } catch (erro) {

            console.error(
                "Resposta inválida:",
                texto
            );

            return res.status(502).json({
                erro: "A calculadora da SuperFrete retornou uma resposta inválida.",
                opcoes: []
            });
        }

        // ==========================================
        // VERIFICAR ERRO
        // ==========================================

        if (!resposta.ok) {

            console.error(
                "Erro da calculadora:",
                dados
            );

            return res.status(resposta.status).json({
                erro:
                    dados?.error?.message ||
                    dados?.message ||
                    "Erro ao calcular o frete.",
                opcoes: []
            });
        }

        const servicos =
            dados?.result?.services;

        if (!Array.isArray(servicos)) {

            console.error(
                "Serviços não encontrados:",
                dados
            );

            return res.status(502).json({
                erro: "Não foi possível encontrar as opções de frete.",
                opcoes: []
            });
        }

        // ==========================================
        // TRANSFORMAR SERVIÇOS
        // ==========================================

        const opcoes = servicos

            .filter(servico =>
                servico &&
                servico.total_with_discount != null &&
                !servico.has_error
            )

            .map(servico => {

                const preco =
                    Number(
                        servico.total_with_discount
                    );

                return {

                    nome:
                        servico.name,

                    preco:
                        (preco + TAXA_FRETE)
                            .toFixed(2)
                            .replace(".", ","),

                    prazo:
                        servico.delivery_time,

                    transportadora:
                        servico.carrier || "",

                    precoSuperFrete:
                        preco
                            .toFixed(2)
                            .replace(".", ","),

                    codigo:
                        servico.code

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

        // ==========================================
        // NENHUM RESULTADO
        // ==========================================

        if (opcoes.length === 0) {

            return res.status(404).json({
                erro:
                    "Nenhuma opção de frete disponível para este CEP.",
                opcoes: []
            });
        }

        // ==========================================
        // RESPOSTA
        // ==========================================

        return res.status(200).json({

            opcoes,

            debug: {

                quantidade:
                    quantidadeNumerica,

                pesoEnviado:
                    peso,

                pesoEmGramas:
                    peso * 1000,

                dimensoes: {
                    altura,
                    largura,
                    comprimento
                },

                respostaCalculadora:
                    dados?.result?.data

            }

        });

    } catch (erro) {

        console.error(
            "Erro no backend:",
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
