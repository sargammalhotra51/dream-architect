// backend/server.js
const express = require("express");
const cors = require("cors");


require("dotenv").config();
const path = require("path");

const pool = require("./config/db").default || require("./config/db");
const { decomposeGoal } = require("./utils/decomposer");

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend folder
app.use(express.static(path.join(__dirname, "../frontend")));


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});


app.get("/api/health", (req, res) => res.json({ ok: true }));

// Generate plan: inserts goal, milestones, tasks into DB and returns plan
app.post("/api/generate-plan", async (req, res) => {
  try {
    const { title, description = "", targetDate, hoursPerWeek = 5 } = req.body;

    if (!title || !targetDate) {
      return res.status(400).json({ error: "title and targetDate required" });
    }

    // Insert goal
    const insertGoal = await pool.query(
      "INSERT INTO goals (title, description, deadline) VALUES ($1, $2, $3) RETURNING id",
      [title, description, targetDate]
    );
    const goalId = insertGoal.rows[0].id;

    // Generate plan using decomposer
    const plan = await decomposeGoal({ title, targetDate, hoursPerWeek });

    // Persist milestones and tasks inside a transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const m of plan.milestones) {
        
        const msRes = await client.query(
          `INSERT INTO milestones (goal_id, title, target_date, progress)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [goalId, m.title, m.end_date, 0] // use end_date as target_date
        );

        const milestoneId = msRes.rows[0].id;

        
        for (const t of m.tasks) {
          await client.query(
            `INSERT INTO tasks (milestone_id, task_name, is_completed)
             VALUES ($1, $2, $3)`,
            [milestoneId, t.title, false]
          );
        }
      }

      await client.query("COMMIT");
      return res.json(plan);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Transaction error", err);
      return res.status(500).json({ error: "DB transaction failed" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Server error", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// Get goal with milestones + tasks
app.get("/api/goals/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const goalRes = await pool.query("SELECT * FROM goals WHERE id=$1", [id]);
    if (goalRes.rows.length === 0)
      return res.status(404).json({ error: "Goal not found" });

    const goal = goalRes.rows[0];

    const miles = await pool.query(
      "SELECT * FROM milestones WHERE goal_id=$1 ORDER BY id",
      [id]
    );

    const milestones = await Promise.all(
      miles.rows.map(async (m) => {
        const t = await pool.query(
          "SELECT * FROM tasks WHERE milestone_id=$1 ORDER BY id",
          [m.id]
        );
        return { ...m, tasks: t.rows };
      })
    );

    res.json({ goal, milestones });
  } catch (err) {
    console.error("Server error", err);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
