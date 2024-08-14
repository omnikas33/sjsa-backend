// user.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');

const User = {};

User.findByUsername = async (username) => {
  try {
    const sql = 'SELECT * FROM users WHERE username = ?';
    const [rows, fields] = await db.execute(sql, [username]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error in findByUsername:', error);
    throw error; // Propagate the error for centralized error handling
  }
};

User.createUser = async (username, password) => {
  try {
    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
    const [result] = await db.execute(sql, [username, hashedPassword]);
    return result.insertId; // Return the ID of the newly created user
  } catch (error) {
    console.error('Error in createUser:', error);
    throw error;
  }
};

module.exports = User;
