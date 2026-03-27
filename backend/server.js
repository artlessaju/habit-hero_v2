const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const Sentiment = require('sentiment');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const sentimentAnalyzer = new Sentiment();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Habit Hero Node Backend is Running!" });
});

// 1. REGISTER
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { username } });
    
    if (existingUser) return res.status(400).json({ detail: "Username already taken" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: { username, password: hashedPassword },
    });

    delete newUser.password;
    res.status(200).json(newUser);
  } catch (error) {
    res.status(500).json({ detail: "Server error" });
  }
});

// 2. LOGIN
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const dbUser = await prisma.user.findUnique({ where: { username } });
    
    if (!dbUser || !(await bcrypt.compare(password, dbUser.password))) {
      return res.status(400).json({ detail: "Invalid credentials" });
    }

    res.status(200).json({ status: "success", user_id: dbUser.id, username: dbUser.username });
  } catch (error) {
    res.status(500).json({ detail: "Server error" });
  }
});

// 3. CREATE HABIT
app.post("/habits", async (req, res) => {
  try {
    const { name, category, frequency, start_date } = req.body;
    const userId = parseInt(req.query.user_id); // Extracted from Axios query param!

    const newHabit = await prisma.habit.create({
      data: { name, category, frequency, start_date, user_id: userId },
    });
    res.status(200).json(newHabit);
  } catch (error) {
    res.status(500).json({ detail: "Server error" });
  }
});

// 4. GET HABITS (With nested logs for the Recharts!)
app.get("/habits/:user_id", async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id);
    const habits = await prisma.habit.findMany({
      where: { user_id: userId },
      include: { logs: true } 
    });
    res.status(200).json(habits);
  } catch (error) {
    res.status(500).json({ detail: "Server error" });
  }
});

// 5. LOG HABIT (AI Sentiment swapped to Node)
app.post("/habits/:habit_id/log", async (req, res) => {
  try {
    const habitId = parseInt(req.params.habit_id);
    const { date, status, note } = req.body;

    let sentimentLabel = "Neutral";
    
    if (note) {
      const result = sentimentAnalyzer.analyze(note);
      const aiScore = result.comparative; 

      if (aiScore > 0.3) sentimentLabel = "Positive";
      else if (aiScore < -0.3) sentimentLabel = "Negative";
    }

    await prisma.habitLog.create({
      data: { date, status, note, sentiment: sentimentLabel, habit_id: habitId }
    });

    res.status(200).json({ status: "logged", sentiment: sentimentLabel });
  } catch (error) {
    res.status(500).json({ detail: "Server error" });
  }
});

// 6. DELETE HABIT
app.delete("/habits/:habit_id", async (req, res) => {
  try {
    const habitId = parseInt(req.params.habit_id);
    await prisma.habit.delete({ where: { id: habitId } });
    res.status(200).json({ status: "deleted" });
  } catch (error) {
    res.status(500).json({ detail: "Server error" });
  }
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`🚀 Habit Hero Node Backend running on port ${PORT}`);
});