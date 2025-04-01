require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const API_BASE_URL = process.env.API_BASE_URL;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Atlas Connection
const MONGODB_URI = 'mongodb+srv://divyanshpuri84:xGBu6stETjtNWlzK@cluster0.u2l80.mongodb.net/purivlog?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Successfully connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schemas
const vlogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    mediaType: {
        type: String,
        required: true,
        enum: ['image', 'video']
    },
    mediaPath: {
        type: String,
        required: true
    },
    uploadDate: { 
        type: Date, 
        default: Date.now 
    },
    comments: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        text: {
            type: String,
            required: true,
            trim: true
        },
        date: { 
            type: Date, 
            default: Date.now 
        }
    }]
});

const Vlog = mongoose.model('Vlog', vlogSchema);

// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image and video files are allowed!'), false);
    }
};

const upload = multer({ 
    storage,
    fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 100 // 100MB limit
    }
});

// API Routes

// Get all vlogs
app.get('/api/vlogs', async (req, res) => {
    try {
        const vlogs = await Vlog.find().sort({ uploadDate: -1 });
        res.json(vlogs);
    } catch (err) {
        console.error('Error fetching vlogs:', err);
        res.status(500).json({ error: 'Failed to fetch vlogs' });
    }
});

// Upload new vlog
app.post('/api/vlogs', upload.single('media'), async (req, res) => {
    try {
        const { password, title, mediaType } = req.body;
        
        // Verify upload password (in production, use proper authentication)
        if (password !== process.env.UPLOAD_PASSWORD) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Validate media type matches file type
        const fileIsImage = req.file.mimetype.startsWith('image/');
        const fileIsVideo = req.file.mimetype.startsWith('video/');
        
        if ((mediaType === 'image' && !fileIsImage) || (mediaType === 'video' && !fileIsVideo)) {
            return res.status(400).json({ error: 'File type does not match selected media type' });
        }

        const newVlog = new Vlog({
            title,
            mediaType,
            mediaPath: req.file.path
        });

        await newVlog.save();
        
        res.status(201).json({
            message: 'Vlog uploaded successfully',
            vlog: newVlog
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ 
            error: err.message || 'Failed to upload vlog' 
        });
    }
});

// Add comment to vlog
app.post('/api/vlogs/:id/comments', async (req, res) => {
    try {
        const { name, text } = req.body;
        
        if (!name || !text) {
            return res.status(400).json({ error: 'Name and text are required' });
        }

        const vlog = await Vlog.findById(req.params.id);
        if (!vlog) {
            return res.status(404).json({ error: 'Vlog not found' });
        }

        vlog.comments.push({ name, text });
        await vlog.save();
        
        res.status(201).json({
            message: 'Comment added successfully',
            vlog: vlog
        });
    } catch (err) {
        console.error('Comment error:', err);
        res.status(500).json({ 
            error: err.message || 'Failed to add comment' 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`MongoDB connected to: ${MONGODB_URI.replace(/:[^@]*@/, ':***@')}`);
});
