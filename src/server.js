import express from "express";
import cors from "cors";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { prisma } from "./lib/prisma.ts";
import { verificarToken } from "./middleware/authMiddleware.js";

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;

const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;

if (!ACCESS_SECRET){
  throw new Error("ACCESS_TOKEN nao encontrado ")
}

if (!REFRESH_SECRET){
  throw new Error("REFRESH_TOKEN nao encontrado ")
}

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

// =========================================================================
// 🔓 ROTAS PÚBLICAS
// =========================================================================

// 📥 1. Registro de Usuários (Argon2id + UUID)
app.post("/usuarios", async (req, res) => {
    console.log(`📥 [API] Criando novo usuário...`);
    try {
        const { nome, email, senha } = req.body;
        
        const senhaHash = await argon2.hash(senha, { type: argon2.argon2id });
        
        const novoUsuario = await prisma.usuario.create({
            data: {
                nome,
                email,
                senha: senhaHash
            }
        });
        
        console.log(`✅ [API] Usuário criado! ID (UUID): ${novoUsuario.id}`);
        res.status(201).json({ 
            id: novoUsuario.id, 
            nome: novoUsuario.nome, 
            email: novoUsuario.email 
        }); 
    } catch (error) {
        console.error("❌ [API Erro]:", error.message || error);
        res.status(400).json({ erro: "Erro ao criar usuário", detalhe: error.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        
        const usuario = await prisma.usuario.findUnique({ where: { email } });
        if (!usuario) return res.status(401).json({ erro: "Credenciais inválidas." });

        const senhaCorreta = await argon2.verify(usuario.senha, senha);
        if (!senhaCorreta) return res.status(401).json({ erro: "Credenciais inválidas." });

        const payload = { id: usuario.id, email: usuario.email };

        const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '30d' });

        // Armazena o Refresh Token no banco de dados
        await prisma.usuario.update({
            where: { id: usuario.id },
            data: { refreshToken }
        });

        return res.json({
            accessToken,
            refreshToken,
            usuario: { 
                id: usuario.id, 
                nome: usuario.nome, 
                email: usuario.email 
            }
        });

    } catch (error) {
        console.error("❌ [Erro no Login]:", error);
        return res.status(500).json({ erro: "Erro no login", detalhe: error.message });
    }
});

app.post('/refresh', async (req, res) => {
    try {
        const { tokenDeRenovacao } = req.body; 

        if (!tokenDeRenovacao) {
            return res.status(401).json({ erro: "Refresh Token não fornecido." });
        }

        const dadosVerificados = jwt.verify(tokenDeRenovacao, REFRESH_SECRET);

        const usuario = await prisma.usuario.findUnique({
            where: { id: dadosVerificados.id }
        });

        if (!usuario || usuario.refreshToken !== tokenDeRenovacao) {
            return res.status(403).json({ erro: "Refresh token inválido ou revogado." });
        }

        const novoPayload = { id: usuario.id, email: usuario.email };
        const novoAccessToken = jwt.sign(novoPayload, ACCESS_SECRET, { expiresIn: '15m' });

        console.log(`✅ [API] Access Token renovado para: ${usuario.email}`);

        return res.json({ accessToken: novoAccessToken });

    } catch (error) {
        return res.status(403).json({ erro: "Sessão expirada. Faça login novamente." });
    }
});

// =========================================================================
// 🔒 ROTAS PROTEGIDAS DE TAREFAS (1:N)
// =========================================================================

app.post("/tarefas", verificarToken, async (req, res) => {
    try {
        const { titulo, descricao } = req.body;
        const usuarioId = req.usuarioLogadoId;

        const novaTarefa = await prisma.tarefa.create({
            data: {
                titulo,
                descricao,
                usuarioId 
            }
        });

        console.log(`✅ [API] Tarefa criada para o usuário UUID: ${usuarioId}`);
        res.status(201).json(novaTarefa);
    } catch (error) {
        console.error(`❌ [API Erro] Falha ao criar tarefa:`, error.message);
        res.status(400).json({ erro: "Erro ao criar tarefa", detalhe: error.message });
    }
});

app.get("/tarefas", verificarToken, async (req, res) => {
    try {
        const usuarioId = req.usuarioLogadoId;

        const minhasTarefas = await prisma.tarefa.findMany({
            where: { 
                usuarioId: usuarioId,
                deletadoEm: null // Filtra tarefas que não foram apagadas (Soft Delete)
            }
        });

        res.json(minhasTarefas);
    } catch (error) {
        res.status(500).json({ erro: "Erro ao buscar tarefas" });
    }
});

app.patch("/tarefas/:id", verificarToken, async (req, res) => {
    const { id } = req.params;
    const usuarioId = req.usuarioLogadoId;
    const { titulo, descricao, concluida } = req.body;

    try {
        const tarefaExistente = await prisma.tarefa.findFirst({
            where: { id, usuarioId }
        });

        if (!tarefaExistente) {
            return res.status(404).json({ erro: "Tarefa não encontrada ou não pertence ao usuário." });
        }

        const tarefaAtualizada = await prisma.tarefa.update({
            where: { id },
            data: { titulo, descricao, concluida }
        });

        res.json(tarefaAtualizada);
    } catch (error) {
        res.status(400).json({ erro: "Erro ao atualizar tarefa", detalhe: error.message });
    }
});

app.delete("/tarefas/:id", verificarToken, async (req, res) => {
    const { id } = req.params;
    const usuarioId = req.usuarioLogadoId;

    try {
        const tarefaExistente = await prisma.tarefa.findFirst({
            where: { id, usuarioId }
        });

        if (!tarefaExistente) {
            return res.status(404).json({ erro: "Tarefa não encontrada ou não pertence ao usuário." });
        }

        await prisma.tarefa.update({
            where: { id },
            data: { deletadoEm: new Date() }
        });

        res.status(204).send();
    } catch (error) {
        res.status(400).json({ erro: "Erro ao deletar tarefa", detalhe: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 API 1:N de Tarefas rodando em: http://localhost:${PORT}`);
});