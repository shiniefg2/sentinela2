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
// BANCO DE DADOS
// =====================================================

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return {
      usuarios: [],
      pacientes: [],
      triagens: [],
      consultas: [],
      chamadas: []
    };
  }

  const db = JSON.parse(
    fs.readFileSync(DB_FILE, "utf8")
  );

  // Garante que chamadas exista mesmo
  // se o db.json antigo não tiver essa propriedade
  if (!db.chamadas) {
    db.chamadas = [];
  }

  if (!db.usuarios) {
    db.usuarios = [];
  }

  if (!db.pacientes) {
    db.pacientes = [];
  }

  if (!db.triagens) {
    db.triagens = [];
  }

  if (!db.consultas) {
    db.consultas = [];
  }

  return db;
}


function writeDB(data) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(data, null, 2)
  );
}


// =====================================================
// LOGIN
// =====================================================

app.post("/login", (req, res) => {

  const db = readDB();

  const user = db.usuarios.find(u =>
    u.usuario === req.body.usuario &&
    u.senha === req.body.senha
  );

  if (!user) {
    return res.status(401).json({
      erro: "Login inválido"
    });
  }

  res.json(user);
});


// =====================================================
// ATENDIMENTO
// =====================================================

app.post("/atendimento", (req, res) => {

  const db = readDB();

  const paciente = {
    id: Date.now(),
    nome: req.body.nome,
    cpf: req.body.cpf,
    tipo: req.body.tipo,
    status: "triagem",
    createdAt: new Date()
  };

  db.pacientes.push(paciente);

  writeDB(db);

  res.json(paciente);
});


// =====================================================
// TRIAGEM
// =====================================================

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

    nome: req.body.nome,

    sintoma: req.body.sintoma,

    temperatura: req.body.temperatura,

    alergia: req.body.alergia,

    observacao: req.body.observacao,

    risco,

    status: "aguardando_medico",

    createdAt: new Date()
  };


  db.triagens.push(triagem);

  writeDB(db);

  res.json(triagem);
});


// =====================================================
// LISTAR TRIAGENS
// =====================================================

app.get("/triagens", (req, res) => {

  const db = readDB();

  res.json(db.triagens);
});


// =====================================================
// LISTA DE MEDICAÇÕES
// =====================================================

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


// =====================================================
// CONSULTA
// =====================================================

app.post("/consulta", (req, res) => {

  const db = readDB();

  const consulta = {

    id: Date.now(),

    paciente: req.body.paciente,

    diagnostico: req.body.diagnostico,

    medicacao: req.body.medicacao,

    obs: req.body.obs,

    createdAt: new Date()
  };


  db.consultas.push(consulta);

  writeDB(db);

  res.json(consulta);
});


// =====================================================
// MEDICAÇÕES
// =====================================================

app.get("/medicacoes", (req, res) => {

  const db = readDB();

  res.json(db.consultas);
});


// =====================================================
// TV - CHAMADA ATUAL
// =====================================================

app.get("/tv/chamada", (req, res) => {

  const db = readDB();

  const chamadas = db.chamadas || [];

  const chamada =
    chamadas.length > 0
      ? chamadas[chamadas.length - 1]
      : null;


  const historico =
    [...chamadas]
      .reverse();


  res.json({
    chamada,
    historico
  });

});


// =====================================================
// TV - CHAMAR PACIENTE
// =====================================================

app.post("/tv/chamar", (req, res) => {

  const db = readDB();


  const paciente =
    req.body.paciente ||
    req.body.nome ||
    "PACIENTE";


  const localTipo =
    req.body.localTipo ||
    "GUICHÊ";


  const localNumero =
    req.body.localNumero ||
    "---";


  const chamada = {

    id: Date.now(),

    paciente,

    localTipo,

    localNumero,

    createdAt: new Date()
  };


  db.chamadas.push(chamada);


  // Mantém somente as últimas chamadas
  // para o histórico não crescer infinitamente
  if (db.chamadas.length > 50) {

    db.chamadas =
      db.chamadas.slice(-50);

  }


  writeDB(db);


  res.json({

    sucesso: true,

    chamada

  });

});


// =====================================================
// TV - LIMPAR CHAMADA
// =====================================================

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
// START
// =====================================================

const PORT =
  process.env.PORT || 3000;


app.listen(PORT, () => {

  console.log(
    `Servidor rodando na porta ${PORT}`
  );

});
