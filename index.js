const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const PORT = 3000;

// Database connection settings
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '3020055a',
    database: 'todolist',
};

async function retrieveListItems() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT id, text FROM items');
        await connection.end();
        return rows;
    } catch (error) {
        console.error('Error retrieving list items:', error);
        throw error;
    }
}

async function getHtmlRows() {
    const todoItems = await retrieveListItems();
    return todoItems.map(item => `
        <tr>
            <td>${item.id}</td>
            <td><input type="text" value="${item.text}" onchange="editItem(${item.id}, this.value)"></td>
            <td><button class="delete-btn" onclick="deleteItem(${item.id})">×</button></td>
        </tr>
    `).join('');
}

async function handleRequest(req, res) {
    if (req.url === '/') {
        try {
            const html = await fs.promises.readFile(
                path.join(__dirname, 'index.html'), 
                'utf8'
            );
            const processedHtml = html.replace('{{rows}}', await getHtmlRows());
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(processedHtml);
        } catch (err) {
            console.error(err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error loading index.html');
        }
    } else if (req.url === '/api/items' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { text } = JSON.parse(body);
                if (!text || typeof text !== 'string') {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    return res.end('Text is required');
                }
                const connection = await mysql.createConnection(dbConfig);
                const [result] = await connection.execute(
                    'INSERT INTO items (text) VALUES (?)',
                    [text]
                );
                await connection.end();
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ id: result.insertId, text }));
            } catch (err) {
                console.error('Error adding item:', err);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error adding item');
            }
        });
    } else if (req.url.startsWith('/api/items/') && req.method === 'DELETE') {
        try {
            const id = parseInt(req.url.split('/').pop());
            if (isNaN(id)) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                return res.end('Invalid item ID');
            }
            const connection = await mysql.createConnection(dbConfig);
            const [result] = await connection.execute(
                'DELETE FROM items WHERE id = ?',
                [id]
            );
            await connection.end();
            if (result.affectedRows === 0) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Item not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('Item deleted');
            }
        } catch (err) {
            console.error('Error deleting item:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error deleting item');
        }
    } else if (req.url.startsWith('/api/items/') && req.method === 'PUT') {
        try {
            const id = parseInt(req.url.split('/').pop());
            if (isNaN(id)) {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                return res.end('Invalid item ID');
            }
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const { text } = JSON.parse(body);
                    if (!text || typeof text !== 'string') {
                        res.writeHead(400, { 'Content-Type': 'text/plain' });
                        return res.end('Text is required');
                    }
                    const connection = await mysql.createConnection(dbConfig);
                    const [result] = await connection.execute(
                        'UPDATE items SET text = ? WHERE id = ?',
                        [text, id]
                    );
                    await connection.end();
                    if (result.affectedRows === 0) {
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('Item not found');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                        res.end('Item updated');
                    }
                } catch (err) {
                    console.error('Error updating item:', err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error updating item');
                }
            });
        } catch (err) {
            console.error('Error:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error updating item');
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Route not found');
    }
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));