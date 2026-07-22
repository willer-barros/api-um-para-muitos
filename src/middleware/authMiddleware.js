import jwt from "jsonwebtoken"

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET

if(!ACCESS_SECRET){
    throw new Error("Chave secreta nao esta definida no ambiente")
}

export function verificarToken(req, res, next){
    const authHeader = req.headers.authorization;

    if(!authHeader){
        return res.status(401).json({erro: "Token nao fornecido"})
    }

    const partes = authHeader.split(" ");
    if(partes.length !== 2 || partes[0] !== "Bearer"){
        return res.status(401).json({erro: "Token mal formatado."})
    }

    const token = partes[1];

    try{
        const dadosDecodificados = jwt.verify(token, ACCESS_SECRET)
        req.usuarioLogadoId = dadosDecodificados.id

        return next()
    } catch(error){
        return res.status(401).json({ erro: "Token invalido ou expirado"})
    }
}