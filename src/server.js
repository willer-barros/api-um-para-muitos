import express from 'express';
import { PrismaClient } from './lib/prisma.ts';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/api/tarefas', async (req, res) => {
  try {
    const { titulo, descricao, usuarioId } = req.body;

    if (!titulo || titulo.trim() === "") {
      return res.status(400).json({ erro: "O título da tarefa é obrigatório." });
    }

    const novaTarefa = await prisma.tarefa.create({
      data: {
        titulo,
        descricao,
        usuarioId: Number(usuarioId),
      },
    });

    return res.status(201).json(novaTarefa); 
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao criar a tarefa no servidor." });
  }
});

app.get('/api/tarefas', async (req, res) => {
  try {
    const tarefas = await prisma.tarefa.findMany({
      where: {
        deletadoEm: null, 
      },
      include: {
        usuario: true,
      },
    });

    return res.json(tarefas);
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao listar as tarefas." });
  }
});

app.get('/api/tarefas/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const tarefa = await prisma.tarefa.findFirst({
      where: {
        id: Number(id),
        deletadoEm: null,
      },
      include: {
        usuario: true,
      },
    });

    if (!tarefa) {
      return res.status(404).json({ erro: "Tarefa não encontrada ou inativa." }); // Semântica: 404 Not Found (H7)
    }

    return res.json(tarefa);
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao buscar a tarefa." });
  }
});

app.put('/api/tarefas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descricao, concluida } = req.body;

    const tarefaExistente = await prisma.tarefa.findFirst({
      where: { id: Number(id), deletadoEm: null },
    });

    if (!tarefaExistente) {
      return res.status(404).json({ erro: "Tarefa não encontrada para atualização." });
    }

    const tarefaAtualizada = await prisma.tarefa.update({
      where: { id: Number(id) },
      data: {
        titulo,
        descricao,
        concluida: concluida !== undefined ? Boolean(concluida) : tarefaExistente.concluida,
      },
    });

    return res.json(tarefaAtualizada);
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao atualizar a tarefa." });
  }
});

app.delete('/api/tarefas/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const intentonaTarefa = await prisma.tarefa.findFirst({
      where: { id: Number(id), deletadoEm: null },
    });

    if (!intentonaTarefa) {
      return res.status(404).json({ erro: "Tarefa não encontrada ou já excluída." });
    }

    const tarefaInativada = await prisma.tarefa.update({
      where: { id: Number(id) },
      data: {
        deletadoEm: new Date(),
      },
    });

    return res.json({ 
      mensagem: "Tarefa removida logicamente com sucesso.", 
      id: tarefaInativada.id 
    });
  } catch (error) {
    return res.status(500).json({ erro: "Erro ao aplicar exclusão lógica." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor TodoList unificado rodando em http://localhost:${PORT}`);
});