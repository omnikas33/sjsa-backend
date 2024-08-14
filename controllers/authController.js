const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.register = (req, res) => {
  const userData = {
    username: req.body.username,
    password: req.body.password
  };

  User.create(userData, (err, result) => {
    if (err) return res.status(500).send('Server error');
    res.status(201).send('User registered');
  });
};

exports.login = (req, res) => {
  const { username, password } = req.body;

  User.findByUsername(username, (err, results) => {
    if (err) return res.status(500).send('Server error');
    if (results.length === 0) return res.status(404).send('User not found');

    const user = results[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) throw err;
      if (!isMatch) return res.status(401).send('Invalid password');

      const token = jwt.sign({ id: user.id }, 'your_jwt_secret', { expiresIn: '1h' });
      res.status(200).json({ token });
    });
  });
};
