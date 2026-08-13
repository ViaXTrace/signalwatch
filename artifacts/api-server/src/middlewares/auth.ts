import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = userId;
  next();
}