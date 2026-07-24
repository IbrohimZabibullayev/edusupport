import cors from "cors";
import express, { Express, NextFunction, Request, Response } from "express";
import { requireAuth } from "./middleware/auth";
import { attachmentsRouter } from "./routes/attachments";
import { authRouter } from "./routes/auth";
import { modulesRouter } from "./routes/modules";
import { operatorsRouter } from "./routes/operators";
import { prioritiesRouter } from "./routes/priorities";
import { requestsRouter } from "./routes/requests";
import { requestTypesRouter } from "./routes/requestTypes";
import { schoolsRouter } from "./routes/schools";
import { supportLogsRouter } from "./routes/supportLogs";
import { statsRouter } from "./routes/stats";
import { systemsRouter } from "./routes/systems";
import { topicKeywordsRouter } from "./routes/topicKeywords";

export function createServer(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRouter);
  app.use("/api/stats", requireAuth, statsRouter);
  app.use("/api/requests", requireAuth, requestsRouter);
  app.use("/api/operators", requireAuth, operatorsRouter);
  app.use("/api/schools", requireAuth, schoolsRouter);
  app.use("/api/modules", requireAuth, modulesRouter);
  app.use("/api/attachments", requireAuth, attachmentsRouter);
  app.use("/api/systems", requireAuth, systemsRouter);
  app.use("/api/topic-keywords", requireAuth, topicKeywordsRouter);
  app.use("/api/request-types", requireAuth, requestTypesRouter);
  app.use("/api/priorities", requireAuth, prioritiesRouter);
  app.use("/api/support-logs", requireAuth, supportLogsRouter);

  app.use((_req, res) => res.status(404).json({ error: "Topilmadi" }));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("API xatosi:", err);
    res.status(500).json({ error: "Server xatosi" });
  });

  return app;
}
