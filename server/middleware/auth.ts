import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const user = req.user as User;
  if (user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
}
