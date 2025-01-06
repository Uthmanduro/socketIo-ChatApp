const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

async function main() {
  const db = await open({
    filename: "chat.db",
    driver: sqlite3.Database,
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_offset TEXT UNIQUE,
      content TEXT
    );
  `);

  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    connectionStateRecovery: {},
  });

  app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
  });

  io.on("connection", async (socket) => {
    console.log("User connected");
    socket.broadcast.emit("hi", "new user joined the chat");

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });

    socket.on("chat message", (msg) => {
      console.log("message: " + msg);
      let result;
      try {
        result = db.exec("INSERT INTO messages (content) VALUES (?)", msg);
      } catch (error) {
        console.log(error);
      }
      io.emit("chat message", msg, result.lastId);
    });

    if (!socket.recovered) {
      // if the connection state recovery was not successful
      try {
        await db.each(
          "SELECT id, content FROM messages WHERE id > ?",
          [socket.handshake.auth.serverOffset || 0],
          (_err, row) => {
            socket.emit("chat message", row.content, row.id);
          }
        );
      } catch (e) {
        // something went wrong
      }
    }
  });

  server.listen(3000, () => console.log("Server is listening on port 3000"));
}

main();
