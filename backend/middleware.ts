import jwt from "jsonwebtoken";

export function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.token;
  if (typeof token !== "string") return res.status(403).json({ message: "token not found" });
  try {
    const decoded = jwt.verify(token, "Secret123");
    if (typeof decoded === "string" || typeof decoded.id !== "string") {
      return res.status(403).json({ message: "invalid token" });
    }
    req.userId = decoded.id;
  } catch {
    return res.status(403).json({ message: "invalid token" });
  }
  next();
}
