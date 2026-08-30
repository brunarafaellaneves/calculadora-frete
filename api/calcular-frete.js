export default async function handler(req, res) {
    try {
        const resposta = await fetch("https://api.superfrete.com.br");

        const texto = await resposta.text();

        return res.status(200).json({
            status: resposta.status,
            resposta: texto.substring(0, 500)
        });

    } catch (erro) {
        return res.status(500).json({
            erro: erro.message,
            nome: erro.name,
            causa: erro.cause ? String(erro.cause) : null
        });
    }
}
