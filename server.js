const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Datenbank initialisieren
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tickets (
                id BIGINT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                author TEXT NOT NULL,
                "group" TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS groups (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS authors (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        `);

        // Initiale Daten einfügen
        const groupsCount = await pool.query('SELECT COUNT(*) FROM groups');
        if (groupsCount.rows[0].count === '0') {
            await pool.query(`
                INSERT INTO groups (name) VALUES 
                ('Entwicklung'), ('Design')
                ON CONFLICT (name) DO NOTHING
            `);
        }

        const authorsCount = await pool.query('SELECT COUNT(*) FROM authors');
        if (authorsCount.rows[0].count === '0') {
            await pool.query(`
                INSERT INTO authors (name) VALUES 
                ('Jan'), ('Nico')
                ON CONFLICT (name) DO NOTHING
            `);
        }

        const settingsCount = await pool.query('SELECT COUNT(*) FROM settings');
        if (settingsCount.rows[0].count === '0') {
            await pool.query(`
                INSERT INTO settings (key, value) VALUES 
                ('adminPassword', 'admin123')
                ON CONFLICT (key) DO NOTHING
            `);
        }

        console.log('✅ Datenbank initialisiert');
    } catch (error) {
        console.error('❌ Fehler beim Initialisieren der Datenbank:', error);
    }
}

// ========== ROUTES ==========

app.get('/', (req, res) => {
    res.json({ status: 'Ticket System API läuft', version: '2.0.0 (PostgreSQL)' });
});

// Alle Daten abrufen
app.get('/api/data', async (req, res) => {
    try {
        const tickets = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');
        const groups = await pool.query('SELECT name FROM groups ORDER BY name');
        const authors = await pool.query('SELECT name FROM authors ORDER BY name');
        const password = await pool.query("SELECT value FROM settings WHERE key = 'adminPassword'");

        res.json({
            tickets: tickets.rows.map(t => ({
                id: parseInt(t.id),
                title: t.title,
                description: t.description,
                author: t.author,
                group: t.group,
                status: t.status,
                createdAt: t.created_at,
                updatedAt: t.updated_at
            })),
            groups: groups.rows.map(g => g.name),
            authors: authors.rows.map(a => a.name),
            adminPassword: password.rows[0]?.value || 'admin123'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Laden der Daten' });
    }
});

// ========== TICKETS ==========

app.get('/api/tickets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');
        res.json(result.rows.map(t => ({
            id: parseInt(t.id),
            title: t.title,
            description: t.description,
            author: t.author,
            group: t.group,
            status: t.status,
            createdAt: t.created_at,
            updatedAt: t.updated_at
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Laden der Tickets' });
    }
});

app.get('/api/tickets/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket nicht gefunden' });
        }
        const t = result.rows[0];
        res.json({
            id: parseInt(t.id),
            title: t.title,
            description: t.description,
            author: t.author,
            group: t.group,
            status: t.status,
            createdAt: t.created_at,
            updatedAt: t.updated_at
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Laden des Tickets' });
    }
});

app.post('/api/tickets', async (req, res) => {
    try {
        const { title, description, author, group, status = 'offen' } = req.body;
        const id = Date.now();
        const result = await pool.query(
            `INSERT INTO tickets (id, title, description, author, "group", status, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
            [id, title, description, author, group, status]
        );
        const t = result.rows[0];
        res.status(201).json({
            id: parseInt(t.id),
            title: t.title,
            description: t.description,
            author: t.author,
            group: t.group,
            status: t.status,
            createdAt: t.created_at
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Erstellen des Tickets' });
    }
});

app.put('/api/tickets/:id', async (req, res) => {
    try {
        const { title, description, author, group, status } = req.body;
        const result = await pool.query(
            `UPDATE tickets 
             SET title = $1, description = $2, author = $3, "group" = $4, status = $5, updated_at = NOW()
             WHERE id = $6 RETURNING *`,
            [title, description, author, group, status, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket nicht gefunden' });
        }
        const t = result.rows[0];
        res.json({
            id: parseInt(t.id),
            title: t.title,
            description: t.description,
            author: t.author,
            group: t.group,
            status: t.status,
            createdAt: t.created_at,
            updatedAt: t.updated_at
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Aktualisieren des Tickets' });
    }
});

app.patch('/api/tickets/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const result = await pool.query(
            'UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket nicht gefunden' });
        }
        const t = result.rows[0];
        res.json({
            id: parseInt(t.id),
            title: t.title,
            description: t.description,
            author: t.author,
            group: t.group,
            status: t.status,
            createdAt: t.created_at,
            updatedAt: t.updated_at
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Ändern des Status' });
    }
});

app.delete('/api/tickets/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM tickets WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket nicht gefunden' });
        }
        res.json({ message: 'Ticket gelöscht', ticket: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Löschen des Tickets' });
    }
});

// ========== GRUPPEN ==========

app.get('/api/groups', async (req, res) => {
    try {
        const result = await pool.query('SELECT name FROM groups ORDER BY name');
        res.json(result.rows.map(g => g.name));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Laden der Gruppen' });
    }
});

app.post('/api/groups', async (req, res) => {
    try {
        const { name } = req.body;
        await pool.query('INSERT INTO groups (name) VALUES ($1)', [name]);
        res.status(201).json({ name });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Gruppe existiert bereits' });
        }
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Hinzufügen der Gruppe' });
    }
});

app.delete('/api/groups/:name', async (req, res) => {
    try {
        await pool.query('DELETE FROM groups WHERE name = $1', [decodeURIComponent(req.params.name)]);
        res.json({ message: 'Gruppe gelöscht' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Löschen der Gruppe' });
    }
});

// ========== AUTOREN ==========

app.get('/api/authors', async (req, res) => {
    try {
        const result = await pool.query('SELECT name FROM authors ORDER BY name');
        res.json(result.rows.map(a => a.name));
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Laden der Autoren' });
    }
});

app.post('/api/authors', async (req, res) => {
    try {
        const { name } = req.body;
        await pool.query('INSERT INTO authors (name) VALUES ($1)', [name]);
        res.status(201).json({ name });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Autor existiert bereits' });
        }
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Hinzufügen des Autors' });
    }
});

app.delete('/api/authors/:name', async (req, res) => {
    try {
        await pool.query('DELETE FROM authors WHERE name = $1', [decodeURIComponent(req.params.name)]);
        res.json({ message: 'Autor gelöscht' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Löschen des Autors' });
    }
});

// ========== ADMIN ==========

app.post('/api/admin/login', async (req, res) => {
    try {
        const result = await pool.query("SELECT value FROM settings WHERE key = 'adminPassword'");
        const adminPassword = result.rows[0]?.value || 'admin123';
        
        if (req.body.password === adminPassword) {
            res.json({ success: true, message: 'Login erfolgreich' });
        } else {
            res.status(401).json({ success: false, message: 'Falsches Passwort' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Login' });
    }
});

app.put('/api/admin/password', async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const result = await pool.query("SELECT value FROM settings WHERE key = 'adminPassword'");
        const currentPassword = result.rows[0]?.value || 'admin123';
        
        if (oldPassword === currentPassword) {
            await pool.query(
                "UPDATE settings SET value = $1 WHERE key = 'adminPassword'",
                [newPassword]
            );
            res.json({ success: true, message: 'Passwort geändert' });
        } else {
            res.status(401).json({ success: false, message: 'Falsches altes Passwort' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fehler beim Ändern des Passworts' });
    }
});

// Server starten
app.listen(PORT, async () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
    console.log(`📍 API erreichbar unter: http://localhost:${PORT}`);
    await initDatabase();
});