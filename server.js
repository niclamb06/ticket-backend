const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json());

// Initiale Datenstruktur
const initialData = {
    tickets: [],
    groups: ['Alle', 'Support', 'Entwicklung', 'Design'],
    authors: ['Max Mustermann', 'Anna Schmidt', 'Tom Weber'],
    adminPassword: 'admin123'
};

// Daten laden oder initialisieren
async function loadData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        await saveData(initialData);
        return initialData;
    }
}

// Daten speichern
async function saveData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// ========== ROUTES ==========

// Health Check
app.get('/', (req, res) => {
    res.json({ status: 'Ticket System API läuft', version: '1.0.0' });
});

// Alle Daten abrufen
app.get('/api/data', async (req, res) => {
    try {
        const data = await loadData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Laden der Daten' });
    }
});

// ========== TICKETS ==========

// Alle Tickets abrufen
app.get('/api/tickets', async (req, res) => {
    try {
        const data = await loadData();
        res.json(data.tickets);
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Laden der Tickets' });
    }
});

// Einzelnes Ticket abrufen
app.get('/api/tickets/:id', async (req, res) => {
    try {
        const data = await loadData();
        const ticket = data.tickets.find(t => t.id === parseInt(req.params.id));
        if (ticket) {
            res.json(ticket);
        } else {
            res.status(404).json({ error: 'Ticket nicht gefunden' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Laden des Tickets' });
    }
});

// Neues Ticket erstellen
app.post('/api/tickets', async (req, res) => {
    try {
        const data = await loadData();
        const newTicket = {
            id: Date.now(),
            title: req.body.title,
            description: req.body.description,
            author: req.body.author,
            group: req.body.group,
            status: req.body.status || 'offen',
            createdAt: new Date().toISOString()
        };
        data.tickets.push(newTicket);
        await saveData(data);
        res.status(201).json(newTicket);
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Erstellen des Tickets' });
    }
});

// Ticket aktualisieren
app.put('/api/tickets/:id', async (req, res) => {
    try {
        const data = await loadData();
        const index = data.tickets.findIndex(t => t.id === parseInt(req.params.id));
        if (index !== -1) {
            data.tickets[index] = {
                ...data.tickets[index],
                ...req.body,
                id: data.tickets[index].id,
                updatedAt: new Date().toISOString()
            };
            await saveData(data);
            res.json(data.tickets[index]);
        } else {
            res.status(404).json({ error: 'Ticket nicht gefunden' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Aktualisieren des Tickets' });
    }
});

// Ticket Status ändern
app.patch('/api/tickets/:id/status', async (req, res) => {
    try {
        const data = await loadData();
        const ticket = data.tickets.find(t => t.id === parseInt(req.params.id));
        if (ticket) {
            ticket.status = req.body.status;
            ticket.updatedAt = new Date().toISOString();
            await saveData(data);
            res.json(ticket);
        } else {
            res.status(404).json({ error: 'Ticket nicht gefunden' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Ändern des Status' });
    }
});

// Ticket löschen
app.delete('/api/tickets/:id', async (req, res) => {
    try {
        const data = await loadData();
        const index = data.tickets.findIndex(t => t.id === parseInt(req.params.id));
        if (index !== -1) {
            const deleted = data.tickets.splice(index, 1);
            await saveData(data);
            res.json({ message: 'Ticket gelöscht', ticket: deleted[0] });
        } else {
            res.status(404).json({ error: 'Ticket nicht gefunden' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Löschen des Tickets' });
    }
});

// ========== GRUPPEN ==========

// Alle Gruppen abrufen
app.get('/api/groups', async (req, res) => {
    try {
        const data = await loadData();
        res.json(data.groups);
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Laden der Gruppen' });
    }
});

// Gruppe hinzufügen
app.post('/api/groups', async (req, res) => {
    try {
        const data = await loadData();
        const newGroup = req.body.name;
        if (!data.groups.includes(newGroup)) {
            data.groups.push(newGroup);
            await saveData(data);
            res.status(201).json({ name: newGroup });
        } else {
            res.status(400).json({ error: 'Gruppe existiert bereits' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Hinzufügen der Gruppe' });
    }
});

// Gruppe löschen
app.delete('/api/groups/:name', async (req, res) => {
    try {
        const data = await loadData();
        const groupName = decodeURIComponent(req.params.name);
        data.groups = data.groups.filter(g => g !== groupName);
        await saveData(data);
        res.json({ message: 'Gruppe gelöscht' });
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Löschen der Gruppe' });
    }
});

// ========== AUTOREN ==========

// Alle Autoren abrufen
app.get('/api/authors', async (req, res) => {
    try {
        const data = await loadData();
        res.json(data.authors);
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Laden der Autoren' });
    }
});

// Autor hinzufügen
app.post('/api/authors', async (req, res) => {
    try {
        const data = await loadData();
        const newAuthor = req.body.name;
        if (!data.authors.includes(newAuthor)) {
            data.authors.push(newAuthor);
            await saveData(data);
            res.status(201).json({ name: newAuthor });
        } else {
            res.status(400).json({ error: 'Autor existiert bereits' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Hinzufügen des Autors' });
    }
});

// Autor löschen
app.delete('/api/authors/:name', async (req, res) => {
    try {
        const data = await loadData();
        const authorName = decodeURIComponent(req.params.name);
        data.authors = data.authors.filter(a => a !== authorName);
        await saveData(data);
        res.json({ message: 'Autor gelöscht' });
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Löschen des Autors' });
    }
});

// ========== ADMIN ==========

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    try {
        const data = await loadData();
        if (req.body.password === data.adminPassword) {
            res.json({ success: true, message: 'Login erfolgreich' });
        } else {
            res.status(401).json({ success: false, message: 'Falsches Passwort' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Login' });
    }
});

// Admin Passwort ändern
app.put('/api/admin/password', async (req, res) => {
    try {
        const data = await loadData();
        if (req.body.oldPassword === data.adminPassword) {
            data.adminPassword = req.body.newPassword;
            await saveData(data);
            res.json({ success: true, message: 'Passwort geändert' });
        } else {
            res.status(401).json({ success: false, message: 'Falsches altes Passwort' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Ändern des Passworts' });
    }
});

// Server starten
app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
    console.log(`📍 API erreichbar unter: http://localhost:${PORT}`);
});