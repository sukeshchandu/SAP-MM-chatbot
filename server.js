require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { ChatPromptTemplate, MessagesPlaceholder } = require('@langchain/core/prompts');
const { HumanMessage, AIMessage} = require('@langchain/core/messages');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

let pool;
if (process.env.DATABASE_URL){
    pool = new Pool ({
        connectionString: process.env.DATABASE_URL,
        ssl:{rejectUnauthorized: false}
    });

}else {
    pool = new Pool ({
        user: process.env.DB_USER,
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
    });
}
pool.query(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_session_id ON chat_history(session_id);
    `).then(() => console.log("cloud db is verified")).catch(err => console.error("DB setup error:", error));

const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature:0.2,
    apiKey: process.env.GOOGLE_API_KEY
});

const prompt = ChatPromptTemplate.fromMessages([
    ["system", `You are an elite, higly experienced Senior SAP MM (Materials Management) Consultant. Your core purpose is to provide deep, technically accurate guidance on the SAP ecosystem, with a strict focus on SAP MM and the complete Procure-to-Pay (P2P) cycle.

When answering, adhere to these rules:
1. Resources: Always provide specific study resources, relevant SAP Notes, and documentation links when asked about a topic.
2. Configuration: Provide exact configuration paths (SPRO), relevant T-codes, and architectural best practices for specific use cases.
3. Business Logic: When discussing procurement, advise on vendor selection strategies, material valuation, and system troubleshooting (what to check).
4. Tone: Keep your answers concise, structured, actionable, and highly professional.`
],
new MessagesPlaceholder("history"),
["human", "{input}"]
]);

const chain = prompt.pipe(model);

app.post('/chat', async (req, res) => {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
        return res.status(400).json({ error: 'Message and sessionId are required'});

    }
    try {
        const historyQuery = await pool.query(
            'SELECT role, content FROM chat_history WHERE session_id = $1 ORDER BY created_at ASC',
            [sessionId]

        );
        const history = historyQuery.rows.map(row =>
            row.role === 'user' ? new HumanMessage(row.content) : new AIMessage(row.content)

        );
        const response = await chain.invoke({
            history: history,
            input: message
        });
        await pool.query(
            'INSERT INTO chat_history (session_id, role, content) VALUES ($1, $2, $3)',
            [sessionId, 'user', message]
        );
        await pool.query(
            'INSERT INTO chat_history (session_id, role, content) VALUES ($1, $2, $3)',
            [sessionId, 'ai', response.content]

        );

        res.json({ reply: response.content});

    } catch (error) {
        console.error("Error :", error);
        res.status(500).json({error: 'Internal server error'});
    }

});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(` server is running on http://localhost:${PORT}`);
});