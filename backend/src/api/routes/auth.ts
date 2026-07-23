import { Router } from "express";
import jwt from "jsonwebtoken";
import { config } from "../../config";
import { safeEquals } from "../../util";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { login, password } = req.body ?? {};
  if (typeof login !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Login va parol talab qilinadi" });
    return;
  }
  if (!safeEquals(login, config.adminLogin) || !safeEquals(password, config.adminPassword)) {
    res.status(401).json({ error: "Login yoki parol noto'g'ri" });
    return;
  }
  const token = jwt.sign({ sub: "admin", role: "admin" }, config.jwtSecret, { expiresIn: "7d" });
  res.json({ token });
});
