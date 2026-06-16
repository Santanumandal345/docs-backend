const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

// GET all documents (with search & filter)
router.get('/', async (req, res) => {
    try {
        const { search, category } = req.query;
        let query = {};
        
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (category && category !== 'All') {
            query.category = category;
        }
        
        const documents = await Document.find(query).sort({ uploadedAt: -1 });
        res.json(documents);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET single document metadata
router.get('/:id', async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json(document);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST upload new document
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { title, description, category } = req.body;
        
        const document = new Document({
            title: title || req.file.originalname.replace(/\.[^/.]+$/, ''),
            description: description || '',
            category: category || 'General',
            filename: req.file.filename,
            originalName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            filePath: req.file.path
        });
        
        await document.save();
        res.status(201).json(document);
    } catch (error) {
        // Delete uploaded file if database save fails
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
    }
});

// GET download file + increment counter
router.get('/download/:id', async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Increment download count
        document.downloadCount += 1;
        await document.save();
        
        const filePath = path.join(__dirname, '..', document.filePath);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on server' });
        }
        
        res.download(filePath, document.originalName);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE document
router.delete('/:id', async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        
        // Delete physical file
        const filePath = path.join(__dirname, '..', document.filePath);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        await document.deleteOne();
        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;