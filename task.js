// routes/tasks.js
const express = require("express");
const router = express.Router();

module.exports = (db) => {
  // ✅ Get all tasks
  router.get("/", async (req, res) => {
    try {
      const [rows] = await db.query(
        "SELECT * FROM tasks ORDER BY due_date ASC"
      );
      res.json(rows);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ✅ Add new task
  router.post("/add", async (req, res) => {
    try {
      const { title, due_date } = req.body;
      if (!title || !due_date) {
        return res.status(400).json({ error: "Title and due_date required" });
      }

      const [result] = await db.query(
        "INSERT INTO tasks (title, due_date, completed, created_at, updated_at) VALUES (?, ?, false, NOW(), NOW())",
        [title, due_date]
      );

      res.json({
        id: result.insertId,
        title,
        due_date,
        completed: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch (error) {
      console.error("Error adding task:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ✅ Update task (title, date, or completed status)
  router.put("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { title, due_date, completed } = req.body;

      const [result] = await db.query(
        "UPDATE tasks SET title = ?, due_date = ?, completed = ?, updated_at = NOW() WHERE id = ?",
        [title, due_date, completed, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json({ success: true, message: "Task updated" });
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // ✅ Delete task
  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [result] = await db.query("DELETE FROM tasks WHERE id = ?", [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json({ success: true, message: "Task deleted" });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  return router;
};
