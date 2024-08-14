const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5001;

// Database connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Xaybzc@5533',
  database: 'cms_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Ensure directories exist
const directories = ['uploads/imageslider', 'uploads/ministericon'];
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/imageslider/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const ministerIconStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/ministericon/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const uploadMinisterIcon = multer({ storage: ministerIconStorage });

// File upload endpoints
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  console.log('File uploaded:', req.file);
  res.json({ url: `http://localhost:${port}/uploads/imageslider/${req.file.filename}` });
});

app.post('/api/upload/ministericon', uploadMinisterIcon.single('image'), (req, res) => {
  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  console.log('Minister icon uploaded:', req.file);
  res.json({ url: `http://localhost:${port}/uploads/ministericon/${req.file.filename}` });
});

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Image management
app.get('/api/images', (req, res) => {
  const directoryPath = path.join(__dirname, 'uploads/imageslider');
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to scan files' });
    }
    const images = files.map(file => ({ url: `http://localhost:${port}/uploads/imageslider/${file}` }));
    res.json(images);
  });
});

app.delete('/api/deleteImage/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', 'imageslider', filename);

  console.log('Attempting to delete file at:', filePath);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('File not found:', filePath);
      return res.status(404).json({ error: 'File not found' });
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
        return res.status(500).json({ error: 'Error deleting file' });
      }
      res.status(200).json({ message: 'File deleted successfully' });
    });
  });
});

app.get('/api/imageslider', (req, res) => {
  const directoryPath = path.join(__dirname, 'uploads/imageslider');
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to scan files!' });
    }
    const images = files.map(file => ({ url: `http://localhost:${port}/uploads/imageslider/${file}` }));
    res.json(images);
  });
});

// Route for ministers
app.post('/api/ministers', async (req, res) => {
  const { name, role, imageUrl } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO ministers (name, role, imageUrl) VALUES (?, ?, ?)', [name, role, imageUrl]);
    res.status(201).json({ message: 'Minister created successfully', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create minister' });
  }
});

app.get('/api/ministers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, role, imageUrl FROM ministers');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ministers' });
  }
});

app.delete('/api/minister/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await pool.query('SELECT imageUrl FROM ministers WHERE id = ?', [id]);
    if (results.length === 0) {
      return res.status(404).json({ error: 'Minister not found' });
    }

    const imageUrl = results[0].imageUrl;
    if (imageUrl) {
      const fileName = path.basename(imageUrl);
      const filePath = path.join(__dirname, 'uploads/ministericon', fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query('DELETE FROM ministers WHERE id = ?', [id]);
    res.json({ message: 'Minister and image deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete minister' });
  }
});
// VIsitor COunt
let visitorCount = 0;

app.get('/api/visitor-count', (req, res) => {
  res.json({ visitorCount });
});

// Increment the visitor count for demonstration
app.post('/api/increment-visitor', (req, res) => {
  visitorCount++;
  res.status(200).send('Visitor count incremented');
});


// User endpoints
app.post('/api/users', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [existingUser] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    res.status(201).json({ message: 'User created successfully', userId: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [user] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (user.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
    const passwordMatch = await bcrypt.compare(password, user[0].password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
    res.status(200).json({ success: true, message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, email FROM users');
    res.json(rows);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).send('Server error');
  }
});

// Notice endpoints
app.get('/api/notices', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM notices');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notices' });
  }
});

app.post('/api/notices', async (req, res) => {
  const { notice_date, notice_text } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO notices (notice_date, notice_text) VALUES (?, ?)', [notice_date, notice_text]);
    res.status(201).json({ message: 'Notice created successfully', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create notice' });
  }
});

app.delete('/api/notices/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM notices WHERE id = ?', [id]);
    res.json({ message: 'Notice deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete notice' });
  }
});

app.put('/api/notices/:id', async (req, res) => {
  const { id } = req.params;
  const { notice_date, notice_text } = req.body;
  try {
    await pool.query('UPDATE notices SET notice_date = ?, notice_text = ? WHERE id = ?', [notice_date, notice_text, id]);
    res.json({ message: 'Notice updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notice' });
  }
});
    


// Modules
app.get('/api/modules', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM modules');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});
app.get('/api/modules/:moduleId/schemes', async (req, res) => {
  const { moduleId } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM schemes WHERE module_id = ?', [moduleId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schemes' });
  }
});


// Fetch all modules
app.get('/api/modules', (req, res) => {
  connection.query('SELECT * FROM modules', (err, results) => {
    if (err) {
      console.error('Error fetching modules:', err);
      res.status(500).json({ error: 'Failed to fetch modules' });
      return;
    }
    res.json(results);
  });
});

// Fetch schemes by module ID
app.get('/api/modules/:moduleId/schemes', (req, res) => {
  const { moduleId } = req.params;
  connection.query('SELECT * FROM schemes WHERE module_id = ?', [moduleId], (err, results) => {
    if (err) {
      console.error('Error fetching schemes:', err);
      res.status(500).json({ error: 'Failed to fetch schemes' });
      return;
    }
    res.json(results);
  });
});

// Delete a scheme by ID
app.delete('/api/schemes/:id', async (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).send('Scheme ID is required');
  }

  const query = 'DELETE FROM schemes WHERE id = ?';
  
  try {
    const [result] = await pool.query(query, [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).send('Scheme not found');
    }
    
    res.status(200).send('Scheme deleted successfully');
  } catch (err) {
    console.error('Error deleting scheme:', err);
    res.status(500).send('Failed to delete scheme');
  }
});
// Update a scheme
app.put('/api/schemes/:schemeId', (req, res) => {
  const { schemeId } = req.params;
  const updatedScheme = req.body;

  const {
    name, description, funding, objective, beneficiary, eligibility,
    benefits, application, category, contact, application_form, pdf,
    application_acceptance_period, module_id
  } = updatedScheme;

  connection.query(
    `UPDATE schemes SET 
      name = ?, description = ?, funding = ?, objective = ?, beneficiary = ?,
      eligibility = ?, benefits = ?, application = ?, category = ?, contact = ?,
      application_form = ?, pdf = ?, application_acceptance_period = ?, module_id = ?
    WHERE id = ?`,
    [name, description, funding, objective, beneficiary, eligibility, benefits, 
    application, category, contact, application_form, pdf, application_acceptance_period,
    module_id, schemeId],
    (err, results) => {
      if (err) {
        console.error('Error updating scheme:', err);
        res.status(500).json({ error: 'Failed to update scheme' });
        return;
      }
      res.json({ message: 'Scheme updated successfully' });
    }
  );
});
app.post('/api/schemes', async (req, res) => {
  const {
    name,
    description,
    funding,
    objective,
    beneficiary,
    eligibility,
    benefits,
    application,
    category,
    contact,
    application_form,
    pdf,
    application_acceptance_period,
    moduleId
  } = req.body;

  if (!name || !description || !funding || !objective || !beneficiary || !eligibility || !benefits || !application || !category || !contact || !moduleId) {
    return res.status(400).json({ error: 'Please provide all required fields' });
  }

  const query = `
    INSERT INTO schemes (name, description, funding, objective, beneficiary, eligibility, benefits, application, category, contact, application_form, pdf, application_acceptance_period, module_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    name,
    description,
    funding,
    objective,
    beneficiary,
    eligibility,
    benefits,
    application,
    category,
    contact,
    application_form,
    pdf,
    application_acceptance_period,
    moduleId
  ];

  try {
    const [result] = await pool.query(query, values);
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add scheme' });
  }
});


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
