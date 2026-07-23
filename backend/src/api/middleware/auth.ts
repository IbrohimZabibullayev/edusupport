import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../../config";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Avtorizatsiya talab qilinadi" });
    return;
  }
  try {
    jwt.verify(header.slice(7), config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: "Token yaroqsiz yoki muddati tugagan" });
  }
}
