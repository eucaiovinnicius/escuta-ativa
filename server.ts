import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";

const db = new Database("escuta_ativa.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    region TEXT,
    status TEXT DEFAULT 'Ativo',
    avatar TEXT
  );

  CREATE TABLE IF NOT EXISTS surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citizen_name TEXT,
    citizen_phone TEXT,
    category TEXT,
    description TEXT,
    neighborhood TEXT,
    urgency TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    agent_id INTEGER,
    FOREIGN KEY(agent_id) REFERENCES users(id)
  );
`);

// Seed data if empty
const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (userCount.count === 0) {
  const insertUser = db.prepare("INSERT INTO users (name, email, role, region, status, avatar) VALUES (?, ?, ?, ?, ?, ?)");
  insertUser.run("Ricardo Oliveira", "ricardo.oliveira@escuta.gov.br", "Administrador", "Sudeste", "Ativo", "https://picsum.photos/seed/ricardo/100/100");
  insertUser.run("Ana Silva", "ana.silva@escuta.gov.br", "Supervisor", "Nordeste", "Ativo", "https://picsum.photos/seed/ana/100/100");
  insertUser.run("Marcos Souza", "marcos.souza@escuta.gov.br", "Servidor", "Sul", "Inativo", "https://picsum.photos/seed/marcos/100/100");
  insertUser.run("Luciana Rocha", "luciana.rocha@escuta.gov.br", "Supervisor", "Centro", "Ativo", "https://picsum.photos/seed/luciana/100/100");
  insertUser.run("Carla Mendes", "carla.mendes@escuta.gov.br", "Servidor", "Centro", "Ativo", "https://picsum.photos/seed/carla/100/100");
  insertUser.run("João Pereira", "joao.pereira@escuta.gov.br", "Servidor", "Leste", "Ativo", "https://picsum.photos/seed/joao/100/100");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/stats", (req, res) => {
    res.json({
      totalSurveys: 1284,
      activeAgents: "18/20",
      dailyGoal: 76,
      avgTime: "12m 45s",
      growth: "+12%"
    });
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  app.get("/api/surveys/alerts", (req, res) => {
    res.json([
      { id: 1, citizen: "Ana Paula Silva", subject: "Falta de insumos no Posto de Saúde", neighborhood: "Centro", urgency: "Crítica", date: "Hoje, 09:30" },
      { id: 2, citizen: "Marcos Oliveira", subject: "Vazamento de esgoto a céu aberto", neighborhood: "Jd. Aeroporto", urgency: "Alta", date: "Hoje, 08:15" },
      { id: 3, citizen: "Ricardo Santos", subject: "Iluminação pública deficiente", neighborhood: "Vila Nova", urgency: "Média", date: "Ontem" },
      { id: 4, citizen: "Juliana Costa", subject: "Sugestão de poda de árvores", neighborhood: "Bela Vista", urgency: "Baixa", date: "Ontem" }
    ]);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
