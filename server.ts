import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.APP_URL}/auth/callback`;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  app.use(express.json());
  app.use(cookieParser());

  const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  // --- Google OAuth Routes ---
  app.get("/api/auth/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/userinfo.email"],
      prompt: "consent",
    });
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      res.cookie("google_tokens", JSON.stringify(tokens), {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>인증 성공! 이 창은 자동으로 닫힙니다.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("OAuth Error:", error);
      res.status(500).send("인증 실패");
    }
  });

  // --- Google Sheets API Helpers ---
  const getSheets = (tokens: any) => {
    const auth = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    auth.setCredentials(tokens);
    return google.sheets({ version: "v4", auth });
  };

  // --- App Logic Routes ---
  app.get("/api/settings", async (req, res) => {
    // In a real app, this would come from a 'Settings' sheet. 
    // For now, we'll provide a default that can be overridden by env.
    res.json({
      currencyName: process.env.CURRENCY_NAME || "보석",
      weeklyAllowanceDay: "Monday"
    });
  });

  app.get("/api/students", async (req, res) => {
    const tokens = req.cookies.google_tokens ? JSON.parse(req.cookies.google_tokens) : null;
    if (!tokens || !SHEET_ID) return res.status(401).json({ error: "Unauthorized or Sheet ID missing" });

    try {
      const sheets = getSheets(tokens);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: "Students!A2:G50", // Name, Balance, AvatarURL, Certificates, BaseAllowance, Password, PetData
      }).catch(() => null);

      if (response && response.data.values) {
        const studentList = response.data.values.map(row => ({
          name: row[0],
          balance: parseInt(row[1] || "0"),
          avatarUrl: row[2] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row[0]}`,
          certificates: row[3] ? row[3].split(",") : [],
          allowance: parseInt(row[4] || "0"),
          password: row[5] || "1234",
          petData: row[6] ? JSON.parse(row[6]) : { stage: "egg", level: 1, exp: 0, hunger: 50, thirst: 50, lastInteraction: Date.now() }
        }));
        return res.json(studentList);
      }
      res.json([]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  app.post("/api/admin/bulk-reward", async (req, res) => {
    const { amount, reason } = req.body;
    const tokens = req.cookies.google_tokens ? JSON.parse(req.cookies.google_tokens) : null;
    if (!tokens || !SHEET_ID) return res.status(401).json({ error: "Unauthorized" });

    try {
      const sheets = getSheets(tokens);
      
      // 1. Get current students to update balances
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: "Students!A2:G50", // Include PetData column
      });

      const rows = response.data.values;
      if (!rows) return res.status(404).json({ error: "No students found" });

      // 2. Update balances in memory and prepare for write-back
      const updatedRows = rows.map(row => {
        const currentBalance = parseInt(row[1] || "0");
        const allowance = parseInt(row[4] || "0");
        // If amount is 0, it's a "Weekly Allowance" trigger
        const addAmount = amount === 0 ? allowance : amount;
        row[1] = (currentBalance + addAmount).toString();
        return row;
      });

      // 3. Write back to Students sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: "Students!A2:G50",
        valueInputOption: "RAW",
        requestBody: { values: updatedRows },
      });

      // 4. Log the transaction
      const timestamp = new Date().toISOString();
      const logEntries = rows.map(row => [timestamp, row[0], amount === 0 ? row[4] : amount, reason]);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: "Logs!A2",
        valueInputOption: "RAW",
        requestBody: { values: logEntries },
      });

      const message = amount === 0 
        ? "주간 수당이 모든 학생에게 지급되었습니다!" 
        : `일괄 보상: 모든 학생에게 ${amount} 보석이 지급되었습니다! (${reason})`;
        
      io.emit("notification", { message });
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to process bulk reward" });
    }
  });


  // --- Socket.io Logic ---
  let currentAuction: any = null;
  let stocks = [
    { id: "AAPL", name: "애플 (Apple)", price: 25.0, change: 0 },
    { id: "SS", name: "삼성전자", price: 7.0, change: 0 },
    { id: "TSLA", name: "테슬라 (Tesla)", price: 32.0, change: 0 },
    { id: "DIS", name: "디즈니 (Disney)", price: 11.0, change: 0 },
    { id: "RBLX", name: "로블록스 (Roblox)", price: 4.5, change: 0 },
    { id: "NTDOY", name: "닌텐도 (Nintendo)", price: 6.5, change: 0 },
    { id: "GOOGL", name: "구글 (Google)", price: 18.0, change: 0 },
    { id: "MSFT", name: "마이크로소프트", price: 42.0, change: 0 },
    { id: "NVDA", name: "엔비디아 (NVIDIA)", price: 85.0, change: 0 },
    { id: "KEPCO", name: "한국전력 (전력주)", price: 2.2, change: 0 },
  ];

  const newsTemplates = [
    { text: "애플의 새로운 아이폰이 대박이 났어요! 🍎", target: "AAPL", impact: 0.05 },
    { text: "삼성전자가 새로운 반도체 칩을 개발했습니다! ⚡", target: "SS", impact: 0.04 },
    { text: "테슬라의 자율주행 기술이 한 단계 진화했습니다! 🚗", target: "TSLA", impact: 0.06 },
    { text: "디즈니랜드에 새로운 테마파크가 문을 열었어요! 🏰", target: "DIS", impact: 0.03 },
    { text: "로블록스 사용자가 역대 최고치를 기록했습니다! 🎮", target: "RBLX", impact: 0.05 },
    { text: "닌텐도의 신작 게임이 전 세계적으로 인기입니다! 🍄", target: "NTDOY", impact: 0.04 },
    { text: "엔비디아의 AI 칩 수요가 폭발적입니다! 🤖", target: "NVDA", impact: 0.07 },
    { text: "전기 요금 인상 소식에 전력주가 들썩입니다! 💡", target: "KEPCO", impact: 0.03 },
    { text: "구글의 새로운 AI 모델이 발표되었습니다! 🔍", target: "GOOGL", impact: 0.04 },
    { text: "마이크로소프트의 클라우드 매출이 급증했습니다! ☁️", target: "MSFT", impact: 0.05 },
    { text: "닌텐도의 새로운 게임기가 유출되었습니다! 🎮", target: "NTDOY", impact: 0.06 },
    { text: "로블록스 사용자가 역대 최고치를 기록했습니다! 🧱", target: "RBLX", impact: 0.04 },
    { text: "디즈니랜드의 새로운 테마파크가 인기를 끌고 있습니다! 🏰", target: "DIS", impact: 0.03 },
    { text: "테슬라의 자율주행 기술이 큰 진전을 보였습니다! 🚗", target: "TSLA", impact: 0.05 },
    { text: "전 세계 경제가 활기를 띠고 있습니다! 📈", target: "ALL", impact: 0.02 },
    { text: "금리가 인하될 가능성이 높아지며 시장이 환호합니다! 🎊", target: "ALL", impact: 0.03 },
  ];

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.emit("stocks:update", stocks);
    socket.emit("news:update", "오늘의 경제 소식: 시장이 평온합니다. ☕");
    if (currentAuction) socket.emit("auction:start", currentAuction);

    socket.on("auction:bid", (data) => {
      if (currentAuction && data.amount > currentAuction.currentBid) {
        currentAuction.currentBid = data.amount;
        currentAuction.highestBidder = data.bidder;
        io.emit("auction:update", currentAuction);
      }
    });

    socket.on("admin:auction:start", (item) => {
      currentAuction = { ...item, currentBid: item.startPrice, highestBidder: null, endTime: Date.now() + 60000 };
      io.emit("auction:start", currentAuction);
    });
  });

  // Update stocks and news every 30 seconds
  setInterval(() => {
    const newsItem = newsTemplates[Math.floor(Math.random() * newsTemplates.length)];
    
    stocks = stocks.map(s => {
      // Base fluctuation: -2% to +2%
      let changePercent = (Math.random() * 4 - 2) / 100;
      
      // Apply news impact
      if (newsItem.target === "ALL" || newsItem.target === s.id) {
        changePercent += newsItem.impact;
      }

      const newPrice = Math.max(0.1, s.price * (1 + changePercent));
      return {
        ...s,
        change: parseFloat((changePercent * 100).toFixed(2)),
        price: parseFloat(newPrice.toFixed(2))
      };
    });

    io.emit("stocks:update", stocks);
    io.emit("news:update", newsItem.text);
  }, 30000);

  app.post("/api/pet/update", async (req, res) => {
    const { studentName, petData, balanceChange } = req.body;
    const tokens = req.cookies.google_tokens ? JSON.parse(req.cookies.google_tokens) : null;
    if (!tokens || !SHEET_ID) return res.status(401).json({ error: "Unauthorized" });

    try {
      const sheets = getSheets(tokens);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: "Students!A2:G50",
      });

      const rows = response.data.values;
      if (!rows) return res.status(404).json({ error: "No students found" });

      const rowIndex = rows.findIndex(row => row[0] === studentName);
      if (rowIndex === -1) return res.status(404).json({ error: "Student not found" });

      const row = rows[rowIndex];
      if (balanceChange) {
        row[1] = (parseInt(row[1] || "0") + balanceChange).toString();
      }
      row[6] = JSON.stringify(petData);

      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Students!A${rowIndex + 2}:G${rowIndex + 2}`,
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      });

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update pet data" });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
