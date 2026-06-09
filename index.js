const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ─── In-memory Database ───────────────────────────────────────────────────────
const users = {};    // { _id: { username, _id } }
const exercises = {} // { userId: [ { description, duration, date } ] }
let userCounter = 1;

function generateId() {
  return (userCounter++).toString(16).padStart(24, '0') +
    Math.random().toString(16).slice(2, 8);
}

// Parse "YYYY-MM-DD" sebagai local time, bukan UTC
function parseDateSafe(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d);
    }
  }
  return new Date(dateStr);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// POST /api/users — Create new user
app.post('/api/users', (req, res) => {
  const { username } = req.body;

  if (!username || username.trim() === '') {
    return res.json({ error: 'Username is required' });
  }

  const existingUser = Object.values(users).find(u => u.username === username);
  if (existingUser) {
    return res.json(existingUser);
  }

  const _id = generateId();
  const newUser = { username, _id };
  users[_id] = newUser;
  exercises[_id] = [];

  res.json(newUser);
});

// GET /api/users — Get all users
app.get('/api/users', (req, res) => {
  res.json(Object.values(users));
});

// POST /api/users/:_id/exercises — Add exercise
app.post('/api/users/:_id/exercises', (req, res) => {
  const { _id } = req.params;
  const { description, duration, date } = req.body;

  const user = users[_id];
  if (!user) return res.json({ error: 'User not found' });

  if (!description || !duration) {
    return res.json({ error: 'Description and duration are required' });
  }

  const durationNum = parseInt(duration);
  if (isNaN(durationNum)) {
    return res.json({ error: 'Duration must be a number' });
  }

  let exerciseDate;
  if (date && date.trim() !== '') {
    exerciseDate = parseDateSafe(date);
  } else {
    exerciseDate = new Date();
  }

  if (isNaN(exerciseDate.getTime())) {
    return res.json({ error: 'Invalid date' });
  }

  const exercise = {
    description,
    duration: durationNum,
    date: exerciseDate.toDateString() // "Mon Jan 01 1990"
  };

  exercises[_id].push(exercise);

  res.json({
    _id: user._id,
    username: user.username,
    description: exercise.description,
    duration: exercise.duration,
    date: exercise.date,
  });
});

// GET /api/users/:_id/logs — Get exercise log
app.get('/api/users/:_id/logs', (req, res) => {
  const { _id } = req.params;
  const { from, to, limit } = req.query;

  const user = users[_id];
  if (!user) return res.json({ error: 'User not found' });

  let log = [...(exercises[_id] || [])];

  if (from) {
    const fromDate = parseDateSafe(from);
    if (!isNaN(fromDate.getTime())) {
      log = log.filter(ex => new Date(ex.date) >= fromDate);
    }
  }

  if (to) {
    const toDate = parseDateSafe(to);
    if (!isNaN(toDate.getTime())) {
      log = log.filter(ex => new Date(ex.date) <= toDate);
    }
  }

  if (limit) {
    const limitNum = parseInt(limit);
    if (!isNaN(limitNum)) {
      log = log.slice(0, limitNum);
    }
  }

  res.json({
    _id: user._id,
    username: user.username,
    count: log.length, // jumlah log yang dikembalikan (setelah filter)
    log: log
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})