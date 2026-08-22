const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

// Servir os arquivos estáticos do frontend
const frontendPath = path.resolve(__dirname, "../frontend");
app.use(express.static(frontendPath));

const DB_FILE = path.join(__dirname, "db.json");

// Redireciona a raiz para o index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// =====================================================
// BANCO DE DADOS LOCAL
// =====================================================

function readDB() {
  const defaultDB = {
    usuarios: [],
    pacientes: [],
    triagens: [],
    consultas: [],
    medicacoes: [],
    chamadas: [],
    altas: []
  };

  if (!fs.existsSync(DB_FILE)) return defaultDB;

  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return { ...defaultDB, ...db };
  } catch (error) {
    console.error("Erro ao ler db.json:", error);
    return defaultDB;
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Erro ao escrever no db.json:", error);
  }
}

// =====================================================
// API - LOGIN
// =====================================================

app.post("/login", (req, res) => {
  const db = readDB();
  const user = db.usuarios.find(
    u => u.usuario === req.body.usuario && u.senha === req.body.senha
  );

  if (!user) {
    return res.status(401).json({ erro: "Login inválido" });
  }

  res.json(user);
});

// =====================================================
// API - ROTAS DOS SETORES
// =====================================================

app.post("/atendimento", (req, res) => {
  const db = readDB();
  const paciente = {
    id: Date.now(),
    nome: req.body.nome,
    cpf: req.body.cpf,
    tipo: req.body.tipo || "Geral",
    status: "aguardando_triagem",
    createdAt: new Date()
  };
  db.pacientes.push(paciente);
  writeDB(db);
  res.json(paciente);
});

app.get("/pacientes/triagem", (req, res) => {
  const db = readDB();
  res.json(db.pacientes.filter(p => p.status === "aguardando_triagem"));
});

app.post("/triagem", (req, res) => {
  const db = readDB();
  let risco = req.body.risco;
  if (req.body.temperatura >= 39) risco = "vermelho";
  else if (req.body.temperatura >= 38) risco = "amarelo";
  else if (!risco) risco = "verde";

  const triagem = {
    id: Date.now(),
    pacienteId: Number(req.body.pacienteId),
    nome: req.body.nome,
    sintoma: req.body.sintoma,
    temperatura: req.body.temperatura,
    alergia: req.body.alergia,
    observacao: req.body.observacao,
    risco,
    createdAt: new Date()
  };

  db.triagens.push(triagem);

  const paciente = db.pacientes.find(
    p => Number(p.id) === Number(req.body.pacienteId) || p.nome === req.body.nome
  );

  if (paciente) {
    paciente.status = "aguardando_medico";
    paciente.risco = risco;
  }

  writeDB(db);
  res.json(triagem);
});

app.get("/triagens", (req, res) => {
  const db = readDB();
  res.json(db.triagens);
});

app.get("/pacientes/medico", (req, res) => {
  const db = readDB();
  res.json(db.pacientes.filter(p => p.status === "aguardando_medico"));
});

app.post("/consulta", (req, res) => {
  const db = readDB();
  const consulta = {
    id: Date.now(),
    pacienteId: Number(req.body.pacienteId),
    paciente: req.body.paciente,
    diagnostico: req.body.diagnostico,
    medicacao: req.body.medicacao,
    obs: req.body.obs,
    createdAt: new Date()
  };

  db.consultas.push(consulta);

  const paciente = db.pacientes.find(
    p => Number(p.id) === Number(req.body.pacienteId) || p.nome === req.body.paciente
  );

  if (paciente) {
    if (req.body.medicacao && String(req.body.medicacao).trim() !== "") {
      paciente.status = "aguardando_medicacao";
    } else {
      paciente.status = "aguardando_alta";
    }
  }

  writeDB(db);
  res.json(consulta);
});

app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona", "Paracetamol", "Ibuprofeno", "Amoxicilina",
    "Azitromicina", "Loratadina", "Omeprazol", "Buscopan", "Dramin", "Soro fisiológico"
  ]);
});

app.get("/pacientes/medicacao", (req, res) => {
  const db = readDB();
  const emMedicacao = db.pacientes.filter(p => p.status === "aguardando_medicacao");
  const resultado = emMedicacao.map(p => {
    const ultimaConsulta = db.consultas.filter(c => Number(c.pacienteId) === Number(p.id) || c.paciente === p.nome).pop();
    return {
      ...p,
      prescricao: ultimaConsulta ? ultimaConsulta.medicacao : "Não informada",
      diagnostico: ultimaConsulta ? ultimaConsulta.diagnostico : "N/A"
    };
  });
  res.json(resultado);
});

app.post("/medicacao/aplicar", (req, res) => {
  const db = readDB();
  const paciente = db.pacientes.find(p => Number(p.id) === Number(req.body.pacienteId));
  if (!paciente) return res.status(404).json({ erro: "Paciente não encontrado" });
  paciente.status = "aguardando_alta";
  writeDB(db);
  res.json({ sucesso: true, mensagem: "Medicação concluída. Encaminhado para alta." });
});

app.get("/pacientes/atendidos", (req, res) => {
  const db = readDB();
  res.json(db.pacientes.filter(p => p.status === "aguardando_alta"));
});

app.post("/alta", (req, res) => {
  const db = readDB();
  const paciente = db.pacientes.find(p => Number(p.id) === Number(req.body.pacienteId));
  if (!paciente) return res.status(404).json({ erro: "Paciente não encontrado" });

  paciente.status = "alta";
  paciente.dataAlta = new Date();

  const registroAlta = {
    id: Date.now(),
    pacienteId: paciente.id,
    paciente: paciente.nome,
    tipoAlta: req.body.tipoAlta,
    orientacoes: req.body.orientacoes,
    createdAt: new Date()
  };

  if (!db.altas) db.altas = [];
  db.altas.push(registroAlta);
  writeDB(db);
  res.json({ sucesso: true, registroAlta });
});

app.get("/altas", (req, res) => {
  const db = readDB();
  res.json(db.altas || []);
});

app.get("/tv/chamada", (req, res) => {
  const db = readDB();
  const chamadas = db.chamadas || [];
  res.json({
    chamada: chamadas.length > 0 ? chamadas[chamadas.length - 1] : null,
    historico: [...chamadas].reverse().slice(1)
  });
});

app.post("/tv/chamar", (req, res) => {
  const db = readDB();
  const chamada = {
    id: Date.now(),
    paciente: req.body.paciente || req.body.nome || "PACIENTE",
    localTipo: req.body.localTipo || "GUICHÊ",
    localNumero: req.body.localNumero || "---",
    createdAt: new Date()
  };
  db.chamadas.push(chamada);
  if (db.chamadas.length > 50) db.chamadas = db.chamadas.slice(-50);
  writeDB(db);
  res.json({ sucesso: true, chamada });
});

app.delete("/tv/chamada", (req, res) => {
  const db = readDB();
  db.chamadas = [];
  writeDB(db);
  res.json({ sucesso: true, mensagem: "Chamadas da TV removidas" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
