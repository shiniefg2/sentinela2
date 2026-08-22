const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../frontend")));

const DB_FILE = path.join(__dirname, "db.json");

// =====================================================
// BANCO DE DADOS LOCAL
// =====================================================

function readDB() {
  const defaultDB = {
    usuarios: [],
    pacientes: [],
    triagens: [],
    consultas: [],
    chamadas: []
  };

  if (!fs.existsSync(DB_FILE)) {
    return defaultDB;
  }

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
// LOGIN
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
// RECEPÇÃO (ATENDIMENTO)
// =====================================================

// Cadastra o paciente e coloca na fila de triagem
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

// =====================================================
// TRIAGEM
// =====================================================

// Lista pacientes que estão aguardando triagem
app.get("/pacientes/triagem", (req, res) => {
  const db = readDB();
  const pendentes = db.pacientes.filter(p => p.status === "aguardando_triagem");
  res.json(pendentes);
});

// Registra a triagem e altera o status do paciente para o médico
app.post("/triagem", (req, res) => {
  const db = readDB();

  let risco = req.body.risco;
  if (req.body.temperatura >= 39) {
    risco = "vermelho";
  } else if (req.body.temperatura >= 38) {
    risco = "amarelo";
  } else if (!risco) {
    risco = "verde";
  }

  const triagem = {
    id: Date.now(),
    pacienteId: req.body.pacienteId,
    nome: req.body.nome,
    sintoma: req.body.sintoma,
    temperatura: req.body.temperatura,
    alergia: req.body.alergia,
    observacao: req.body.observacao,
    risco,
    createdAt: new Date()
  };

  db.triagens.push(triagem);

  // Atualiza o status na lista de pacientes
  const paciente = db.pacientes.find(
    p => p.id === Number(req.body.pacienteId) || p.nome === req.body.nome
  );

  if (paciente) {
    paciente.status = "aguardando_medico";
    paciente.risco = risco;
  }

  writeDB(db);
  res.json(triagem);
});

// Lista todas as triagens realizadas
app.get("/triagens", (req, res) => {
  const db = readDB();
  res.json(db.triagens);
});

// =====================================================
// CONSULTA MÉDICA
// =====================================================

// Lista pacientes prontos para o atendimento médico
app.get("/pacientes/medico", (req, res) => {
  const db = readDB();
  const aguardandoMedico = db.pacientes.filter(p => p.status === "aguardando_medico");
  res.json(aguardandoMedico);
});

// Registra a consulta realizada e encerra o fluxo do paciente
app.post("/consulta", (req, res) => {
  const db = readDB();

  const consulta = {
    id: Date.now(),
    pacienteId: req.body.pacienteId,
    paciente: req.body.paciente,
    diagnostico: req.body.diagnostico,
    medicacao: req.body.medicacao,
    obs: req.body.obs,
    createdAt: new Date()
  };

  db.consultas.push(consulta);

  // Atualiza status do paciente para finalizado
  const paciente = db.pacientes.find(
    p => p.id === Number(req.body.pacienteId) || p.nome === req.body.paciente
  );

  if (paciente) {
    paciente.status = "atendido";
  }

  writeDB(db);
  res.json(consulta);
});

// Lista de medicações padrão
app.get("/lista-medicacoes", (req, res) => {
  res.json([
    "Dipirona",
    "Paracetamol",
    "Ibuprofeno",
    "Amoxicilina",
    "Azitromicina",
    "Loratadina",
    "Omeprazol",
    "Buscopan",
    "Dramin",
    "Soro fisiológico"
  ]);
});

app.get("/medicacoes", (req, res) => {
  const db = readDB();
  res.json(db.consultas);
});

// =====================================================
// TV - CHAMADAS
// =====================================================

// Retorna chamada atual e o histórico
app.get("/tv/chamada", (req, res) => {
  const db = readDB();
  const chamadas = db.chamadas || [];

  const chamada = chamadas.length > 0 ? chamadas[chamadas.length - 1] : null;
  const historico = [...chamadas].reverse().slice(1);

  res.json({
    chamada,
    historico
  });
});

// Chamar paciente na TV (Guichê / Consultório)
app.post("/tv/chamar", (req, res) => {
  const db = readDB();

  const paciente = req.body.paciente || req.body.nome || "PACIENTE";
  const localTipo = req.body.localTipo || "GUICHÊ";
  const localNumero = req.body.localNumero || "---";

  const chamada = {
    id: Date.now(),
    paciente,
    localTipo,
    localNumero,
    createdAt: new Date()
  };

  db.chamadas.push(chamada);

  if (db.chamadas.length > 50) {
    db.chamadas = db.chamadas.slice(-50);
  }

  writeDB(db);

  res.json({
    sucesso: true,
    chamada
  });
});

// Limpar histórico da TV
app.delete("/tv/chamada", (req, res) => {
  const db = readDB();
  db.chamadas = [];
  writeDB(db);

  res.json({
    sucesso: true,
    mensagem: "Chamadas da TV removidas"
  });
});

// =====================================================
// INICIALIZAÇÃO
// =====================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
